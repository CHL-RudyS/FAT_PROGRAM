import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { toNumber } from "@/lib/format";
import {
  AR_ACCOUNT_CODES,
  accountById,
  accountByCode,
  isCashAccount,
  money,
  parseIsoDate,
  postJournal,
  requireOpenPeriod,
  settlementFor,
} from "../../../ap/_ledger";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Layar 24 · dialog "m-terima" — terima pembayaran pelanggan. */
const receiveSchema = z.object({
  date: z.string().regex(ISO_DATE, "Tanggal terima harus diisi."),
  accountId: z.string().trim().min(1, "Akun kas/bank harus dipilih."),
  amount: z.number().positive("Nilai diterima harus diisi."),
  method: z.string().trim().max(40).default("Transfer bank"),
  statementNote: z.string().trim().max(120).optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/ar/[id]/terima">) {
  const { id } = await ctx.params;

  return handle(request, receiveSchema, async ({ body, context }) => {
    const invoice = await db.arInvoice.findFirst({
      where: { id, companyId: context.companyId },
      include: { customer: { select: { id: true, code: true, name: true } } },
    });
    if (!invoice) rule("Invoice tidak ditemukan.");

    const amount = money(body.amount);
    const settlement = settlementFor(
      {
        amount: toNumber(invoice.amount),
        paidAmount: toNumber(invoice.paidAmount),
        dueDate: invoice.dueDate,
        status: invoice.status,
      },
      amount,
      {
        draft: "Invoice masih draf — posting dulu sebelum menerima pembayaran.",
        closed: "Invoice ini sudah lunas atau dibatalkan.",
        tooMuch: (remaining) =>
          `Nilai melebihi sisa piutang ${remaining}. Kelebihan harus dicatat sebagai titipan pelanggan.`,
      },
    );

    const receiveDate = parseIsoDate(body.date);
    const period = await requireOpenPeriod(context.companyId, receiveDate);

    const target = await accountById(context.companyId, body.accountId, "kas / bank");
    if (!isCashAccount(target)) rule("Penerimaan harus masuk ke akun kas atau bank.");

    const receivableAccount = await accountByCode(context.companyId, AR_ACCOUNT_CODES, "piutang usaha");

    const journal = await postJournal(
      { ...context, unitId: invoice.unitId },
      {
        date: receiveDate,
        periodId: period.id,
        description: `Penerimaan piutang ${invoice.number} · ${invoice.customer.name}`,
        reference: body.statementNote?.trim() || invoice.number,
        source: "FAKTUR_PENJUALAN",
        lines: [
          { accountId: target.id, description: body.method, debit: amount },
          { accountId: receivableAccount.id, description: invoice.customer.name, credit: amount },
        ],
      },
    );

    const updated = await db.arInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: settlement.paidAmount, status: settlement.status },
    });

    await recordAudit(context, {
      action: "PAYMENT",
      entityType: "ArInvoice",
      entityId: invoice.id,
      summary: `Terima pembayaran ${invoice.number} · ${invoice.customer.name} · jurnal ${journal.number}`,
      changes: { amount, method: body.method, status: settlement.status },
    });

    return NextResponse.json({ invoice: updated, journal });
  });
}
