import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { MONTHS_ID, toNumber } from "@/lib/format";
import UnitBisnisScreen, { type UnitRow } from "./UnitBisnisScreen";

const RAK_PREFIXES = ["1-1900", "2-1900"];

export default async function UnitBisnisPage() {
  const context = await requireActiveContext();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [units, assetLines, rakLines, accountCount] = await Promise.all([
    db.businessUnit.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      include: {
        access: {
          orderBy: { canApprove: "desc" },
          include: { user: { select: { name: true, jobTitle: true } } },
        },
      },
    }),
    db.journalLine.findMany({
      where: { entry: { companyId: context.companyId, status: "DIPOSTING" }, account: { type: "ASET" } },
      select: { debit: true, credit: true, entry: { select: { unitId: true } } },
    }),
    db.journalLine.findMany({
      where: {
        entry: { companyId: context.companyId, status: "DIPOSTING" },
        account: { OR: RAK_PREFIXES.map((prefix) => ({ code: { startsWith: prefix } })) },
      },
      select: { debit: true, credit: true, entry: { select: { id: true, unitId: true, date: true } } },
    }),
    db.account.count({ where: { companyId: context.companyId } }),
  ]);

  const assetByUnit = new Map<string, number>();
  for (const line of assetLines) {
    const key = line.entry.unitId;
    assetByUnit.set(key, (assetByUnit.get(key) ?? 0) + toNumber(line.debit) - toNumber(line.credit));
  }

  const rakByUnit = new Map<string, { debit: number; credit: number }>();
  const interUnitEntries = new Set<string>();
  for (const line of rakLines) {
    const key = line.entry.unitId;
    const current = rakByUnit.get(key) ?? { debit: 0, credit: 0 };
    current.debit += toNumber(line.debit);
    current.credit += toNumber(line.credit);
    rakByUnit.set(key, current);
    if (line.entry.date >= monthStart && line.entry.date < monthEnd) interUnitEntries.add(line.entry.id);
  }

  const rows: UnitRow[] = units.map((unit) => {
    const rak = rakByUnit.get(unit.id) ?? { debit: 0, credit: 0 };
    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      city: unit.address,
      isActive: unit.isActive,
      needsWork: unit.needsWork,
      hasVariance: unit.hasVariance,
      owner: unit.access[0]?.user.name ?? null,
      ownerTitle: unit.access[0]?.user.jobTitle ?? null,
      accessCount: unit.access.length,
      totalAsset: assetByUnit.get(unit.id) ?? 0,
      rakDebit: rak.debit,
      rakCredit: rak.credit,
    };
  });

  const rakTotal = rows.reduce((sum, row) => sum + row.rakDebit - row.rakCredit, 0);

  return (
    <UnitBisnisScreen
      rows={rows}
      companyName={context.company.name}
      monthLabel={MONTHS_ID[now.getMonth()]}
      accountCount={accountCount}
      interUnitJournals={interUnitEntries.size}
      eliminatedTotal={rows.reduce((sum, row) => sum + row.totalAsset, 0) - rakTotal}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("setelan.kelola")}
    />
  );
}
