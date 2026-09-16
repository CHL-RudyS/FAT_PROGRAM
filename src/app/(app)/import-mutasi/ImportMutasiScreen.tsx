"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { dash, formatDate, formatDateTime } from "@/lib/format";

export type ImportBook = { id: string; label: string; unitCode: string };
export type ImportHistoryRow = {
  id: string;
  fileName: string;
  bankAccountLabel: string;
  rowCount: number;
  matchedCount: number;
  status: string;
  notes: string | null;
  createdAt: string;
};
export type PeriodOption = { key: string; year: number; month: number; label: string };

type PreviewRow = {
  lineNo: number;
  date: string | null;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  balance: number | null;
  valid: boolean;
  error: string | null;
};

type ColumnKey = "date" | "description" | "reference" | "debit" | "credit" | "balance";

type PreviewResult = {
  headers: string[];
  mapping: Partial<Record<ColumnKey, number>>;
  rows: PreviewRow[];
  validCount: number;
  errorCount: number;
  periodFrom: string | null;
  periodTo: string | null;
  error?: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

const COLUMN_LABELS: { key: ColumnKey; label: string; required: boolean }[] = [
  { key: "date", label: "Tanggal", required: true },
  { key: "description", label: "Keterangan", required: true },
  { key: "reference", label: "Ref", required: false },
  { key: "debit", label: "Debit", required: true },
  { key: "credit", label: "Kredit", required: true },
  { key: "balance", label: "Saldo", required: true },
];

const GUIDE = [
  "File harus berformat .xlsx, .xls, atau .csv",
  "Kolom wajib: Tanggal, Keterangan, Debit, Kredit, Saldo",
  "Tanggal dalam format DD/MM/YYYY",
  "Angka tanpa simbol Rp dan titik ribuan",
  "Maksimal 500 baris per file",
];

function StepNumber({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </span>
  );
}

function IconCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ledger)"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none", marginTop: 3 }}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.4l2.4 2.4 4.6-5" />
    </svg>
  );
}

