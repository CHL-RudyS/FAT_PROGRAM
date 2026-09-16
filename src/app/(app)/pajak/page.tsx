import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import PajakScreen, { type LedgerAccountOption, type TaxRow } from "./PajakScreen";

export default async function PajakPage() {
  const context = await requireActiveContext();

  const [records, paymentAccounts] = await Promise.all([
    db.taxRecord.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        kind: true,
        periodYear: true,
        periodMonth: true,
        dpp: true,
        taxAmount: true,
        dueDate: true,
        reportedAt: true,
        paidAt: true,
        status: true,
        reference: true,
        createdAt: true,
        unit: { select: { id: true, code: true } },
      },
    }),
    db.account.findMany({
      where: { companyId: context.companyId, type: "ASET", isPostable: true, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const rows: TaxRow[] = records.map((record) => ({
    id: record.id,
    kind: record.kind,
    periodYear: record.periodYear,
    periodMonth: record.periodMonth,
    dpp: toNumber(record.dpp),
    taxAmount: toNumber(record.taxAmount),
    dueDate: record.dueDate ? record.dueDate.toISOString() : null,
    reportedAt: record.reportedAt ? record.reportedAt.toISOString() : null,
    paidAt: record.paidAt ? record.paidAt.toISOString() : null,
    status: record.status,
    reference: record.reference,
    recordedAt: record.createdAt.toISOString(),
    unitId: record.unit.id,
    unitCode: record.unit.code,
  }));

  const accountOptions: LedgerAccountOption[] = paymentAccounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
  }));

  return (
    <PajakScreen
      records={rows}
      paymentAccounts={accountOptions}
      todayIso={new Date().toISOString()}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.posting")}
    />
  );
}
