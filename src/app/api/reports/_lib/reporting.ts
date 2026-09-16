/** Reporting maths for screens 06, 09, 10, 19 and 34.
 *
 *  Every figure is summed from posted `JournalLine` rows (`JournalEntry.status = DIPOSTING`)
 *  and folded per `Account`, honouring the account's `normalBalance`:
 *
 *    DEBIT-normal  -> saldo = Σdebit − Σkredit
 *    KREDIT-normal -> saldo = Σkredit − Σdebit
 *
 *  Because every posted journal balances, the accounting identity
 *  Aset = Kewajiban + Ekuitas + (Pendapatan − Beban) holds by construction; the
 *  balance sheet still reports the difference so a broken ledger is visible.
 */

import "server-only";
import { db } from "@/lib/db";
import { MONTHS_ID, MONTHS_SHORT_ID, toNumber } from "@/lib/format";
import { ratioOf } from "./types";
import type {
  AccountType,
  BalanceSheet,
  CashFlow,
  CashFlowRow,
  ConsolidationGroup,
  ConsolidationRow,
  DireksiUnitRow,
  IncomeRow,
  IncomeStatement,
  NormalBalance,
  PeriodOption,
  PeriodScope,
  StatementRow,
  StatementSection,
  UnitReadiness,
} from "./types";

export type AccountRef = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isPostable: boolean;
};

export type LedgerLine = {
  companyId: string;
  unitId: string;
  accountId: string;
  date: Date;
  debit: number;
  credit: number;
};

export type Totals = { debit: number; credit: number };

const ROMAN = ["I", "II", "III", "IV"];

// ── Periods ─────────────────────────────────────────────────

export function startOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

export function endOfMonth(year: number, month: number) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

export function startOfYear(year: number) {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

/** Resolves a selector value ("2026-08-KUARTAL") into the date range it covers. */
export function scopeRange(year: number, month: number, scope: PeriodScope) {
  if (scope === "TAHUN") return { from: startOfYear(year), to: endOfMonth(year, month) };
  if (scope === "KUARTAL") {
    const quarterStart = Math.floor((month - 1) / 3) * 3 + 1;
    return { from: startOfMonth(year, quarterStart), to: endOfMonth(year, month) };
  }
  return { from: startOfMonth(year, month), to: endOfMonth(year, month) };
}

/** The comparative column: the month/quarter/year immediately before the selected one. */
export function previousScopeRange(year: number, month: number, scope: PeriodScope) {
  if (scope === "TAHUN") {
    return { from: startOfYear(year - 1), to: endOfMonth(year - 1, month) };
  }
  if (scope === "KUARTAL") {
    const quarter = Math.floor((month - 1) / 3);
    const previousYear = quarter === 0 ? year - 1 : year;
    const endMonth = quarter === 0 ? 12 : quarter * 3;
    return { from: startOfMonth(previousYear, endMonth - 2), to: endOfMonth(previousYear, endMonth) };
  }
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  return { from: startOfMonth(previousYear, previousMonth), to: endOfMonth(previousYear, previousMonth) };
}

/** The `count` months ending on (and including) `year`/`month`, oldest first. */
export function trailingMonths(year: number, month: number, count: number) {
  const months: Array<{ year: number; month: number; label: string }> = [];
  const anchor = year * 12 + (month - 1);
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const index = anchor - offset;
    const itemYear = Math.floor(index / 12);
    const itemMonth = (index % 12) + 1;
    months.push({ year: itemYear, month: itemMonth, label: MONTHS_SHORT_ID[itemMonth - 1] });
  }
  return months;
}

export function scopeLabel(year: number, month: number, scope: PeriodScope) {
  if (scope === "TAHUN") return `Tahun berjalan ${year}`;
  if (scope === "KUARTAL") return `Kuartal ${ROMAN[Math.floor((month - 1) / 3)]} ${year}`;
  return `${MONTHS_ID[month - 1]} ${year}`;
}

export function rangeLabel(from: Date, to: Date) {
  return `${from.getDate()} ${MONTHS_ID[from.getMonth()]} – ${to.getDate()} ${MONTHS_ID[to.getMonth()]} ${to.getFullYear()}`;
}

