import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { can } from "@/lib/auth";

const directorSchema = z.object({
  position: z.string().trim().min(1, "Jabatan pengurus harus diisi.").max(60),
  name: z.string().trim().min(1, "Nama pengurus harus diisi.").max(180),
  nik: z.string().trim().max(24).optional(),
  npwp: z.string().trim().max(32).optional(),
  address: z.string().trim().max(400).optional(),
  startDate: z.string().trim().optional(),
});

const createSchema = z.object({
  kind: z.enum(["PERUSAHAAN", "ENTITAS"]),
  legalForm: z.string().trim().min(1, "Inisial harus dipilih.").max(24),
  name: z.string().trim().min(1, "Nama harus diisi.").max(180),
  address: z.string().trim().min(1, "Alamat harus diisi.").max(400),
  postalCode: z.string().trim().max(10).optional(),
  phone: z.string().trim().max(40).optional(),
  npwp: z.string().trim().max(32).optional(),
  industry: z.string().trim().max(120).optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
  colorTag: z.string().trim().max(16).optional(),
  directors: z.array(directorSchema).max(24).optional(),
});

/** Company.code is not asked for in the prototype form — derive it from the name. */
async function uniqueCode(name: string) {
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const base = (letters.map((word) => word[0]).join("") || "ENT").slice(0, 4);

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const taken = await db.company.findUnique({ where: { code: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  rule("Kode entitas tidak bisa dibuat otomatis — ubah namanya.");
}

export async function GET() {
  return handleRead(async () => {
    const companies = await db.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        npwp: true,
        industry: true,
        legalForm: true,
        colorTag: true,
        isActive: true,
        _count: { select: { units: true } },
      },
    });
    return NextResponse.json(
      companies.map(({ _count, ...company }) => ({ ...company, unitCount: _count.units })),
    );
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    if (!can(context.user, "setelan.kelola")) {
      rule("Hanya Administrator yang bisa menambah perusahaan atau entitas.");
    }

    const duplicate = await db.company.findFirst({
      where: { name: { equals: body.name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) rule("Nama entitas sudah terdaftar.");

    if (body.npwp) {
      const npwpTaken = await db.company.findFirst({
        where: { npwp: body.npwp },
        select: { id: true },
      });
      if (npwpTaken) rule("NPWP sudah dipakai entitas lain.");
    }

    if (body.parentId) {
      const parent = await db.company.findUnique({ where: { id: body.parentId }, select: { id: true } });
      if (!parent) rule("Entitas induk tidak ditemukan.");
    }

    const code = await uniqueCode(body.name);

    const company = await db.company.create({
      data: {
        code,
        name: body.name,
        kind: body.kind,
        parentId: body.parentId ?? null,
        legalForm: body.legalForm,
        npwp: body.npwp || null,
        industry: body.industry || null,
        address: body.address,
        postalCode: body.postalCode || null,
        phone: body.phone || null,
        colorTag: body.colorTag || null,
        directors: body.directors?.length
          ? {
              create: body.directors.map((director) => ({
                position: director.position,
                name: director.name,
                nik: director.nik || null,
                npwp: director.npwp || null,
                address: director.address || null,
                startDate: director.startDate ? new Date(director.startDate) : null,
              })),
            }
          : undefined,
      },
      include: { directors: true },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "Company",
      entityId: company.id,
      summary: `Tambah ${body.kind === "ENTITAS" ? "entitas" : "perusahaan"} ${company.legalForm} ${company.name}`,
      changes: { after: { code: company.code, name: company.name, kind: company.kind, directors: company.directors.length } },
    });

    return NextResponse.json(company, { status: 201 });
  });
}
