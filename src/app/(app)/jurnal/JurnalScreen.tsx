"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount, formatDate, parseAmountInput, toInputDate } from "@/lib/format";

export type LedgerAccountOption = { id: string; code: string; name: string };
export type UnitOption = { id: string; code: string; name: string };

export type JournalSourceValue =
  | "MANUAL"
  | "IMPOR"
  | "FAKTUR_PENJUALAN"
  | "PEMBELIAN"
  | "KAS_KECIL"
  | "PENYUSUTAN"
  | "PENYESUAIAN";

export type JournalRow = {
  id: string;
  number: string;
  date: string;
  description: string;
  reference: string | null;
  source: JournalSourceValue;
  unitId: string;
  unitCode: string;
  amount: number;
};

const SOURCE_LABELS: Array<[JournalSourceValue, string]> = [
  ["MANUAL", "Manual"],
  ["IMPOR", "Import bank"],
  ["FAKTUR_PENJUALAN", "Faktur penjualan"],
  ["PEMBELIAN", "Pembelian"],
  ["KAS_KECIL", "Kas kecil"],
  ["PENYUSUTAN", "Penyusutan"],
  ["PENYESUAIAN", "Penyesuaian"],
];

const SOURCE_LABEL = Object.fromEntries(SOURCE_LABELS) as Record<JournalSourceValue, string>;

type FormLine = {
  key: number;
  accountId: string;
  description: string;
  unitId: string;
  debit: string;
  credit: string;
};

let lineKey = 0;
function emptyLine(unitId: string): FormLine {
  lineKey += 1;
  return { key: lineKey, accountId: "", description: "", unitId, debit: "", credit: "" };
}

