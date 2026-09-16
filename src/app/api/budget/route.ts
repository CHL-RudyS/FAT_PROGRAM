import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";

const saveSchema = z.object({
  year: z.number().int().min(2000, "Tahun anggaran tidak valid.").max(2100),
  unitId: z.string().trim().min(1).optional(),
  basis: z.string().trim().max(60).optional(),
  increasePercent: z.number().min(-100).max(1000).default(0),
  detail: z.string().trim().max(60).optional(),
  note: z.string().trim().max(1000).optional(),
  submit: z.boolean().default(false),
  lines: z
    .array(
      z.object({
        accountId: z.string().trim().min(1),
        budget: z.number().min(0, "Anggaran tidak boleh negatif."),
      }),
    )
    .min(1, "Isi anggaran minimal satu akun."),
});

export async function GET(request: Request) {
  return handleRead(async (context) => {
    const url = new URL(request.url);
    const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
    const unitId = url.searchParams.get("unitId") ?? undefined;

    const lines = await db.budgetLine.findMany({
      where: { companyId: context.companyId, year, ...(unitId ? { unitId } : {}) },
      orderBy: { account: { code: "asc" } },
      include: { account: { select: { id: true, code: true, name: true, type: true, normalBalance: true } } },
    });
    return NextResponse.json(lines);
  });
}

/**
 * Menyimpan anggaran tahunan per akun untuk satu buku unit.
 * Baris tahunan disimpan dengan `month = null`; baris yang sudah ada diperbarui
 * supaya penyusunan ulang tidak menggandakan anggaran.
 */
export async function POST(request: Request) {
  return handle(request, saveSchema, async ({ body, context }) => {
    const unitId = body.unitId ?? context.unitId;
    const unit = await db.businessUnit.findFirst({
      where: { id: unitId, companyId: context.companyId },
      select: { id: true, code: true, name: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan di perusahaan aktif.");

    const accountIds = Array.from(new Set(body.lines.map((line) => line.accountId)));
    const accounts = await db.account.findMany({
      where: { id: { in: accountIds }, companyId: context.companyId },
      select: { id: true, code: true, name: true, isPostable: true },
    });
    if (accounts.length !== accountIds.length) {
      rule("Ada akun yang tidak ditemukan di bagan akun perusahaan aktif.");
    }
    const notPostable = accounts.find((account) => !account.isPostable);
    if (notPostable) rule(`Akun ${notPostable.code} adalah akun induk dan tidak bisa dianggarkan.`);

    let created = 0;
    let updated = 0;
    let total = 0;

    for (const line of body.lines) {
      total += line.budget;
      const existing = await db.budgetLine.findFirst({
        where: {
          companyId: context.companyId,
          unitId: unit!.id,
          accountId: line.accountId,
          year: body.year,
          month: null,
        },
        select: { id: true },
      });

      if (existing) {
        await db.budgetLine.update({ where: { id: existing.id }, data: { budget: line.budget } });
        updated += 1;
      } else {
        await db.budgetLine.create({
          data: {
            companyId: context.companyId,
            unitId: unit!.id,
            accountId: line.accountId,
            year: body.year,
            month: null,
            budget: line.budget,
          },
        });
        created += 1;
      }
    }

    await recordAudit(context, {
      action: body.submit ? "SUBMIT" : "UPDATE",
      entityType: "BudgetLine",
      summary: `${body.submit ? "Ajukan" : "Simpan"} anggaran ${body.year} · buku ${unit!.code} · ${body.lines.length} akun`,
      changes: {
        basis: body.basis,
        increasePercent: body.increasePercent,
        detail: body.detail,
        note: body.note,
        created,
        updated,
        total,
      },
    });

    return NextResponse.json({ created, updated, total, year: body.year, unitCode: unit!.code }, { status: 201 });
  });
}