export function periodValue(year: number, month: number, scope: PeriodScope) {
  return `${year}-${String(month).padStart(2, "0")}-${scope}`;
}

export function parsePeriodValue(value: string | null | undefined, fallback: { year: number; month: number; scope: PeriodScope }) {
  if (!value) return fallback;
  const [yearText, monthText, scopeText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const scope = scopeText as PeriodScope;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return fallback;
  if (scope !== "BULAN" && scope !== "KUARTAL" && scope !== "TAHUN") return fallback;
  return { year, month, scope };
}

/**
 * The "buku berjalan" is the earliest period still open — the prototype's
 * "buku Agustus 2026" while the calendar already shows September.
 */
export async function resolveBookPeriod(companyId: string) {
  const periods = await db.fiscalPeriod.findMany({
    where: { companyId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    select: { year: true, month: true, status: true },
  });

  const open = periods.find((period) => period.status === "TERBUKA");
  const last = periods[periods.length - 1];
  const now = new Date();
  const current = open ?? last ?? { year: now.getFullYear(), month: now.getMonth() + 1, status: "TERBUKA" as const };

  const options: PeriodOption[] = [];
  for (const period of periods) {
    options.push({
      value: periodValue(period.year, period.month, "BULAN"),
      label: scopeLabel(period.year, period.month, "BULAN"),
      year: period.year,
      month: period.month,
      scope: "BULAN",
    });
  }
  if (periods.length > 0) {
    options.push({
      value: periodValue(current.year, current.month, "KUARTAL"),
      label: scopeLabel(current.year, current.month, "KUARTAL"),
      year: current.year,
      month: current.month,
      scope: "KUARTAL",
    });
    options.push({
      value: periodValue(current.year, current.month, "TAHUN"),
      label: scopeLabel(current.year, current.month, "TAHUN"),
      year: current.year,
      month: current.month,
      scope: "TAHUN",
    });
  }

  return {
    year: current.year,
    month: current.month,
    scope: "BULAN" as PeriodScope,
    status: current.status,
    periods,
    options,
  };
}

// ── Scope ───────────────────────────────────────────────────

/** The active company plus every entity linked to it through `Company.parentId`. */
export async function companyTreeIds(companyId: string): Promise<string[]> {
  const ids = [companyId];
  let frontier = [companyId];
  for (let depth = 0; depth < 6 && frontier.length > 0; depth += 1) {
    const children = await db.company.findMany({
      where: { parentId: { in: frontier }, isActive: true },
      select: { id: true },
    });
    frontier = children.map((child) => child.id).filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
}

export async function loadAccounts(companyIds: string[]): Promise<AccountRef[]> {
  const accounts = await db.account.findMany({
    where: { companyId: { in: companyIds }, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, companyId: true, code: true, name: true, type: true, normalBalance: true, isPostable: true },
  });
  return accounts as AccountRef[];
}

/** Every posted line up to `to`; the callers bucket them by date in memory. */
export async function loadPostedLines(options: {
  companyIds: string[];
  unitIds?: string[];
  to: Date;
  from?: Date;
}): Promise<LedgerLine[]> {
  const lines = await db.journalLine.findMany({
    where: {
      entry: {
        status: "DIPOSTING",
        companyId: { in: options.companyIds },
        ...(options.unitIds ? { unitId: { in: options.unitIds } } : {}),
        date: { lte: options.to, ...(options.from ? { gte: options.from } : {}) },
      },
    },
    select: {
      accountId: true,
      debit: true,
      credit: true,
      entry: { select: { companyId: true, unitId: true, date: true } },
    },
  });

  return lines.map((line) => ({
    companyId: line.entry.companyId,
    unitId: line.entry.unitId,
    accountId: line.accountId,
    date: line.entry.date,
    debit: toNumber(line.debit),
    credit: toNumber(line.credit),
  }));
}

// ── Folding ─────────────────────────────────────────────────

export function foldByAccount(lines: LedgerLine[], keep: (line: LedgerLine) => boolean): Map<string, Totals> {
  const map = new Map<string, Totals>();
  for (const line of lines) {
    if (!keep(line)) continue;
    const current = map.get(line.accountId) ?? { debit: 0, credit: 0 };
    current.debit += line.debit;
    current.credit += line.credit;
    map.set(line.accountId, current);
  }
  return map;
}

export function foldByUnitAndAccount(lines: LedgerLine[], keep: (line: LedgerLine) => boolean) {
  const map = new Map<string, Map<string, Totals>>();
  for (const line of lines) {
    if (!keep(line)) continue;
    let perUnit = map.get(line.unitId);
    if (!perUnit) {
      perUnit = new Map<string, Totals>();
      map.set(line.unitId, perUnit);
    }
    const current = perUnit.get(line.accountId) ?? { debit: 0, credit: 0 };
    current.debit += line.debit;
    current.credit += line.credit;
    perUnit.set(line.accountId, current);
  }
  return map;
}

export function signedOf(totals: Totals | undefined, normalBalance: NormalBalance): number {
  if (!totals) return 0;
  return normalBalance === "DEBIT" ? totals.debit - totals.credit : totals.credit - totals.debit;
}

export function balanceOf(balances: Map<string, Totals>, account: AccountRef): number {
  return signedOf(balances.get(account.id), account.normalBalance);
}

export function sumAccounts(balances: Map<string, Totals>, accounts: AccountRef[]): number {
  return accounts.reduce((total, account) => total + balanceOf(balances, account), 0);
}

// ── Account classification ──────────────────────────────────

export function isPostableAccount(account: AccountRef) {
  return account.isPostable;
}

export function isCurrentAsset(account: AccountRef) {
  return account.type === "ASET" && !account.code.startsWith("1-2");
}

export function isFixedAsset(account: AccountRef) {
  return account.type === "ASET" && account.code.startsWith("1-2");
}

export function isCogs(account: AccountRef) {
  return account.type === "BEBAN" && account.code.startsWith("5-");
}

export function isOperatingExpense(account: AccountRef) {
  return account.type === "BEBAN" && account.code.startsWith("6-");
}

export function isOtherExpense(account: AccountRef) {
  return account.type === "BEBAN" && !isCogs(account) && !isOperatingExpense(account);
}

/** Contra accounts (accumulated depreciation) print inside parentheses. */
export function isContraAsset(account: AccountRef) {
  return account.type === "ASET" && /akumulasi/i.test(account.name);
}

/** Inter-unit current accounts ("RAK") are what the consolidation worksheet eliminates. */
export function isInterUnitAccount(account: AccountRef) {
  return /\bRAK\b|antar[- ]unit|antar[- ]cabang/i.test(account.name);
}

export function matchesName(account: AccountRef, pattern: RegExp) {
  return pattern.test(account.name);
}

// ── Neraca ──────────────────────────────────────────────────

function sectionOf(
  key: string,
  title: string,
  totalLabel: string,
  accounts: AccountRef[],
  balances: Map<string, Totals>,
  extraRows: StatementRow[] = [],
): StatementSection {
  const rows: StatementRow[] = accounts.map((account) => ({
    key: account.id,
    code: account.code,
    label: account.name,
    value: balanceOf(balances, account),
    contra: isContraAsset(account),
  }));
  rows.push(...extraRows);
  return { key, title, rows, total: rows.reduce((sum, row) => sum + row.value, 0), totalLabel };
}

export function buildBalanceSheet(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  fiscalYearStart: Date;
  to: Date;
}): BalanceSheet {
  const postable = input.accounts.filter(isPostableAccount);
  const cumulative = foldByAccount(input.lines, (line) => line.date <= input.to);
  const priorYears = foldByAccount(input.lines, (line) => line.date < input.fiscalYearStart);
  const thisYear = foldByAccount(
    input.lines,
    (line) => line.date >= input.fiscalYearStart && line.date <= input.to,
  );

  const revenueAccounts = postable.filter((account) => account.type === "PENDAPATAN");
  const expenseAccounts = postable.filter((account) => account.type === "BEBAN");

  const priorProfit =
    sumAccounts(priorYears, revenueAccounts) - sumAccounts(priorYears, expenseAccounts);
  const currentProfit =
    sumAccounts(thisYear, revenueAccounts) - sumAccounts(thisYear, expenseAccounts);

  const assetSections = [
    sectionOf("lancar", "Aset Lancar", "Jumlah aset lancar", postable.filter(isCurrentAsset), cumulative),
    sectionOf("tetap", "Aset Tetap", "Jumlah aset tetap", postable.filter(isFixedAsset), cumulative),
  ];
  const totalAssets = assetSections.reduce((sum, section) => sum + section.total, 0);

  const liabilitySection = sectionOf(
    "liabilitas",
    "Liabilitas jangka pendek",
    "Jumlah liabilitas",
    postable.filter((account) => account.type === "KEWAJIBAN"),
    cumulative,
  );

  const equitySection = sectionOf(
    "ekuitas",
    "Ekuitas",
    "Jumlah ekuitas",
    postable.filter((account) => account.type === "EKUITAS"),
    cumulative,
    [
      { key: "saldo-laba-awal", label: "Saldo laba awal periode", value: priorProfit },
      { key: "laba-berjalan", label: "Laba Tahun Berjalan", value: currentProfit },
    ],
  );

  const totalLiabilitiesEquity = liabilitySection.total + equitySection.total;

  return {
    assetSections,
    totalAssets,
    liabilitySection,
    equitySection,
    totalLiabilitiesEquity,
    difference: Math.round((totalAssets - totalLiabilitiesEquity) * 100) / 100,
  };
}

// ── Laba rugi ───────────────────────────────────────────────

function incomeRowsFor(
  accounts: AccountRef[],
  current: Map<string, Totals>,
  previous: Map<string, Totals>,
): IncomeRow[] {
  return accounts.map((account) => ({
    key: account.id,
    code: account.code,
    label: account.name,
    current: balanceOf(current, account),
    previous: balanceOf(previous, account),
  }));
}

export function buildIncomeStatement(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}): IncomeStatement {
  const postable = input.accounts.filter(isPostableAccount);
  const current = foldByAccount(input.lines, (line) => line.date >= input.from && line.date <= input.to);
  const previous = foldByAccount(
    input.lines,
    (line) => line.date >= input.previousFrom && line.date <= input.previousTo,
  );

  const revenueAccounts = postable.filter((account) => account.type === "PENDAPATAN");
  const cogsAccounts = postable.filter(isCogs);
  const opexAccounts = postable.filter(isOperatingExpense);
  const otherAccounts = postable.filter(isOtherExpense);

  const rows: IncomeRow[] = [];
  const total = (accounts: AccountRef[], map: Map<string, Totals>) => sumAccounts(map, accounts);

  rows.push(...incomeRowsFor(revenueAccounts, current, previous));
  rows.push({
    key: "total-pendapatan",
    label: "Jumlah pendapatan",
    current: total(revenueAccounts, current),
    previous: total(revenueAccounts, previous),
    strong: true,
  });
  rows.push(...incomeRowsFor(cogsAccounts, current, previous));
  const grossProfit = total(revenueAccounts, current) - total(cogsAccounts, current);
  rows.push({
    key: "laba-kotor",
    label: "Laba kotor",
    current: grossProfit,
    previous: total(revenueAccounts, previous) - total(cogsAccounts, previous),
    strong: true,
  });
  rows.push(...incomeRowsFor(opexAccounts, current, previous));
  const operatingProfit = grossProfit - total(opexAccounts, current);
  rows.push({
    key: "laba-usaha",
    label: "Laba usaha",
    current: operatingProfit,
    previous: total(revenueAccounts, previous) - total(cogsAccounts, previous) - total(opexAccounts, previous),
    strong: true,
  });
  if (otherAccounts.length > 0) rows.push(...incomeRowsFor(otherAccounts, current, previous));
  const netProfit = operatingProfit - total(otherAccounts, current);
  rows.push({
    key: "laba-bersih",
    label: "Laba bersih",
    current: netProfit,
    previous:
      total(revenueAccounts, previous) -
      total(cogsAccounts, previous) -
      total(opexAccounts, previous) -
      total(otherAccounts, previous),
    strong: true,
  });

  return {
    rows,
    revenue: total(revenueAccounts, current),
    cogs: total(cogsAccounts, current),
    grossProfit,
    opex: total(opexAccounts, current),
    operatingProfit,
    otherExpense: total(otherAccounts, current),
    netProfit,
  };
}

// ── Arus kas (metode tidak langsung) ────────────────────────

export function buildCashFlow(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  from: Date;
  to: Date;
  netProfit: number;
}): CashFlow {
  const postable = input.accounts.filter(isPostableAccount);
  const inPeriod = foldByAccount(input.lines, (line) => line.date >= input.from && line.date <= input.to);
  const beforePeriod = foldByAccount(input.lines, (line) => line.date < input.from);
  const cumulative = foldByAccount(input.lines, (line) => line.date <= input.to);

  const pick = (predicate: (account: AccountRef) => boolean) => postable.filter(predicate);
  const movement = (accounts: AccountRef[]) => sumAccounts(inPeriod, accounts);

  const cashAccounts = pick((account) => account.type === "ASET" && /^(kas|bank)/i.test(account.name));
  const receivables = pick((account) => account.type === "ASET" && /piutang/i.test(account.name));
  const inventory = pick((account) => account.type === "ASET" && /persediaan/i.test(account.name));
  const payables = pick((account) => account.type === "KEWAJIBAN" && /hutang usaha|utang usaha/i.test(account.name));
  const depreciationExpense = pick((account) => account.type === "BEBAN" && /penyusutan/i.test(account.name));
  const fixedAssets = pick((account) => isFixedAsset(account) && !isContraAsset(account));
  const equityAccounts = pick((account) => account.type === "EKUITAS" && /modal/i.test(account.name));

  const depreciation = movement(depreciationExpense);
  const receivableIncrease = movement(receivables);
  const inventoryIncrease = movement(inventory);
  const payableIncrease = movement(payables);
  const fixedAssetPurchase = movement(fixedAssets);
  const equityInflow = movement(equityAccounts);

  const operating =
    input.netProfit + depreciation - receivableIncrease - inventoryIncrease + payableIncrease;
  const investing = -fixedAssetPurchase;
  const financing = equityInflow;
  const netChange = operating + investing + financing;

  const openingCash = sumAccounts(beforePeriod, cashAccounts);
  const closingCash = sumAccounts(cumulative, cashAccounts);

  const operatingRows: CashFlowRow[] = [
    { key: "laba", label: "Laba sebelum pajak", value: input.netProfit },
    { key: "penyusutan", label: "Penyesuaian: beban penyusutan", value: depreciation },
    { key: "piutang", label: "Kenaikan piutang usaha", value: receivableIncrease, contra: true },
    { key: "persediaan", label: "Kenaikan persediaan", value: inventoryIncrease, contra: true },
    { key: "utang", label: "Kenaikan utang usaha", value: payableIncrease },
    { key: "operasi", label: "Kas bersih dari operasi", value: operating, total: true },
  ];

  const investingRows: CashFlowRow[] = [
    { key: "aset", label: "Pembelian aset tetap", value: fixedAssetPurchase, contra: true },
    { key: "investasi", label: "Kas bersih dari investasi", value: investing, total: true, contra: true },
  ];

  const financingRows: CashFlowRow[] = [
    { key: "modal", label: "Setoran modal pemegang saham", value: equityInflow },
    { key: "pendanaan", label: "Kas bersih dari pendanaan", value: financing, total: true },
  ];

  return {
    sections: [
      { key: "operasi", title: "Arus kas dari aktivitas operasi", rows: operatingRows },
      { key: "investasi", title: "Arus kas dari aktivitas investasi", rows: investingRows },
      { key: "pendanaan", title: "Arus kas dari aktivitas pendanaan", rows: financingRows },
    ],
    netChange,
    openingCash,
    closingCash,
  };
}

