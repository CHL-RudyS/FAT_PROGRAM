import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { formatDateTime, periodLabel, toNumber } from "@/lib/format";
import TutupPeriodeScreen, {
  type ChecklistItem,
  type TimelineStep,
  type UnitStatusRow,
} from "./TutupPeriodeScreen";

function bounds(year: number, month: number) {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0, 23, 59, 59, 999) };
}

export default async function TutupPeriodePage() {
  const context = await requireActiveContext();

  const periods = await db.fiscalPeriod.findMany({
    where: { companyId: context.companyId },
    orderBy: [{ year: "asc" }, { month: "asc" }],
    select: { id: true, year: true, month: true, status: true },
  });

  // Periode yang harus ditutup berikutnya: periode terbuka paling awal.
  const period = periods.find((item) => item.status === "TERBUKA") ?? periods[periods.length - 1] ?? null;

  if (!period) {
    return (
      <TutupPeriodeScreen
        periodId=""
        periodName="—"
        periodStatus="TERBUKA"
        unitLabel={`${context.unit.code} ${context.unit.name}`}
        checklist={[]}
        timeline={[]}
        units={[]}
        canClose={false}
      />
    );
  }

  const { start, end } = bounds(period.year, period.month);
  const range = { gte: start, lte: end };

  const [entries, units, reconciliations, assets, depreciations, claims, invoices, approvals] = await Promise.all([
    db.journalEntry.findMany({
      where: { companyId: context.companyId, date: range, status: { in: ["DRAF", "DIPOSTING"] } },
      select: { id: true, unitId: true, status: true, lines: { select: { debit: true, credit: true } } },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.reconciliation.findMany({
      where: { bankAccount: { companyId: context.companyId }, periodYear: period.year, periodMonth: period.month },
      select: { id: true, status: true },
    }),
    db.fixedAsset.count({ where: { companyId: context.companyId, status: "AKTIF" } }),
    db.depreciationEntry.count({
      where: {
        asset: { companyId: context.companyId, status: "AKTIF" },
        periodYear: period.year,
        periodMonth: period.month,
        postedAt: { not: null },
      },
    }),
    db.pettyCashClaim.count({
      where: { companyId: context.companyId, claimDate: range, status: { in: ["DRAF", "DIAJUKAN"] } },
    }),
    db.salesInvoice.count({ where: { companyId: context.companyId, invoiceDate: range, status: "DRAF" } }),
    db.approvalRequest.findMany({
      where: { companyId: context.companyId, kind: "TUTUP_PERIODE", referenceId: period.id },
      orderBy: { requestedAt: "desc" },
      take: 1,
      select: {
        id: true,
        status: true,
        requestedAt: true,
        resolvedAt: true,
        requester: { select: { name: true } },
        decisions: {
          orderBy: { decidedAt: "asc" },
          select: { status: true, note: true, decidedAt: true, approver: { select: { name: true } } },
        },
      },
    }),
  ]);

  function unbalanced(entry: (typeof entries)[number]) {
    const debit = Math.round(entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0) * 100);
    const credit = Math.round(entry.lines.reduce((sum, line) => sum + toNumber(line.credit), 0) * 100);
    return debit !== credit;
  }

  const draftCount = entries.filter((entry) => entry.status === "DRAF").length;
  const unbalancedCount = entries.filter(unbalanced).length;
  const openReconciliations = reconciliations.filter((item) => item.status !== "SELESAI").length;

  const previousYear = period.month === 1 ? period.year - 1 : period.year;
  const previousMonth = period.month === 1 ? 12 : period.month - 1;
  const previous = periods.find((item) => item.year === previousYear && item.month === previousMonth) ?? null;

  const checklist: ChecklistItem[] = [
    {
      label: "Seluruh jurnal periode sudah diposting",
      detail: draftCount === 0 ? "Tidak ada jurnal draf" : `${draftCount} jurnal masih draf`,
      done: draftCount === 0,
    },
    {
      label: "Seluruh jurnal seimbang",
      detail: unbalancedCount === 0 ? "Debit sama dengan kredit" : `${unbalancedCount} jurnal belum seimbang`,
      done: unbalancedCount === 0,
    },
    {
      label: "Rekonsiliasi bank selesai",
      detail:
        reconciliations.length === 0
          ? "Belum ada rekonsiliasi periode ini"
          : openReconciliations === 0
            ? `${reconciliations.length} rekonsiliasi selesai`
            : `${openReconciliations} rekonsiliasi masih berjalan`,
      done: reconciliations.length > 0 && openReconciliations === 0,
    },
    {
      label: "Penyusutan aset tetap sudah dijurnal",
      detail: assets === 0 ? "Belum ada aset tetap aktif" : `${depreciations} dari ${assets} aset terjurnal`,
      done: assets === 0 || depreciations >= assets,
    },
    {
      label: "Klaim kas kecil sudah diselesaikan",
      detail: claims === 0 ? "Tidak ada klaim menggantung" : `${claims} klaim belum selesai`,
      done: claims === 0,
    },
    {
      label: "Faktur penjualan periode sudah terbit",
      detail: invoices === 0 ? "Tidak ada faktur draf" : `${invoices} faktur masih draf`,
      done: invoices === 0,
    },
    {
      label: "Periode sebelumnya sudah ditutup",
      detail: previous
        ? previous.status === "TERBUKA"
          ? `${periodLabel(previousYear, previousMonth)} masih terbuka`
          : `${periodLabel(previousYear, previousMonth)} sudah ditutup`
        : "Tidak ada periode sebelumnya",
      done: !previous || previous.status !== "TERBUKA",
    },
  ];

  const approval = approvals[0] ?? null;
  const timeline: TimelineStep[] = [];
  if (approval) {
    timeline.push({
      state: "Selesai",
      color: "var(--ledger)",
      title: "User — pengajuan",
      detail: `${approval.requester.name} · ${formatDateTime(approval.requestedAt)}`,
    });
    if (approval.decisions.length === 0) {
      timeline.push({
        state: approval.status === "MENUNGGU" ? "Berjalan" : "Selesai",
        color: approval.status === "MENUNGGU" ? "var(--amber)" : "var(--ledger)",
        title: "Administrator — persetujuan",
        detail: "menunggu keputusan",
      });
    }
    for (const decision of approval.decisions) {
      timeline.push({
        state: decision.status === "MENUNGGU" ? "Berjalan" : "Selesai",
        color: decision.status === "DITOLAK" ? "var(--brick)" : decision.status === "MENUNGGU" ? "var(--amber)" : "var(--ledger)",
        title: "Administrator — persetujuan",
        detail: `${decision.approver.name} · ${formatDateTime(decision.decidedAt)}`,
      });
    }
  }

  const unitRows: UnitStatusRow[] = units.map((unit) => {
    const unitEntries = entries.filter((entry) => entry.unitId === unit.id);
    const blocking = unitEntries.filter((entry) => entry.status === "DRAF" || unbalanced(entry)).length;
    return {
      id: unit.id,
      label: `${unit.code} · ${unit.name}`,
      status:
        period.status === "DIKUNCI"
          ? "Terkunci"
          : period.status === "DITUTUP"
            ? "Ditutup"
            : blocking > 0
              ? `${blocking} jurnal tertahan`
              : unitEntries.length === 0
                ? "Belum ada jurnal"
                : "Siap dikunci",
      tone:
        period.status === "DIKUNCI" || period.status === "DITUTUP"
          ? "lock"
          : blocking > 0
            ? "warn"
            : unitEntries.length === 0
              ? "open"
              : "ok",
    };
  });

  return (
    <TutupPeriodeScreen
      periodId={period.id}
      periodName={periodLabel(period.year, period.month)}
      periodStatus={period.status}
      unitLabel={`${context.unit.code} ${context.unit.name}`}
      checklist={checklist}
      timeline={timeline}
      units={unitRows}
      canClose={context.user.roleCode === "ADMIN" || context.user.permissions.includes("periode.tutup")}
    />
  );
}
