import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule, nextDocumentNumber } from "@/lib/api";
import { MONTHS_ID } from "@/lib/format";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");

const TAX_KINDS = ["PPN_KELUARAN", "PPN_MASUKAN", "PPH_21", "PPH_22", "PPH_23", "PPH_25", "PPH_4_2"] as const;

const createSchema = z.object({
  kind: z.enum(TAX_KINDS),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  billingCode: z.string().trim().min(1, "Kode billing harus diisi.").max(60),
  paidAt: dateString,
  amount: z.number().min(1, "Nilai setoran harus diisi."),
  dpp: z.number().min(0).default(0),
  paymentAccountId: z.string().min(1, "Akun pembayaran harus dipilih."),
  ntpn: z.string().trim().max(60).optional(),
  receiptName: z.string().trim().max(200).optional(),
});

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

/** PPN disetor paling lambat tanggal 15, PPh tanggal 10 bulan berikutnya. */
export function taxDueDate(kind: string, year: number, month: number) {
  const day = kind.startsWith("PPN") ? 15 : 10;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, day);
}

export async function GET() {
  return handleRead(async (context) => {
    const records = await db.taxRecord.findMany({
      where: { companyId: context.companyId, unitId: context.unitId },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    });
    return NextResponse.json(records);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const paidAt = parseDate(body.paidAt);

    const period = await db.fiscalPeriod.findUnique({
      where: {
        companyId_year_month: { companyId: context.companyId, year: paidAt.getFullYear(), month: paidAt.getMonth() + 1 },
      },
    });
    if (period && period.status !== "TERBUKA") {
      rule(
        `Periode ${MONTHS_ID[paidAt.getMonth()]} ${paidAt.getFullYear()} sudah ${
          period.status === "DITUTUP" ? "ditutup" : "dikunci"
        }. Setoran pajak tidak bisa diposting ke periode ini.`,
      );
    }

    const paymentAccount = await db.account.findFirst({
      where: { id: body.paymentAccountId, companyId: context.companyId, isPostable: true },
      select: { id: true, code: true, name: true },
    });
    if (!paymentAccount) rule("Akun pembayaran tidak ditemukan.");

    const taxPayable = await db.account.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: "2-1200" } },
    });
    if (!taxPayable) rule("Akun 2-1200 · Hutang Pajak belum ada di bagan akun.");
    if (paymentAccount!.id === taxPayable!.id) rule("Akun pembayaran tidak boleh akun hutang pajak.");

    const record = await db.taxRecord.create({
      data: {
        companyId: context.companyId,
        unitId: context.unitId,
        kind: body.kind,
        periodYear: body.periodYear,
        periodMonth: body.periodMonth,
        dpp: body.dpp,
        taxAmount: body.amount,
        dueDate: taxDueDate(body.kind, body.periodYear, body.periodMonth),
        paidAt,
        status: "DIBAYAR",
        reference: body.ntpn ? `${body.billingCode} · NTPN ${body.ntpn}` : body.billingCode,
      },
    });

    // Jurnal terbentuk otomatis: debit utang pajak terkait, kredit akun kas atau bank.
    const number = await nextDocumentNumber(context.companyId, "JURNAL", "JU");
    const entry = await db.journalEntry.create({
      data: {
        companyId: context.companyId,
        unitId: context.unitId,
        periodId: period?.id ?? null,
        number,
        date: paidAt,
        description: `Setoran pajak ${body.kind.replace(/_/g, " ")} masa ${MONTHS_ID[body.periodMonth - 1]} ${body.periodYear}`,
        reference: body.billingCode,
        status: "DIPOSTING",
        source: "MANUAL",
        createdById: context.user.id,
        postedById: context.user.id,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: taxPayable!.id, description: "Hutang pajak", debit: body.amount, credit: 0, lineNo: 1 },
            {
              accountId: paymentAccount!.id,
              description: `${paymentAccount!.code} ${paymentAccount!.name}`,
              debit: 0,
              credit: body.amount,
              lineNo: 2,
            },
          ],
        },
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "TaxRecord",
      entityId: record.id,
      summary: `Catat setoran pajak ${body.kind.replace(/_/g, " ")} masa ${MONTHS_ID[body.periodMonth - 1]} ${body.periodYear}`,
      changes: { amount: body.amount, billingCode: body.billingCode, journal: entry.number },
    });

    return NextResponse.json({ ...record, journalNumber: entry.number }, { status: 201 });
  });
}
