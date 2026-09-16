import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import {
  buildConsolidation,
  buildReadiness,
  companyTreeIds,
  isInterUnitAccount,
  loadAccounts,
  loadPostedLines,
  parsePeriodValue,
  periodValue,
  resolveBookPeriod,
  scopeLabel,
  scopeRange,
} from "@/app/api/reports/_lib/reporting";
import KonsolidasiScreen from "./KonsolidasiScreen";

function single(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function KonsolidasiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireActiveContext();
  const params = await searchParams;

  const book = await resolveBookPeriod(context.companyId);
  const selected = parsePeriodValue(single(params.periode), {
    year: book.year,
    month: book.month,
    scope: book.scope,
  });
  const range = scopeRange(selected.year, selected.month, selected.scope);
  const treeIds = await companyTreeIds(context.companyId);

  const [companies, units, accounts, lines, entriesInPeriod, history] = await Promise.all([
    db.company.findMany({
      where: { id: { in: treeIds } },
      select: { id: true, code: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: { in: treeIds }, isActive: true },
      orderBy: [{ companyId: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, companyId: true },
    }),
    loadAccounts(treeIds),
    loadPostedLines({ companyIds: treeIds, to: range.to }),
    db.journalEntry.findMany({
      where: { companyId: { in: treeIds }, date: { gte: range.from, lte: range.to } },
      select: {
        id: true,
        number: true,
        description: true,
        source: true,
        status: true,
        unitId: true,
        lines: { select: { accountId: true, debit: true, credit: true } },
      },
    }),
    db.auditLog.findMany({
      where: { entityType: "Konsolidasi" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, createdAt: true, summary: true, action: true, user: { select: { name: true } } },
    }),
  ]);

  const companyCodeById = new Map(companies.map((company) => [company.id, company.code]));
  const unitRefs = units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

  const worksheet = buildConsolidation({ accounts, lines, units: unitRefs, to: range.to });

  const selectedPeriod = book.periods.find(
    (period) => period.year === selected.year && period.month === selected.month,
  );
  const periodLocked = selectedPeriod?.status === "DITUTUP" || selectedPeriod?.status === "DIKUNCI";

  const readiness = buildReadiness({
    units: unitRefs,
    entries: entriesInPeriod.map((entry) => ({ unitId: entry.unitId, status: entry.status })),
    periodLocked,
  });

  const interUnitAccountIds = new Set(
    accounts.filter((account) => isInterUnitAccount(account)).map((account) => account.id),
  );

  const eliminationEntries = entriesInPeriod
    .filter(
      (entry) => entry.status === "DIPOSTING" && entry.lines.some((line) => interUnitAccountIds.has(line.accountId)),
    )
    .map((entry) => ({
      id: entry.id,
      number: entry.number,
      description: entry.description,
      source: entry.source,
      amount: entry.lines
        .filter((line) => interUnitAccountIds.has(line.accountId))
        .reduce((sum, line) => sum + Math.max(toNumber(line.debit), toNumber(line.credit)), 0),
    }));

  return (
    <KonsolidasiScreen
      periodOptions={(book.options.length > 0
        ? book.options
        : [
            {
              value: periodValue(selected.year, selected.month, selected.scope),
              label: scopeLabel(selected.year, selected.month, selected.scope),
            },
          ]
      ).map((option) => ({ value: option.value, label: option.label }))}
      periodValue={periodValue(selected.year, selected.month, selected.scope)}
      monthLabel={scopeLabel(selected.year, selected.month, "BULAN")}
      units={units.map((unit) => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        companyCode: companyCodeById.get(unit.companyId) ?? "",
      }))}
      groups={worksheet.groups}
      difference={worksheet.difference}
      eliminationTotal={worksheet.eliminationTotal}
      readiness={readiness}
      eliminationEntries={eliminationEntries}
      history={history.map((log) => ({
        id: log.id,
        at: log.createdAt.toISOString(),
        summary: `${log.summary ?? log.action}${log.user ? ` · ${log.user.name}` : ""}`,
      }))}
      multiCompany={companies.length > 1}
    />
  );
}
