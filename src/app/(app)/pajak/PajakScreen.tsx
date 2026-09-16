"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { MONTHS_ID, MONTHS_SHORT_ID, dash, formatDate, parseAmountInput } from "@/lib/format";

export type LedgerAccountOption = { id: string; code: string; name: string };

export type TaxKind = "PPN_KELUARAN" | "PPN_MASUKAN" | "PPH_21" | "PPH_22" | "PPH_23" | "PPH_25" | "PPH_4_2";

export type TaxRow = {
  id: string;
  kind: TaxKind;
  periodYear: number;
  periodMonth: number;
  dpp: number;
  taxAmount: number;
  dueDate: string | null;
  reportedAt: string | null;
  paidAt: string | null;
  status: "DRAF" | "DILAPORKAN" | "DIBAYAR" | "TERLAMBAT";
  reference: string | null;
  recordedAt: string;
  unitId: string;
  unitCode: string;
};

const KIND_LABEL: Record<TaxKind, string> = {
  PPN_KELUARAN: "PPN keluaran",
  PPN_MASUKAN: "PPN masukan",
  PPH_21: "PPh 21",
  PPH_22: "PPh 22",
  PPH_23: "PPh 23",
  PPH_25: "PPh 25",
  PPH_4_2: "PPh 4(2)",
};

const FILTER_KINDS: TaxKind[] = ["PPN_KELUARAN", "PPN_MASUKAN", "PPH_21", "PPH_23", "PPH_4_2"];

/** Pilihan jenis setoran di dialog — "PPN kurang bayar" disetor sebagai PPN keluaran. */
const PAYMENT_KINDS: Array<{ value: TaxKind; label: string }> = [
  { value: "PPN_KELUARAN", label: "PPN kurang bayar" },
  { value: "PPH_21", label: "PPh 21" },
  { value: "PPH_23", label: "PPh 23" },
  { value: "PPH_4_2", label: "PPh 4(2) final" },
];

const STATUS_LABEL: Record<TaxRow["status"], string> = {
  DRAF: "Belum disetor",
  DIBAYAR: "Sudah disetor",
  DILAPORKAN: "Sudah dilapor",
  TERLAMBAT: "Terlambat",
};

const STATUS_CHIP: Record<TaxRow["status"], string> = {
  DRAF: "chip chip-warn",
  DIBAYAR: "chip chip-info",
  DILAPORKAN: "chip chip-ok",
  TERLAMBAT: "chip chip-bad",
};

const TAB_STATUS: Record<string, TaxRow["status"][]> = {
  belum: ["DRAF", "TERLAMBAT"],
  setor: ["DIBAYAR"],
  lapor: ["DILAPORKAN"],
};

/** PPN disetor paling lambat tanggal 15, PPh tanggal 10 bulan berikutnya. */
function dueDateOf(kind: TaxKind, year: number, month: number) {
  const day = kind.startsWith("PPN") ? 15 : 10;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return new Date(nextYear, nextMonth - 1, day);
}

function shortDue(kind: TaxKind, year: number, month: number) {
  const date = dueDateOf(kind, year, month);
  return `${date.getDate()} ${MONTHS_SHORT_ID[date.getMonth()]}`;
}