// ── Rasio keuangan ──────────────────────────────────────────

export function buildRatios(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  fiscalYearStart: Date;
  to: Date;
}) {
  const postable = input.accounts.filter(isPostableAccount);
  const cumulative = foldByAccount(input.lines, (line) => line.date <= input.to);
  const inYear = foldByAccount(
    input.lines,
    (line) => line.date >= input.fiscalYearStart && line.date <= input.to,
  );

  const currentAssets = sumAccounts(cumulative, postable.filter(isCurrentAsset));
  const liabilities = sumAccounts(cumulative, postable.filter((account) => account.type === "KEWAJIBAN"));
  const equityAccounts = postable.filter((account) => account.type === "EKUITAS");
  const revenueAccounts = postable.filter((account) => account.type === "PENDAPATAN");
  const expenseAccounts = postable.filter((account) => account.type === "BEBAN");
  const receivables = postable.filter((account) => account.type === "ASET" && /piutang/i.test(account.name));

  const revenue = sumAccounts(inYear, revenueAccounts);
  const cogs = sumAccounts(inYear, postable.filter(isCogs));
  const netProfit = revenue - sumAccounts(inYear, expenseAccounts);
  const equity = sumAccounts(cumulative, equityAccounts) + netProfit;
  const interestAndDepreciation = sumAccounts(
    inYear,
    postable.filter((account) => account.type === "BEBAN" && /penyusutan|bunga/i.test(account.name)),
  );

  const divide = (numerator: number, denominator: number) => (denominator ? numerator / denominator : null);

  return {
    currentAssets,
    liabilities,
    equity,
    revenue,
    cogs,
    netProfit,
    receivables: sumAccounts(cumulative, receivables),
    currentRatio: divide(currentAssets, liabilities),
    der: divide(liabilities, equity),
    dscr: divide(netProfit + interestAndDepreciation, liabilities),
    grossMargin: revenue ? ((revenue - cogs) / revenue) * 100 : null,
    netMargin: revenue ? (netProfit / revenue) * 100 : null,
    roe: equity ? (netProfit / equity) * 100 : null,
    receivableTurnover: divide(revenue, sumAccounts(cumulative, receivables)),
    ebitda: netProfit + interestAndDepreciation,
  };
}

