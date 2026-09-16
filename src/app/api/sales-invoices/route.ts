import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule, nextDocumentNumber } from "@/lib/api";
import type { ActiveContext } from "@/lib/context";
import { MONTHS_ID } from "@/lib/format";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");

const createSchema = z.object({
  customerId: z.string().min(1, "Customer harus dipilih."),
  number: z.string().trim().max(60).optional(),
  invoiceDate: dateString,
  termDays: z.number().int().min(0).max(365).default(30),
  dueDate: dateString.optional(),
  revenueAccountId: z.string().min(1, "Akun pendapatan harus dipilih."),
  ppnRate: z.number().min(0).max(100).default(11),
  description: z.string().trim().min(1, "Uraian harus diisi.").max(200),
  quantity: z.number().positive("Kuantitas harus lebih dari nol.").default(1),
  unitPrice: z.number().min(1, "Harga satuan harus diisi."),
  takeEfakturSeries: z.boolean().default(true),
  issue: z.boolean().default(false),
});

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

/** Postings are refused into a period that is already closed or locked. */
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
      }. Faktur tidak bisa diterbitkan ke periode ini.`,
    );
  }
  return period;
}

async function accountByCode(companyId: string, code: string, label: string) {
  const account = await db.account.findUnique({ where: { companyId_code: { companyId, code } } });
  if (!account) rule(`Akun ${code} · ${label} belum ada di bagan akun.`);
  return account!;
}

/** Faktur yang diterbitkan langsung menjurnal piutang usaha, pendapatan, dan PPN keluaran. */
async function postSalesJournal(
  context: ActiveContext,
  input: {
    periodId: string | null;
    date: Date;
    number: string;
    description: string;
    revenueAccountId: string;
    dpp: number;
    ppn: number;
    total: number;
  },
) {
  const piutang = await accountByCode(context.companyId, "1-1200", "Piutang Usaha");
  const ppnKeluaran = input.ppn > 0 ? await accountByCode(context.companyId, "2-1100", "PPN Keluaran") : null;

  const journalNumber = await nextDocumentNumber(context.companyId, "JURNAL", "JU");

  const lines = [
    { accountId: piutang.id, description: input.description, debit: input.total, credit: 0, lineNo: 1 },
    { accountId: input.revenueAccountId, description: input.description, debit: 0, credit: input.dpp, lineNo: 2 },
  ];
  if (ppnKeluaran) {
    lines.push({ accountId: ppnKeluaran.id, description: "PPN keluaran", debit: 0, credit: input.ppn, lineNo: 3 });
  }

  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  if (money(debit) !== money(credit)) rule("Jurnal faktur tidak seimbang.");

  return db.journalEntry.create({
    data: {
      companyId: context.companyId,
      unitId: context.unitId,
      periodId: input.periodId,
      number: journalNumber,
      date: input.date,
      description: `Faktur penjualan ${input.number}`,
      reference: input.number,
      status: "DIPOSTING",
      source: "FAKTUR_PENJUALAN",
      createdById: context.user.id,
      postedById: context.user.id,
      postedAt: new Date(),
      lines: { create: lines },
    },
  });
}

export async function GET() {
  return handleRead(async (context) => {
    const invoices = await db.salesInvoice.findMany({
      where: { companyId: context.companyId, unitId: context.unitId },
      orderBy: { invoiceDate: "desc" },
      include: { customer: { select: { code: true, name: true } } },
    });
    return NextResponse.json(invoices);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const invoiceDate = parseDate(body.invoiceDate);
    const dueDate = body.dueDate
      ? parseDate(body.dueDate)
      : new Date(invoiceDate.getTime() + body.termDays * 86_400_000);

    const period = await requireOpenPeriod(context.companyId, invoiceDate);

    const customer = await db.customer.findFirst({
      where: { id: body.customerId, companyId: context.companyId },
      select: { id: true, code: true, name: true },
    });
    if (!customer) rule("Customer tidak ditemukan di perusahaan ini.");

    const revenueAccount = await db.account.findFirst({
      where: { id: body.revenueAccountId, companyId: context.companyId, isPostable: true },
      select: { id: true, code: true, name: true },
    });
    if (!revenueAccount) rule("Akun pendapatan tidak ditemukan.");

    const dpp = money(body.quantity * body.unitPrice);
    const ppn = money((dpp * body.ppnRate) / 100);
    const total = money(dpp + ppn);

    const number = body.number?.trim()
      ? body.number.trim()
      : await nextDocumentNumber(context.companyId, "FAKTUR_PENJUALAN", "INV");

    const duplicate = await db.salesInvoice.findUnique({
      where: { companyId_number: { companyId: context.companyId, number } },
      select: { id: true },
    });
    if (duplicate) rule("Nomor faktur sudah dipakai.");

    const invoice = await db.salesInvoice.create({
      data: {
        companyId: context.companyId,
        unitId: context.unitId,
        customerId: customer!.id,
        number,
        invoiceDate,
        dueDate,
        dpp,
        ppnRate: body.ppnRate,
        ppn,
        total,
        termDays: body.termDays,
        status: body.issue ? "TERBUKA" : "DRAF",
        efaktur: body.issue && body.takeEfakturSeries && ppn > 0 ? "DIAJUKAN" : "BELUM",
        notes: `${body.description} · ${revenueAccount!.code} ${revenueAccount!.name}`,
      },
    });

    if (body.issue) {
      await postSalesJournal(context, {
        periodId: period?.id ?? null,
        date: invoiceDate,
        number,
        description: body.description,
        revenueAccountId: revenueAccount!.id,
        dpp,
        ppn,
        total,
      });
    }

    await recordAudit(context, {
      action: "CREATE",
      entityType: "SalesInvoice",
      entityId: invoice.id,
      summary: `${body.issue ? "Terbitkan" : "Simpan draf"} faktur penjualan ${number} · ${customer!.name}`,
      changes: { dpp, ppn, total, status: invoice.status },
    });

    return NextResponse.json(invoice, { status: 201 });
  });
}
