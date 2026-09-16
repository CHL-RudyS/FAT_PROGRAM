import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import {
  buildBalanceSheet,
  buildCashFlow,
  buildIncomeStatement,
  loadAccounts,
  loadPostedLines,
  parsePeriodValue,
  periodValue,
  previousScopeRange,
  rangeLabel,
  resolveBookPeriod,
  scopeLabel,
  scopeRange,
  startOfYear,
  type LedgerLine,
} from "@/app/api/reports/_lib/reporting";
import LaporanScreen, { type StatementSet } from "./LaporanScreen";

function single(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function LaporanPage({
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
  const previous = previousScopeRange(selected.year, selected.month, selected.scope);
  const fiscalYearStart = startOfYear(selected.year);

  const [units, accounts] = await Promise.all([
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    loadAccounts([context.companyId]),
  ]);

  const requestedScope = single(params.lingkup) || "konsolidasi";
  const scopeIsUnit = units.some((unit) => unit.id === requestedScope);
  const bookScope = scopeIsUnit || requestedScope === "berdampingan" ? requestedScope : "konsolidasi";

  const lines = await loadPostedLines({
    companyIds: [context.companyId],
    unitIds: scopeIsUnit ? [bookScope] : undefined,
    to: range.to,
  });

  function statementFor(key: string, label: string, subset: LedgerLine[]): StatementSet {
    const balanceSheet = buildBalanceSheet({ accounts, lines: subset, fiscalYearStart, to: range.to });
    const income = buildIncomeStatement({
      accounts,
      lines: subset,
      from: range.from,
      to: range.to,
      previousFrom: previous.from,
      previousTo: previous.to,
    });
    const cashFlow = buildCashFlow({
      accounts,
      lines: subset,
      from: range.from,
      to: range.to,
      netProfit: income.netProfit,
    });
    return { key, label, balanceSheet, income, cashFlow };
  }

  const statements: StatementSet[] =
    bookScope === "berdampingan"
      ? units.map((unit) =>
          statementFor(
            unit.id,
            `${unit.code} · ${unit.name}`,
            lines.filter((line) => line.unitId === unit.id),
          ),
        )
      : [
          statementFor(
            bookScope,
            scopeIsUnit
              ? `${units.find((unit) => unit.id === bookScope)?.code ?? ""} · ${units.find((unit) => unit.id === bookScope)?.name ?? ""}`
              : "Konsolidasi",
            lines,
          ),
        ];

  const scopeOptions = [
    { value: "konsolidasi", label: `Konsolidasi ${units.length} unit bisnis` },
    ...units.map((unit) => ({ value: unit.id, label: `${unit.code} · ${unit.name}` })),
    { value: "berdampingan", label: "Per unit berdampingan" },
  ];

  const periodOptions =
    book.options.length > 0
      ? book.options
      : [
          {
            value: periodValue(selected.year, selected.month, selected.scope),
            label: scopeLabel(selected.year, selected.month, selected.scope),
            year: selected.year,
            month: selected.month,
            scope: selected.scope,
          },
        ];

  return (
    <LaporanScreen
      statements={statements}
      scopeOptions={scopeOptions}
      scopeValue={bookScope}
      periodOptions={periodOptions.map((option) => ({ value: option.value, label: option.label }))}
      periodValue={periodValue(selected.year, selected.month, selected.scope)}
      scopeHeading={scopeIsUnit ? statements[0]?.label ?? "Konsolidasi" : "Konsolidasi"}
      rangeText={rangeLabel(range.from, range.to)}
      yearRangeText={rangeLabel(fiscalYearStart, range.to)}
    />
  );
}
