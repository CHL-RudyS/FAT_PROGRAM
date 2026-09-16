/** Shared shapes for the reporting screens. Pure types + pure helpers — no
 *  server-only imports, so client components can `import type` from here. */

export type AccountType = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";
export type NormalBalance = "DEBIT" | "KREDIT";
export type PeriodScope = "BULAN" | "KUARTAL" | "TAHUN";

/** One option in the prototype's period selector (Agustus 2026 / Kuartal III 2026 / …). */
export type PeriodOption = {
  value: string; // "2026-08-BULAN"
  label: string;
  year: number;
  month: number;
  scope: PeriodScope;
};

export type StatementRow = {
  key: string;
  code?: string;
  label: string;
  value: number;
  /** Rendered inside parentheses, like the prototype's `(—)` cells. */
  contra?: boolean;
};

export type StatementSection = {
  key: string;
  title: string;
  rows: StatementRow[];
  total: number;
  totalLabel: string;
};

export type BalanceSheet = {
  assetSections: StatementSection[];
  totalAssets: number;
  liabilitySection: StatementSection;
  equitySection: StatementSection;
  totalLiabilitiesEquity: number;
  difference: number;
};

export type IncomeRow = { key: string; code?: string; label: string; current: number; previous: number; strong?: boolean };

export type IncomeStatement = {
  rows: IncomeRow[];
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  operatingProfit: number;
  otherExpense: number;
  netProfit: number;
};

export type CashFlowRow = { key: string; label: string; value: number; contra?: boolean; total?: boolean; strong?: boolean };
export type CashFlowSection = { key: string; title: string; rows: CashFlowRow[] };

export type CashFlow = {
  sections: CashFlowSection[];
  netChange: number;
  openingCash: number;
  closingCash: number;
};

export type LaporanPayload = {
  periodLabel: string;
  rangeLabel: string;
  scopeLabel: string;
  unitCount: number;
  balanceSheet: BalanceSheet;
  income: IncomeStatement;
  cashFlow: CashFlow;
};

export type ConsolidationCell = { unitId: string; value: number };

export type ConsolidationRow = {
  key: string;
  code: string;
  label: string;
  /** Per-unit figures, in the same order as `units`. */
  cells: number[];
  combined: number;
  elimination: number;
  consolidated: number;
  eliminated: boolean;
  contra: boolean;
};

export type ConsolidationGroup = {
  key: string;
  title: string;
  rows: ConsolidationRow[];
  totalLabel: string;
  totals: { cells: number[]; combined: number; elimination: number; consolidated: number };
};

export type UnitReadiness = {
  unitId: string;
  code: string;
  name: string;
  status: "TERKUNCI" | "BERJALAN" | "BELUM";
  postedCount: number;
  draftCount: number;
  progress: number;
};

export type KonsolidasiPayload = {
  periodLabel: string;
  units: Array<{ id: string; code: string; name: string; companyCode: string }>;
  groups: ConsolidationGroup[];
  difference: number;
  eliminationTotal: number;
  readiness: UnitReadiness[];
  eliminationEntries: Array<{ id: string; number: string; description: string; source: string; amount: number }>;
  history: Array<{ id: string; at: string; summary: string }>;
  notReadyUnits: string[];
  lockedAll: boolean;
};

export type DireksiUnitRow = {
  unitId: string;
  code: string;
  name: string;
  revenue: number;
  cogs: number;
  opex: number;
  operatingProfit: number;
  margin: number | null;
  share: number;
};

export type DireksiPayload = {
  periodLabel: string;
  unitCount: number;
  rows: DireksiUnitRow[];
  total: DireksiUnitRow;
  metrics: {
    revenue: number;
    netProfit: number;
    netMargin: number | null;
    previousNetMargin: number | null;
    cashAndBank: number;
    cashAccountCount: number;
    ebitda: number;
  };
  trend: Array<{ label: string; value: number; ratio: number }>;
  attention: Array<{ key: string; label: string; text: string }>;
};

export type DashboardClientRow = {
  companyId: string;
  code: string;
  name: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  netProfit: number;
  margin: number | null;
  source: string;
};

export type DashboardRatioRow = {
  companyId: string;
  name: string;
  currentRatio: number | null;
  der: number | null;
  dscr: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  roe: number | null;
  receivableTurnover: number | null;
  note: string;
};

export type DashboardStatusRow = {
  companyId: string;
  name: string;
  lastBook: string;
  unitCount: number;
  progress: number;
  unreconciled: number;
  status: "TERKUNCI" | "BERJALAN" | "BELUM";
};

export type DashboardPayload = {
  periodLabel: string;
  asOfLabel: string;
  metrics: {
    activeClients: number;
    newThisQuarter: number;
    upToDate: number;
    upToDatePct: number;
    behind: number;
    awaitingReview: number;
    averageWaitDays: number | null;
    pendingUnitBooks: number;
    multiUnitClients: number;
  };
  clients: DashboardClientRow[];
  ratios: DashboardRatioRow[];
  status: DashboardStatusRow[];
  provisionalCount: number;
  outOfBoundsCount: number;
  approvals: Array<{ id: string; kind: string; referenceNo: string; requester: string; amount: number; at: string }>;
  activity: Array<{ id: string; at: string; text: string }>;
};

export type RatioRow = {
  key: string;
  label: string;
  current: number | null;
  priorOne: number | null;
  priorTwo: number | null;
  suffix: string;
  basis: string;
};

export type LaporanKhususPayload = {
  periodLabel: string;
  comparativeLabels: [string, string, string];
  ratios: RatioRow[];
  unitOptions: Array<{ id: string; code: string; name: string }>;
  unlockedUnits: string[];
  history: Array<{ id: string; at: string; packageName: string; recipient: string; approver: string }>;
};

/** Percentage of `part` in `whole`, or null when the base is zero. */
export function ratioOf(part: number, whole: number): number | null {
  if (!whole) return null;
  return (part / whole) * 100;
}

/** The prototype prints percentages as "—%" when there is no base yet. */
export function formatPercent(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Ratio figures (1,24×) — the prototype writes them with a comma decimal. */
export function formatRatio(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** Money cell that renders `(1.234)` for negatives and `—` for zero. */
export function ledgerCell(value: number): string {
  if (!value) return "—";
  const text = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.abs(value));
  return value < 0 ? `(${text})` : text;
}

/** Contra cell — always in parentheses, `(—)` when the ledger is still empty. */
export function contraCell(value: number): string {
  if (!value) return "(—)";
  return `(${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.abs(value))})`;
}

/** A money cell that knows whether its row prints inside parentheses. */
export function amountCell(value: number, contra?: boolean): string {
  return contra ? contraCell(value) : ledgerCell(value);
}
