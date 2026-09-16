import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule, nextDocumentNumber } from "@/lib/api";
import { MONTHS_ID, formatAmount } from "@/lib/format";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");

const createSchema = z.object({
  unitId: z.string().min(1).optional(),
  number: z.string().trim().max(60).optional(),
  claimDate: dateString,
  category: z.string().trim().min(1, "Kategori harus dipilih.").max(60),
  amount: z.number().min(1, "Nilai klaim harus diisi."),
  expenseAccountId: z.string().min(1, "Akun beban harus dipilih."),
  description: z.string().trim().min(1, "Keterangan harus diisi.").max(240),
  receiptName: z.string().trim().max(200).optional(),
  submit: z.boolean().default(false),
});

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

async function requireOpenPeriod(companyId: string, date: Date) {
  const period = await db.fiscalPeriod.findUnique({
    where: {
      companyId_year_month: { companyId, year: date.getFullYear(), month: date.getMonth() + 1 },
    },
  });
  if (period && period.status !== "TERBUKA") {
    rule(
      `Periode ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()} sudah ${
        period.status === "DITUTUP" ? "ditutup" : "dikunci"
      }. Klaim tidak bisa dicatat ke periode ini.`,
    );
  }
  return period;
}

/** Batas kas kecil per klaim — SystemSetting `pettyCashLimit` = { perClaim: 5000000 }. */
async function pettyCashLimit() {
  const setting = await db.systemSetting.findUnique({ where: { key: "pettyCashLimit" } });
  const value = setting?.value as { perClaim?: number } | null;
  return typeof value?.perClaim === "number" && value.perClaim > 0 ? value.perClaim : 5_000_000;
}

export async function GET() {
  return handleRead(async (context) => {
    const claims = await db.pettyCashClaim.findMany({
      where: { companyId: context.companyId, unitId: context.unitId },
      orderBy: { claimDate: "desc" },
      include: { requester: { select: { name: true } }, unit: { select: { code: true, name: true } } },
    });
    return NextResponse.json(claims);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const claimDate = parseDate(body.claimDate);
    await requireOpenPeriod(context.companyId, claimDate);

    const limit = await pettyCashLimit();
    if (body.amount > limit) {
      rule(`Nilai klaim melebihi batas kas kecil Rp ${formatAmount(limit)}. Ajukan lewat pengajuan biaya.`);
    }

    const account = await db.account.findFirst({
      where: { id: body.expenseAccountId, companyId: context.companyId, isPostable: true },
      select: { id: true, code: true, name: true },
    });
    if (!account) rule("Akun beban tidak ditemukan.");

    // Buku unit dari dialog — default ke unit aktif.
    const unitId = body.unitId ?? context.unitId;
    if (unitId !== context.unitId) {
      const unit = await db.businessUnit.findFirst({
        where: { id: unitId, companyId: context.companyId },
        select: { id: true },
      });
      if (!unit) rule("Buku unit tidak ditemukan.");
    }

    const number = body.number?.trim()
      ? body.number.trim()
      : await nextDocumentNumber(context.companyId, "KAS_KECIL", "KK");

    const duplicate = await db.pettyCashClaim.findUnique({
      where: { companyId_number: { companyId: context.companyId, number } },
      select: { id: true },
    });
    if (duplicate) rule("Nomor klaim sudah dipakai.");

    const claim = await db.pettyCashClaim.create({
      data: {
        companyId: context.companyId,
        unitId,
        number,
        requesterId: context.user.id,
        claimDate,
        category: body.category,
        amount: body.amount,
        description: `${body.description} · ${account!.code} ${account!.name}`,
        receiptName: body.receiptName || null,
        status: body.submit ? "DIAJUKAN" : "DRAF",
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "PettyCashClaim",
      entityId: claim.id,
      summary: `${body.submit ? "Ajukan" : "Simpan draf"} klaim kas kecil ${number} · ${body.category}`,
      changes: { amount: body.amount, status: claim.status },
    });

    return NextResponse.json(claim, { status: 201 });
  });
}
