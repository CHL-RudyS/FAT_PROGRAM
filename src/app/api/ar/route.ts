import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, nextDocumentNumber, recordAudit, rule } from "@/lib/api";
import {
  AR_ACCOUNT_CODES,
  PPN_KELUARAN_CODES,
  REVENUE_CODES,
  accountByCode,
  invoiceStatusFor,
  money,
  parseIsoDate,
  postJournal,
  requireOpenPeriod,
} from "../ap/_ledger";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Layar 24 · dialog "m-invoice" — buat invoice penjualan. */
const createSchema = z.object({
  customerId: z.string().trim().min(1, "Pelanggan harus dipilih."),
  unitId: z.string().trim().min(1, "Buku unit harus dipilih."),
  invoiceDate: z.string().regex(ISO_DATE, "Tanggal invoice harus diisi."),
  dueDate: z.string().regex(ISO_DATE, "Jatuh tempo harus diisi."),
  lines: z
    .array(
      z.object({
        description: z.string().trim().max(180).optional(),
        quantity: z.number().min(0),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1, "Invoice harus punya minimal satu baris."),
  ppnRate: z.number().min(0).max(100).default(11),
  post: z.boolean().default(true),
});

export async function GET() {
  return handleRead(async (context) => {
    const invoices = await db.arInvoice.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      include: { customer: { select: { id: true, code: true, name: true } } },
    });
    return NextResponse.json(invoices);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const customer = await db.customer.findFirst({
      where: { id: body.customerId, companyId: context.companyId },
      select: { id: true, code: true, name: true, creditLimit: true },
    });
    if (!customer) rule("Pelanggan tidak ditemukan.");

    const unit = await db.businessUnit.findFirst({
      where: { id: body.unitId, companyId: context.companyId },
      select: { id: true, code: true, name: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan.");

    const invoiceDate = parseIsoDate(body.invoiceDate);
    const dueDate = parseIsoDate(body.dueDate);
    if (dueDate.getTime() < invoiceDate.getTime()) rule("Jatuh tempo tidak boleh sebelum tanggal invoice.");

    const subtotal = money(body.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    if (subtotal <= 0) rule("Nilai invoice harus lebih besar dari nol.");
    const ppn = money((subtotal * body.ppnRate) / 100);
    const total = money(subtotal + ppn);

    const keterangan = body.lines
      .map((line) => line.description?.trim())
      .filter(Boolean)
      .join(", ")
      || `Penjualan ${customer.name}`;

    if (!body.post) {
      const number = await nextDocumentNumber(context.companyId, "PIUTANG", "AR");
      const draft = await db.arInvoice.create({
        data: {
          companyId: context.companyId,
          unitId: unit.id,
          customerId: customer.id,
          number,
          invoiceDate,
          dueDate,
          amount: total,
          paidAmount: 0,
          status: "DRAF",
          description: keterangan,
        },
      });

      await recordAudit(context, {
        action: "CREATE",
        entityType: "ArInvoice",
        entityId: draft.id,
        summary: `Draf invoice ${draft.number} · ${customer.name}`,
      });

      return NextResponse.json({ invoice: draft, journal: null, posted: false }, { status: 201 });
    }

    const period = await requireOpenPeriod(context.companyId, invoiceDate);
    const receivableAccount = await accountByCode(context.companyId, AR_ACCOUNT_CODES, "piutang usaha");
    const revenueAccount = await accountByCode(context.companyId, REVENUE_CODES, "pendapatan penjualan");
    const ppnAccount = ppn > 0 ? await accountByCode(context.companyId, PPN_KELUARAN_CODES, "PPN keluaran") : null;

    const number = await nextDocumentNumber(context.companyId, "PIUTANG", "AR");

    const journal = await postJournal(
      { ...context, unitId: unit.id },
      {
        date: invoiceDate,
        periodId: period.id,
        description: `Invoice penjualan ${customer.name} · ${number}`,
        reference: number,
        source: "FAKTUR_PENJUALAN",
        lines: [
          { accountId: receivableAccount.id, description: customer.name, debit: total },
          { accountId: revenueAccount.id, description: keterangan, credit: subtotal },
          ...(ppnAccount ? [{ accountId: ppnAccount.id, description: "PPN keluaran", credit: ppn }] : []),
        ],
      },
    );

    const invoice = await db.arInvoice.create({
      data: {
        companyId: context.companyId,
        unitId: unit.id,
        customerId: customer.id,
        number,
        invoiceDate,
        dueDate,
        amount: total,
        paidAmount: 0,
        status: invoiceStatusFor(total, 0, dueDate),
        description: keterangan,
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "ArInvoice",
      entityId: invoice.id,
      summary: `Buat invoice ${invoice.number} · ${customer.name} · jurnal ${journal.number}`,
      changes: { subtotal, ppn, total, unit: unit.code },
    });

    return NextResponse.json({ invoice, journal, posted: true, unitCode: unit.code }, { status: 201 });
  });
}
