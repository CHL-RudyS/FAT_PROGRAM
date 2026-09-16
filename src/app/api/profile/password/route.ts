import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const schema = z
  .object({
    current: z.string().min(1, "Kata sandi lama harus diisi."),
    next: z
      .string()
      .min(8, "Kata sandi baru minimal 8 karakter.")
      .max(200)
      .regex(/[A-Za-z]/, "Kata sandi baru harus memuat huruf dan angka.")
      .regex(/\d/, "Kata sandi baru harus memuat huruf dan angka."),
    confirm: z.string().min(1, "Konfirmasi kata sandi harus diisi."),
  })
  .refine((value) => value.next === value.confirm, {
    message: "Konfirmasi kata sandi tidak sama.",
    path: ["confirm"],
  });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: issue?.message ?? "Data tidak valid.", field: issue?.path.join(".") }, { status: 400 });
    }

    const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(parsed.data.current, record.passwordHash))) {
      return NextResponse.json({ error: "Kata sandi lama tidak cocok.", field: "current" }, { status: 422 });
    }

    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });

    // The prototype ends every other device's session on a password change.
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const session = token ? await verifySession(token) : null;
    await db.session.updateMany({
      where: { userId: user.id, revokedAt: null, ...(session ? { NOT: { tokenId: session.tokenId } } : {}) },
      data: { revokedAt: new Date() },
    });

    await db.auditLog.create({
      data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, summary: "Ubah kata sandi dan akhiri sesi lain" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
