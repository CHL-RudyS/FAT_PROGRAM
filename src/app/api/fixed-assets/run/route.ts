import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { MONTHS_ID } from "@/lib/format";
import { runDepreciation } from "../schedule";

const runSchema = z.object({
  year: z.number().int().min(2000, "Tahun tidak valid.").max(2100),
  month: z.number().int().min(1, "Bulan tidak valid.").max(12),
  unitId: z.string().trim().min(1).optional(),
});

/**
 * Menjalankan penyusutan satu periode untuk satu buku unit.
 * Idempoten: unique (assetId, periodYear, periodMonth) membuat pengulangan
 * tidak menggandakan baris maupun menggeser akumulasi.
 */
export async function POST(request: Request) {
  return handle(request, runSchema, async ({ body, context }) => {
    const unitId = body.unitId ?? context.unitId;
    const unit = await db.businessUnit.findFirst({
      where: { id: unitId, companyId: context.companyId },
      select: { id: true, code: true, name: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan di perusahaan aktif.");

    const period = await db.fiscalPeriod.findUnique({
      where: {
        companyId_year_month: { companyId: context.companyId, year: body.year, month: body.month },
      },
      select: { status: true },
    });
    if (period && period.status !== "TERBUKA") {
      rule(
        `Periode ${MONTHS_ID[body.month - 1]} ${body.year} sudah ${
          period.status === "DITUTUP" ? "ditutup" : "dikunci"
        }. Penyusutan tidak bisa dijalankan ke periode ini.`,
      );
    }

    const result = await runDepreciation({
      companyId: context.companyId,
      unitId: unit!.id,
      year: body.year,
      month: body.month,
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "DepreciationEntry",
      summary: `Jalankan penyusutan ${MONTHS_ID[body.month - 1]} ${body.year} · buku ${unit!.code}`,
      changes: { assets: result.assets, entries: result.entries, expense: result.expense },
    });

    return NextResponse.json(result, { status: 201 });
  });
}
