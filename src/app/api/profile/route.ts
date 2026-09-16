import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const schema = z.object({
  name: z.string().trim().min(1, "Nama lengkap harus diisi.").max(180),
  jobTitle: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  locale: z.enum(["ID", "EN"]),
  preferences: z
    .object({
      startScreen: z.string().max(60).optional(),
      density: z.string().max(30).optional(),
      dateFormat: z.string().max(30).optional(),
      emailNotifications: z.array(z.string().max(60)).max(20).optional(),
    })
    .optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: issue?.message ?? "Data tidak valid.", field: issue?.path.join(".") }, { status: 400 });
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name,
        jobTitle: parsed.data.jobTitle || null,
        phone: parsed.data.phone || null,
        locale: parsed.data.locale,
      },
    });

    if (parsed.data.preferences) {
      await db.systemSetting.upsert({
        where: { key: `prefs:${user.id}` },
        update: { value: parsed.data.preferences },
        create: { key: `prefs:${user.id}`, value: parsed.data.preferences },
      });
    }

    await db.auditLog.create({
      data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, summary: "Perbarui profil & preferensi" },
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
