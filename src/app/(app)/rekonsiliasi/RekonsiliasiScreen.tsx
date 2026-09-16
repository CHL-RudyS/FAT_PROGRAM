"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount, formatDate } from "@/lib/format";

export type PeriodOption = { key: string; year: number; month: number; label: string };

export type ReconBook = {
  id: string;
  label: string;
  accountCode: string | null;
  unitCode: string;
  unitName: string;
};

export type StatementLine = {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  matchStatus: "BELUM_COCOK" | "COCOK" | "DIABAIKAN";
  journalLineId: string | null;
};

export type BookLine = {
  id: string;
  entryId: string;
  number: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  matched: boolean;
};

export type ReconData = {
  statementLines: StatementLine[];
  journalLines: BookLine[];
  bookBalance: number;
  statementBalance: number;
  difference: number;
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
  periodTo: string;
  status: "BERJALAN" | "SELESAI";
};

/** Nilai satu baris: debit positif = uang masuk, kredit = uang keluar. */
function signedAmount(line: { debit: number; credit: number }) {
  return line.debit > 0 ? line.debit : -line.credit;
}

function amountLabel(line: { debit: number; credit: number }) {
  return line.debit > 0 ? formatAmount(line.debit) : `(${formatAmount(line.credit)})`;
}

function sameDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