export default function ImportMutasiScreen({
  books,
  history,
  units,
  periods,
  pendingMapping,
  unitCode,
  unitName,
}: {
  books: ImportBook[];
  history: ImportHistoryRow[];
  units: { id: string; code: string; name: string }[];
  periods: PeriodOption[];
  pendingMapping: number;
  unitCode: string;
  unitName: string;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [bankAccountId, setBankAccountId] = useState(books[0]?.id ?? "");
  const [periodKey, setPeriodKey] = useState(periods[0]?.key ?? "");
  const [targetUnit, setTargetUnit] = useState(units[0]?.id ?? "per-baris");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ColumnKey, number>>>({});
  const [skipErrors, setSkipErrors] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const period = useMemo(
    () => periods.find((item) => item.key === periodKey) ?? periods[0] ?? null,
    [periods, periodKey],
  );

  const runPreview = useCallback(
    async (
      text: string,
      name: string,
      accountId: string,
      target: PeriodOption | null,
      override: Partial<Record<ColumnKey, number>>,
    ) => {
      if (!accountId || !target) return;
      setBusy(true);
      const res = await fetch("/api/statements/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId: accountId,
          fileName: name,
          text,
          year: target.year,
          month: target.month,
          mapping: Object.keys(override).length > 0 ? override : undefined,
        }),
      });
      const data = (await res.json()) as PreviewResult & { error?: string };
      setBusy(false);

      if (!res.ok) {
        setPreview(null);
        setFileError(data.error ?? t("Gagal membaca file."));
        return;
      }
      setFileError(data.error ?? null);
      setPreview(data);
      setMapping(data.mapping ?? {});
    },
    [t],
  );

  const readFile = useCallback(
    async (file: File) => {
      setPreview(null);
      setSkipErrors(false);
      setMapping({});

      if (file.size > MAX_BYTES) {
        setFileName(file.name);
        setFileText(null);
        setFileError(t("Ukuran file melebihi 5 MB."));
        return;
      }
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        setFileName(file.name);
        setFileText(null);
        setFileError(t("File Excel belum bisa dibaca langsung — simpan sebagai .csv lalu unggah ulang."));
        return;
      }

      const text = await file.text();
      setFileName(file.name);
      setFileText(text);
      setFileError(null);
      await runPreview(text, file.name, bankAccountId, period, {});
    },
    [bankAccountId, period, runPreview, t],
  );

  function changeMapping(key: ColumnKey, value: string) {
    const next: Partial<Record<ColumnKey, number>> = { ...mapping };
    if (value === "") delete next[key];
    else next[key] = Number(value);
    setMapping(next);
    if (fileText && fileName) void runPreview(fileText, fileName, bankAccountId, period, next);
  }

  function changeAccount(value: string) {
    setBankAccountId(value);
    if (fileText && fileName) void runPreview(fileText, fileName, value, period, mapping);
  }

  function changePeriod(value: string) {
    setPeriodKey(value);
    const next = periods.find((item) => item.key === value) ?? null;
    if (fileText && fileName) void runPreview(fileText, fileName, bankAccountId, next, mapping);
  }

  function downloadTemplate() {
    const csv = [
      "Tanggal;Keterangan;Ref;Debit;Kredit;Saldo",
      "01/09/2026;Setoran tunai kasir;TRF001;5000000;0;15000000",
      "02/09/2026;Biaya administrasi bank;ADM;0;15000;14985000",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-mutasi-bank.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function submit() {
    if (!fileText || !fileName || !period) return;
    setBusy(true);
    const res = await fetch("/api/statements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankAccountId,
        fileName,
        text: fileText,
        year: period.year,
        month: period.month,
        skipErrors,
        mapping: Object.keys(mapping).length > 0 ? mapping : undefined,
      }),
    });
    const data = (await res.json()) as { error?: string; imported?: number; skipped?: number };
    setBusy(false);

    if (!res.ok) {
      setFileError(data.error ?? t("Gagal memproses import."));
      toast(data.error ?? t("Gagal memproses import."));
      return;
    }

    setFileName(null);
    setFileText(null);
    setPreview(null);
    setMapping({});
    setSkipErrors(false);
    setFileError(null);
    if (fileInput.current) fileInput.current.value = "";
    toast(`${t("Import selesai")} · ${data.imported ?? 0} ${t("baris")}`);
    router.refresh();
  }

  const importable = preview ? (skipErrors ? preview.validCount : preview.errorCount > 0 ? 0 : preview.validCount) : 0;
  const canImport = Boolean(fileText && period && bankAccountId) && !preview?.error && importable > 0 && !busy;

  return (
    <>
      <div className="head">
        <div>
          <h1>{t("Import Mutasi Bank")}</h1>
          <p>
            {t("Upload mutasi rekening bank")} — <span className="num">{unitCode}</span> {unitName}
          </p>
        </div>
        <div className="head-act">
          <button
            className="btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            onClick={() => setHistoryOpen(true)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 3v6h6M3.5 9a9 9 0 1116.5 5" />
              <path d="M12 8v4l3 2" />
            </svg>
            {t("Riwayat Import")}
          </button>
        </div>
      </div>

      <div className="grid-32">
        <div className="stack">
          <div className="card">
            <div className="card-b">
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 15 }}>
                <StepNumber>1</StepNumber>
                <h2 style={{ fontSize: 14.5, fontWeight: 600 }}>{t("Pilih Rekening Bank")}</h2>
              </div>
              <div className="row row-2" style={{ marginBottom: 0 }}>
                <div>
                  <label className="f" style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink3)" }}>
                    {t("Akun bank")}
                  </label>
                  <select value={bankAccountId} onChange={(event) => changeAccount(event.target.value)} disabled={books.length === 0}>
                    {books.length === 0 && <option value="">{t("Belum ada rekening kas/bank")}</option>}
                    {books.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="f" style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink3)" }}>
                    {t("Periode")}
                  </label>
                  <select value={periodKey} onChange={(event) => changePeriod(event.target.value)}>
                    {periods.map((item) => (
                      <option key={item.key} value={item.key}>
                        {t(item.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {books.length === 0 && (
                <div className="note note-warn" style={{ marginTop: 12 }}>
                  {t("Belum ada rekening kas/bank. Tambahkan rekening dulu di layar Kas & Bank Harian.")}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-b">
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 15 }}>
                <StepNumber>2</StepNumber>
                <h2 style={{ fontSize: 14.5, fontWeight: 600 }}>{t("Upload File Mutasi")}</h2>
              </div>
              <div
                className="dz"
                style={{ padding: "38px 26px", ...(dragging ? { borderColor: "var(--ledger)", background: "var(--ledger-bg)" } : null) }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) void readFile(file);
                }}
              >
                <svg
                  width="42"
                  height="42"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink4)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ margin: "0 auto 12px", display: "block" }}
                >
                  <path d="M6.5 17.5A4.5 4.5 0 017 8.6a6 6 0 0111.3 1.5A3.9 3.9 0 0117.5 17.5" />
                  <path d="M12 21v-8m0 0l-3 3m3-3l3 3" />
                </svg>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{fileName ?? t("Seret & lepas file di sini")}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3 }}>{t("atau")}</div>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,.xls,.xlsx,text/csv"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void readFile(file);
                  }}
                />
                <button
                  className="btn"
                  style={{ marginTop: 12, color: "var(--ledger)", borderColor: "var(--ledger)" }}
                  disabled={books.length === 0}
                  onClick={() => fileInput.current?.click()}
                >
                  {t("Pilih File")}
                </button>
                <div style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 14 }}>
                  {t("Format yang didukung: .xlsx, .xls, .csv · Maks. 5 MB")}
                </div>
              </div>
              {fileError && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "9px 11px",
                    borderRadius: 8,
                    fontSize: 12,
                    background: "var(--brick-bg)",
                    color: "var(--brick)",
                  }}
                >
                  {fileError}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-b" style={{ paddingBottom: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 15, flexWrap: "wrap" }}>
                <StepNumber>3</StepNumber>
                <h2 style={{ fontSize: 14.5, fontWeight: 600 }}>{t("Pratinjau Data")}</h2>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink3)" }}>
                  {preview ? (
                    <>
                      {fileName} —{" "}
                      <b style={{ color: "var(--ledger)", fontWeight: 500 }}>
                        {preview.validCount} {t("baris valid")}
                      </b>
                      , <b style={{ color: "var(--brick)", fontWeight: 500 }}>{preview.errorCount} {t("baris bermasalah")}</b>
                    </>
                  ) : (
                    t("Belum ada file dipilih")
                  )}
                </span>
              </div>
              {preview && preview.headers.length > 0 && (
                <div className="row row-3" style={{ marginBottom: 15 }}>
                  {COLUMN_LABELS.map((column) => (
                    <div key={column.key}>
                      <label className="f" data-req={column.required ? "1" : undefined}>
                        {t(column.label)}
                      </label>
                      <select
                        value={mapping[column.key] === undefined ? "" : String(mapping[column.key])}
                        onChange={(event) => changeMapping(column.key, event.target.value)}
                        className={column.required && mapping[column.key] === undefined ? "field-error" : undefined}
                      >
                        <option value="">{t("— Tidak dipakai —")}</option>
                        {preview.headers.map((header, index) => (
                          <option key={`${header}-${index}`} value={index}>
                            {header || `${t("Kolom")} ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ minWidth: 620, fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ width: 104 }}>{t("Tanggal")}</th>
                    <th>{t("Keterangan")}</th>
                    <th className="r">{t("Debit")}</th>
                    <th className="r">{t("Kredit")}</th>
                    <th className="r">{t("Saldo")}</th>
                    <th style={{ width: 76 }}>{t("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(!preview || preview.rows.length === 0) && (
                    <tr>
                      <td colSpan={6} className="sm muted" style={{ padding: "18px 12px" }}>
                        {t("Belum ada data")}
                      </td>
                    </tr>
                  )}
                  {preview?.rows.map((row) => (
                    <tr key={row.lineNo}>
                      <td className="num">{row.date ? formatDate(row.date) : "—"}</td>
                      <td>
                        {row.description || "—"}
                        {row.error && (
                          <span className="sm" style={{ display: "block", color: "var(--brick)" }}>
                            {t(row.error)}
                          </span>
                        )}
                      </td>
                      <td className="r num">{dash(row.debit)}</td>
                      <td className="r num">{dash(row.credit)}</td>
                      <td className="r num">{row.balance === null ? "—" : dash(row.balance)}</td>
                      <td>
                        <span className={row.valid ? "chip chip-ok" : "chip chip-bad"}>
                          {row.valid ? t("Valid") : t("Error")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 18px", display: "flex", gap: 9, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                className="btn"
                aria-pressed={skipErrors}
                style={skipErrors ? { color: "var(--ledger)", borderColor: "var(--ledger)" } : undefined}
                disabled={!preview || preview.errorCount === 0}
                onClick={() => setSkipErrors((current) => !current)}
              >
                {t("Lewati baris error")}
              </button>
              <button className="btn btn-primary" disabled={!canImport} onClick={() => void submit()}>
                {busy ? t("Memproses…") : `${t("Proses Import")} (${importable} ${t("baris")})`}
              </button>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-b">
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 13 }}>{t("Panduan Import")}</h2>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9 }}>
                {GUIDE.map((item) => (
                  <li key={item} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5 }}>
                    <IconCheck />
                    {t(item)}
                  </li>
                ))}
              </ul>
              <button
                onClick={downloadTemplate}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 15, fontSize: 12.5, fontWeight: 500, color: "var(--ledger)", cursor: "pointer" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" />
                </svg>
                {t("Unduh Template Excel")}
              </button>
            </div>
          </div>

          <div className="card" style={{ background: "var(--ledger-bg)", borderColor: "#C6DDE9" }}>
            <div className="card-b">
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t("Riwayat Import")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {history.length === 0 && <div className="sm muted">{t("Belum ada import")}</div>}
                {history.slice(0, 4).map((row) => (
                  <div key={row.id} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 12.5 }}>
                    <span className="num" style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.fileName}
                    </span>
                    <span className="num" style={{ color: "var(--ledger-dk)", fontWeight: 500, flex: "none" }}>
                      {row.rowCount} {t("baris")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-b">
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 11 }}>{t("Pemetaan Akun Lawan")}</h2>
              <p className="sm muted" style={{ marginBottom: 12 }}>
                {pendingMapping} {t("baris masih menunggu akun lawan setelah import diproses.")}
              </p>
              <div className="row" style={{ marginBottom: 0 }}>
                <div>
                  <label className="f">{t("Unit tujuan")}</label>
                  <select value={targetUnit} onChange={(event) => setTargetUnit(event.target.value)}>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code} · {unit.name}
                      </option>
                    ))}
                    <option value="per-baris">{t("Tentukan per baris dari kolom")}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={t("Riwayat Import")}
        maxWidth={720}
        footer={
          <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setHistoryOpen(false)}>
            {t("Tutup")}
          </button>
        }
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 620, fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 0 }}>{t("Berkas")}</th>
                <th>{t("Rekening")}</th>
                <th className="r" style={{ width: 80 }}>{t("Baris")}</th>
                <th className="r" style={{ width: 80 }}>{t("Cocok")}</th>
                <th style={{ width: 150, paddingRight: 0 }}>{t("Waktu")}</th>
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
              {history.map((row) => (
                <tr key={row.id}>
                  <td className="num" style={{ paddingLeft: 0 }}>
                    {row.fileName}
                    {row.notes && (
                      <span className="sm muted" style={{ display: "block" }}>
                        {row.notes}
                      </span>
                    )}
                  </td>
                  <td>{row.bankAccountLabel}</td>
                  <td className="r num">{row.rowCount}</td>
                  <td className="r num">{row.matchedCount === 0 ? "—" : row.matchedCount}</td>
                  <td className="num sm" style={{ paddingRight: 0 }}>
                    {formatDateTime(row.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>
    </>
  );
}
