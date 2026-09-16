import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import CustomerScreen from "./CustomerScreen";

const OPEN_STATUSES = ["TERBUKA", "SEBAGIAN", "JATUH_TEMPO"] as const;

export default async function CustomerPage() {
  const context = await requireActiveContext();

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [customers, units, accounts] = await Promise.all([
    db.customer.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      include: {
        arInvoices: {
          where: { status: { in: [...OPEN_STATUSES] } },
          select: { unitId: true, amount: true, paidAmount: true, invoiceDate: true, dueDate: true },
        },
      },
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
  ]);

  const unitCodeById = new Map(units.map((unit) => [unit.id, unit.code]));

  const rows = customers.map((customer) => ({
    id: customer.id,
    code: customer.code,
    name: customer.name,
    npwp: customer.npwp,
    contactName: customer.contactName,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    paymentTerm: customer.paymentTerm,
    creditLimit: toNumber(customer.creditLimit),
    status: customer.status,
    open: customer.arInvoices.map((invoice) => ({
      unitId: invoice.unitId,
      unitCode: unitCodeById.get(invoice.unitId) ?? "—",
      outstanding: toNumber(invoice.amount) - toNumber(invoice.paidAmount),
      invoiceDate: invoice.invoiceDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
    })),
  }));

  const receivableAccount = accounts.find((account) => account.code === "1-1200") ?? null;

  return (
    <CustomerScreen
      customers={rows}
      units={units}
      receivableAccounts={accounts.filter((account) => account.type === "ASET")}
      revenueAccounts={accounts.filter((account) => account.type === "PENDAPATAN")}
      receivableAccountCode={receivableAccount?.code ?? "1-1200"}
      todayIso={today.toISOString()}
      activeUnit={{ id: context.unit.id, code: context.unit.code, name: context.unit.name }}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("mitra.ubah")}
    />
  );
}
