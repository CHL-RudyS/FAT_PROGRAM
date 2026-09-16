import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { generateSchedule } from "./schedule";

const createSchema = z.object({
  code: z.string().trim().min(1, "Kode aset harus diisi.").max(24),
  name: z.string().trim().min(1, "Nama aset harus diisi.").max(180),
  group: z.string().trim().min(1, "Kelompok harus dipilih.").max(60),
  acquisitionDate: z.string().trim().min(1, "Tanggal perolehan harus diisi."),
  acquisitionCost: z.number().min(1, "Nilai perolehan harus diisi."),
  residualValue: z.number().min(0).default(0),
  usefulLifeMonths: z.number().int().min(1, "Masa manfaat harus diisi.").max(600),
  unitId: z.string().trim().min(1).optional(),
  assetAccountId: z.string().trim().min(1, "Akun aset harus dipilih."),
  depreciationAccountId: z.string().trim().min(1, "Akun beban penyusutan harus dipilih."),
  withSchedule: z.boolean().default(false),
});

export async function GET() {
  return handleRead(async (context) => {
    const assets = await db.fixedAsset.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      include: { depreciations: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] } },
    });
    return NextResponse.json(assets);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const duplicate = await db.fixedAsset.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: body.code } },
      select: { id: true },
    });
    if (duplicate) rule("Kode aset sudah dipakai.");

    if (body.residualValue >= body.acquisitionCost) {
      rule("Nilai residu harus lebih kecil dari nilai perolehan.");
    }

    const unitId = body.unitId ?? context.unitId;
    const unit = await db.businessUnit.findFirst({
      where: { id: unitId, companyId: context.companyId },
      select: { id: true, code: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan di perusahaan aktif.");

    const acquisitionDate = new Date(`${body.acquisitionDate.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(acquisitionDate.getTime())) rule("Tanggal perolehan tidak valid.");

    const accounts = await db.account.findMany({
      where: { companyId: context.companyId, id: { in: [body.assetAccountId, body.depreciationAccountId] } },
      select: { id: true, code: true },
    });
    if (accounts.length !== new Set([body.assetAccountId, body.depreciationAccountId]).size) {
      rule("Akun tidak ditemukan di bagan akun perusahaan aktif.");
    }

    const asset = await db.fixedAsset.create({
      data: {
        companyId: context.companyId,
        unitId: unit.id,
        code: body.code,
        name: body.name,
        group: body.group,
        acquisitionDate,
        acquisitionCost: body.acquisitionCost,
        residualValue: body.residualValue,
        usefulLifeMonths: body.usefulLifeMonths,
        method: "GARIS_LURUS",
        status: "AKTIF",
      },
    });

    const scheduled = body.withSchedule ? await generateSchedule(asset) : 0;

    await recordAudit(context, {
      action: "CREATE",
      entityType: "FixedAsset",
      entityId: asset.id,
      summary: `Tambah aset ${asset.code} · ${asset.name} (buku ${unit.code})`,
      changes: {
        acquisitionCost: body.acquisitionCost,
        residualValue: body.residualValue,
        usefulLifeMonths: body.usefulLifeMonths,
        assetAccount: accounts.find((item) => item.id === body.assetAccountId)?.code,
        depreciationAccount: accounts.find((item) => item.id === body.depreciationAccountId)?.code,
        scheduledPeriods: scheduled,
      },
    });

    return NextResponse.json({ ...asset, scheduledPeriods: scheduled }, { status: 201 });
  });
}
