import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import AnggaranScreen, {
  type AccountRow,
  type BudgetRow,
  type RevisionEvent,
  type UnitOption,
} from "./AnggaranScreen";

type Search = { tahun?: string };

/**
 * Kelompok akun mengikuti pengelompokan prototipe: pendapatan, beban pokok
 * (akun berawalan 5) dan beban operasi (beban lainnya).
 */
function groupOf(account: { code: string; type: string }) {
  if (account.type === "PENDAPATAN") return "Pendapatan";
  if (account.type === "BEBAN") return account.code.startsWith("5") ? "Beban pokok" : "Beban operasi";
  return "Lainnya";
}

export default async function AnggaranPage({ searchParams }: { searchParams: Promise<Search> }) {
  const context = await requireActiveContext();
  const query = await searchParams;

  const now = new Date();
  const currentYear = now.getFullYear();
  const parsed = Number(query.tahun);
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : currentYear;

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
  const previousYearStart = new Date(Date.UTC(year - 1, 0, 1));

  const [accounts, units, budgets, lines, previousLines, periods] = await Promise.all([
    db.account.findMany({
      where: {
        companyId: context.companyId,
        isActive: true,
        isPostable: true,
        type: { in: ["PENDAPATAN", "BEBAN"] },
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true, normalBalance: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.budgetLine.findMany({
      where: { companyId: context.companyId, year },
      select: { accountId: true, unitId: true, budget: true, createdAt: true, updatedAt: true },
    }),
    db.journalLine.findMany({
      where: {
        entry: {
          companyId: context.companyId,
          status: "DIPOSTING",
          date: { gte: yearStart, lt: nextYearStart },
        },
      },
      select: { accountId: true, debit: true, credit: true, entry: { select: { unitId: true, date: true } } },
    }),
    db.journalLine.findMany({
      where: {
        entry: {
          companyId: context.companyId,
          status: "DIPOSTING",
          date: { gte: previousYearStart, lt: yearStart },
        },
      },
      select: { accountId: true, debit: true, credit: true, entry: { select: { unitId: true } } },
    }),
    db.fiscalPeriod.findMany({
      where: { companyId: context.companyId, year },
      orderBy: { month: "asc" },
      select: { month: true, status: true },
    }),
  ]);

  const accountById = new Map(accounts.map((account) => [account.id, account]));

  /**
   * Realisasi dihitung searah saldo normal akun supaya beban terbaca positif:
   * akun bersaldo normal debit = debit − kredit, bersaldo normal kredit = kredit − debit.
   */
  function signedAmount(accountId: string, debit: unknown, credit: unknown) {
    const account = accountById.get(accountId);
    if (!account) return null;
    const d = toNumber(debit as never);
    const c = toNumber(credit as never);
    return account.normalBalance === "DEBIT" ? d - c : c - d;
  }

  /** Realisasi per akun+buku, dipecah per bulan supaya periode bisa disaring di layar. */
  const realisation = new Map<string, number[]>();
  for (const line of lines) {
    const amount = signedAmount(line.accountId, line.debit, line.credit);
    if (amount === null) continue;
    const key = `${line.accountId}|${line.entry.unitId}`;
    const months = realisation.get(key) ?? new Array<number>(12).fill(0);
    months[line.entry.date.getUTCMonth()] += amount;
    realisation.set(key, months);
  }

  const previousRealisation = new Map<string, number>();
  for (const line of previousLines) {
    const amount = signedAmount(line.accountId, line.debit, line.credit);
    if (amount === null) continue;
    const key = `${line.accountId}|${line.entry.unitId}`;
    previousRealisation.set(key, (previousRealisation.get(key) ?? 0) + amount);
  }

  const budgetMap = new Map<string, number>();
  for (const budget of budgets) {
    const key = `${budget.accountId}|${budget.unitId}`;
    budgetMap.set(key, (budgetMap.get(key) ?? 0) + toNumber(budget.budget));
  }

  // Satu baris per akun per buku unit yang punya anggaran atau realisasi.
  const keys = new Set([...budgetMap.keys(), ...realisation.keys()]);
  const rows: BudgetRow[] = [];
  for (const key of keys) {
    const [accountId, unitId] = key.split("|");
    const account = accountById.get(accountId);
    const unit = units.find((item) => item.id === unitId);
    if (!account || !unit) continue;
    rows.push({
      accountId,
      code: account.code,
      name: account.name,
      type: account.type,
      group: groupOf(account),
      unitId,
      unitCode: unit.code,
      budget: budgetMap.get(key) ?? 0,
      monthly: realisation.get(key) ?? new Array<number>(12).fill(0),
    });
  }
  rows.sort((a, b) => a.code.localeCompare(b.code) || a.unitCode.localeCompare(b.unitCode));

  const closedMonths = periods
    .filter((period) => period.status === "DITUTUP" || period.status === "DIKUNCI")
    .map((period) => period.month);
  const periodsClosed = closedMonths.length;
  const throughMonth =
    closedMonths.length > 0
      ? Math.max(...closedMonths)
      : year === currentYear
        ? now.getMonth() + 1
        : 12;

  const approvedAt = budgets.reduce<Date | null>(
    (earliest, budget) => (earliest === null || budget.createdAt < earliest ? budget.createdAt : earliest),
    null,
  );
  const revisedAt = budgets.reduce<Date | null>(
    (latest, budget) => (latest === null || budget.updatedAt > latest ? budget.updatedAt : latest),
    null,
  );

  const revisions: RevisionEvent[] = [];
  if (approvedAt) {
    revisions.push({ date: approvedAt.toISOString(), text: `Anggaran ${year} disusun`, muted: false });
  }
  if (revisedAt && approvedAt && revisedAt.getTime() - approvedAt.getTime() > 60_000) {
    revisions.push({ date: revisedAt.toISOString(), text: "Revisi terakhir disimpan", muted: false });
  }

  const accountOptions: AccountRow[] = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type,
    group: groupOf(account),
  }));

  const unitOptions: UnitOption[] = units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

  return (
    <AnggaranScreen
      rows={rows}
      accounts={accountOptions}
      units={unitOptions}
      currentBudget={Array.from(budgetMap.entries()).map(([key, budget]) => {
        const [accountId, unitId] = key.split("|");
        return { accountId, unitId, budget };
      })}
      previousRealisation={Array.from(previousRealisation.entries()).map(([key, amount]) => {
        const [accountId, unitId] = key.split("|");
        return { accountId, unitId, amount };
      })}
      year={year}
      currentYear={currentYear}
      periodsClosed={periodsClosed}
      throughMonth={throughMonth}
      approvedAt={approvedAt ? approvedAt.toISOString() : null}
      revisions={revisions}
      unitId={context.unitId}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.ubah")}
    />
  );
}
