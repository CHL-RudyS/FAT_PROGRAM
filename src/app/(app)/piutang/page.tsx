import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { MONTHS_ID, toNumber } from "@/lib/format";
import { isCashAccount, previewDocumentNumber } from "@/app/api/ap/_ledger";
import PiutangScreen from "./PiutangScreen";

export default async function PiutangPage() {
  const context = await requireActiveContext();

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const previousMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [invoices, customers, units, accounts, receipts, nextNumber] = await Promise.all([
    db.arInvoice.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      include: { customer: { select: { id: true, code: true, name: true, paymentTerm: true } } },
    }),
    db.customer.findMany({
      where: { companyId: context.companyId, status: "AKTIF" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, paymentTerm: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.account.findMany({
      where: { companyId: context.companyId, isActive: true, isPostable: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
    db.journalEntry.findMany({
      where: {
        companyId: context.companyId,
        source: "FAKTUR_PENJUALAN",
        description: { startsWith: "Penerimaan piutang" },
      },
      orderBy: { date: "desc" },
      take: 24,
      select: { id: true, number: true, unitId: true, date: true, description: true, lines: { select: { debit: true } } },
    }),
    previewDocumentNumber(context.companyId, "PIUTANG", "AR"),
  ]);

  const unitCodeById = new Map(units.map((unit) => [unit.id, unit.code]));

  const rows = invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    customerId: invoice.customerId,
    customerCode: invoice.customer.code,
    customerName: invoice.customer.name,
    customerTerm: invoice.customer.paymentTerm,
    unitId: invoice.unitId,
    unitCode: unitCodeById.get(invoice.unitId) ?? "—",
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    amount: toNumber(invoice.amount),
    paidAmount: toNumber(invoice.paidAmount),
    status: invoice.status,
    description: invoice.description,
  }));

  const receiptRows = receipts.map((entry) => ({
    id: entry.id,
    number: entry.number,
    unitId: entry.unitId,
    date: entry.date.toISOString(),
    description: entry.description,
    amount: entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0),
    inPreviousMonth: entry.date >= previousMonthStart && entry.date < monthStart,
  }));

  const receivableAccount = accounts.find((account) => account.code === "1-1200") ?? null;

  return (
    <PiutangScreen
      invoices={rows}
      customers={customers}
      units={units}
      cashAccounts={accounts.filter((account) => account.type === "ASET" && isCashAccount(account))}
      receivableAccountCode={receivableAccount?.code ?? "1-1200"}
      receipts={receiptRows}
      previousMonthLabel={MONTHS_ID[previousMonthStart.getUTCMonth()]}
      nextInvoiceNumber={nextNumber}
      todayIso={today.toISOString()}
      activeUnit={{ id: context.unit.id, code: context.unit.code, name: context.unit.name }}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.posting")}
    />
  );
}
