import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import FakturPenjualanScreen, {
  type CustomerOption,
  type LedgerAccountOption,
  type SalesInvoiceRow,
  type UnitOption,
} from "./FakturPenjualanScreen";

/** Nomor berikutnya hanya ditampilkan — urutannya baru dipakai saat faktur disimpan. */
function previewNumber(pattern: string, sequence: number) {
  const now = new Date();
  return pattern
    .replace("{YYYY}", String(now.getFullYear()))
    .replace("{MM}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{#+\}/, (match) => String(sequence).padStart(match.length - 2, "0"));
}

export default async function FakturPenjualanPage() {
  const context = await requireActiveContext();

  const [customers, accounts, units, invoices, numbering] = await Promise.all([
    db.customer.findMany({
      where: { companyId: context.companyId, status: "AKTIF" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, paymentTerm: true },
    }),
    db.account.findMany({
      where: { companyId: context.companyId, type: "PENDAPATAN", isPostable: true, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.salesInvoice.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ invoiceDate: "desc" }, { number: "desc" }],
      take: 200,
      select: {
        id: true,
        number: true,
        invoiceDate: true,
        dueDate: true,
        dpp: true,
        ppn: true,
        total: true,
        paidAmount: true,
        termDays: true,
        efaktur: true,
        efakturNo: true,
        status: true,
        unit: { select: { id: true, code: true } },
        customer: { select: { id: true, code: true, name: true } },
      },
    }),
    db.documentNumbering.findUnique({
      where: { companyId_docType: { companyId: context.companyId, docType: "FAKTUR_PENJUALAN" } },
      select: { pattern: true, nextNumber: true },
    }),
  ]);

  const rows: SalesInvoiceRow[] = invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    dpp: toNumber(invoice.dpp),
    ppn: toNumber(invoice.ppn),
    total: toNumber(invoice.total),
    paidAmount: toNumber(invoice.paidAmount),
    termDays: invoice.termDays,
    efaktur: invoice.efaktur,
    efakturNo: invoice.efakturNo,
    status: invoice.status,
    unitId: invoice.unit.id,
    unitCode: invoice.unit.code,
    customerId: invoice.customer.id,
    customerCode: invoice.customer.code,
    customerName: invoice.customer.name,
  }));

  const customerOptions: CustomerOption[] = customers.map((customer) => ({
    id: customer.id,
    code: customer.code,
    name: customer.name,
    paymentTerm: customer.paymentTerm,
  }));

  const accountOptions: LedgerAccountOption[] = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
  }));

  const unitOptions: UnitOption[] = units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

  return (
    <FakturPenjualanScreen
      invoices={rows}
      customers={customerOptions}
      revenueAccounts={accountOptions}
      units={unitOptions}
      activeUnit={{ id: context.unit.id, code: context.unit.code, name: context.unit.name }}
      todayIso={new Date().toISOString()}
      nextNumber={previewNumber(numbering?.pattern ?? "INV/{YYYY}/{MM}/{####}", numbering?.nextNumber ?? 1)}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.posting")}
    />
  );
}