export default function RekonsiliasiScreen({
  books,
  accounts,
  periods,
  selectedBookId,
  selectedPeriodKey,
  loadError,
  data,
}: {
  books: ReconBook[];
  accounts: { id: string; code: string; name: string }[];
  periods: PeriodOption[];
  selectedBookId: string;
  selectedPeriodKey: string;
  loadError: string | null;
  data: ReconData | null;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [statementId, setStatementId] = useState<string | null>(null);
  const [journalId, setJournalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [counterAccountId, setCounterAccountId] = useState(accounts[0]?.id ?? "");
  const [journalNote, setJournalNote] = useState("");
  const [journalError, setJournalError] = useState<string | null>(null);

  const book = books.find((item) => item.id === selectedBookId) ?? null;
  const period = periods.find((item) => item.key === selectedPeriodKey) ?? periods[0];

  const statement = data?.statementLines.find((line) => line.id === statementId) ?? null;
  const journal = data?.journalLines.find((line) => line.id === journalId) ?? null;

  const statementRows = useMemo(() => {
    if (!data) return [];
    return [...data.statementLines].sort(
      (a, b) => Number(a.matchStatus === "COCOK") - Number(b.matchStatus === "COCOK"),
    );
  }, [data]);

  const journalRows = useMemo(() => {
    if (!data) return [];
    return [...data.journalLines].sort((a, b) => Number(a.matched) - Number(b.matched));
  }, [data]);

  /** Kandidat pasangan: nilai dan arah sama dengan baris terpilih di sisi seberang. */
  const candidateJournalIds = useMemo(() => {
    if (!statement || !data) return new Set<string>();
    return new Set(
      data.journalLines
        .filter((line) => !line.matched && signedAmount(line) === signedAmount(statement))
        .map((line) => line.id),
    );
  }, [statement, data]);

  const candidateStatementIds = useMemo(() => {
    if (!journal || !data) return new Set<string>();
    return new Set(
      data.statementLines
        .filter((line) => line.matchStatus === "BELUM_COCOK" && signedAmount(line) === signedAmount(journal))
        .map((line) => line.id),
    );
  }, [journal, data]);

  function navigate(next: { akun?: string; periode?: string }) {
    const params = new URLSearchParams();
    params.set("akun", next.akun ?? selectedBookId);
    params.set("periode", next.periode ?? selectedPeriodKey);
    setStatementId(null);
    setJournalId(null);
    startTransition(() => router.replace(`/rekonsiliasi?${params.toString()}`));
  }

  async function call(path: string, body: Record<string, unknown>, success: string) {
    if (!book || !period) return;
    setBusy(true);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId: book.id, year: period.year, month: period.month, ...body }),
    });
    const payload = (await res.json()) as { error?: string; matched?: number };
    setBusy(false);
    if (!res.ok) {
      toast(payload.error ?? t("Gagal memproses rekonsiliasi."));
      return null;
    }
    setStatementId(null);
    setJournalId(null);
    toast(success.replace("{n}", String(payload.matched ?? 0)));
    router.refresh();
    return payload;
  }

  async function createJournal() {
    if (!book || !period || !statement) return;
    if (!counterAccountId) {
      setJournalError(t("Akun lawan harus dipilih."));
      return;
    }
    setBusy(true);
    const res = await fetch("/api/reconciliation/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankAccountId: book.id,
        year: period.year,
        month: period.month,
        statementLineId: statement.id,
        counterAccountId,
        description: journalNote.trim() || undefined,
      }),
    });
    const payload = (await res.json()) as { error?: string; number?: string };
    setBusy(false);
    if (!res.ok) {
      setJournalError(payload.error ?? t("Gagal membuat jurnal."));
      return;
    }
    setJournalOpen(false);
    setJournalNote("");
    setJournalError(null);
    setStatementId(null);
    setJournalId(null);
    toast(`${t("Jurnal")} ${payload.number ?? ""} ${t("dibuat dari mutasi bank")}`);
    router.refresh();
  }

  const difference = data?.difference ?? 0;
  const pairMatched = statement && journal ? signedAmount(statement) === signedAmount(journal) : false;
  const pairSameDay = statement && journal ? sameDay(statement.date, journal.date) : false;
  const selectedMatched = statement?.matchStatus === "COCOK";
  const matchedPartner = selectedMatched
    ? (data?.journalLines.find((line) => line.id === statement?.journalLineId) ?? null)
    : null;

  const subtitle = book
    ? `${book.label} · ${t("buku")} `
    : t("Belum ada rekening kas/bank");

  return (
    <>
      <div className="head">
        <div>
          <h1>{t("Rekonsiliasi Bank")}</h1>
          <p>
            {subtitle}
            {book && (
              <>
                <span className="num">{book.unitCode}</span> {book.unitName} · {t(period?.label ?? "")}
              </>
            )}
          </p>
        </div>
        <div className="head-act">
          <select
            value={selectedBookId}
            onChange={(event) => navigate({ akun: event.target.value })}
            style={{ width: "auto", minWidth: 190 }}
            disabled={books.length === 0}
          >
            {books.length === 0 && <option value="">{t("Belum ada rekening kas/bank")}</option>}
            {books.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={selectedPeriodKey}
            onChange={(event) => navigate({ periode: event.target.value })}
            style={{ width: "auto", minWidth: 130 }}
          >
            {periods.map((item) => (
              <option key={item.key} value={item.key}>
                {t(item.label)}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!data || busy || pending || data.status === "SELESAI"}
            onClick={() => void call("/api/reconciliation/auto", {}, `{n} ${t("transaksi tercocokkan otomatis")}`)}
          >
            {t("Cocokkan otomatis")}
          </button>
          <button
            className="btn btn-primary"
            disabled={!data || busy || pending}
            onClick={() =>
              void call(
                "/api/reconciliation/complete",
                { reopen: data?.status === "SELESAI" },
                data?.status === "SELESAI"
                  ? t("Rekonsiliasi periode ini dibuka kembali")
                  : t("Rekonsiliasi periode ini ditutup"),
              )
            }
          >
            {data?.status === "SELESAI" ? t("Buka kembali rekonsiliasi") : t("Selesaikan rekonsiliasi")}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="note note-warn" style={{ marginBottom: 16 }}>
          {t(loadError)}
        </div>
      )}
      {books.length === 0 && !loadError && (
        <div className="note note-warn" style={{ marginBottom: 16 }}>
          {t("Belum ada rekening kas/bank. Tambahkan rekening dulu di layar Kas & Bank Harian.")}
        </div>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Saldo rekening koran")}</div>
          <div className="v">{formatAmount(data?.statementBalance ?? 0)}</div>
          <div className="d muted">
            {t("per")} {data ? formatDate(data.periodTo) : "—"}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Saldo buku besar")}</div>
          <div className="v">{formatAmount(data?.bookBalance ?? 0)}</div>
          <div className="d muted">
            {t("akun")} {book?.accountCode ?? "—"}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Selisih")}</div>
          <div className="v" style={{ color: difference === 0 ? "var(--ledger)" : "var(--brick)" }}>
            {formatAmount(difference)}
          </div>
          <div className="d" style={{ color: difference === 0 ? "var(--ledger)" : "var(--brick)" }}>
            {difference === 0 ? t("Sudah nol") : t("Belum nol")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Sudah cocok")}</div>
          <div className="v" style={{ color: "var(--ledger)" }}>
            {data?.matchedCount ?? 0}
          </div>
          <div className="d muted">
            {t("dari")} {data?.totalCount ?? 0} {t("mutasi")}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>{t("Pencocokan mutasi")}</h2>
          <span className="sub">{t("Pilih satu baris di tiap sisi lalu tekan cocokkan")}</span>
          <div className="rt">
            {data && data.status === "SELESAI" && <span className="chip chip-lock">{t("Selesai")}</span>}
            <span className={data && data.unmatchedCount === 0 ? "chip chip-ok" : "chip chip-warn"}>
              {data && data.unmatchedCount === 0
                ? t("Semua mutasi cocok")
                : `${data?.unmatchedCount ?? 0} ${t("belum cocok")}`}
            </span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "stretch" }}>
          <div style={{ minWidth: 0, overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th colSpan={3}>{t("Rekening koran — belum cocok")}</th>
                </tr>
                <tr>
                  <th style={{ width: 80 }}>{t("Tanggal")}</th>
                  <th>{t("Uraian")}</th>
                  <th className="r">{t("Nilai")}</th>
                </tr>
              </thead>
              <tbody>
                {statementRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {statementRows.map((line) => {
                  const isMatched = line.matchStatus === "COCOK";
                  const selected = line.id === statementId;
                  const candidate = candidateStatementIds.has(line.id);
                  return (
                    <tr
                      key={line.id}
                      onClick={() => setStatementId(selected ? null : line.id)}
                      style={{
                        cursor: "pointer",
                        background: selected
                          ? "var(--ledger-bg)"
                          : isMatched
                            ? "var(--sunk)"
                            : candidate
                              ? "var(--ledger-bg)"
                              : "var(--amber-bg)",
                        boxShadow: selected ? "inset 0 0 0 1px var(--ledger)" : undefined,
                      }}
                    >
                      <td className="num">{formatDate(line.date)}</td>
                      <td>
                        {line.description}
                        {line.reference && (
                          <span className="sm muted" style={{ display: "block" }}>
                            {line.reference}
                          </span>
                        )}
                      </td>
                      <td className="r num">{amountLabel(line)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            style={{
              width: 52,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--sunk)",
              borderLeft: "1px solid var(--rule)",
              borderRight: "1px solid var(--rule)",
              gap: 8,
              padding: "8px 0",
            }}
          >
            <button
              className="btn btn-sm"
              aria-label={t("Cocokkan pilihan")}
              disabled={!statement || !journal || busy || data?.status === "SELESAI"}
              onClick={() =>
                void call(
                  "/api/reconciliation/match",
                  { statementLineId: statementId, journalLineId: journalId },
                  t("Pasangan mutasi tercocokkan"),
                )
              }
            >
              ⇄
            </button>
            <button
              className="btn btn-sm"
              aria-label={t("Buat jurnal dari mutasi bank")}
              disabled={!statement || selectedMatched || busy || data?.status === "SELESAI"}
              onClick={() => {
                setJournalError(null);
                setJournalOpen(true);
              }}
            >
              ✎
            </button>
          </div>
          <div style={{ minWidth: 0, overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th colSpan={3}>{t("Buku besar — belum cocok")}</th>
                </tr>
                <tr>
                  <th style={{ width: 80 }}>{t("Tanggal")}</th>
                  <th>{t("Keterangan")}</th>
                  <th className="r">{t("Nilai")}</th>
                </tr>
              </thead>
              <tbody>
                {journalRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {journalRows.map((line) => {
                  const selected = line.id === journalId;
                  const candidate = candidateJournalIds.has(line.id);
                  return (
                    <tr
                      key={line.id}
                      onClick={() => (line.matched ? undefined : setJournalId(selected ? null : line.id))}
                      style={{
                        cursor: line.matched ? "default" : "pointer",
                        background: selected
                          ? "var(--ledger-bg)"
                          : line.matched
                            ? "var(--sunk)"
                            : candidate
                              ? "var(--ledger-bg)"
                              : "var(--amber-bg)",
                        boxShadow: selected ? "inset 0 0 0 1px var(--ledger)" : undefined,
                      }}
                    >
                      <td className="num">{formatDate(line.date)}</td>
                      <td>
                        {line.description}
                        <span className="sm muted" style={{ display: "block" }}>
                          {line.number}
                        </span>
                      </td>
                      <td className="r num">{amountLabel(line)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bal">
          <span className="k">{t("Pasangan terpilih")}</span>
          <span className="v">
            {statement
              ? `${formatDate(statement.date)} · ${amountLabel(statement)} ⇄ ${
                  selectedMatched
                    ? (matchedPartner?.description ?? t("jurnal terkait"))
                    : (journal?.description ?? t("belum dipilih"))
                }`
              : t("belum dipilih")}
          </span>
          {statement && !selectedMatched && journal && (
            <span className={pairMatched ? (pairSameDay ? "chip chip-open" : "chip chip-warn") : "chip chip-bad"}>
              {pairMatched
                ? pairSameDay
                  ? t("Nilai & tanggal cocok")
                  : t("Nilai cocok, tanggal beda")
                : t("Nilai tidak sama")}
            </span>
          )}
          {selectedMatched && <span className="chip chip-ok">{t("Sudah dicocokkan")}</span>}
          <span style={{ marginLeft: "auto" }}>
            {selectedMatched ? (
              <button
                className="btn btn-sm"
                disabled={busy || data?.status === "SELESAI"}
                onClick={() =>
                  void call(
                    "/api/reconciliation/unmatch",
                    { statementLineId: statementId },
                    t("Pasangan mutasi dibatalkan"),
                  )
                }
              >
                {t("Batalkan pasangan ini")}
              </button>
            ) : (
              <button
                className="btn btn-sm btn-primary"
                disabled={!statement || !journal || busy || data?.status === "SELESAI"}
                onClick={() =>
                  void call(
                    "/api/reconciliation/match",
                    { statementLineId: statementId, journalLineId: journalId },
                    t("Pasangan mutasi tercocokkan"),
                  )
                }
              >
                {t("Cocokkan pasangan ini")}
              </button>
            )}
          </span>
        </div>
      </div>

      <div className="legend">
        <span>
          <i style={{ background: "var(--ledger-bg)", border: "1px solid var(--ledger)" }} /> {t("Kandidat pasangan")}
        </span>
        <span>
          <i style={{ background: "var(--amber-bg)", border: "1px solid var(--amber)" }} /> {t("Belum ada pasangan")}
        </span>
        <span>
          <i style={{ background: "var(--sunk)", border: "1px solid var(--rule2)" }} /> {t("Sudah dicocokkan")}
        </span>
      </div>

      <Dialog
        open={journalOpen}
        onClose={() => setJournalOpen(false)}
        title={t("Buat jurnal dari mutasi bank")}
        badge={book ? `${t("buku")} ${book.unitCode}` : undefined}
        footer={
          <>
            <button className="btn" onClick={() => setJournalOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void createJournal()}>
              {busy ? t("Menyimpan…") : t("Simpan & posting")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f">{t("Tanggal")}</label>
            <input type="text" className="num" readOnly value={statement ? formatDate(statement.date) : "—"} />
          </div>
          <div>
            <label className="f">{t("Nilai")}</label>
            <input type="text" className="num" readOnly value={statement ? amountLabel(statement) : "—"} />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Akun lawan")}
            </label>
            <select
              value={counterAccountId}
              onChange={(event) => setCounterAccountId(event.target.value)}
              className={journalError && !counterAccountId ? "field-error" : undefined}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Keterangan")}</label>
            <input
              type="text"
              value={journalNote}
              onChange={(event) => setJournalNote(event.target.value)}
              placeholder={statement?.description ?? ""}
            />
          </div>
        </div>
        <div className="note">
          {t("Jurnal berimbang langsung diposting ke buku unit rekening ini, lalu baris mutasi ditandai cocok.")}
        </div>
        {journalError && (
          <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 8, fontSize: 12, background: "var(--brick-bg)", color: "var(--brick)" }}>
            {journalError}
          </div>
        )}
      </Dialog>
    </>
  );
}
