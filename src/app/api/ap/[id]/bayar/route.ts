import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { toNumber } from "@/lib/format";
import {
  AP_ACCOUNT_CODES,
  PAYMENT_APPROVAL_LIMIT,
  accountById,
  accountByCode,
  isCashAccount,
  money,
  parseIsoDate,
  postJournal,
  requireOpenPeriod,
  settlementFor,
} from "../../_ledger";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Layar 23 · dialog "m-bayar" — bayar tagihan vendor. */
const paySchema = z.object({
  date: z.string().regex(ISO_DATE, "Tanggal bayar harus diisi."),
  accountId: z.string().trim().min(1, "Sumber dana harus dipilih."),
  amount: z.number().positive("Nilai pembayaran harus diisi."),
  method: z.string().trim().max(40).default("Transfer bank"),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function POST(request: Request, ctx: RouteContext<"/api/ap/[id]/bayar">) {
  const { id } = await ctx.params;

  return handle(request, paySchema, async ({ body, context }) => {
    const invoice = await db.apInvoice.findFirst({
      where: { id, companyId: context.companyId },
      include: { vendor: { select: { id: true, code: true, name: true } }, unit: { select: { id: true, code: true } } },
    });
    if (!invoice) rule("Tagihan tidak ditemukan.");

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
        draft: "Tagihan masih draf — posting dulu sebelum dibayar.",
        closed: "Tagihan ini sudah lunas atau dibatalkan.",
        tooMuch: (remaining) => `Nilai pembayaran melebihi sisa tagihan ${remaining}.`,
      },
    );

    const payDate = parseIsoDate(body.date);
    const period = await requireOpenPeriod(context.companyId, payDate);

    const source = await accountById(context.companyId, body.accountId, "kas / bank");
    if (!isCashAccount(source)) rule("Sumber dana harus akun kas atau bank.");

    // Prototype note: payments above the limit queue for the Administrator and do not
    // touch the bank balance until approved.
    const needsApproval = amount > PAYMENT_APPROVAL_LIMIT && context.user.roleCode !== "ADMIN";
    if (needsApproval) {
      const approval = await db.approvalRequest.create({
        data: {
          companyId: context.companyId,
          unitId: invoice.unitId,
          kind: "JURNAL",
          referenceId: invoice.id,
          referenceNo: invoice.number,
          requesterId: context.user.id,
          amount,
          escalateNote: `Pembayaran ${invoice.number} · ${invoice.vendor.name}${body.note ? ` · ${body.note}` : ""}`,
        },
      });

      await recordAudit(context, {
        action: "REQUEST_APPROVAL",
        entityType: "ApInvoice",
        entityId: invoice.id,
        summary: `Pembayaran ${invoice.number} menunggu persetujuan Administrator`,
        changes: { amount, approvalId: approval.id },
      });

      return NextResponse.json({ approval: true, invoice, journal: null });
    }

    const payableAccount = await accountByCode(context.companyId, AP_ACCOUNT_CODES, "utang usaha");
    const bankReference = body.reference?.trim() || null;

    const journal = await postJournal(
      { ...context, unitId: invoice.unitId },
      {
        date: payDate,
        periodId: period.id,
        description: `Pembayaran hutang ${invoice.number} · ${invoice.vendor.name}`,
        reference: bankReference ?? invoice.number,
        source: "PEMBELIAN",
        lines: [
          { accountId: payableAccount.id, description: invoice.vendor.name, debit: amount },
          { accountId: source.id, description: body.method, credit: amount },
        ],
      },
    );

    const updated = await db.apInvoice.update({
      where: { id: invoice.id },
      data: { paidAmount: settlement.paidAmount, status: settlement.status },
    });

    await recordAudit(context, {
      action: "PAYMENT",
      entityType: "ApInvoice",
      entityId: invoice.id,
      summary: `Bayar tagihan ${invoice.number} · ${invoice.vendor.name} · jurnal ${journal.number}`,
      changes: { amount, method: body.method, reference: bankReference, status: settlement.status },
    });

    return NextResponse.json({ approval: false, invoice: updated, journal });
  });
}
