"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount, formatDateTime, humanizeEnum } from "@/lib/format";
import {
  formatPercent,
  formatRatio,
  ledgerCell,
  type DashboardClientRow,
  type DashboardRatioRow,
  type DashboardStatusRow,
} from "@/app/api/reports/_lib/types";

type Option = { value: string; label: string };

const STATUS_CHIP: Record<DashboardStatusRow["status"], string> = {
  TERKUNCI: "chip chip-lock",
  BERJALAN: "chip chip-warn",
  BELUM: "chip chip-bad",
};

const STATUS_LABEL: Record<DashboardStatusRow["status"], string> = {
  TERKUNCI: "Terkunci",
  BERJALAN: "Berjalan",
  BELUM: "Belum mulai",
};

export default function DashboardScreen({
  asOfLabel,
  bookLabel,
  periodOptions,
  periodValue,
  owners,
  ownerValue,
  metrics,
  clients,
  ratios,
  status,
  provisionalCount,
  outOfBoundsCount,
  approvals,
  activity,
  safeLimits,
}: {
  asOfLabel: string;
  bookLabel: string;
  periodOptions: Option[];
  periodValue: string;
  owners: Array<{ id: string; name: string }>;
  ownerValue: string;
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
  safeLimits: { currentRatio: number; der: number; dscr: number };
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams({ periode: periodValue, ...(ownerValue ? { pj: ownerValue } : {}), ...patch });
    startTransition(() => router.replace(`/dashboard?${params.toString()}`));
  }

  return (
    <>
      <PageHead
        title={t("Dashboard Pembukuan")}
        subtitle={`${t("Status seluruh klien per")} ${asOfLabel} · ${t("buku")} ${bookLabel}`}
        actions={
          <>
            <select
              style={{ width: "auto" }}
              value={ownerValue}
              disabled={pending}
              onChange={(event) => apply({ pj: event.target.value })}
            >
              <option value="">{t("Semua penanggung jawab")}</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => toast(t("Ringkasan dashboard diekspor ke Excel"))}>
              {t("Ekspor ringkasan")}
            </button>
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Klien aktif")}</div>
          <div className="v">{metrics.activeClients}</div>
          <div className="d muted">
            {metrics.newThisQuarter} {t("klien baru kuartal ini")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Buku up to date")}</div>
          <div className="v">{metrics.upToDate}</div>
          <div className="d" style={{ color: "var(--ledger)" }}>
            {metrics.upToDatePct}% {t("dari klien aktif")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Tertinggal > 1 bulan")}</div>
          <div className="v" style={{ color: "var(--brick)" }}>
            {metrics.behind}
          </div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {t("Perlu tindak lanjut")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Menunggu review")}</div>
          <div className="v">{metrics.awaitingReview}</div>
          <div className="d muted">
            {t("Rata-rata tunggu")} {metrics.averageWaitDays === null ? "—" : formatPercent(metrics.averageWaitDays)}{" "}
            {t("hari")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Buku unit tertunda")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>
            {metrics.pendingUnitBooks}
          </div>
          <div className="d muted">
            {t("di")} {metrics.multiUnitClients} {t("klien multi-unit")}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h2>{t("Ringkasan laba rugi per klien")}</h2>
          <span className="sub">
            {bookLabel} · {t("konsolidasi seluruh cabang")}
          </span>
          <div className="rt">
            <select
              style={{ width: "auto" }}
              value={periodValue}
              disabled={pending}
              onChange={(event) => apply({ periode: event.target.value })}
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" onClick={() => toast(t("Ringkasan dashboard diekspor ke Excel"))}>
              {t("Ekspor")}
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: "22%" }}>{t("Perusahaan & Entitas")}</th>
                <th className="r">{t("Pendapatan")}</th>
                <th className="r">{t("HPP")}</th>
                <th className="r">{t("Laba kotor")}</th>
                <th className="r">{t("Beban Usaha")}</th>
                <th className="r">{t("Laba bersih")}</th>
                <th className="r">{t("Margin")}</th>
                <th>{t("Sumber angka")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr>
                  <td colSpan={8} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {clients.map((client) => (
                <tr key={client.companyId}>
                  <td>
                    <span className="num sm">{client.code}</span> {client.name}
                  </td>
                  <td className="r num">{ledgerCell(client.revenue)}</td>
                  <td className="r num">{ledgerCell(client.cogs)}</td>
                  <td className="r num">{ledgerCell(client.grossProfit)}</td>
                  <td className="r num">{ledgerCell(client.opex)}</td>
                  <td className="r num">{ledgerCell(client.netProfit)}</td>
                  <td className="r num">{formatPercent(client.margin)}%</td>
                  <td className="sm muted">{t(client.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bal">
          <span className="k">{t("Klien dengan buku belum lengkap ikut dijumlahkan sebagai angka sementara")}</span>
          <span className="chip chip-warn">
            {provisionalCount} {t("klien angkanya belum final")}
          </span>
          <span style={{ marginLeft: "auto" }}>
            <button className="btn btn-sm" onClick={() => router.push("/laporan")}>
              {t("Buka laporan lengkap")}
            </button>
          </span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h2>{t("Rasio keuangan per klien")}</h2>
          <span className="sub">{t("Dihitung dari buku terakhir masing-masing klien")}</span>
          <div className="rt">
            <button className="btn btn-sm" onClick={() => toast(t("Batas aman diatur di Setelan"))}>
              {t("Atur batas aman")}
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 940 }}>
            <thead>
              <tr>
                <th style={{ width: "22%" }}>{t("Perusahaan & Entitas")}</th>
                <th className="r">{t("Rasio lancar")}</th>
                <th className="r">{t("DER")}</th>
                <th className="r">{t("DSCR")}</th>
                <th className="r">{t("Margin kotor")}</th>
                <th className="r">{t("Margin bersih")}</th>
                <th className="r">{t("ROE")}</th>
                <th className="r">{t("Perputaran piutang")}</th>
                <th>{t("Catatan")}</th>
              </tr>
            </thead>
            <tbody>
              {ratios.length === 0 && (
                <tr>
                  <td colSpan={9} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {ratios.map((row) => (
                <tr key={row.companyId}>
                  <td>{row.name}</td>
                  <td className="r num">{formatRatio(row.currentRatio)}</td>
                  <td className="r num">{formatRatio(row.der)}</td>
                  <td className="r num">{formatRatio(row.dscr)}</td>
                  <td className="r num">{formatPercent(row.grossMargin)}%</td>
                  <td className="r num">{formatPercent(row.netMargin)}%</td>
                  <td className="r num">{formatPercent(row.roe)}%</td>
                  <td className="r num">{formatRatio(row.receivableTurnover)}</td>
                  <td className="sm muted">{t(row.note)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bal">
          <span className="k">{t("Batas aman kantor")}</span>
          <span className="v">
            {t("Rasio lancar")} ≥ {formatRatio(safeLimits.currentRatio)}× · {t("DER")} ≤ {formatRatio(safeLimits.der)}× ·{" "}
            {t("DSCR")} ≥ {formatRatio(safeLimits.dscr)}×
          </span>
          <span className="chip chip-bad">
            {outOfBoundsCount} {t("klien di luar batas")}
          </span>
          <span style={{ marginLeft: "auto" }}>
            <button className="btn btn-sm" onClick={() => router.push("/laporan-khusus")}>
              {t("Susun paket bank")}
            </button>
          </span>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Status pembukuan per klien")}</h2>
            <div className="rt">
              <button className="btn btn-sm" onClick={() => toast(t("Diurutkan dari klien paling tertinggal"))}>
                {t("Urut: paling tertinggal")}
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: "30%" }}>{t("Perusahaan & Entitas")}</th>
                <th>{t("Buku terakhir")}</th>
                <th>{t("Cabang")}</th>
                <th>{`${t("Progres")} ${bookLabel}`}</th>
                <th className="r">{t("Belum rekon")}</th>
                <th>{t("Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {status.length === 0 && (
                <tr>
                  <td colSpan={7} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {status.map((row) => (
                <tr key={row.companyId}>
                  <td>{row.name}</td>
                  <td className="num">{row.lastBook}</td>
                  <td className="num">{row.unitCount}</td>
                  <td>
                    <div className="bar">
                      <i style={{ width: `${row.progress}%` }} />
                    </div>
                  </td>
                  <td className="r num">{row.unreconciled === 0 ? "—" : formatAmount(row.unreconciled)}</td>
                  <td>
                    <span className={STATUS_CHIP[row.status]}>{t(STATUS_LABEL[row.status])}</span>
                  </td>
                  <td className="r">
                    <button className="btn btn-sm" onClick={() => router.push("/laporan")}>
                      {t("Buka")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Menunggu persetujuan Anda")}</h2>
            </div>
            {approvals.length === 0 ? (
              <div className="card-b">
                <div className="sm muted" style={{ padding: "6px 0" }}>
                  {t("Belum ada permintaan persetujuan")}
                </div>
              </div>
            ) : (
              <ul className="timeline" style={{ padding: "6px 18px 12px" }}>
                {approvals.map((approval) => (
                  <li key={approval.id}>
                    <span className="tm">{humanizeEnum(approval.kind)}</span>
                    <span>
                      <b>{approval.referenceNo}</b>
                      {approval.amount > 0 && <span className="num"> · {formatAmount(approval.amount)}</span>}
                      <br />
                      <span className="muted sm">
                        {approval.requester} · {formatDateTime(approval.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Aktivitas terbaru")}</h2>
            </div>
            {activity.length === 0 ? (
              <div className="card-b">
                <div className="sm muted">{t("Belum ada aktivitas")}</div>
              </div>
            ) : (
              <ul className="timeline" style={{ padding: "6px 18px 12px" }}>
                {activity.map((item) => (
                  <li key={item.id}>
                    <span className="tm">{formatDateTime(item.at)}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
