import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { can, hashPassword } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama pengguna harus diisi.").max(180),
  email: z.string().trim().email("Format email tidak valid."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
  roleId: z.string().trim().min(1, "Peran harus dipilih."),
  jobTitle: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(["AKTIF", "NONAKTIF", "DIKUNCI"]).default("AKTIF"),
  unitIds: z.array(z.string().trim().min(1)).optional(),
});

export async function GET() {
  return handleRead(async (context) => {
    if (!can(context.user, "pengguna.kelola")) rule("Tidak diizinkan melihat daftar pengguna.");

    const users = await db.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        jobTitle: true,
        lastLoginAt: true,
        role: { select: { id: true, code: true, name: true } },
        unitAccess: { select: { unitId: true } },
      },
    });
    return NextResponse.json(users);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    if (!can(context.user, "pengguna.kelola")) {
      rule("Hanya Administrator yang bisa menambah pengguna.");
    }

    if (!/[a-zA-Z]/.test(body.password) || !/\d/.test(body.password)) {
      rule("Kata sandi harus berisi huruf dan angka.");
    }

    const email = body.email.toLowerCase();
    const duplicate = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (duplicate) rule("Email ini sudah terdaftar.");

    const role = await db.role.findUnique({ where: { id: body.roleId }, select: { id: true, name: true } });
    if (!role) rule("Peran tidak ditemukan.");

    const units = body.unitIds?.length
      ? await db.businessUnit.findMany({ where: { id: { in: body.unitIds } }, select: { id: true } })
      : [];

    const user = await db.user.create({
      data: {
        name: body.name,
        email,
        passwordHash: await hashPassword(body.password),
        roleId: role.id,
        jobTitle: body.jobTitle || null,
        phone: body.phone || null,
        status: body.status,
        unitAccess: units.length ? { create: units.map((unit) => ({ unitId: unit.id })) } : undefined,
      },
      select: { id: true, name: true, email: true, status: true },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      summary: `Tambah pengguna ${user.name} · ${role.name}`,
      changes: { after: { email: user.email, role: role.name, units: units.length } },
    });

    return NextResponse.json(user, { status: 201 });
  });
}
