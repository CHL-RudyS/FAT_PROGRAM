"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatPercent, ledgerCell, type DireksiUnitRow } from "@/app/api/reports/_lib/types";

type Option = { value: string; label: string };

export default function DireksiScreen({
  unitCount,
  bookLabel,
  periodLocked,
  periodOptions,
  periodValue,
  previousMonthLabel,
  metrics,
  rows,
  total,
  trend,
  attention,
  bankAccountCount,
}: {
  unitCount: number;
  bookLabel: string;
  periodLocked: boolean;
  periodOptions: Option[];
  periodValue: string;
  previousMonthLabel: string;
  metrics: {
    revenue: number;
    netProfit: number;
    netMargin: number | null;
    previousNetMargin: number | null;
    cashAndBank: number;
    ebitda: number;
  };
  rows: DireksiUnitRow[];
  total: DireksiUnitRow;
  trend: Array<{ label: string; value: number; ratio: number }>;
  attention: Array<{ key: string; label: string; text: string }>;
  bankAccountCount: number;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [unitFilter, setUnitFilter] = useState("");

  const visible = unitFilter ? rows.filter((row) => row.unitId === unitFilter) : rows;

  return (
    <>
      <PageHead
        title={t("Dashboard Direksi")}
        subtitle={`${t("Angka konsolidasi")} ${unitCount} ${t("unit bisnis")} · ${t("buku")} ${bookLabel} ${
          periodLocked ? t("yang sudah dikunci") : t("yang masih berjalan")
        }`}
        actions={
          <>
            <select
              style={{ width: "auto" }}
              value={periodValue}
              disabled={pending}
              onChange={(event) =>
                startTransition(() => router.replace(`/dashboard-direksi?periode=${event.target.value}`))
              }
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => toast(t("Ringkasan direksi dikirim ke pratinjau cetak"))}>
              {t("Cetak ringkasan")}
            </button>
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Pendapatan konsolidasi")}</div>
          <div className="v">{ledgerCell(metrics.revenue)}</div>
          <div className="d muted">{t("setelah eliminasi antar-unit")}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Laba bersih")}</div>
          <div className="v">{ledgerCell(metrics.netProfit)}</div>
          <div className="d muted">{t("setelah pajak")}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Marjin bersih")}</div>
          <div className="v">{formatPercent(metrics.netMargin)}%</div>
          <div className="d muted">
            {formatPercent(metrics.previousNetMargin)}% {t("pada")} {previousMonthLabel}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Kas & bank")}</div>
          <div className="v">{ledgerCell(metrics.cashAndBank)}</div>
          <div className="d muted">
            {bankAccountCount} {t("rekening")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("EBITDA")}</div>
          <div className="v">{ledgerCell(metrics.ebitda)}</div>
          <div className="d muted">{t("sebelum bunga & penyusutan")}</div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Kinerja per unit bisnis")}</h2>
            <div className="rt">
              <select style={{ width: "auto" }} value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                <option value="">{t("Semua unit")}</option>
                {rows.map((row) => (
                  <option key={row.unitId} value={row.unitId}>
                    {`${row.code} · ${row.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 900, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: "24%" }}>{t("Unit bisnis")}</th>
                  <th className="r">{t("Pendapatan")}</th>
                  <th className="r">{t("Beban pokok")}</th>
                  <th className="r">{t("Beban operasi")}</th>
                  <th className="r">{t("Laba usaha")}</th>
                  <th className="r">{t("Marjin")}</th>
                  <th style={{ width: "16%" }} />
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {visible.map((row) => (
                  <tr key={row.unitId}>
                    <td>
                      <span className="num sm">{row.code}</span> {row.name}
                    </td>
                    <td className="r num">{ledgerCell(row.revenue)}</td>
                    <td className="r num">{ledgerCell(row.cogs)}</td>
                    <td className="r num">{ledgerCell(row.opex)}</td>
                    <td className="r num">{ledgerCell(row.operatingProfit)}</td>
                    <td className="r num">{formatPercent(row.margin)}%</td>
                    <td>
                      <div className="bar">
                        <i style={{ width: `${row.share}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
                {unitFilter && (
                  <tr>
                    <td colSpan={7} className="sm muted" style={{ background: "var(--sunk)" }}>
                      {rows.length - visible.length} {t("unit lainnya")}
                    </td>
                  </tr>
                )}
                <tr className="tot">
                  <td>{t("Konsolidasi setelah eliminasi")}</td>
                  <td className="r num">{ledgerCell(total.revenue)}</td>
                  <td className="r num">{ledgerCell(total.cogs)}</td>
                  <td className="r num">{ledgerCell(total.opex)}</td>
                  <td className="r num">{ledgerCell(total.operatingProfit)}</td>
                  <td className="r num">{formatPercent(total.margin)}%</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{t("Angka diambil dari buku terkunci · eliminasi antar-unit sudah diterapkan")}</span>
            <span style={{ marginLeft: "auto" }}>
              <button className="btn btn-sm" onClick={() => router.push("/konsolidasi")}>
                {t("Lihat kertas kerja konsolidasi")}
              </button>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Tren enam bulan")}</h2>
              <span className="sub">{t("pendapatan konsolidasi")}</span>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {trend.map((point) => (
                <div key={point.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="sm muted" style={{ width: 52 }}>
                    {point.label}
                  </span>
                  <div className="bar" style={{ flex: 1 }}>
                    <i style={{ width: `${point.ratio}%` }} />
                  </div>
                  <span className="num sm" style={{ width: 34, textAlign: "right" }}>
                    {ledgerCell(point.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Perhatian direksi")}</h2>
            </div>
            <ul className="timeline" style={{ padding: "6px 18px 12px" }}>
              {attention.map((item) => (
                <li key={item.key}>
                  <span className="tm">{t(item.label)}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
            <div className="bal">
              <span style={{ marginLeft: "auto" }}>
                <button className="btn btn-sm" onClick={() => router.push("/persetujuan")}>
                  {t("Buka kotak persetujuan")}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
