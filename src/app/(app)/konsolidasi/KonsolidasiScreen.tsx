"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount, formatDateTime, humanizeEnum } from "@/lib/format";
import {
  amountCell,
  contraCell,
  ledgerCell,
  type ConsolidationGroup,
  type ConsolidationRow,
  type UnitReadiness,
} from "@/app/api/reports/_lib/types";

type Option = { value: string; label: string };
type Unit = { id: string; code: string; name: string; companyCode: string };

const MODE_NOTE: Record<string, string> = {
  combine: "Eliminasi investasi, goodwill, dan kepentingan non-pengendali dinonaktifkan pada mode ini.",
  konsolidasi: "Eliminasi investasi induk, goodwill, dan kepentingan non-pengendali ikut dihitung pada mode ini.",
};

const MODE_LABEL: Record<string, string> = {
  combine: "Pusat & Cabang (Combine)",
  konsolidasi: "Pusat & Anak (Konsolidasi)",
};

const READY_CHIP: Record<UnitReadiness["status"], string> = {
  TERKUNCI: "chip chip-lock",
  BERJALAN: "chip chip-warn",
  BELUM: "chip chip-bad",
};

const READY_LABEL: Record<UnitReadiness["status"], string> = {
  TERKUNCI: "Terkunci",
  BERJALAN: "Berjalan",
  BELUM: "Belum ada jurnal",
};

