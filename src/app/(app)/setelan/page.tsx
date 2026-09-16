import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { periodLabel } from "@/lib/format";
import SetelanScreen, { type IntegrationRow, type NumberingRow } from "./SetelanScreen";

export default async function SetelanPage() {
  const context = await requireActiveContext();

  const [numbering, integrations, periods] = await Promise.all([
    db.documentNumbering.findMany({ where: { companyId: context.companyId }, orderBy: { docType: "asc" } }),
    db.integration.findMany({ orderBy: { name: "asc" } }),
    db.fiscalPeriod.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true, year: true, month: true, status: true },
    }),
  ]);

  const numberingRows: NumberingRow[] = numbering.map((entry) => ({
    id: entry.id,
    docType: entry.docType,
    pattern: entry.pattern,
    nextNumber: entry.nextNumber,
  }));

  const integrationRows: IntegrationRow[] = integrations.map((entry) => ({
    id: entry.id,
    name: entry.name,
    status: entry.status,
    lastSyncAt: entry.lastSyncAt ? entry.lastSyncAt.toISOString() : null,
  }));

  const openPeriod = periods.find((period) => period.status === "TERBUKA") ?? periods[0];

  return (
    <SetelanScreen
      numbering={numberingRows}
      integrations={integrationRows}
      periods={periods.map((period) => ({ id: period.id, label: periodLabel(period.year, period.month) }))}
      activePeriodId={openPeriod?.id ?? ""}
      unitLabel={`${context.unit.code} · ${context.unit.name}`}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("setelan.kelola")}
    />
  );
}
