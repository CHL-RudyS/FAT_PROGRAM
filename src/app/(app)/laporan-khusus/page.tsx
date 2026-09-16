import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { MONTHS_SHORT_ID } from "@/lib/format";
import {
  buildRatios,
  companyTreeIds,
  endOfMonth,
  loadAccounts,
  loadPostedLines,
  parsePeriodValue,
  periodValue,
  resolveBookPeriod,
  scopeLabel,
  scopeRange,
  startOfYear,
} from "@/app/api/reports/_lib/reporting";
import type { RatioRow } from "@/app/api/reports/_lib/types";
import LaporanKhususScreen from "./LaporanKhususScreen";

function single(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function settingText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export default async function LaporanKhususPage({
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

  const [company, units, accounts, lines, history, settings] = await Promise.all([
    db.company.findUnique({
      where: { id: context.companyId },
      select: { code: true, name: true, city: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: { in: treeIds }, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    loadAccounts(treeIds),
    loadPostedLines({ companyIds: treeIds, to: range.to }),
    db.auditLog.findMany({
      where: { entityType: "LaporanKhusus" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, createdAt: true, summary: true, user: { select: { name: true } } },
    }),
    db.systemSetting.findMany({ where: { key: { in: ["officeName", "officeTagline"] } } }),
  ]);

  const settingByKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  const current = buildRatios({ accounts, lines, fiscalYearStart: startOfYear(selected.year), to: range.to });
  const priorOne = buildRatios({
    accounts,
    lines,
    fiscalYearStart: startOfYear(selected.year - 1),
    to: endOfMonth(selected.year - 1, 12),
  });
  const priorTwo = buildRatios({
    accounts,
    lines,
    fiscalYearStart: startOfYear(selected.year - 2),
    to: endOfMonth(selected.year - 2, 12),
  });

  const ratios: RatioRow[] = [
    {
      key: "cr",
      label: "Rasio lancar",
      current: current.currentRatio,
      priorOne: priorOne.currentRatio,
      priorTwo: priorTwo.currentRatio,
      suffix: "×",
      basis: "Aset lancar ÷ liabilitas jangka pendek",
    },
    {
      key: "der",
      label: "DER",
      current: current.der,
      priorOne: priorOne.der,
      priorTwo: priorTwo.der,
      suffix: "×",
      basis: "Total liabilitas ÷ ekuitas",
    },
    {
      key: "dscr",
      label: "DSCR",
      current: current.dscr,
      priorOne: priorOne.dscr,
      priorTwo: priorTwo.dscr,
      suffix: "×",
      basis: "Laba bersih + penyusutan & bunga ÷ liabilitas",
    },
    {
      key: "margin-kotor",
      label: "Marjin kotor",
      current: current.grossMargin,
      priorOne: priorOne.grossMargin,
      priorTwo: priorTwo.grossMargin,
      suffix: "%",
      basis: "(Pendapatan − beban pokok) ÷ pendapatan",
    },
    {
      key: "margin-bersih",
      label: "Marjin bersih",
      current: current.netMargin,
      priorOne: priorOne.netMargin,
      priorTwo: priorTwo.netMargin,
      suffix: "%",
      basis: "Laba bersih ÷ pendapatan",
    },
    {
      key: "roe",
      label: "ROE",
      current: current.roe,
      priorOne: priorOne.roe,
      priorTwo: priorTwo.roe,
      suffix: "%",
      basis: "Laba bersih ÷ ekuitas akhir periode",
    },
    {
      key: "perputaran-piutang",
      label: "Perputaran piutang",
      current: current.receivableTurnover,
      priorOne: priorOne.receivableTurnover,
      priorTwo: priorTwo.receivableTurnover,
      suffix: "×",
      basis: "Pendapatan ÷ saldo piutang usaha",
    },
  ];

  // Books whose fiscal period is still open carry an asterisk in the package.
  const unlockedUnits = book.periods.some(
    (period) =>
      period.year === selected.year && period.month === selected.month && period.status !== "TERBUKA",
  )
    ? []
    : units.map((unit) => unit.code);

  return (
    <LaporanKhususScreen
      officeName={settingText(settingByKey.get("officeName"), "ARTA WIJAYA & REKAN")}
      officeTagline={settingText(settingByKey.get("officeTagline"), "Kantor Konsultan Pajak · Jakarta")}
      companyName={company?.name ?? context.company.name}
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
      periodTitle={scopeLabel(selected.year, selected.month, selected.scope)}
      asOfLabel={`per ${range.to.getDate()} ${scopeLabel(selected.year, selected.month, "BULAN")}`}
      comparativeLabels={[
        `${MONTHS_SHORT_ID[selected.month - 1]} ${selected.year}`,
        String(selected.year - 1),
        String(selected.year - 2),
      ]}
      ratios={ratios}
      units={units}
      unlockedUnits={unlockedUnits}
      history={history.map((log) => ({
        id: log.id,
        at: log.createdAt.toISOString(),
        summary: log.summary ?? "—",
        by: log.user?.name ?? "—",
      }))}
    />
  );
}
