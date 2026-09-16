"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatDate } from "@/lib/format";
import { formatPercent, formatRatio, type RatioRow } from "@/app/api/reports/_lib/types";

type Option = { value: string; label: string };

type Component = { key: string; title: string; hint: string; pages: number; on: boolean; preview?: boolean };

/** The package outline from the prototype — order on screen is page order. */
const COMPONENTS: Component[] = [
  { key: "sampul", title: "Sampul & kop kantor", hint: "Halaman 1", pages: 1, on: true },
  { key: "neraca", title: "Neraca komparatif 3 tahun", hint: "2 halaman", pages: 2, on: true },
  { key: "lr", title: "Laba rugi komparatif 3 tahun", hint: "1 halaman", pages: 1, on: true },
  { key: "ak", title: "Arus kas", hint: "1 halaman", pages: 1, on: true },
  { key: "rasio", title: "Rasio keuangan", hint: "CR · DER · DSCR · margin · ROE", pages: 1, on: true, preview: true },
  { key: "aging", title: "Aging piutang & utang", hint: "2 halaman · ember 30 / 60 / 90 / >90", pages: 2, on: true, preview: true },
  { key: "pinjaman", title: "Rincian pinjaman bank", hint: "Plafon, outstanding, jaminan", pages: 1, on: true, preview: true },
  { key: "catatan", title: "Catatan atas laporan keuangan", hint: "3 halaman · 18 catatan", pages: 3, on: true },
  { key: "tren", title: "Tren pertumbuhan & EBITDA", hint: "Untuk paket investor", pages: 2, on: false },
  { key: "proyeksi", title: "Proyeksi 12 bulan", hint: "Asumsi diisi manual", pages: 2, on: false },
  { key: "surat", title: "Surat pernyataan manajemen", hint: "Tanda tangan direksi", pages: 1, on: true },
  { key: "lampiran", title: "Lampiran per unit", hint: "Neraca & LR tiap buku", pages: 1, on: false },
];

const TEMPLATES = [
  "Paket kredit bank — umum",
  "Paket kredit BCA",
  "Paket kredit Mandiri",
  "Paket investor / due diligence",
  "Kustom kosong",
];

