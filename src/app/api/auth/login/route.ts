import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

const schema = z.object({
  email: z.string().min(1).max(160),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    return await signIn(request);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Layanan sedang bermasalah. Coba lagi." }, { status: 500 });
  }
}

async function signIn(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email dan kata sandi harus diisi." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    include: { role: true },
  });

  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
  }
  if (user.status !== "AKTIF") {
    return NextResponse.json({ error: "Akun ini tidak aktif. Hubungi Admin." }, { status: 403 });
  }

  await createSession(user.id, user.role.code);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await db.auditLog.create({
    data: { userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, summary: "Masuk ke sistem" },
  });

  return NextResponse.json({ ok: true });
}