// ── Kinerja per unit bisnis (layar 34) ──────────────────────

export type UnitRef = { id: string; code: string; name: string };

/**
 * Pendapatan / beban pokok / beban operasi per unit for one range. Every figure
 * is the signed balance of that unit's posted lines, so a unit without journals
 * stays at exactly zero instead of dropping out of the table.
 */
export function buildUnitPerformance(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  units: UnitRef[];
  from: Date;
  to: Date;
}): { rows: DireksiUnitRow[]; total: DireksiUnitRow } {
  const postable = input.accounts.filter(isPostableAccount);
  const revenueAccounts = postable.filter((account) => account.type === "PENDAPATAN");
  const cogsAccounts = postable.filter(isCogs);
  const opexAccounts = postable.filter(isOperatingExpense);

  const perUnit = foldByUnitAndAccount(
    input.lines,
    (line) => line.date >= input.from && line.date <= input.to,
  );

  const rows: DireksiUnitRow[] = input.units.map((unit) => {
    const balances = perUnit.get(unit.id) ?? new Map<string, Totals>();
    const revenue = sumAccounts(balances, revenueAccounts);
    const cogs = sumAccounts(balances, cogsAccounts);
    const opex = sumAccounts(balances, opexAccounts);
    const operatingProfit = revenue - cogs - opex;
    return {
      unitId: unit.id,
      code: unit.code,
      name: unit.name,
      revenue,
      cogs,
      opex,
      operatingProfit,
      margin: ratioOf(operatingProfit, revenue),
      share: 0,
    };
  });

  const topRevenue = rows.reduce((max, row) => Math.max(max, row.revenue), 0);
  for (const row of rows) {
    row.share = topRevenue > 0 ? Math.max(0, Math.min(100, (row.revenue / topRevenue) * 100)) : 0;
  }

  const add = (pick: (row: DireksiUnitRow) => number) => rows.reduce((sum, row) => sum + pick(row), 0);
  const revenue = add((row) => row.revenue);
  const cogs = add((row) => row.cogs);
  const opex = add((row) => row.opex);
  const operatingProfit = revenue - cogs - opex;

  return {
    rows,
    total: {
      unitId: "konsolidasi",
      code: "",
      name: "Konsolidasi setelah eliminasi",
      revenue,
      cogs,
      opex,
      operatingProfit,
      margin: ratioOf(operatingProfit, revenue),
      share: 100,
    },
  };
}