export default function PajakScreen({
  records,
  paymentAccounts,
  todayIso,
  canEdit,
}: {
  records: TaxRow[];
  paymentAccounts: LedgerAccountOption[];
  todayIso: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const todayInput = todayIso.slice(0, 10);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthLabel = `${MONTHS_ID[month - 1]} ${year}`;
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const previousLabel = `${MONTHS_ID[previous.month - 1]} ${previous.year}`;
  const nextMonthLabel = `${MONTHS_ID[month === 12 ? 0 : month]} ${month === 12 ? year + 1 : year}`;

  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [tab, setTab] = useState("all");

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    kind: "",
    period: `${year}-${month}`,
    billingCode: "",
    paidAt: todayInput,
    amount: "",
    paymentAccountId: "",
    ntpn: "",
  });

  const scoped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((row) => {
      if (kindFilter && row.kind !== kindFilter) return false;
      if (!needle) return true;
      return `${row.reference ?? ""} ${KIND_LABEL[row.kind]} ${row.unitCode}`.toLowerCase().includes(needle);
    });
  }, [records, query, kindFilter]);

  const counts = useMemo(
    () => ({
      all: scoped.length,
      belum: scoped.filter((row) => TAB_STATUS.belum.includes(row.status)).length,
      setor: scoped.filter((row) => TAB_STATUS.setor.includes(row.status)).length,
      lapor: scoped.filter((row) => TAB_STATUS.lapor.includes(row.status)).length,
    }),
    [scoped],
  );

  const filtered = useMemo(
    () => (tab === "all" ? scoped : scoped.filter((row) => TAB_STATUS[tab]?.includes(row.status))),
    [scoped, tab],
  );

  const unpaidShown = filtered
    .filter((row) => row.status === "DRAF" || row.status === "TERLAMBAT")
    .reduce((sum, row) => sum + row.taxAmount, 0);

  /** Rekapitulasi masa berjalan — dasar SPT Masa. */
  const recap = useMemo(() => {
    const period = records.filter((row) => row.periodYear === year && row.periodMonth === month);
    const sumOf = (kind: TaxKind) =>
      period.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.taxAmount, 0);
    const output = sumOf("PPN_KELUARAN");
    const input = sumOf("PPN_MASUKAN");
    const underpaid = Math.max(output - input, 0);
    const pph21 = sumOf("PPH_21");
    const pph23 = sumOf("PPH_23");
    const pphFinal = sumOf("PPH_4_2");
    return {
      output,
      outputCount: period.filter((row) => row.kind === "PPN_KELUARAN").length,
      input,
      inputCount: period.filter((row) => row.kind === "PPN_MASUKAN").length,
      underpaid,
      pph21,
      pph23,
      pphFinal,
      pphTotal: pph21 + pph23 + pphFinal,
      total: underpaid + pph21 + pph23 + pphFinal,
      reported: period.length > 0 && period.every((row) => row.status === "DILAPORKAN"),
    };
  }, [records, year, month]);

  /** Tenggat bulan depan — bukti yang jatuh tempo dan belum disetor. */
  const deadlines = useMemo(() => {
    const upcoming = records.filter(
      (row) => row.dueDate !== null && (row.status === "DRAF" || row.status === "TERLAMBAT"),
    );
    return upcoming
      .slice()
      .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime())
      .slice(0, 6);
  }, [records]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setError("");
  }

  function openDialog() {
    setForm({
      kind: "",
      period: `${year}-${month}`,
      billingCode: "",
      paidAt: todayInput,
      amount: "",
      paymentAccountId: "",
      ntpn: "",
    });
    setErrors({});
    setError("");
    setOpen(true);
  }

  async function submit() {
    const nextErrors: Record<string, string> = {};
    if (!form.kind) nextErrors.kind = t("Jenis pajak harus dipilih.");
    if (!form.billingCode.trim()) nextErrors.billingCode = t("Kode billing harus diisi.");
    if (!form.paidAt) nextErrors.paidAt = t("Tanggal setor harus diisi.");
    if (parseAmountInput(form.amount) <= 0) nextErrors.amount = t("Nilai setoran harus diisi.");
    if (!form.paymentAccountId) nextErrors.paymentAccountId = t("Akun pembayaran harus dipilih.");

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setError(t("Lengkapi dulu kolom yang ditandai."));
      return;
    }

    const [periodYear, periodMonth] = form.period.split("-").map(Number);

    setBusy(true);
    const res = await fetch("/api/tax", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: form.kind,
        periodYear,
        periodMonth,
        billingCode: form.billingCode.trim(),
        paidAt: form.paidAt,
        amount: parseAmountInput(form.amount),
        paymentAccountId: form.paymentAccountId,
        ntpn: form.ntpn.trim() || undefined,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string; journalNumber?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      setError(data.error ?? t("Setoran pajak gagal dicatat."));
      return;
    }

    setOpen(false);
    toast(`${t("Setoran pajak dicatat · jurnal")} ${data.journalNumber ?? ""} ${t("diposting")}`.replace(/\s+/g, " "));
    router.refresh();
  }

  async function report(row: TaxRow) {
    const res = await fetch(`/api/tax/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "LAPOR" }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast(data.error ?? t("Pelaporan pajak gagal."));
      return;
    }
    toast(`${t("SPT Masa")} ${MONTHS_ID[row.periodMonth - 1]} ${t("dilaporkan")}`);
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Pajak")}
        subtitle={t("PPN, PPh, dan e-Faktur")}
        actions={
          <>
            <button
              className="btn"
              onClick={() => toast(`${t("Rekap pajak masa")} ${t(MONTHS_ID[month - 1])} ${t("diunduh")}`)}
            >
              {t("Unduh rekap")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openDialog}>
                {t("Catat pajak")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("PPN keluaran")}</div>
          <div className="v">{dash(recap.output)}</div>
          <div className="d muted">{`${recap.outputCount === 0 ? "—" : recap.outputCount} ${t("faktur")} · ${t("akun")} 2-1200`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("PPN masukan")}</div>
          <div className="v">{dash(recap.input)}</div>
          <div className="d muted">{`${recap.inputCount === 0 ? "—" : recap.inputCount} ${t("faktur dikreditkan")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("PPN kurang bayar")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>
            {dash(recap.underpaid)}
          </div>
          <div className="d" style={{ color: "var(--amber)" }}>
            {`${t("setor sebelum")} ${shortDue("PPN_KELUARAN", year, month)}`}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("PPh dipotong")}</div>
          <div className="v">{dash(recap.pphTotal)}</div>
          <div className="d muted">{t("PPh 21, 23, dan 4(2)")}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Status SPT Masa")}</div>
          <div className="v" style={{ fontSize: 17 }}>
            {recap.reported ? t("Dilaporkan") : "—"}
          </div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {recap.reported ? t("sudah dilaporkan") : t("belum dilaporkan")}
          </div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Daftar Pajak Masa")}</h2>
            <div className="rt">
              <select
                style={{ width: "auto" }}
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value)}
              >
                <option value="">{t("Semua jenis")}</option>
                {FILTER_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(KIND_LABEL[kind])}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t("Cari lawan transaksi")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                style={{ width: 180 }}
              />
            </div>
          </div>
          <div style={{ padding: "12px 18px 0" }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={tab === "all" ? "tab on" : "tab"} onClick={() => setTab("all")}>
                {t("Semua")} <span className="muted">{counts.all}</span>
              </button>
              <button className={tab === "belum" ? "tab on" : "tab"} onClick={() => setTab("belum")}>
                {t("Belum disetor")} <span style={{ color: "var(--amber)" }}>{counts.belum}</span>
              </button>
              <button className={tab === "setor" ? "tab on" : "tab"} onClick={() => setTab("setor")}>
                {t("Sudah disetor")} <span className="muted">{counts.setor}</span>
              </button>
              <button className={tab === "lapor" ? "tab on" : "tab"} onClick={() => setTab("lapor")}>
                {t("Sudah dilapor")} <span className="muted">{counts.lapor}</span>
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 940, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 150, whiteSpace: "nowrap" }}>{t("No. bukti")}</th>
                  <th style={{ width: "22%" }}>{t("Lawan transaksi")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Jenis")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Tanggal")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("DPP")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Pajak")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Status")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {row.reference ?? "—"}
                    </td>
                    <td>
                      <span style={{ display: "block" }}>—</span>
                      <span className="sm muted num">
                        {t("buku")} {row.unitCode}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{t(KIND_LABEL[row.kind])}</td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {formatDate(row.paidAt ?? row.recordedAt)}
                      <span className="sm muted" style={{ display: "block" }}>
                        {`${t("masa")} ${MONTHS_SHORT_ID[row.periodMonth - 1]} ${row.periodYear}`}
                      </span>
                    </td>
                    <td className="r num">{dash(row.dpp)}</td>
                    <td className="r num">{dash(row.taxAmount)}</td>
                    <td>
                      <span className={STATUS_CHIP[row.status]}>{t(STATUS_LABEL[row.status])}</span>
                    </td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      {canEdit && row.status === "DIBAYAR" && (
                        <button className="btn btn-sm" onClick={() => void report(row)}>
                          {t("Lapor")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{`${filtered.length} ${t("dari")} ${scoped.length} ${t("bukti ditampilkan")}`}</span>
            <span className="k">{t("Pajak belum disetor")}</span>
            <span className="v num">{dash(unpaidShown)}</span>
            <span style={{ marginLeft: "auto" }}>
              <a className="btn btn-sm" href="/browser">
                {t("Buka e-Faktur")}
              </a>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Rekapitulasi Masa")}</h2>
              <span className="sub">{monthLabel}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Jenis pajak")}</th>
                  <th className="r">{t("Nilai")}</th>
                  <th className="r">{t("Jatuh tempo")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t("PPN keluaran")}</td>
                  <td className="r num">{dash(recap.output)}</td>
                  <td className="r sm muted">—</td>
                </tr>
                <tr>
                  <td>{t("PPN masukan")}</td>
                  <td className="r num">{dash(recap.input)}</td>
                  <td className="r sm muted">—</td>
                </tr>
                <tr style={{ background: "var(--amber-bg)" }}>
                  <td>
                    <b>{t("PPN kurang bayar")}</b>
                  </td>
                  <td className="r num" style={{ color: "var(--amber)", fontWeight: 600 }}>
                    {dash(recap.underpaid)}
                  </td>
                  <td className="r sm" style={{ color: "var(--amber)" }}>
                    {shortDue("PPN_KELUARAN", year, month)}
                  </td>
                </tr>
                <tr>
                  <td>{t("PPh 21")}</td>
                  <td className="r num">{dash(recap.pph21)}</td>
                  <td className="r sm muted">{shortDue("PPH_21", year, month)}</td>
                </tr>
                <tr>
                  <td>{t("PPh 23")}</td>
                  <td className="r num">{dash(recap.pph23)}</td>
                  <td className="r sm muted">{shortDue("PPH_23", year, month)}</td>
                </tr>
                <tr>
                  <td>{t("PPh 4(2) final")}</td>
                  <td className="r num">{dash(recap.pphFinal)}</td>
                  <td className="r sm muted">{shortDue("PPH_4_2", year, month)}</td>
                </tr>
                <tr className="tot">
                  <td>{t("Total setoran")}</td>
                  <td className="r num">{dash(recap.total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <div className="bal">
              <span className="k">{t("Angka ini menjadi dasar SPT Masa")}</span>
              <span style={{ marginLeft: "auto" }}>
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    toast(`${t("SPT Masa")} ${t(MONTHS_ID[month - 1])} ${t("disiapkan untuk pelaporan")}`)
                  }
                >
                  {t("Siapkan SPT")}
                </button>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Tenggat Pajak")}</h2>
              <span className="sub">{nextMonthLabel}</span>
            </div>
            <div className="card-b">
              {deadlines.length === 0 && <div className="sm muted">{t("Belum ada tenggat")}</div>}
              {deadlines.map((row) => (
                <div
                  key={row.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12.5 }}
                >
                  <span>{t(KIND_LABEL[row.kind])}</span>
                  <span className="sm muted num">
                    {`${t("masa")} ${MONTHS_SHORT_ID[row.periodMonth - 1]} ${row.periodYear}`}
                  </span>
                  <span className="num" style={{ marginLeft: "auto" }}>
                    {formatDate(row.dueDate)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Catat Setoran Pajak")}
        maxWidth={540}
        badge={`${t("masa")} ${monthLabel}`}
        badgeTone="warn"
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              {t("Batal")}
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? t("Menyimpan…") : t("Simpan & posting")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Jenis pajak")}</label>
            <select
              className={errors.kind ? "field-error" : undefined}
              value={form.kind}
              onChange={(event) => update("kind", event.target.value)}
            >
              <option value="">{t("— Pilih jenis —")}</option>
              {PAYMENT_KINDS.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {t(kind.label)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Masa pajak")}</label>
            <select value={form.period} onChange={(event) => update("period", event.target.value)}>
              <option value={`${year}-${month}`}>{monthLabel}</option>
              <option value={`${previous.year}-${previous.month}`}>{previousLabel}</option>
            </select>
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Kode billing")}</label>
            <input
              type="text"
              className={errors.billingCode ? "num field-error" : "num"}
              value={form.billingCode}
              onChange={(event) => update("billingCode", event.target.value)}
              placeholder="820260900000000"
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("Tanggal setor")}</label>
            <input
              type="date"
              className={errors.paidAt ? "field-error" : undefined}
              value={form.paidAt}
              onChange={(event) => update("paidAt", event.target.value)}
            />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Nilai setoran")}</label>
            <input
              type="text"
              className={errors.amount ? "num field-error" : "num"}
              value={form.amount}
              onChange={(event) => update("amount", event.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("Dibayar dari")}</label>
            <select
              className={errors.paymentAccountId ? "field-error" : undefined}
              value={form.paymentAccountId}
              onChange={(event) => update("paymentAccountId", event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {paymentAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
            {paymentAccounts.length === 0 && (
              <span className="sm muted">{t("Belum ada akun kas atau bank di bagan akun.")}</span>
            )}
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Nomor NTPN")}</label>
            <input
              type="text"
              className="num"
              value={form.ntpn}
              onChange={(event) => update("ntpn", event.target.value)}
              placeholder={t("Opsional · diisi setelah setoran berhasil")}
            />
          </div>
        </div>
        <div className="dz" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t("Lampirkan bukti penerimaan negara")}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
            {t("BPN atau bukti transfer · PDF maksimal 5 MB")}
          </div>
        </div>
        <div className="note">
          {t("Jurnal terbentuk otomatis: debit utang pajak terkait, kredit akun kas atau bank yang dipilih.")}
        </div>

        {error && (
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
            {error}
          </div>
        )}
      </Dialog>
    </>
  );
}
