import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { MONTHS_SHORT_ID } from "@/lib/format";
import KlienScreen, { type EntitasRow } from "./KlienScreen";

export default async function KlienPage() {
  const context = await requireActiveContext();
  const year = new Date().getFullYear();

  const [companies, periods, access] = await Promise.all([
    db.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        kind: true,
        npwp: true,
        industry: true,
        legalForm: true,
        colorTag: true,
        isActive: true,
        _count: { select: { units: true } },
      },
    }),
    db.fiscalPeriod.groupBy({
      by: ["companyId"],
      where: { year },
      _min: { month: true },
      _max: { month: true },
    }),
    db.userUnitAccess.findMany({ select: { userId: true, unit: { select: { companyId: true } } } }),
  ]);

  const fiscal = new Map(
    periods.map((period) => {
      const from = period._min.month;
      const to = period._max.month;
      if (!from || !to) return [period.companyId, "—"] as const;
      return [period.companyId, `${MONTHS_SHORT_ID[from - 1]} – ${MONTHS_SHORT_ID[to - 1]}`] as const;
    }),
  );

  const accessByCompany = new Map<string, Set<string>>();
  for (const grant of access) {
    const key = grant.unit.companyId;
    const current = accessByCompany.get(key) ?? new Set<string>();
    current.add(grant.userId);
    accessByCompany.set(key, current);
  }

  const rows: EntitasRow[] = companies.map((company) => ({
    id: company.id,
    initial: company.legalForm ?? company.code,
    name: company.name,
    kind: company.kind,
    npwp: company.npwp,
    industry: company.industry,
    // Company has no accounting-standard column yet — the prototype's chip stays a dash.
    standard: null,
    colorTag: company.colorTag,
    unitCount: company._count.units,
    fiscalLabel: fiscal.get(company.id) ?? "—",
    accessCount: accessByCompany.get(company.id)?.size ?? 0,
    isActive: company.isActive,
  }));

  return (
    <KlienScreen
      rows={rows}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("setelan.kelola")}
    />
  );
}