/** Consolidated revenue per month, for the prototype's six-month bar chart. */
export function buildRevenueTrend(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  year: number;
  month: number;
  count?: number;
}) {
  const revenueAccounts = input.accounts.filter(
    (account) => isPostableAccount(account) && account.type === "PENDAPATAN",
  );
  const months = trailingMonths(input.year, input.month, input.count ?? 6);
  const values = months.map((item) => {
    const from = startOfMonth(item.year, item.month);
    const to = endOfMonth(item.year, item.month);
    const balances = foldByAccount(input.lines, (line) => line.date >= from && line.date <= to);
    return { label: item.label, value: sumAccounts(balances, revenueAccounts) };
  });
  const top = values.reduce((max, item) => Math.max(max, item.value), 0);
  return values.map((item) => ({
    ...item,
    ratio: top > 0 ? Math.max(0, Math.min(100, (item.value / top) * 100)) : 0,
  }));
}

// ── Kertas kerja konsolidasi (layar 09) ─────────────────────

function consolidationRow(
  account: AccountRef,
  units: UnitRef[],
  perUnit: Map<string, Map<string, Totals>>,
): ConsolidationRow {
  const cells = units.map((unit) =>
    signedOf(perUnit.get(unit.id)?.get(account.id), account.normalBalance),
  );
  const combined = cells.reduce((sum, value) => sum + value, 0);
  const eliminated = isInterUnitAccount(account);
  const elimination = eliminated ? combined : 0;
  return {
    key: account.id,
    code: account.code,
    label: account.name,
    cells,
    combined,
    elimination,
    consolidated: combined - elimination,
    eliminated,
    contra: isContraAsset(account),
  };
}

