import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, nextDocumentNumber, recordAudit, rule } from "@/lib/api";
import {
  AP_ACCOUNT_CODES,
  PPH_ACCOUNT_CODES,
  PPN_MASUKAN_CODES,
  accountById,
  accountByCode,
  invoiceStatusFor,
  money,
  parseIsoDate,
  postJournal,
  requireOpenPeriod,
} from "./_ledger";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Layar 23 · dialog "m-tagihan" — catat tagihan vendor. */
const createSchema = z.object({
  vendorId: z.string().trim().min(1, "Vendor harus dipilih."),
  vendorRef: z.string().trim().max(60).optional(),
  unitId: z.string().trim().min(1, "Buku unit harus dipilih."),
  invoiceDate: z.string().regex(ISO_DATE, "Tanggal tagihan harus diisi."),
  dueDate: z.string().regex(ISO_DATE, "Jatuh tempo harus diisi."),
  expenseAccountId: z.string().trim().min(1, "Akun beban / persediaan harus dipilih."),
  payableAccountId: z.string().trim().optional(),
  dpp: z.number().positive("DPP harus lebih besar dari nol."),
  ppnRate: z.number().min(0).max(100).default(11),
  pphRate: z.number().min(0).max(100).default(0),
  description: z.string().trim().max(400).optional(),
  post: z.boolean().default(true),
});

export async function GET() {
  return handleRead(async (context) => {
    const invoices = await db.apInvoice.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      include: { vendor: { select: { id: true, code: true, name: true } } },
    });
    return NextResponse.json(invoices);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const vendor = await db.vendor.findFirst({
      where: { id: body.vendorId, companyId: context.companyId },
      select: { id: true, code: true, name: true },
    });
    if (!vendor) rule("Vendor tidak ditemukan.");

    const unit = await db.businessUnit.findFirst({
      where: { id: body.unitId, companyId: context.companyId },
      select: { id: true, code: true, name: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan.");

    const invoiceDate = parseIsoDate(body.invoiceDate);
    const dueDate = parseIsoDate(body.dueDate);
    if (dueDate.getTime() < invoiceDate.getTime()) rule("Jatuh tempo tidak boleh sebelum tanggal tagihan.");

    const dpp = money(body.dpp);
    const ppn = money((dpp * body.ppnRate) / 100);
    const pph = money((dpp * body.pphRate) / 100);
    const total = money(dpp + ppn);
    const payable = money(total - pph);
    if (payable <= 0) rule("Nilai tagihan setelah potongan PPh harus lebih besar dari nol.");

    const keterangan = body.description?.trim() || `Tagihan vendor ${vendor.name}`;
    const reference = body.vendorRef?.trim() || null;

    // A draft never touches the ledger, so it is also allowed in a closed period.
    if (!body.post) {
      const number = await nextDocumentNumber(context.companyId, "HUTANG", "AP");
      const draft = await db.apInvoice.create({
        data: {
          companyId: context.companyId,
          unitId: unit.id,
          vendorId: vendor.id,
          number,
          invoiceDate,
          dueDate,
          amount: payable,
          paidAmount: 0,
          status: "DRAF",
          description: reference ? `${reference} · ${keterangan}` : keterangan,
        },
      });

      await recordAudit(context, {
        action: "CREATE",
        entityType: "ApInvoice",
        entityId: draft.id,
        summary: `Draf tagihan ${draft.number} · ${vendor.name}`,
      });

      return NextResponse.json({ invoice: draft, journal: null, posted: false }, { status: 201 });
    }

    const period = await requireOpenPeriod(context.companyId, invoiceDate);
    const expenseAccount = await accountById(context.companyId, body.expenseAccountId, "beban / persediaan");
    const payableAccount = body.payableAccountId
      ? await accountById(context.companyId, body.payableAccountId, "utang usaha")
      : await accountByCode(context.companyId, AP_ACCOUNT_CODES, "utang usaha");
    const ppnAccount = ppn > 0 ? await accountByCode(context.companyId, PPN_MASUKAN_CODES, "PPN masukan") : null;
    const pphAccount = pph > 0 ? await accountByCode(context.companyId, PPH_ACCOUNT_CODES, "utang pajak") : null;

    const number = await nextDocumentNumber(context.companyId, "HUTANG", "AP");

    const journal = await postJournal(
      { ...context, unitId: unit.id },
      {
        date: invoiceDate,
        periodId: period.id,
        description: `Tagihan vendor ${vendor.name} · ${number}`,
        reference: reference ?? number,
        source: "PEMBELIAN",
        lines: [
          { accountId: expenseAccount.id, description: keterangan, debit: dpp },
          ...(ppnAccount ? [{ accountId: ppnAccount.id, description: "PPN masukan", debit: ppn }] : []),
          ...(pphAccount ? [{ accountId: pphAccount.id, description: "PPh dipotong", credit: pph }] : []),
          { accountId: payableAccount.id, description: vendor.name, credit: payable },
        ],
      },
    );

    const invoice = await db.apInvoice.create({
      data: {
        companyId: context.companyId,
        unitId: unit.id,
        vendorId: vendor.id,
        number,
        invoiceDate,
        dueDate,
        amount: payable,
        paidAmount: 0,
        status: invoiceStatusFor(payable, 0, dueDate),
        description: reference ? `${reference} · ${keterangan}` : keterangan,
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "ApInvoice",
      entityId: invoice.id,
      summary: `Catat tagihan ${invoice.number} · ${vendor.name} · jurnal ${journal.number}`,
      changes: { dpp, ppn, pph, total, payable, unit: unit.code },
    });

    return NextResponse.json(
      { invoice, journal, posted: true, unitCode: unit.code },
      { status: 201 },
    );
  });
}
