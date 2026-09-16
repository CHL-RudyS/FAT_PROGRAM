import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { formatDateLong, periodLabel, toNumber } from "@/lib/format";
import {
  buildIncomeStatement,
  buildRatios,
  companyTreeIds,
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
import type {
  DashboardClientRow,
  DashboardRatioRow,
  DashboardStatusRow,
} from "@/app/api/reports/_lib/types";
import DashboardScreen from "./DashboardScreen";

function single(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const SAFE_CURRENT_RATIO = 1.2;
const SAFE_DER = 1.5;
const SAFE_DSCR = 1.2;

export default async function DashboardPage({
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

  const treeIds = await companyTreeIds(context.companyId);

  const [companies, units, accounts, lines, periods, entriesInPeriod, approvals, logs, recentJournals, statementLines, owners] =
    await Promise.all([
      db.company.findMany({
        where: { id: { in: treeIds } },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, createdAt: true },
      }),
      db.businessUnit.findMany({
        where: { companyId: { in: treeIds }, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, companyId: true },
      }),
      loadAccounts(treeIds),
      loadPostedLines({ companyIds: treeIds, to: range.to }),
      db.fiscalPeriod.findMany({
        where: { companyId: { in: treeIds } },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        select: { companyId: true, year: true, month: true, status: true },
      }),
      db.journalEntry.findMany({
        where: { companyId: { in: treeIds }, date: { gte: range.from, lte: range.to } },
        select: { companyId: true, unitId: true, status: true, createdById: true },
      }),
      db.approvalRequest.findMany({
        where: { companyId: { in: treeIds }, status: "MENUNGGU" },
        orderBy: { requestedAt: "asc" },
        take: 8,
        select: {
          id: true,
          kind: true,
          referenceNo: true,
          amount: true,
          requestedAt: true,
          requester: { select: { name: true } },
        },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, action: true, entityType: true, summary: true, createdAt: true, user: { select: { name: true } } },
      }),
      db.journalEntry.findMany({
        where: { companyId: { in: treeIds }, status: "DIPOSTING" },
        orderBy: { postedAt: "desc" },
        take: 6,
        select: { id: true, number: true, description: true, postedAt: true, createdAt: true, unit: { select: { code: true } } },
      }),
      db.bankStatementLine.findMany({
        where: { matchStatus: "BELUM_COCOK", bankAccount: { companyId: { in: treeIds } } },
        select: { id: true, bankAccount: { select: { companyId: true } } },
      }),
      db.user.findMany({
        where: { journalEntries: { some: { companyId: { in: treeIds } } } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const ownerId = single(params.pj);
  const ownerCompanyIds = ownerId
    ? new Set(entriesInPeriod.filter((entry) => entry.createdById === ownerId).map((entry) => entry.companyId))
    : null;
  const visibleCompanies = ownerCompanyIds
    ? companies.filter((company) => ownerCompanyIds.has(company.id))
    : companies;

  const bookIndex = selected.year * 12 + (selected.month - 1);

  const clients: DashboardClientRow[] = [];
  const ratios: DashboardRatioRow[] = [];
  const status: DashboardStatusRow[] = [];
  let provisionalCount = 0;
  let outOfBoundsCount = 0;
  let upToDate = 0;
  let behind = 0;

  for (const company of visibleCompanies) {
    const companyAccounts = accounts.filter((account) => account.companyId === company.id);
    const companyLines = lines.filter((line) => line.companyId === company.id);
    const companyPeriods = periods.filter((period) => period.companyId === company.id);
    const companyUnits = units.filter((unit) => unit.companyId === company.id);

    const income = buildIncomeStatement({
      accounts: companyAccounts,
      lines: companyLines,
      from: range.from,
      to: range.to,
      previousFrom: previous.from,
      previousTo: previous.to,
    });
    const ratio = buildRatios({ accounts: companyAccounts, lines: companyLines, fiscalYearStart, to: range.to });

    const selectedPeriod = companyPeriods.find(
      (period) => period.year === selected.year && period.month === selected.month,
    );
    const hasPostings = companyLines.some((line) => line.date >= range.from && line.date <= range.to);
    const locked = selectedPeriod?.status === "DITUTUP" || selectedPeriod?.status === "DIKUNCI";
    const source = !hasPostings
      ? "Belum ada jurnal"
      : locked
        ? "Buku terkunci · final"
        : "Buku berjalan · sementara";
    if (source !== "Buku terkunci · final") provisionalCount += 1;

    clients.push({
      companyId: company.id,
      code: company.code,
      name: company.name,
      revenue: income.revenue,
      cogs: income.cogs,
      grossProfit: income.grossProfit,
      opex: income.opex,
      netProfit: income.netProfit,
      margin: income.revenue ? (income.netProfit / income.revenue) * 100 : null,
      source,
    });

    const breaches: string[] = [];
    if (ratio.currentRatio !== null && ratio.currentRatio < SAFE_CURRENT_RATIO) breaches.push("rasio lancar");
    if (ratio.der !== null && ratio.der > SAFE_DER) breaches.push("DER");
    if (ratio.dscr !== null && ratio.dscr < SAFE_DSCR) breaches.push("DSCR");
    if (breaches.length > 0) outOfBoundsCount += 1;

    ratios.push({
      companyId: company.id,
      name: `${company.code} · ${company.name}`,
      currentRatio: ratio.currentRatio,
      der: ratio.der,
      dscr: ratio.dscr,
      grossMargin: ratio.grossMargin,
      netMargin: ratio.netMargin,
      roe: ratio.roe,
      receivableTurnover: ratio.receivableTurnover,
      note:
        breaches.length > 0
          ? `Di luar batas aman: ${breaches.join(", ")}`
          : ratio.currentRatio === null && ratio.der === null
            ? "Belum ada dasar perhitungan"
            : "Dalam batas aman",
    });

    const closed = [...companyPeriods].reverse().find((period) => period.status !== "TERBUKA");
    const earliestOpen = companyPeriods.find((period) => period.status === "TERBUKA");
    const behindMonths = earliestOpen ? bookIndex - (earliestOpen.year * 12 + (earliestOpen.month - 1)) : 0;
    if (behindMonths >= 1) behind += 1;
    else upToDate += 1;

    const unitsWithPostings = companyUnits.filter((unit) =>
      entriesInPeriod.some((entry) => entry.unitId === unit.id && entry.status === "DIPOSTING"),
    ).length;

    status.push({
      companyId: company.id,
      name: `${company.code} · ${company.name}`,
      lastBook: closed ? periodLabel(closed.year, closed.month) : "—",
      unitCount: companyUnits.length,
      progress: companyUnits.length > 0 ? Math.round((unitsWithPostings / companyUnits.length) * 100) : 0,
      unreconciled: statementLines.filter((line) => line.bankAccount.companyId === company.id).length,
      status: locked ? "TERKUNCI" : unitsWithPostings > 0 ? "BERJALAN" : "BELUM",
    });
  }

  const visibleIds = new Set(visibleCompanies.map((company) => company.id));
  const visibleUnits = units.filter((unit) => visibleIds.has(unit.companyId));
  const pendingUnits = visibleUnits.filter(
    (unit) => !entriesInPeriod.some((entry) => entry.unitId === unit.id && entry.status === "DIPOSTING"),
  );
  const multiUnitClients = visibleCompanies.filter((company) => {
    const own = visibleUnits.filter((unit) => unit.companyId === company.id);
    return own.length > 1 && own.some((unit) => pendingUnits.some((pending) => pending.id === unit.id));
  }).length;

  const now = new Date();
  const quarterStart = new Date(selected.year, Math.floor((selected.month - 1) / 3) * 3, 1);
  const newThisQuarter = visibleCompanies.filter((company) => company.createdAt >= quarterStart).length;

  const waitDays = approvals.map((approval) => (now.getTime() - approval.requestedAt.getTime()) / 86_400_000);

  const activity = [
    ...logs.map((log) => ({
      id: `log-${log.id}`,
      at: log.createdAt.toISOString(),
      text: `${log.summary ?? `${log.action} ${log.entityType}`}${log.user ? ` · ${log.user.name}` : ""}`,
    })),
    ...recentJournals.map((entry) => ({
      id: `jrn-${entry.id}`,
      at: (entry.postedAt ?? entry.createdAt).toISOString(),
      text: `Jurnal ${entry.number} diposting · buku ${entry.unit.code} · ${entry.description}`,
    })),
  ]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 8);

  return (
    <DashboardScreen
      asOfLabel={formatDateLong(now)}
      bookLabel={scopeLabel(selected.year, selected.month, selected.scope)}
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
      owners={owners}
      ownerValue={ownerId}
      metrics={{
        activeClients: visibleCompanies.length,
        newThisQuarter,
        upToDate,
        upToDatePct: visibleCompanies.length > 0 ? Math.round((upToDate / visibleCompanies.length) * 100) : 0,
        behind,
        awaitingReview: approvals.length,
        averageWaitDays: waitDays.length > 0 ? waitDays.reduce((sum, days) => sum + days, 0) / waitDays.length : null,
        pendingUnitBooks: pendingUnits.length,
        multiUnitClients,
      }}
      clients={clients}
      ratios={ratios}
      status={status}
      provisionalCount={provisionalCount}
      outOfBoundsCount={outOfBoundsCount}
      approvals={approvals.map((approval) => ({
        id: approval.id,
        kind: approval.kind,
        referenceNo: approval.referenceNo,
        requester: approval.requester.name,
        amount: toNumber(approval.amount),
        at: approval.requestedAt.toISOString(),
      }))}
      activity={activity}
      safeLimits={{ currentRatio: SAFE_CURRENT_RATIO, der: SAFE_DER, dscr: SAFE_DSCR }}
    />
  );
}