function totalsOf(rows: ConsolidationRow[], unitCount: number) {
  const cells = new Array(unitCount).fill(0) as number[];
  let combined = 0;
  let elimination = 0;
  let consolidated = 0;
  for (const row of rows) {
    row.cells.forEach((value, index) => {
      cells[index] += value;
    });
    combined += row.combined;
    elimination += row.elimination;
    consolidated += row.consolidated;
  }
  return { cells, combined, elimination, consolidated };
}

/**
 * The prototype's worksheet: one column per book, a combined column, the
 * elimination column (inter-unit RAK accounts net to zero) and the consolidated
 * column. Retained earnings are folded into a single synthetic equity row so the
 * worksheet balances the same way the balance sheet does.
 */
export function buildConsolidation(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  units: UnitRef[];
  to: Date;
}): { groups: ConsolidationGroup[]; difference: number; eliminationTotal: number } {
  const postable = input.accounts.filter(isPostableAccount);
  const perUnit = foldByUnitAndAccount(input.lines, (line) => line.date <= input.to);

  const assetRows = postable
    .filter((account) => account.type === "ASET")
    .map((account) => consolidationRow(account, input.units, perUnit));

  const liabilityEquityRows = postable
    .filter((account) => account.type === "KEWAJIBAN" || account.type === "EKUITAS")
    .map((account) => consolidationRow(account, input.units, perUnit));

  const revenueAccounts = postable.filter((account) => account.type === "PENDAPATAN");
  const expenseAccounts = postable.filter((account) => account.type === "BEBAN");
  const retainedCells = input.units.map((unit) => {
    const balances = perUnit.get(unit.id) ?? new Map<string, Totals>();
    return sumAccounts(balances, revenueAccounts) - sumAccounts(balances, expenseAccounts);
  });
  const retainedCombined = retainedCells.reduce((sum, value) => sum + value, 0);
  liabilityEquityRows.push({
    key: "saldo-laba",
    code: "",
    label: "Saldo laba & laba berjalan",
    cells: retainedCells,
    combined: retainedCombined,
    elimination: 0,
    consolidated: retainedCombined,
    eliminated: false,
    contra: false,
  });

  const groups: ConsolidationGroup[] = [
    {
      key: "aset",
      title: "Aset",
      rows: assetRows,
      totalLabel: "Total aset",
      totals: totalsOf(assetRows, input.units.length),
    },
    {
      key: "liabilitas-ekuitas",
      title: "Liabilitas & ekuitas",
      rows: liabilityEquityRows,
      totalLabel: "Total liabilitas & ekuitas",
      totals: totalsOf(liabilityEquityRows, input.units.length),
    },
  ];

  const difference = Math.round((groups[0].totals.consolidated - groups[1].totals.consolidated) * 100) / 100;
  const eliminationTotal = groups.reduce((sum, group) => sum + group.totals.elimination, 0);

  return { groups, difference, eliminationTotal };
}

