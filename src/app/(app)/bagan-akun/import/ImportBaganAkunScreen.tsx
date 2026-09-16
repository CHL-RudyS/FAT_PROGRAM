"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount } from "@/lib/format";

export type ImportHistoryRow = {
  id: string;
  fileName: string;
  rows: number;
  ok: boolean;
};

type PreviewRow = {
  line: number;
  code: string;
  name: string;
  typeLabel: string;
  parentCode: string;
  opening: number;
  ok: boolean;
  message: string;
};

type PreviewResult = {
  fileName: string;
  rows: PreviewRow[];
  total: number;
  okCount: number;
  errorCount: number;
  imported: number;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = [".xlsx", ".xls", ".csv"];

/** Ceklis hijau pada panduan import. */
function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none", marginTop: 1 }}>
      <circle cx="12" cy="12" r="10" fill="#3D6B3C" />
      <path d="M7.6 12.4l3 3 5.8-6.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ImportBaganAkunScreen({
  history,
  unitCode,
  canEdit,
}: {
  history: ImportHistoryRow[];
  unitCode: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function preview(file: File) {
    setError("");
    setResult(null);

    const lower = file.name.toLowerCase();
    if (!ACCEPTED.some((extension) => lower.endsWith(extension))) {
      setError(t("Format berkas tidak didukung. Gunakan .xlsx, .xls, atau .csv."));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t("Ukuran berkas melebihi 5 MB."));
      return;
    }

    const content = await file.text();
    // Workbook .xlsx/.xls biner tidak bisa dibaca sebagai teks di peramban.
    if (content.startsWith("PK") || content.charCodeAt(0) === 0xd0) {
      setFileName(file.name);
      setText("");
      setError(t("Berkas Excel biner belum bisa dibaca — simpan ulang sebagai CSV lalu unggah kembali."));
      return;
    }

    setFileName(file.name);
    setText(content);
    setSkipErrors(false);
    await send(file.name, content, "pratinjau", false);
  }

  async function send(name: string, content: string, mode: "pratinjau" | "proses", skip: boolean) {
    setBusy(true);
    const res = await fetch("/api/accounts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: name, text: content, mode, skipErrors: skip }),
    });
    const data = (await res.json()) as PreviewResult & { error?: string };
    setBusy(false);

    if (!res.ok) {
      setResult(null);
      setError(data.error ?? t("Berkas gagal dibaca."));
      return null;
    }

    setError("");
    setResult(data);
    return data;
  }

  async function process() {
    if (!result || !text) return;
    const data = await send(fileName, text, "proses", skipErrors || result.errorCount === 0);
    if (!data) return;
    toast(`${data.imported} ${t("akun diimpor ke bagan akun buku")} ${unitCode}`);
    router.push("/bagan-akun");
    router.refresh();
  }

  const rows = result ? (skipErrors ? result.rows.filter((row) => row.ok) : result.rows) : [];

  return (
    <>
      <PageHead
        title={t("Import Bagan Akun")}
        subtitle={t("Unggah daftar akun dari berkas Excel atau CSV")}
        actions={
          <button className="btn" onClick={() => router.push("/bagan-akun")}>
            {t("Kembali")}
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 18, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 18px 2px" }}>
              <span
                className="num"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "var(--ledger-dk)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  flex: "none",
                }}
              >
                1
              </span>
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>{t("Upload File Bagan Akun")}</h2>
            </div>
            <div className="card-b">
              <div
                className="dz"
                style={{ padding: "34px 20px", textAlign: "center", borderColor: dragging ? "var(--ledger)" : undefined }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void preview(file);
                }}
              >
                <svg
                  width="42"
                  height="42"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink4)"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ margin: "0 auto 10px" }}
                >
                  <path d="M6.5 18a4.5 4.5 0 01-.6-8.96A6 6 0 0117.7 9.2 3.9 3.9 0 0121 13a4 4 0 01-4 4" />
                  <path d="M12 12v7M9 15l3-3 3 3" />
                </svg>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t("Seret & lepas file di sini")}</div>
                <div className="muted" style={{ fontSize: 11.5, margin: "6px 0 10px" }}>
                  {t("atau")}
                </div>
                <button className="btn" disabled={!canEdit || busy} onClick={() => fileRef.current?.click()}>
                  {t("Pilih File")}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void preview(file);
                  }}
                />
                <div className="muted" style={{ fontSize: 11, marginTop: 12 }}>
                  {t("Format yang didukung: .xlsx, .xls, .csv · Maks. 5 MB")}
                </div>
              </div>
              {error && (
                <div className="note note-warn" style={{ marginTop: 12 }}>
                  {error}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 18px 2px" }}>
              <span
                className="num"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "var(--ledger-dk)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  flex: "none",
                }}
              >
                2
              </span>
              <h2 style={{ fontSize: 14, fontWeight: 600 }}>{t("Pratinjau Data")}</h2>
              <span className="sub" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink3)" }}>
                {result ? result.fileName : t("Belum ada berkas diunggah")}
              </span>
            </div>

            {result && (
              <div style={{ overflowX: "auto", marginTop: 8 }}>
                <table style={{ minWidth: 660, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 18, whiteSpace: "nowrap" }}>{t("Kode Akun")}</th>
                      <th>{t("Nama Akun")}</th>
                      <th style={{ whiteSpace: "nowrap" }}>{t("Tipe")}</th>
                      <th style={{ whiteSpace: "nowrap" }}>{t("Induk")}</th>
                      <th className="r" style={{ whiteSpace: "nowrap" }}>
                        {t("Saldo Awal")}
                      </th>
                      <th style={{ whiteSpace: "nowrap" }}>{t("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="sm muted" style={{ padding: "18px 12px" }}>
                          {t("Belum ada data")}
                        </td>
                      </tr>
                    )}
                    {rows.map((row) => (
                      <tr key={row.line} style={row.ok ? undefined : { background: "var(--brick-bg)" }}>
                        <td className="num" style={{ paddingLeft: 18, color: row.ok ? undefined : "var(--brick)" }}>
                          {row.code || "???"}
                        </td>
                        <td>{row.name || "—"}</td>
                        <td className={row.typeLabel ? undefined : "muted"}>{row.typeLabel || "—"}</td>
                        <td className="num muted">{row.parentCode || "—"}</td>
                        <td className={row.ok ? "r num" : "r num muted"} style={row.ok ? undefined : { color: "var(--brick)" }}>
                          {row.opening === 0 ? "—" : formatAmount(row.opening)}
                        </td>
                        <td>
                          <span className={row.ok ? "chip chip-lock" : "chip chip-bad"}>{t(row.message)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!result && (
              <div style={{ padding: "26px 18px", textAlign: "center", fontSize: 12.5, color: "var(--ink3)" }}>
                {t("Pratinjau muncul setelah berkas diunggah")}
              </div>
            )}

            {result && (
              <div className="bal">
                <span className="k">
                  {result.total} {t("baris terbaca")} · {result.okCount} {t("siap diimpor")}
                </span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button
                    className="btn btn-sm"
                    disabled={busy || result.errorCount === 0}
                    onClick={() => {
                      setSkipErrors(true);
                      toast(`${result.errorCount} ${t("baris bermasalah dilewati")}`);
                    }}
                  >
                    {t("Lewati baris error")}
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!canEdit || busy || result.okCount === 0}
                    onClick={() => void process()}
                  >
                    {t("Proses Import")} ({result.okCount} {t("baris")})
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-h">
              <h2>{t("Panduan Import")}</h2>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 12, color: "var(--ink2)" }}>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <Check />
                {t("File harus berformat .xlsx, .xls, atau .csv")}
              </div>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <Check />
                {t("Kolom wajib: Kode Akun, Nama Akun, Tipe, Induk, Saldo Awal")}
              </div>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <Check />
                {t("Kode akun mengikuti format 4 digit setelah awalan kelompok")}
              </div>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <Check />
                {t("Angka tanpa simbol Rp dan titik ribuan")}
              </div>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <Check />
                {t("Maksimal 500 baris per file")}
              </div>
              <button
                onClick={() => {
                  const csv = "Kode Akun,Nama Akun,Tipe,Induk,Saldo Awal\n7-1100,Beban Pemeliharaan Kantor,Beban,7-1000,0\n";
                  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "template-bagan-akun.csv";
                  link.click();
                  URL.revokeObjectURL(url);
                  toast(t("Template Excel bagan akun diunduh"));
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 5,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--ledger-dk)",
                  cursor: "pointer",
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flex: "none" }}
                >
                  <path d="M12 4v11M8 12l4 4 4-4M5 20h14" />
                </svg>
                {t("Unduh Template Excel")}
              </button>
            </div>
          </div>

          <div className="card" style={{ background: "#EAF3F8", borderColor: "#CBDDE9" }}>
            <div className="card-h" style={{ borderColor: "#CBDDE9" }}>
              <h2 style={{ color: "#1F3F6B" }}>{t("Riwayat Import")}</h2>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 9, fontSize: 12 }}>
              {history.length === 0 && <span className="sm muted">{t("Belum ada riwayat import")}</span>}
              {history.map((item) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    className="num"
                    style={{ color: "var(--ink2)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {item.fileName}
                  </span>
                  <span
                    className="num"
                    style={{ marginLeft: "auto", color: item.ok ? "#2F7A3E" : "var(--brick)", whiteSpace: "nowrap" }}
                  >
                    {item.rows} {t("baris")}
                  </span>
                  <span className={item.ok ? "chip chip-lock" : "chip chip-bad"} style={{ flex: "none" }}>
                    {item.ok ? t("Sukses") : t("Gagal")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
