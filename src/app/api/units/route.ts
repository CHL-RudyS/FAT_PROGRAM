import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { can } from "@/lib/auth";

const createSchema = z.object({
  code: z.string().trim().min(1, "Kode unit harus diisi.").max(4, "Kode unit maksimal 4 huruf."),
  name: z.string().trim().min(1, "Nama cabang harus diisi.").max(180),
  city: z.string().trim().max(180).optional(),
});

export async function GET() {
  return handleRead(async (context) => {
    const units = await db.businessUnit.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, address: true, isActive: true, needsWork: true, hasVariance: true },
    });
    return NextResponse.json(units);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    if (!can(context.user, "setelan.kelola")) {
      rule("Hanya Administrator yang bisa membuat unit bisnis.");
    }

    const code = body.code.toUpperCase();
    const duplicate = await db.businessUnit.findUnique({
      where: { companyId_code: { companyId: context.companyId, code } },
      select: { id: true },
    });
    if (duplicate) rule("Kode unit sudah dipakai di entitas ini.");

    const unit = await db.businessUnit.create({
      data: {
        companyId: context.companyId,
        code,
        name: body.name,
        address: body.city || null,
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "BusinessUnit",
      entityId: unit.id,
      summary: `Tambah unit bisnis ${unit.code} · ${unit.name}`,
    });

    return NextResponse.json(unit, { status: 201 });
  });
}
