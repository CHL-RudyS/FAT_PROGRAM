import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { formatAmount, toNumber } from "@/lib/format";
import {
  budgetOverruns,
  buildPeriodMetrics,
  buildRevenueTrend,
  buildUnitPerformance,
  loadAccounts,
  loadPostedLines,
  parsePeriodValue,
  periodValue,
  previousScopeRange,
  resolveBookPeriod,
  scopeLabel,
  scopeRange,
  startOfYear,
} from "@/app/api/reports/_lib/reporting";
import DireksiScreen from "./DireksiScreen";

function single(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function DashboardDireksiPage({
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

  const [units, accounts, lines, budgets, overdue, rejectedEfaktur, bankAccountCount] = await Promise.all([
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    loadAccounts([context.companyId]),
    loadPostedLines({ companyIds: [context.companyId], to: range.to }),
    db.budgetLine.findMany({
      where: { companyId: context.companyId, year: selected.year },
      select: { accountId: true, budget: true },
    }),
    db.arInvoice.findMany({
      where: {
        companyId: context.companyId,
        status: { in: ["TERBUKA", "SEBAGIAN", "JATUH_TEMPO"] },
        dueDate: { lt: new Date(range.to.getTime() - 60 * 86_400_000) },
      },
      select: { amount: true, paidAmount: true },
    }),
    db.salesInvoice.count({ where: { companyId: context.companyId, efaktur: "DITOLAK" } }),
    db.bankAccount.count({ where: { companyId: context.companyId, isActive: true } }),
  ]);

  const performance = buildUnitPerformance({ accounts, lines, units, from: range.from, to: range.to });
  const metrics = buildPeriodMetrics({
    accounts,
    lines,
    from: range.from,
    to: range.to,
    previousFrom: previous.from,
    previousTo: previous.to,
  });
  const trend = buildRevenueTrend({ accounts, lines, year: selected.year, month: selected.month, count: 6 });

  const lockedPeriod = book.periods.find(
    (period) => period.year === selected.year && period.month === selected.month,
  );
  const periodLocked = lockedPeriod?.status === "DITUTUP" || lockedPeriod?.status === "DIKUNCI";

  // A unit's book counts as locked only once the whole fiscal period is closed.
  const notLockedUnits = periodLocked ? 0 : units.length;

  const overdueAmount = overdue.reduce(
    (sum, invoice) => sum + toNumber(invoice.amount) - toNumber(invoice.paidAmount),
    0,
  );
  const overBudget = budgetOverruns({
    accounts,
    lines,
    budgets: budgets.map((line) => ({ accountId: line.accountId, budget: toNumber(line.budget) })),
    fiscalYearStart,
    to: range.to,
  });

  const monthLabel = scopeLabel(selected.year, selected.month, "BULAN");

  const attention = [
    {
      key: "anggaran",
      label: "Anggaran",
      text: `${overBudget === 0 ? "—" : overBudget} akun melewati anggaran tahunan`,
    },
    {
      key: "piutang",
      label: "Piutang",
      text: `${overdueAmount === 0 ? "—" : formatAmount(overdueAmount)} nilai piutang lewat jatuh tempo di atas 60 hari`,
    },
    {
      key: "periode",
      label: "Periode",
      text: `${notLockedUnits === 0 ? "—" : notLockedUnits} buku unit belum dikunci untuk ${monthLabel.split(" ")[0]}`,
    },
    {
      key: "pajak",
      label: "Pajak",
      text: `${rejectedEfaktur === 0 ? "—" : rejectedEfaktur} faktur ditolak sistem e-Faktur`,
    },
  ];

  return (
    <DireksiScreen
      unitCount={units.length}
      bookLabel={scopeLabel(selected.year, selected.month, selected.scope)}
      periodLocked={periodLocked}
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
      previousMonthLabel={scopeLabel(previous.from.getFullYear(), previous.from.getMonth() + 1, "BULAN").split(" ")[0]}
      metrics={metrics}
      rows={performance.rows}
      total={performance.total}
      trend={trend}
      attention={attention}
      bankAccountCount={bankAccountCount}
    />
  );
}