// ── Kesiapan buku unit ──────────────────────────────────────

export function buildReadiness(input: {
  units: UnitRef[];
  entries: Array<{ unitId: string; status: string }>;
  periodLocked: boolean;
}): UnitReadiness[] {
  return input.units.map((unit) => {
    const own = input.entries.filter((entry) => entry.unitId === unit.id);
    const postedCount = own.filter((entry) => entry.status === "DIPOSTING").length;
    const draftCount = own.filter((entry) => entry.status === "DRAF").length;
    const considered = postedCount + draftCount;
    const status: UnitReadiness["status"] = input.periodLocked
      ? "TERKUNCI"
      : postedCount > 0
        ? "BERJALAN"
        : "BELUM";
    return {
      unitId: unit.id,
      code: unit.code,
      name: unit.name,
      status,
      postedCount,
      draftCount,
      progress: considered > 0 ? Math.round((postedCount / considered) * 100) : 0,
    };
  });
}

// ── Angka ringkas satu periode (layar 34) ───────────────────

export function isCashAccount(account: AccountRef) {
  return account.type === "ASET" && /^(kas|bank)/i.test(account.name);
}

/**
 * Headline figures for the board dashboard: revenue, net profit and EBITDA for
 * the selected range, plus the cash position accumulated up to its last day.
 */