export default function KonsolidasiScreen({
  periodOptions,
  periodValue,
  monthLabel,
  units,
  groups,
  difference,
  eliminationTotal,
  readiness,
  eliminationEntries,
  history,
  multiCompany,
}: {
  periodOptions: Option[];
  periodValue: string;
  monthLabel: string;
  units: Unit[];
  groups: ConsolidationGroup[];
  difference: number;
  eliminationTotal: number;
  readiness: UnitReadiness[];
  eliminationEntries: Array<{ id: string; number: string; description: string; source: string; amount: number }>;
  history: Array<{ id: string; at: string; summary: string }>;
  multiCompany: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"combine" | "konsolidasi">("combine");
  const [layout, setLayout] = useState<"penuh" | "ringkas">("penuh");

  const columns = useMemo(() => {
    if (layout === "ringkas" && units.length > 1) {
      return [
        { key: units[0].id, label: units[0].code, indexes: [0] },
        {
          key: "cabang",
          label: t("Cabang"),
          indexes: units.map((_, index) => index).slice(1),
        },
      ];
    }
    return units.map((unit, index) => ({
      key: unit.id,
      label: multiCompany ? `${unit.companyCode}/${unit.code}` : unit.code,
      indexes: [index],
    }));
  }, [layout, multiCompany, t, units]);

  const cellsFor = (cells: number[]) => columns.map((column) => column.indexes.reduce((sum, index) => sum + (cells[index] ?? 0), 0));

  const notReady = readiness.filter((row) => row.status !== "TERKUNCI");
  const running = notReady.filter((row) => row.status === "BERJALAN");
  const empty = notReady.filter((row) => row.status === "BELUM");
  const balanced = difference === 0;

  return (
    <>
      <PageHead
        title={t("Konsolidasi & Eliminasi")}
        subtitle={t("Buku unit dikonsolidasi ke laporan induk")}
        actions={
          <>
            <select
              style={{ width: "auto" }}
              value={periodValue}
              disabled={pending}
              onChange={(event) => startTransition(() => router.replace(`/konsolidasi?periode=${event.target.value}`))}
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className="btn"
              onClick={() =>
                toast(
                  eliminationEntries.length === 0
                    ? t("Tidak ada transaksi antar-unit pada periode ini")
                    : `${eliminationEntries.length} ${t("transaksi antar-unit terdeteksi")}`,
                )
              }
            >
              {t("Deteksi transaksi antar-unit")}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                toast(t("Konsolidasi dijalankan untuk periode terpilih"));
                startTransition(() => router.refresh());
              }}
            >
              {t("Jalankan konsolidasi")}
            </button>
          </>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h2>{t("Dasar penggabungan")}</h2>
          <span className="sub">{t("Mengikuti struktur buku yang dipilih di Perusahaan & Entitas")}</span>
          <div className="rt">
            <select
              id="consolMode"
              style={{ width: "auto" }}
              value={mode}
              onChange={(event) => setMode(event.target.value as "combine" | "konsolidasi")}
            >
              <option value="combine">{t(MODE_LABEL.combine)}</option>
              <option value="konsolidasi">{t(MODE_LABEL.konsolidasi)}</option>
            </select>
          </div>
        </div>
        <div className="card-b" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: "34%" }}>{t("Langkah")}</th>
                <th>{t("Combine — satu badan hukum")}</th>
                <th>{t("Konsolidasi — induk & anak")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                  {t("Belum ada data")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="bal">
          <span className="k">{t("Struktur aktif")}</span>
          <span className="chip chip-info" id="consolModeChip">
            {t(MODE_LABEL[mode])}
          </span>
          <span className="k" id="consolModeNote">
            {t(MODE_NOTE[mode])}
          </span>
        </div>
      </div>

      {notReady.length > 0 && (
        <div className="note note-warn" style={{ marginBottom: 16 }}>
          {notReady.length} {t("buku belum siap")}:{" "}
          {running.length > 0 && (
            <>
              <b>{running.map((row) => row.code).join(", ")}</b>{" "}
              {t("masih berjalan")} ({running[0].progress}% {t("jurnal masuk")})
              {empty.length > 0 ? ` ${t("dan")} ` : ""}
            </>
          )}
          {empty.length > 0 && (
            <>
              <b>{empty.map((row) => row.code).join(", ")}</b> {t("belum ada jurnal")} {monthLabel}
            </>
          )}
          .{" "}
          {t(
            "Konsolidasi bisa dijalankan sebagai draf, tapi tidak bisa dikirim ke bank atau investor sebelum semua buku terkunci.",
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h2>{t("Kertas kerja konsolidasi")}</h2>
          <span className="sub">{t("Neraca ringkas · nilai dalam rupiah")}</span>
          <div className="rt">
            <select
              style={{ width: "auto" }}
              value={layout}
              onChange={(event) => setLayout(event.target.value as "penuh" | "ringkas")}
            >
              <option value="penuh">{`${t("Tampilkan")} ${units.length} ${t("kolom unit")}`}</option>
              <option value="ringkas">{t("Ringkas: pusat vs total cabang")}</option>
            </select>
            <button className="btn btn-sm" onClick={() => toast(t("Kertas kerja diekspor ke Excel"))}>
              {t("Ekspor kertas kerja")}
            </button>
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 1040 }}>
            <thead>
              <tr>
                <th style={{ width: 210 }}>{t("Akun")}</th>
                {columns.map((column) => (
                  <th key={column.key} className="r">
                    {column.label}
                  </th>
                ))}
                <th className="r" style={{ background: "var(--sunk)" }}>
                  {t("Jumlah")}
                </th>
                <th className="r" style={{ background: "var(--sunk)" }}>
                  {t("Eliminasi")}
                </th>
                <th className="r" style={{ background: "var(--ledger-bg)", color: "var(--ledger-dk)" }}>
                  {t("Konsolidasi")}
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <GroupRows
                  key={group.key}
                  group={group}
                  columnCount={columns.length}
                  cellsFor={cellsFor}
                  emptyLabel={t("Belum ada data")}
                  title={t(group.title)}
                  totalLabel={t(group.totalLabel)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="bal">
          <span className="k">{t("Neraca konsolidasi")}</span>
          <span className={balanced ? "chip chip-open" : "chip chip-bad"}>
            {balanced
              ? `${t("Seimbang · selisih")} 0`
              : `${t("Belum seimbang · selisih")} ${formatAmount(Math.abs(difference))}`}
          </span>
          <span className="k">{t("RAK setelah eliminasi")}</span>
          <span className="v num">0</span>
          <span className="k">{t("Status")}</span>
          <span className={notReady.length === 0 ? "chip chip-ok" : "chip chip-warn"}>
            {notReady.length === 0
              ? t("Final — semua buku terkunci")
              : `${t("Draf")} — ${notReady.length} ${t("buku belum terkunci")}`}
          </span>
          {eliminationTotal !== 0 && (
            <span className="k" style={{ marginLeft: "auto" }}>
              {t("Total eliminasi")} <span className="v num">{formatAmount(eliminationTotal)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-h">
            <h2>{t("Jurnal eliminasi")}</h2>
            <span className="sub">{t("Dibuat di buku konsolidasi, tidak masuk buku unit")}</span>
            <div className="rt">
              <button className="btn btn-sm" onClick={() => router.push("/jurnal")}>
                {t("Tambah eliminasi manual")}
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>{t("No.")}</th>
                <th>{t("Uraian")}</th>
                <th>{t("Sumber")}</th>
                <th className="r">{t("Nilai")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {eliminationEntries.length === 0 && (
                <tr>
                  <td colSpan={5} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {eliminationEntries.map((entry) => (
                <tr key={entry.id}>
                  <td className="num" style={{ color: "var(--ledger-dk)" }}>
                    {entry.number}
                  </td>
                  <td>{entry.description}</td>
                  <td className="sm muted">{humanizeEnum(entry.source)}</td>
                  <td className="r num">{ledgerCell(entry.amount)}</td>
                  <td className="r">
                    <button className="btn btn-sm" onClick={() => router.push("/jurnal")}>
                      {t("Lihat")}
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
              <h2>{t("Kesiapan buku unit")}</h2>
              <span className="sub">{t("Konsolidasi final butuh semua buku terkunci")}</span>
            </div>
            <table>
              <tbody>
                {readiness.length === 0 && (
                  <tr>
                    <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {readiness.map((row) => (
                  <tr key={row.unitId}>
                    <td>
                      <span className="num sm">{row.code}</span> {row.name}
                    </td>
                    <td style={{ width: "34%" }}>
                      <div className="bar">
                        <i style={{ width: `${row.progress}%` }} />
                      </div>
                    </td>
                    <td className="r">
                      <span className={READY_CHIP[row.status]}>{t(READY_LABEL[row.status])}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bal">
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn btn-sm" onClick={() => toast(t("Pengingat dikirim ke penanggung jawab buku"))}>
                  {t("Ingatkan penanggung jawab")}
                </button>
                <button className="btn btn-sm" onClick={() => router.push("/laporan-khusus")}>
                  {t("Susun laporan dari hasil ini")}
                </button>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Riwayat konsolidasi")}</h2>
            </div>
            {history.length === 0 ? (
              <div className="card-b">
                <div className="sm muted">{t("Belum ada aktivitas")}</div>
              </div>
            ) : (
              <ul className="timeline" style={{ padding: "6px 18px 12px" }}>
                {history.map((item) => (
                  <li key={item.id}>
                    <span className="tm">{formatDateTime(item.at)}</span>
                    <span>{item.summary}</span>
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

function GroupRows({
  group,
  columnCount,
  cellsFor,
  emptyLabel,
  title,
  totalLabel,
}: {
  group: ConsolidationGroup;
  columnCount: number;
  cellsFor: (cells: number[]) => number[];
  emptyLabel: string;
  title: string;
  totalLabel: string;
}) {
  const span = columnCount + 4;
  return (
    <>
      <tr>
        <td colSpan={span} className="sm muted" style={{ background: "var(--sunk)" }}>
          {title}
        </td>
      </tr>
      {group.rows.length === 0 && (
        <tr>
          <td colSpan={span} className="sm muted" style={{ padding: "18px 12px" }}>
            {emptyLabel}
          </td>
        </tr>
      )}
      {group.rows.map((row) => (
        <WorksheetRow key={row.key} row={row} cells={cellsFor(row.cells)} />
      ))}
      <tr className="tot">
        <td>{totalLabel}</td>
        {cellsFor(group.totals.cells).map((value, index) => (
          <td key={index} className="r num">
            {ledgerCell(value)}
          </td>
        ))}
        <td className="r num">{ledgerCell(group.totals.combined)}</td>
        <td className="r num" style={{ color: "var(--amber)" }}>
          {contraCell(group.totals.elimination)}
        </td>
        <td className="r num" style={{ background: "var(--ledger-bg)", color: "var(--ledger-dk)" }}>
          {ledgerCell(group.totals.consolidated)}
        </td>
      </tr>
    </>
  );
}

function WorksheetRow({ row, cells }: { row: ConsolidationRow; cells: number[] }) {
  return (
    <tr style={row.eliminated ? { background: "var(--amber-bg)" } : undefined}>
      <td>
        {row.code && <span className="num sm">{row.code}</span>} {row.label}
        {row.eliminated && (
          <span className="chip chip-warn" style={{ marginLeft: 4 }}>
            eliminasi
          </span>
        )}
      </td>
      {cells.map((value, index) => (
        <td key={index} className={value === 0 ? "r num muted" : "r num"}>
          {amountCell(value, row.contra)}
        </td>
      ))}
      <td className="r num" style={{ background: "var(--sunk)" }}>
        {amountCell(row.combined, row.contra)}
      </td>
      <td
        className={row.eliminated ? "r num" : "r num muted"}
        style={row.eliminated ? { color: "var(--amber)" } : undefined}
      >
        {row.eliminated ? contraCell(row.elimination) : ledgerCell(row.elimination)}
      </td>
      <td className="r num" style={{ background: "var(--ledger-bg)" }}>
        {row.eliminated ? "0" : amountCell(row.consolidated, row.contra)}
      </td>
    </tr>
  );
}