export default function JurnalScreen({
  accounts,
  units,
  entries,
  unitId,
  nextNumber,
  canPost,
  canEdit,
}: {
  accounts: LedgerAccountOption[];
  units: UnitOption[];
  entries: JournalRow[];
  unitId: string;
  nextNumber: string;
  canPost: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [date, setDate] = useState(() => toInputDate(new Date()));
  const [bookUnitId, setBookUnitId] = useState(unitId);
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<FormLine[]>(() => [emptyLine(unitId), emptyLine(unitId)]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [unitFilter, setUnitFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + parseAmountInput(line.debit), 0);
    const credit = lines.reduce((sum, line) => sum + parseAmountInput(line.credit), 0);
    return { debit, credit, diff: debit - credit };
  }, [lines]);

  const balanced = totals.diff === 0 && totals.debit > 0;

  const posted = useMemo(() => {
    return entries.filter((entry) => {
      if (unitFilter && entry.unitId !== unitFilter) return false;
      if (sourceFilter && entry.source !== sourceFilter) return false;
      if (from && entry.date.slice(0, 10) < from) return false;
      if (to && entry.date.slice(0, 10) > to) return false;
      return true;
    });
  }, [entries, unitFilter, sourceFilter, from, to]);

  function updateLine(key: number, patch: Partial<FormLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    setError("");
  }

  function resetForm() {
    setDate(toInputDate(new Date()));
    setBookUnitId(unitId);
    setReference("");
    setDescription("");
    setLines([emptyLine(unitId), emptyLine(unitId)]);
    setError("");
  }

  async function submit(post: boolean) {
    setError("");
    if (!date) {
      setError(t("Tanggal jurnal harus diisi."));
      return;
    }
    if (!description.trim()) {
      setError(t("Keterangan jurnal harus diisi."));
      return;
    }

    const payloadLines = lines
      .map((line) => ({
        accountId: line.accountId,
        description: line.description.trim() || undefined,
        unitId: line.unitId || undefined,
        debit: parseAmountInput(line.debit),
        credit: parseAmountInput(line.credit),
      }))
      .filter((line) => line.debit > 0 || line.credit > 0);

    if (payloadLines.length < 2) {
      setError(t("Jurnal harus punya minimal dua baris bernilai."));
      return;
    }
    if (payloadLines.some((line) => !line.accountId)) {
      setError(t("Setiap baris bernilai harus memilih akun."));
      return;
    }
    if (post && totals.diff !== 0) {
      setError(t("Jurnal belum seimbang — total debit harus sama dengan total kredit sebelum diposting."));
      return;
    }

    setBusy(true);
    const res = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        unitId: bookUnitId,
        reference: reference.trim() || undefined,
        description: description.trim(),
        lines: payloadLines,
        post,
      }),
    });
    const data = (await res.json()) as { error?: string; number?: string };
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? t("Jurnal gagal disimpan."));
      toast(data.error ?? t("Jurnal gagal disimpan."));
      return;
    }

    resetForm();
    toast(post ? `${t("Jurnal diposting")} · ${data.number}` : `${t("Draf jurnal tersimpan")} · ${data.number}`);
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Jurnal Umum")}
        subtitle={t("Entri jurnal per buku unit")}
        actions={
          <>
            <button className="btn" onClick={() => toast(t("Daftar jurnal berulang dibuka"))}>
              {t("Jurnal berulang")}
            </button>
            <button className="btn" onClick={() => toast(t("Form jurnal antar-unit dibuka"))}>
              {t("Jurnal antar-unit")}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                resetForm();
                toast(t("Form entri jurnal baru dibuka"));
              }}
            >
              {t("Entri baru")}
            </button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 18 }}>
        <div style={{ minWidth: 0 }}>
          <div className="card">
            <div className="card-h">
              <h2>{t("Entri Jurnal")}</h2>
              <span className="sub num">{nextNumber}</span>
              <div className="rt">
                <span className="chip chip-open">{t("Draf")}</span>
              </div>
            </div>
            <div className="card-b" style={{ paddingBottom: 0 }}>
              <div className="row row-4">
                <div>
                  <label className="f" data-req="1">
                    {t("Tanggal")}
                  </label>
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div>
                  <label className="f">{t("Buku unit")}</label>
                  <select
                    value={bookUnitId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setBookUnitId(next);
                      setLines((current) => current.map((line) => ({ ...line, unitId: next })));
                    }}
                  >
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {`${unit.code} · ${unit.name}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="f">{t("Referensi")}</label>
                  <input
                    type="text"
                    placeholder="INV/2026/VIII/0091"
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </div>
                <div>
                  <label className="f">{t("Bukti transaksi")}</label>
                  <button className="btn" style={{ width: "100%" }} onClick={() => toast(t("Unggah bukti transaksi dibuka"))}>
                    {t("Lampirkan berkas")}
                  </button>
                </div>
              </div>
              <div className="row">
                <div>
                  <label className="f" data-req="1">
                    {t("Keterangan")}
                  </label>
                  <input type="text" value={description} onChange={(event) => setDescription(event.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto", borderTop: "1px solid var(--rule)" }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: "28%" }}>{t("Akun")}</th>
                    <th>{t("Keterangan baris")}</th>
                    <th style={{ width: 150 }}>{t("Cabang")}</th>
                    <th className="r" style={{ width: 140 }}>
                      {t("Debit")}
                    </th>
                    <th className="r" style={{ width: 140 }}>
                      {t("Kredit")}
                    </th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.key}>
                      <td>
                        <select value={line.accountId} onChange={(event) => updateLine(line.key, { accountId: event.target.value })}>
                          <option value="">{t("Pilih akun")}</option>
                          {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {`${account.code} · ${account.name}`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(event) => updateLine(line.key, { description: event.target.value })}
                        />
                      </td>
                      <td>
                        <select value={line.unitId} onChange={(event) => updateLine(line.key, { unitId: event.target.value })}>
                          {units.map((unit) => (
                            <option key={unit.id} value={unit.id}>
                              {`${unit.code} · ${unit.name}`}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          className="num"
                          inputMode="numeric"
                          value={line.debit}
                          onChange={(event) => updateLine(line.key, { debit: event.target.value, credit: "" })}
                          onBlur={(event) => {
                            const value = parseAmountInput(event.target.value);
                            updateLine(line.key, { debit: value === 0 ? "" : formatAmount(value) });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="num"
                          inputMode="numeric"
                          value={line.credit}
                          onChange={(event) => updateLine(line.key, { credit: event.target.value, debit: "" })}
                          onBlur={(event) => {
                            const value = parseAmountInput(event.target.value);
                            updateLine(line.key, { credit: value === 0 ? "" : formatAmount(value) });
                          }}
                        />
                      </td>
                      <td className="r">
                        <button
                          className="btn btn-sm"
                          aria-label={t("Hapus baris")}
                          disabled={lines.length <= 2}
                          onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--rule)", display: "flex", gap: 10, alignItems: "center" }}>
              <button className="btn btn-sm" onClick={() => setLines((current) => [...current, emptyLine(bookUnitId)])}>
                {t("+ Tambah baris")}
              </button>
              <span className="sm muted">
                {t(
                  "Kolom unit opsional. Jika baris memakai unit berbeda dari buku aktif, sistem membuat pasangan jurnal RAK otomatis di kedua buku.",
                )}
              </span>
            </div>

            {error && (
              <div style={{ padding: "0 16px 10px" }}>
                <div className="note note-warn">{error}</div>
              </div>
            )}

            <div className="bal">
              <span className="k">{t("Total debit")}</span>
              <span className="v num">{formatAmount(totals.debit)}</span>
              <span className="k">{t("Total kredit")}</span>
              <span className="v num">{formatAmount(totals.credit)}</span>
              <span className="k">{t("Selisih")}</span>
              <span className="v num">{formatAmount(totals.diff)}</span>
              <span className={balanced ? "chip chip-open" : "chip chip-bad"}>
                {balanced ? t("Seimbang") : t("Belum seimbang")}
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn btn-sm" disabled={!canEdit || busy} onClick={() => void submit(false)}>
                  {t("Simpan draf")}
                </button>
                <button className="btn btn-sm btn-primary" disabled={!canPost || busy || !balanced} onClick={() => void submit(true)}>
                  {busy ? t("Memproses…") : t("Posting jurnal")}
                </button>
              </span>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-h">
              <h2>{t("Jurnal Terposting")}</h2>
              <div className="rt">
                <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} style={{ width: "auto" }}>
                  <option value="">{t("Semua buku")}</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {`${unit.code} · ${unit.name}`}
                    </option>
                  ))}
                </select>
                <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} style={{ width: "auto" }}>
                  <option value="">{t("Semua sumber")}</option>
                  {SOURCE_LABELS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm" onClick={() => setPeriodOpen((current) => !current)}>
                  {t("Filter periode")}
                </button>
              </div>
            </div>

            {periodOpen && (
              <div className="card-b" style={{ paddingBottom: 0 }}>
                <div className="row row-4">
                  <div>
                    <label className="f">{t("Dari tanggal")}</label>
                    <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                  </div>
                  <div>
                    <label className="f">{t("Sampai tanggal")}</label>
                    <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                  </div>
                </div>
              </div>
            )}

            <table>
              <thead>
                <tr>
                  <th style={{ width: 170 }}>{t("No. jurnal")}</th>
                  <th>{t("Tanggal")}</th>
                  <th>{t("Keterangan")}</th>
                  <th>{t("Buku")}</th>
                  <th>{t("Sumber")}</th>
                  <th className="r">{t("Nilai")}</th>
                  <th>{t("Bukti")}</th>
                </tr>
              </thead>
              <tbody>
                {posted.length === 0 && (
                  <tr>
                    <td colSpan={7} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {posted.map((entry) => (
                  <tr key={entry.id}>
                    <td className="num" style={{ color: "var(--ledger-dk)" }}>
                      {entry.number}
                    </td>
                    <td className="num">{formatDate(entry.date)}</td>
                    <td>{entry.description}</td>
                    <td className="num">{entry.unitCode}</td>
                    <td>{t(SOURCE_LABEL[entry.source] ?? entry.source)}</td>
                    <td className="r num">{formatAmount(entry.amount)}</td>
                    <td className="num muted">{entry.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