export function buildPeriodMetrics(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
}) {
  const postable = input.accounts.filter(isPostableAccount);
  const inPeriod = foldByAccount(input.lines, (line) => line.date >= input.from && line.date <= input.to);
  const inPrevious = foldByAccount(
    input.lines,
    (line) => line.date >= input.previousFrom && line.date <= input.previousTo,
  );
  const cumulative = foldByAccount(input.lines, (line) => line.date <= input.to);

  const revenueAccounts = postable.filter((account) => account.type === "PENDAPATAN");
  const expenseAccounts = postable.filter((account) => account.type === "BEBAN");
  const addBackAccounts = postable.filter(
    (account) => account.type === "BEBAN" && /penyusutan|amortisasi|bunga/i.test(account.name),
  );
  const cashAccounts = postable.filter(isCashAccount);

  const revenue = sumAccounts(inPeriod, revenueAccounts);
  const netProfit = revenue - sumAccounts(inPeriod, expenseAccounts);
  const previousRevenue = sumAccounts(inPrevious, revenueAccounts);
  const previousNetProfit = previousRevenue - sumAccounts(inPrevious, expenseAccounts);

  return {
    revenue,
    netProfit,
    netMargin: ratioOf(netProfit, revenue),
    previousNetMargin: ratioOf(previousNetProfit, previousRevenue),
    cashAndBank: sumAccounts(cumulative, cashAccounts),
    cashAccountCount: cashAccounts.length,
    ebitda: netProfit + sumAccounts(inPeriod, addBackAccounts),
  };
}

/** Year-to-date realisation per account, for the budget watchlist. */
export function budgetOverruns(input: {
  accounts: AccountRef[];
  lines: LedgerLine[];
  budgets: Array<{ accountId: string; budget: number }>;
  fiscalYearStart: Date;
  to: Date;
}) {
  const byId = new Map(input.accounts.map((account) => [account.id, account]));
  const inYear = foldByAccount(
    input.lines,
    (line) => line.date >= input.fiscalYearStart && line.date <= input.to,
  );
  const totals = new Map<string, number>();
  for (const budget of input.budgets) {
    totals.set(budget.accountId, (totals.get(budget.accountId) ?? 0) + budget.budget);
  }
  let count = 0;
  for (const [accountId, budget] of totals) {
    const account = byId.get(accountId);
    if (!account || budget <= 0) continue;
    if (balanceOf(inYear, account) > budget) count += 1;
  }
  return count;
}
