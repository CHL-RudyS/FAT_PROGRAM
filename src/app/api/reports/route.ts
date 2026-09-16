import { NextResponse } from "next/server";
import { handleRead } from "@/lib/api";
import {
  buildBalanceSheet,
  buildCashFlow,
  buildConsolidation,
  buildIncomeStatement,
  buildUnitPerformance,
  companyTreeIds,
  loadAccounts,
  loadPostedLines,
  parsePeriodValue,
  previousScopeRange,
  rangeLabel,
  resolveBookPeriod,
  scopeLabel,
  scopeRange,
  startOfYear,
} from "./_lib/reporting";
import { db } from "@/lib/db";

/**
 * Read-only feed behind the reporting screens' export buttons: every figure is
 * recomputed from posted journals, nothing is stored.
 *
 *   GET /api/reports?periode=2026-08-BULAN&lingkup=konsolidasi
 */
export async function GET(request: Request) {
  return handleRead(async (context) => {
    const url = new URL(request.url);
    const book = await resolveBookPeriod(context.companyId);
    const selected = parsePeriodValue(url.searchParams.get("periode"), {
      year: book.year,
      month: book.month,
      scope: book.scope,
    });
    const range = scopeRange(selected.year, selected.month, selected.scope);
    const previous = previousScopeRange(selected.year, selected.month, selected.scope);
    const fiscalYearStart = startOfYear(selected.year);

    const wantsTree = url.searchParams.get("lingkup") === "grup";
    const companyIds = wantsTree ? await companyTreeIds(context.companyId) : [context.companyId];

    const [units, accounts] = await Promise.all([
      db.businessUnit.findMany({
        where: { companyId: { in: companyIds }, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      loadAccounts(companyIds),
    ]);
    const lines = await loadPostedLines({ companyIds, to: range.to });

    const income = buildIncomeStatement({
      accounts,
      lines,
      from: range.from,
      to: range.to,
      previousFrom: previous.from,
      previousTo: previous.to,
    });

    return NextResponse.json({
      period: {
        value: `${selected.year}-${String(selected.month).padStart(2, "0")}-${selected.scope}`,
        label: scopeLabel(selected.year, selected.month, selected.scope),
        range: rangeLabel(range.from, range.to),
      },
      balanceSheet: buildBalanceSheet({ accounts, lines, fiscalYearStart, to: range.to }),
      income,
      cashFlow: buildCashFlow({ accounts, lines, from: range.from, to: range.to, netProfit: income.netProfit }),
      units: buildUnitPerformance({ accounts, lines, units, from: range.from, to: range.to }),
      consolidation: buildConsolidation({ accounts, lines, units, to: range.to }),
    });
  });
}
