import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import VendorScreen from "./VendorScreen";

export default async function VendorPage() {
  const context = await requireActiveContext();

  const vendors = await db.vendor.findMany({
    where: { companyId: context.companyId },
    orderBy: { code: "asc" },
    include: {
      apInvoices: {
        where: { status: { in: ["TERBUKA", "SEBAGIAN", "JATUH_TEMPO"] } },
        select: { amount: true, paidAmount: true, dueDate: true },
      },
    },
  });

  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const rows = vendors.map((vendor) => {
    const outstanding = vendor.apInvoices.reduce(
      (total, invoice) => total + toNumber(invoice.amount) - toNumber(invoice.paidAmount),
      0,
    );
    const dueThisMonth = vendor.apInvoices.some((invoice) => invoice.dueDate <= endOfMonth);
    return {
      id: vendor.id,
      code: vendor.code,
      name: vendor.name,
      category: vendor.category,
      npwp: vendor.npwp,
      contactName: vendor.contactName,
      phone: vendor.phone,
      email: vendor.email,
      paymentTerm: vendor.paymentTerm,
      status: vendor.status,
      outstanding,
      dueThisMonth,
    };
  });

  return (
    <VendorScreen
      vendors={rows}
      unitLabel={`${context.unit.code} · ${context.unit.name}`}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("mitra.ubah")}
    />
  );
}