export default function LaporanKhususScreen({
  officeName,
  officeTagline,
  companyName,
  periodOptions,
  periodValue,
  periodTitle,
  asOfLabel,
  comparativeLabels,
  ratios,
  units,
  unlockedUnits,
  history,
}: {
  officeName: string;
  officeTagline: string;
  companyName: string;
  periodOptions: Option[];
  periodValue: string;
  periodTitle: string;
  asOfLabel: string;
  comparativeLabels: [string, string, string];
  ratios: RatioRow[];
  units: Array<{ id: string; code: string; name: string }>;
  unlockedUnits: string[];
  history: Array<{ id: string; at: string; summary: string; by: string }>;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [scope, setScope] = useState("konsolidasi");
  const [recipient, setRecipient] = useState("PT Bank Central Asia — KCU Jakarta");
  const [unit, setUnit] = useState("Rupiah penuh");
  const [letterhead, setLetterhead] = useState('Kop kantor konsultan + tanda "unaudited"');
  const [language, setLanguage] = useState("Indonesia");
  const [checked, setChecked] = useState<Record<string, boolean>>(
    Object.fromEntries(COMPONENTS.map((item) => [item.key, item.on])),
  );

  const selectedComponents = useMemo(() => COMPONENTS.filter((item) => checked[item.key]), [checked]);
  const totalPages = selectedComponents.reduce((sum, item) => sum + item.pages, 0);

  const pageIndex = useMemo(() => {
    let page = 1;
    const map = new Map<string, number>();
    for (const item of selectedComponents) {
      map.set(item.key, page);
      page += item.pages;
    }
    return map;
  }, [selectedComponents]);

  const previewPage = pageIndex.get("rasio") ?? 1;
  const ready = unlockedUnits.length === 0;

  // Ratios are unit-less, so the "Satuan angka" selector only labels the package.
  function cell(value: number | null, suffix: string) {
    if (value === null) return "—";
    return suffix === "%" ? `${formatPercent(value)}%` : `${formatRatio(value)}${suffix}`;
  }

  return (
    <>
      <PageHead
        title={t("Laporan Khusus")}
        subtitle={t(
          "Paket laporan atas permintaan bank atau investor · disusun dari angka buku yang sudah terkunci",
        )}
        actions={
          <>
            <button className="btn" onClick={() => toast(t("Daftar template kantor dibuka"))}>
              {t("Kelola template kantor")}
            </button>
            <button className="btn btn-primary" onClick={() => toast(t("Paket laporan khusus baru dibuat"))}>
              {t("Paket baru")}
            </button>
          </>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-b" style={{ padding: "14px 16px" }}>
          <div className="row row-4" style={{ marginBottom: 0 }}>
            <div>
              <label className="f">{t("Template")}</label>
              <select value={template} onChange={(event) => setTemplate(event.target.value)}>
                {TEMPLATES.map((item) => (
                  <option key={item} value={item}>
                    {t(item)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="f">{t("Lingkup buku")}</label>
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option value="konsolidasi">{`${t("Konsolidasi")} ${units.length} ${t("unit bisnis")}`}</option>
                {units.map((item) => (
                  <option key={item.id} value={item.id}>
                    {`${item.code} · ${item.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="f">{t("Periode & komparatif")}</label>
              <select
                value={periodValue}
                disabled={pending}
                onChange={(event) =>
                  startTransition(() => router.replace(`/laporan-khusus?periode=${event.target.value}`))
                }
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {`${option.label} · ${t("komparatif")} ${comparativeLabels[1]}, ${comparativeLabels[2]}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="f">{t("Ditujukan kepada")}</label>
              <input type="text" value={recipient} onChange={(event) => setRecipient(event.target.value)} />
            </div>
          </div>
        </div>
        <div className="bal">
          <span className={ready ? "chip chip-ok" : "chip chip-warn"}>
            {ready
              ? t("Seluruh buku dalam lingkup sudah terkunci")
              : `${t("Lingkup memuat")} ${unlockedUnits.length} ${t("buku belum terkunci")} (${unlockedUnits.join(", ")})`}
          </span>
          <span className="k">
            {t("Angka dari buku belum terkunci akan diberi tanda bintang dan catatan di halaman terakhir")}
          </span>
          <span style={{ marginLeft: "auto" }}>
            <button className="btn btn-sm" onClick={() => router.push("/konsolidasi")}>
              {t("Periksa konsolidasi")}
            </button>
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr)", gap: 16, alignItems: "start" }}>
        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Komponen laporan")}</h2>
              <span className="sub">{t("Urutan = urutan halaman")}</span>
            </div>
            <div id="compList" style={{ padding: "6px 0" }}>
              {COMPONENTS.map((item) => (
                <label
                  key={item.key}
                  style={{
                    display: "flex",
                    gap: 9,
                    alignItems: "flex-start",
                    padding: "8px 14px",
                    fontSize: 13,
                    cursor: "pointer",
                    background: item.preview ? "var(--ledger-bg)" : undefined,
                  }}
                >
                  <span style={{ color: "var(--ink4)", cursor: "grab", fontSize: 12, lineHeight: 1.6 }}>⠿</span>
                  <input
                    type="checkbox"
                    checked={checked[item.key] ?? false}
                    style={{ width: "auto", marginTop: 4 }}
                    onChange={(event) => setChecked((prev) => ({ ...prev, [item.key]: event.target.checked }))}
                  />
                  <span>
                    <b style={{ fontWeight: 500 }}>{t(item.title)}</b>
                    <br />
                    <span className="sm muted">{t(item.hint)}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="bal">
              <span className="k">{t("Terpilih")}</span>
              <span className="v" id="compCount">
                {selectedComponents.length} {t("komponen")}
              </span>
              <span className="k">{t("Perkiraan")}</span>
              <span className="v" id="pageCount">
                {totalPages} {t("halaman")}
              </span>
              <span style={{ marginLeft: "auto" }}>
                <button className="btn btn-sm" onClick={() => toast(t("Template kantor disimpan"))}>
                  {t("Simpan sebagai template")}
                </button>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Penyajian")}</h2>
            </div>
            <div className="card-b">
              <div className="row">
                <div>
                  <label className="f">{t("Satuan angka")}</label>
                  <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                    <option>{t("Rupiah penuh")}</option>
                    <option>{t("Ribuan rupiah")}</option>
                    <option>{t("Juta rupiah")}</option>
                  </select>
                </div>
              </div>
              <div className="row">
                <div>
                  <label className="f">{t("Kop & penanda")}</label>
                  <select value={letterhead} onChange={(event) => setLetterhead(event.target.value)}>
                    <option>{t('Kop kantor konsultan + tanda "unaudited"')}</option>
                    <option>{t("Kop kantor tanpa penanda")}</option>
                    <option>{t("Tanpa kop (kertas klien)")}</option>
                  </select>
                </div>
              </div>
              <div className="row" style={{ marginBottom: 0 }}>
                <div>
                  <label className="f">{t("Bahasa")}</label>
                  <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                    <option>{t("Indonesia")}</option>
                    <option>{t("Indonesia + Inggris berdampingan")}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Pratinjau halaman")}</h2>
              <span className="sub" id="pvLabel">
                {t("Halaman")} {previewPage} {t("dari")} {totalPages} · {t("Rasio keuangan")}
              </span>
              <div className="rt">
                <button className="btn btn-sm" onClick={() => toast(t("Halaman sebelumnya"))}>
                  ‹
                </button>
                <button className="btn btn-sm" onClick={() => toast(t("Halaman berikutnya"))}>
                  ›
                </button>
                <select style={{ width: "auto" }} defaultValue="100">
                  <option value="100">{t("Zoom 100%")}</option>
                  <option value="lebar">{t("Lebar halaman")}</option>
                </select>
              </div>
            </div>
            <div style={{ background: "var(--sunk)", padding: 22, display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  background: "#fff",
                  width: "100%",
                  maxWidth: 720,
                  boxShadow: "0 1px 3px rgba(22,32,27,.14)",
                  padding: "38px 42px 30px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    borderBottom: "2px solid var(--ink)",
                    paddingBottom: 10,
                    marginBottom: 4,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, letterSpacing: ".02em" }}>{officeName}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink3)" }}>{officeTagline}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 10.5, color: "var(--ink3)" }}>
                    <div>
                      {t("Disusun untuk")} {recipient}
                    </div>
                    <div className="num">
                      {periodTitle} · {t("konsolidasi")} {units.length} {t("unit bisnis")}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontSize: 9.5,
                    color: "var(--amber)",
                    letterSpacing: ".06em",
                    marginBottom: 24,
                  }}
                >
                  {ready ? t("TIDAK DIAUDIT") : t("TIDAK DIAUDIT · DRAF INTERNAL")}
                </div>

                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 2 }}>{companyName}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 22 }}>
                  {t("Rasio keuangan")} · {asOfLabel} {t("dengan komparatif dua tahun")}
                </div>

                <table style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "6px 8px" }}>{t("Rasio")}</th>
                      <th className="r" style={{ padding: "6px 8px" }}>
                        {comparativeLabels[0]}
                      </th>
                      <th className="r" style={{ padding: "6px 8px" }}>
                        {comparativeLabels[1]}
                      </th>
                      <th className="r" style={{ padding: "6px 8px" }}>
                        {comparativeLabels[2]}
                      </th>
                      <th style={{ padding: "6px 8px", width: "34%" }}>{t("Dasar perhitungan")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ratios.length === 0 && (
                      <tr>
                        <td colSpan={5} className="sm muted" style={{ padding: "18px 12px" }}>
                          {t("Belum ada data")}
                        </td>
                      </tr>
                    )}
                    {ratios.map((row) => (
                      <tr key={row.key}>
                        <td style={{ padding: "6px 8px" }}>{t(row.label)}</td>
                        <td className="r num" style={{ padding: "6px 8px" }}>
                          {cell(row.current, row.suffix)}
                        </td>
                        <td className="r num" style={{ padding: "6px 8px" }}>
                          {cell(row.priorOne, row.suffix)}
                        </td>
                        <td className="r num" style={{ padding: "6px 8px" }}>
                          {cell(row.priorTwo, row.suffix)}
                        </td>
                        <td className="sm muted" style={{ padding: "6px 8px" }}>
                          {t(row.basis)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 18, lineHeight: 1.6 }}>
                  {ready
                    ? `${t("Seluruh buku dalam lingkup sudah dikunci untuk")} ${periodTitle}. ${t("Perhitungan DSCR memakai saldo liabilitas pada akhir periode sebagaimana tercantum pada rincian pinjaman.")}`
                    : `${t("Angka")} ${periodTitle} ${t("mencakup buku unit yang belum dikunci")} (${unlockedUnits.join(", ")}) ${t("dan bersifat sementara. Perhitungan DSCR memakai saldo liabilitas pada akhir periode sebagaimana tercantum pada rincian pinjaman.")}`}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 9.5,
                    color: "var(--ink4)",
                    marginTop: 22,
                    paddingTop: 8,
                    borderTop: "1px solid var(--rule)",
                  }}
                >
                  <span>
                    {companyName} · {t(template)}
                  </span>
                  <span className="num">
                    {t("Halaman")} {previewPage} {t("dari")} {totalPages}
                  </span>
                </div>
              </div>
            </div>
            <div className="bal">
              <span className="k">{t("Persetujuan")}</span>
              <span className={ready ? "chip chip-ok" : "chip chip-warn"}>
                {ready ? t("Siap diekspor") : t("Menunggu Administrator")}
              </span>
              <span className="k">
                {t("Penerima")} {recipient} · {t("penyajian")} {t(unit)} · {t(letterhead)} · {t(language)}
              </span>
              <span
                style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}
              >
                <button
                  className="btn btn-sm"
                  disabled={!ready}
                  style={ready ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
                  onClick={() => toast(t("Paket diekspor ke PDF"))}
                >
                  {t("Ekspor PDF")}
                </button>
                <button
                  className="btn btn-sm"
                  disabled={!ready}
                  style={ready ? undefined : { opacity: 0.45, cursor: "not-allowed" }}
                  onClick={() => toast(t("Paket diekspor ke Excel"))}
                >
                  {t("Ekspor Excel")}
                </button>
                <button className="btn btn-sm btn-primary" onClick={() => toast(t("Paket disetujui dan ekspor dibuka"))}>
                  {t("Setujui & buka ekspor")}
                </button>
              </span>
            </div>
          </div>

          <div className="grid2">
            <div className="card">
              <div className="card-h">
                <h2>{t("Halaman lain dalam paket")}</h2>
              </div>
              <table>
                <tbody>
                  {selectedComponents.length === 0 && (
                    <tr>
                      <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                        {t("Belum ada data")}
                      </td>
                    </tr>
                  )}
                  {selectedComponents
                    .filter((item) => item.key !== "rasio")
                    .map((item) => (
                      <tr key={item.key}>
                        <td>{t(item.title)}</td>
                        <td className="sm muted">{t(item.hint)}</td>
                        <td className="r num">
                          {item.pages === 1
                            ? pageIndex.get(item.key)
                            : `${pageIndex.get(item.key)}–${(pageIndex.get(item.key) ?? 1) + item.pages - 1}`}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-h">
                <h2>{t("Riwayat pengiriman")}</h2>
                <span className="sub">{t("Versi tersimpan permanen")}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t("Tanggal")}</th>
                      <th>{t("Paket")}</th>
                      <th>{t("Penerima")}</th>
                      <th>{t("Disetujui")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 && (
                      <tr>
                        <td colSpan={5} className="sm muted" style={{ padding: "18px 12px" }}>
                          {t("Belum ada data")}
                        </td>
                      </tr>
                    )}
                    {history.map((item) => (
                      <tr key={item.id}>
                        <td className="num">{formatDate(item.at)}</td>
                        <td>{item.summary}</td>
                        <td>{recipient}</td>
                        <td>{item.by}</td>
                        <td className="r">
                          <button className="btn btn-sm" onClick={() => toast(t("Versi paket dibuka"))}>
                            {t("Lihat")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bal">
                <span className="k">
                  {t("Setiap unduhan tercatat di jejak audit beserta penerima dan versi angka")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
