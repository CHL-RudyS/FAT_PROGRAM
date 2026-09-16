import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { MONTHS_ID, toNumber } from "@/lib/format";
import { isCashAccount } from "@/app/api/ap/_ledger";
import HutangScreen from "./HutangScreen";

export default async function HutangPage() {
  const context = await requireActiveContext();

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const previousMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [invoices, vendors, units, accounts, payments] = await Promise.all([
    db.apInvoice.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ dueDate: "asc" }, { number: "asc" }],
      include: { vendor: { select: { id: true, code: true, name: true, paymentTerm: true } } },
    }),
    db.vendor.findMany({
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
        source: "PEMBELIAN",
        description: { startsWith: "Pembayaran hutang" },
        date: { gte: previousMonthStart, lt: monthStart },
      },
      select: { id: true, unitId: true, lines: { select: { debit: true } } },
    }),
  ]);

  const unitCodeById = new Map(units.map((unit) => [unit.id, unit.code]));

  const rows = invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    vendorId: invoice.vendorId,
    vendorCode: invoice.vendor.code,
    vendorName: invoice.vendor.name,
    vendorTerm: invoice.vendor.paymentTerm,
    unitId: invoice.unitId,
    unitCode: unitCodeById.get(invoice.unitId) ?? "—",
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    amount: toNumber(invoice.amount),
    paidAmount: toNumber(invoice.paidAmount),
    status: invoice.status,
    description: invoice.description,
  }));

  const paidPreviousMonth = payments.map((entry) => ({
    unitId: entry.unitId,
    amount: entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0),
  }));

  const payableAccount = accounts.find((account) => account.code === "2-1000") ?? null;

  return (
    <HutangScreen
      invoices={rows}
      vendors={vendors}
      units={units}
      expenseAccounts={accounts.filter(
        (account) => account.type === "BEBAN" || account.code === "1-1300" || account.code === "1-1500",
      )}
      payableAccounts={accounts.filter((account) => account.type === "KEWAJIBAN")}
      cashAccounts={accounts.filter((account) => account.type === "ASET" && isCashAccount(account))}
      payableAccountCode={payableAccount?.code ?? "2-1000"}
      paidPreviousMonth={paidPreviousMonth}
      previousMonthLabel={MONTHS_ID[previousMonthStart.getUTCMonth()]}
      todayIso={today.toISOString()}
      activeUnit={{ id: context.unit.id, code: context.unit.code, name: context.unit.name }}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.posting")}
    />
  );
}
