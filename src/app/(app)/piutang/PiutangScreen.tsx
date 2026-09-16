"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { chipClassFor, dash, formatAmount, formatDate, humanizeEnum, parseAmountInput } from "@/lib/format";

export type ArInvoiceRow = {
  id: string;
  number: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  customerTerm: number;
  unitId: string;
  unitCode: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: "DRAF" | "TERBUKA" | "SEBAGIAN" | "LUNAS" | "JATUH_TEMPO" | "BATAL";
  description: string | null;
};

export type ReceiptRow = {
  id: string;
  number: string;
  unitId: string;
  date: string;
  description: string;
  amount: number;
  inPreviousMonth: boolean;
};

type CustomerRow = { id: string; code: string; name: string; paymentTerm: number };
type UnitRow = { id: string; code: string; name: string };
type AccountRow = { id: string; code: string; name: string };

const DAY = 86_400_000;

const AGING_BUCKETS: Array<{ label: string; from: number; to: number }> = [
  { label: "Belum jatuh tempo", from: -Infinity, to: 0 },
  { label: "1–30 hari", from: 1, to: 30 },
  { label: "31–60 hari", from: 31, to: 60 },
  { label: "61–90 hari", from: 61, to: 90 },
  { label: "> 90 hari", from: 91, to: Infinity },
];

const TERM_OPTIONS = [30, 14, 0];

type LineDraft = { description: string; quantity: string; unitPrice: string };

const emptyLine: LineDraft = { description: "", quantity: "1", unitPrice: "" };

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Date(date.getTime() + days * DAY).toISOString().slice(0, 10);
}

export default function PiutangScreen({
  invoices,
  customers,
  units,
  cashAccounts,
  receivableAccountCode,
  receipts,
  previousMonthLabel,
  nextInvoiceNumber,
  todayIso,
  activeUnit,
  canEdit,
}: {
  invoices: ArInvoiceRow[];
  customers: CustomerRow[];
  units: UnitRow[];
  cashAccounts: AccountRow[];
  receivableAccountCode: string;
  receipts: ReceiptRow[];
  previousMonthLabel: string;
  nextInvoiceNumber: string;
  todayIso: string;
  activeUnit: UnitRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const today = useMemo(() => new Date(todayIso).getTime(), [todayIso]);
  const todayInput = todayIso.slice(0, 10);

  const [query, setQuery] = useState("");
  const [buku, setBuku] = useState("");
  const [termFilter, setTermFilter] = useState("");
  const [tab, setTab] = useState("all");

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceErrors, setInvoiceErrors] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({
    customerId: "",
    unitId: activeUnit.id,
    invoiceDate: todayInput,
    term: "30",
    dueDate: addDays(todayInput, 30),
    ppnMode: "11",
  });
  const [lines, setLines] = useState<LineDraft[]>([{ ...emptyLine }]);

  const [receiveFor, setReceiveFor] = useState<ArInvoiceRow | null>(null);
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveErrors, setReceiveErrors] = useState<Record<string, string>>({});
  const [receive, setReceive] = useState({
    date: todayInput,
    accountId: "",
    amount: "",
    method: "Transfer bank",
    statementNote: "",
  });

  const [allowanceOpen, setAllowanceOpen] = useState(false);
  const [allowanceBusy, setAllowanceBusy] = useState(false);
  const [allowanceErrors, setAllowanceErrors] = useState<Record<string, string>>({});
  const [allowance, setAllowance] = useState({ basis: "60", amount: "", reason: "" });

  const enriched = useMemo(
    () =>
      invoices.map((invoice) => {
        const remaining = invoice.amount - invoice.paidAmount;
        const overdueDays = Math.floor((today - new Date(invoice.dueDate).getTime()) / DAY);
        let status = invoice.status;
        if (status === "TERBUKA" || status === "SEBAGIAN" || status === "JATUH_TEMPO") {
          if (remaining <= 0) status = "LUNAS";
          else if (overdueDays > 0) status = "JATUH_TEMPO";
          else status = invoice.paidAmount > 0 ? "SEBAGIAN" : "TERBUKA";
        }
        return { invoice, remaining, overdueDays, status };
      }),
    [invoices, today],
  );

  const scoped = useMemo(
    () => enriched.filter((entry) => (buku ? entry.invoice.unitId === buku : true)),
    [enriched, buku],
  );

  const counts = useMemo(
    () => ({
      all: scoped.length,
      telat: scoped.filter((entry) => entry.status === "JATUH_TEMPO").length,
      buka: scoped.filter((entry) => entry.status === "TERBUKA" || entry.status === "DRAF").length,
      sebagian: scoped.filter((entry) => entry.status === "SEBAGIAN").length,
      lunas: scoped.filter((entry) => entry.status === "LUNAS").length,
    }),
    [scoped],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter((entry) => {
      if (termFilter && String(entry.invoice.customerTerm) !== termFilter) return false;
      if (tab === "telat" && entry.status !== "JATUH_TEMPO") return false;
      if (tab === "buka" && entry.status !== "TERBUKA" && entry.status !== "DRAF") return false;
      if (tab === "sebagian" && entry.status !== "SEBAGIAN") return false;
      if (tab === "lunas" && entry.status !== "LUNAS") return false;
      if (!needle) return true;
      return `${entry.invoice.number} ${entry.invoice.customerCode} ${entry.invoice.customerName} ${entry.invoice.description ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [scoped, query, termFilter, tab]);

  const openEntries = useMemo(
    () => scoped.filter((entry) => entry.status !== "LUNAS" && entry.status !== "BATAL" && entry.status !== "DRAF"),
    [scoped],
  );

  const scopedReceipts = useMemo(
    () => receipts.filter((receipt) => (buku ? receipt.unitId === buku : true)),
    [receipts, buku],
  );

  const metrics = useMemo(() => {
    const outstanding = openEntries.reduce((sum, entry) => sum + entry.remaining, 0);
    const current = openEntries.filter((entry) => entry.overdueDays <= 0);
    const overdue = openEntries.filter((entry) => entry.overdueDays > 0);
    const overdueCustomers = new Set(overdue.map((entry) => entry.invoice.customerId)).size;
    const received = scopedReceipts.filter((receipt) => receipt.inPreviousMonth);

    const ageSum = openEntries.reduce(
      (sum, entry) =>
        sum + entry.remaining * Math.max(0, Math.floor((today - new Date(entry.invoice.invoiceDate).getTime()) / DAY)),
      0,
    );

    return {
      outstanding,
      current: { amount: current.reduce((sum, entry) => sum + entry.remaining, 0), count: current.length },
      overdue: {
        amount: overdue.reduce((sum, entry) => sum + entry.remaining, 0),
        count: overdue.length,
        customers: overdueCustomers,
      },
      received: { amount: received.reduce((sum, receipt) => sum + receipt.amount, 0), count: received.length },
      dso: outstanding > 0 ? Math.round(ageSum / outstanding) : 0,
    };
  }, [openEntries, scopedReceipts, today]);

  const aging = useMemo(() => {
    const rows = AGING_BUCKETS.map((bucket) => ({ label: bucket.label, value: 0 }));
    for (const entry of openEntries) {
      const index = AGING_BUCKETS.findIndex((bucket) => entry.overdueDays >= bucket.from && entry.overdueDays <= bucket.to);
      if (index >= 0) rows[index].value += entry.remaining;
    }
    return { rows, total: rows.reduce((sum, row) => sum + row.value, 0) };
  }, [openEntries]);

  /** Piutang lebih tua dari 60 / 90 hari — dasar usulan cadangan kerugian. */
  const overdueBeyond = useMemo(
    () => ({
      60: openEntries.reduce((sum, entry) => (entry.overdueDays > 60 ? sum + entry.remaining : sum), 0),
      90: openEntries.reduce((sum, entry) => (entry.overdueDays > 90 ? sum + entry.remaining : sum), 0),
    }),
    [openEntries],
  );

  const shownRemaining = filtered.reduce(
    (sum, entry) => sum + (entry.status === "LUNAS" || entry.status === "BATAL" ? 0 : entry.remaining),
    0,
  );

  const bukuLabel = buku ? units.find((unit) => unit.id === buku)?.code ?? activeUnit.code : t("semua buku");

  const subtotal = lines.reduce(
    (sum, line) => sum + parseAmountInput(line.quantity) * parseAmountInput(line.unitPrice),
    0,
  );
  const ppn = draft.ppnMode === "11" ? Math.round(subtotal * 0.11) : 0;
  const invoiceTotal = subtotal + ppn;

  const receiveRemaining = receiveFor ? receiveFor.amount - receiveFor.paidAmount : 0;

  function updateDraft(field: keyof typeof draft, value: string) {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "term") next.dueDate = addDays(next.invoiceDate, Number(value) || 0);
      if (field === "invoiceDate") next.dueDate = addDays(value, Number(next.term) || 0);
      if (field === "customerId") {
        const term = customers.find((customer) => customer.id === value)?.paymentTerm;
        if (term !== undefined && TERM_OPTIONS.includes(term)) {
          next.term = String(term);
          next.dueDate = addDays(next.invoiceDate, term);
        }
      }
      return next;
    });
    setInvoiceErrors((current) => ({ ...current, [field]: "" }));
  }

  function updateLine(index: number, field: keyof LineDraft, value: string) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
    setInvoiceErrors((current) => ({ ...current, lines: "" }));
  }

  function openInvoice() {
    setDraft({
      customerId: customers[0]?.id ?? "",
      unitId: activeUnit.id,
      invoiceDate: todayInput,
      term: "30",
      dueDate: addDays(todayInput, 30),
      ppnMode: "11",
    });
    setLines([{ ...emptyLine }]);
    setInvoiceErrors({});
    setInvoiceOpen(true);
  }

  async function submitInvoice(post: boolean) {
    const nextErrors: Record<string, string> = {};
    if (!draft.customerId) nextErrors.customerId = t("Pelanggan harus dipilih.");
    if (!draft.invoiceDate) nextErrors.invoiceDate = t("Tanggal invoice harus diisi.");
    if (subtotal <= 0) nextErrors.lines = t("Isi qty dan harga minimal satu baris.");
    if (Object.keys(nextErrors).length > 0) {
      setInvoiceErrors(nextErrors);
      return;
    }

    setInvoiceBusy(true);
    const res = await fetch("/api/ar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: draft.customerId,
        unitId: draft.unitId,
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate || draft.invoiceDate,
        lines: lines
          .filter((line) => parseAmountInput(line.quantity) > 0 && parseAmountInput(line.unitPrice) > 0)
          .map((line) => ({
            description: line.description.trim() || undefined,
            quantity: parseAmountInput(line.quantity),
            unitPrice: parseAmountInput(line.unitPrice),
          })),
        ppnRate: draft.ppnMode === "11" ? 11 : 0,
        post,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      field?: string;
      invoice?: { number: string };
      journal?: { number: string } | null;
    };
    setInvoiceBusy(false);

    if (!res.ok) {
      if (data.field) setInvoiceErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan invoice."));
      return;
    }

    setInvoiceOpen(false);
    const number = data.invoice?.number ?? "";
    toast(
      post
        ? `${t("Invoice")} ${number} ${t("diposting dan siap dikirim ke pelanggan")}`
        : `${t("Invoice")} ${number} ${t("disimpan sebagai draf")}`,
    );
    router.refresh();
  }

  function openReceive(invoice: ArInvoiceRow) {
    setReceiveFor(invoice);
    setReceive({
      date: todayInput,
      accountId: cashAccounts[0]?.id ?? "",
      amount: "",
      method: "Transfer bank",
      statementNote: "",
    });
    setReceiveErrors({});
  }

  async function submitReceive() {
    if (!receiveFor) return;
    const amount = parseAmountInput(receive.amount);
    const nextErrors: Record<string, string> = {};
    if (!receive.date) nextErrors.date = t("Tanggal terima harus diisi.");
    if (!receive.accountId) nextErrors.accountId = t("Akun kas/bank harus dipilih.");
    if (amount <= 0) nextErrors.amount = t("Nilai diterima harus diisi.");
    else if (amount > receiveRemaining) {
      nextErrors.amount = `${t("Nilai melebihi sisa piutang")} ${formatAmount(receiveRemaining)}. ${t(
        "Kelebihan harus dicatat sebagai titipan pelanggan.",
      )}`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setReceiveErrors(nextErrors);
      return;
    }

    setReceiveBusy(true);
    const res = await fetch(`/api/ar/${receiveFor.id}/terima`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: receive.date,
        accountId: receive.accountId,
        amount,
        method: receive.method,
        statementNote: receive.statementNote.trim() || undefined,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string; journal?: { number: string } | null };
    setReceiveBusy(false);

    if (!res.ok) {
      if (data.field) setReceiveErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal mencatat penerimaan."));
      return;
    }

    setReceiveFor(null);
    toast(`${t("Penerimaan dicatat · jurnal kas masuk")} ${data.journal?.number ?? ""} ${t("diposting")}`);
    router.refresh();
  }

  function openAllowance() {
    setAllowance({ basis: "60", amount: overdueBeyond[60] > 0 ? formatAmount(overdueBeyond[60]) : "", reason: "" });
    setAllowanceErrors({});
    setAllowanceOpen(true);
  }

  function updateAllowance(field: keyof typeof allowance, value: string) {
    setAllowance((current) => {
      const next = { ...current, [field]: value };
      if (field === "basis" && value !== "MANUAL") {
        const base = value === "90" ? overdueBeyond[90] : overdueBeyond[60];
        next.amount = base > 0 ? formatAmount(base) : "";
      }
      return next;
    });
    setAllowanceErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submitAllowance() {
    const amount = parseAmountInput(allowance.amount);
    const nextErrors: Record<string, string> = {};
    if (amount <= 0) nextErrors.amount = t("Nilai usulan harus diisi.");
    if (!allowance.reason.trim()) nextErrors.reason = t("Alasan harus diisi.");
    if (Object.keys(nextErrors).length > 0) {
      setAllowanceErrors(nextErrors);
      return;
    }

    setAllowanceBusy(true);
    const res = await fetch("/api/ar/cadangan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basis: allowance.basis,
        amount,
        reason: allowance.reason.trim(),
        unitId: buku || activeUnit.id,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setAllowanceBusy(false);

    if (!res.ok) {
      if (data.field) setAllowanceErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal mengirim usulan cadangan."));
      return;
    }

    setAllowanceOpen(false);
    toast(`${t("Usulan cadangan")} ${formatAmount(amount)} ${t("dikirim ke Administrator")}`);
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Piutang Usaha")}
        subtitle={t("Invoice terbuka per buku unit")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari no. invoice atau pelanggan")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 246 }}
            />
            <button className="btn" onClick={() => toast(t("Pengingat pembayaran dikirim ke pelanggan"))}>
              {t("Kirim pengingat")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openInvoice}>
                {t("Buat invoice")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Total piutang")}</div>
          <div className="v">{dash(metrics.outstanding)}</div>
          <div className="d muted">{`${t("akun")} ${receivableAccountCode} · ${t("buku")} ${bukuLabel}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Belum jatuh tempo")}</div>
          <div className="v">{dash(metrics.current.amount)}</div>
          <div className="d muted">{`${metrics.current.count} ${t("invoice")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Lewat jatuh tempo")}</div>
          <div className="v" style={{ color: "var(--brick)" }}>{dash(metrics.overdue.amount)}</div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {`${metrics.overdue.count} ${t("invoice")} · ${metrics.overdue.customers} ${t("pelanggan")}`}
          </div>
        </div>
        <div className="metric">
          <div className="l">{`${t("Diterima")} ${t(previousMonthLabel)}`}</div>
          <div className="v">{dash(metrics.received.amount)}</div>
          <div className="d muted">{`${metrics.received.count} ${t("penerimaan")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("DSO")}</div>
          <div className="v">{metrics.dso === 0 ? "—" : String(metrics.dso)}</div>
          <div className="d muted">{`${t("hari")} · ${t("target")} 30`}</div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Invoice pelanggan")}</h2>
            <div className="rt">
              <select value={buku} onChange={(event) => setBuku(event.target.value)} style={{ width: "auto" }}>
                <option value="">{t("Semua buku")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
              <select value={termFilter} onChange={(event) => setTermFilter(event.target.value)} style={{ width: "auto" }}>
                <option value="">{t("Semua termin")}</option>
                <option value="0">{t("Tunai")}</option>
                <option value="14">14 {t("hari")}</option>
                <option value="30">30 {t("hari")}</option>
              </select>
            </div>
          </div>
          <div style={{ padding: "12px 18px 0" }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={tab === "all" ? "tab on" : "tab"} onClick={() => setTab("all")}>
                {t("Semua")} <span className="muted">{counts.all}</span>
              </button>
              <button className={tab === "telat" ? "tab on" : "tab"} onClick={() => setTab("telat")}>
                {t("Lewat jatuh tempo")} <span style={{ color: "var(--brick)" }}>{counts.telat}</span>
              </button>
              <button className={tab === "buka" ? "tab on" : "tab"} onClick={() => setTab("buka")}>
                {t("Belum dibayar")} <span className="muted">{counts.buka}</span>
              </button>
              <button className={tab === "sebagian" ? "tab on" : "tab"} onClick={() => setTab("sebagian")}>
                {t("Sebagian")} <span className="muted">{counts.sebagian}</span>
              </button>
              <button className={tab === "lunas" ? "tab on" : "tab"} onClick={() => setTab("lunas")}>
                {t("Lunas")} <span className="muted">{counts.lunas}</span>
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 1000, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 118, whiteSpace: "nowrap" }}>{t("No. invoice")}</th>
                  <th style={{ width: "22%" }}>{t("Pelanggan")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Tanggal")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Jatuh tempo")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Nilai")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Diterima")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Sisa")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {filtered.map((entry) => (
                  <tr key={entry.invoice.id}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{entry.invoice.number}</td>
                    <td>
                      <span style={{ display: "block", fontWeight: 500 }}>{entry.invoice.customerName}</span>
                      <span className="sm muted num">{entry.invoice.customerCode} · {entry.invoice.unitCode}</span>
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{formatDate(entry.invoice.invoiceDate)}</td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{formatDate(entry.invoice.dueDate)}</td>
                    <td className="r num">{dash(entry.invoice.amount)}</td>
                    <td className="r num">{dash(entry.invoice.paidAmount)}</td>
                    <td className="r num">{dash(entry.remaining)}</td>
                    <td>
                      <span className={chipClassFor(entry.status)}>{t(humanizeEnum(entry.status))}</span>
                    </td>
                    <td className="r">
                      {canEdit && entry.status !== "LUNAS" && entry.status !== "BATAL" && entry.status !== "DRAF" && (
                        <button className="btn btn-sm" onClick={() => openReceive(entry.invoice)}>
                          {t("Terima")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{`${filtered.length} ${t("dari")} ${scoped.length} ${t("invoice ditampilkan")}`}</span>
            <span className="k">{t("Sisa yang ditampilkan")}</span>
            <span className="v num">{dash(shownRemaining)}</span>
            <span style={{ marginLeft: "auto" }}>
              <button className="btn btn-sm" onClick={() => toast(t("Daftar piutang diekspor ke Excel"))}>
                {t("Ekspor daftar")}
              </button>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Umur piutang")}</h2>
              <span className="sub">{`${t("buku")} ${bukuLabel} · ${openEntries.length} ${t("invoice")}`}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Umur")}</th>
                  <th className="r">{t("Nilai")}</th>
                  <th style={{ width: "34%" }}></th>
                </tr>
              </thead>
              <tbody>
                {aging.total === 0 && (
                  <tr>
                    <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {aging.total > 0 &&
                  aging.rows.map((row) => (
                    <tr key={row.label}>
                      <td>{t(row.label)}</td>
                      <td className="r num">{dash(row.value)}</td>
                      <td>
                        <div className="bar">
                          <i style={{ width: `${Math.round((row.value / aging.total) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="bal">
              <span className="k">{t("Piutang > 60 hari diusulkan jadi cadangan kerugian")}</span>
              <span style={{ marginLeft: "auto" }}>
                <button className="btn btn-sm" disabled={!canEdit} onClick={openAllowance}>
                  {t("Usulkan")}
                </button>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Penerimaan terakhir")}</h2>
            </div>
            <div className="card-b">
              {scopedReceipts.length === 0 && <div className="sm muted">{t("Belum ada penerimaan")}</div>}
              {scopedReceipts.slice(0, 5).map((receipt) => (
                <div
                  key={receipt.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--rule)" }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 500 }}>
                      {receipt.description.replace("Penerimaan piutang ", "")}
                    </span>
                    <span className="sm muted num">
                      {receipt.number} · {formatDate(receipt.date)}
                    </span>
                  </span>
                  <span className="num" style={{ marginLeft: "auto", fontSize: 12.5 }}>{formatAmount(receipt.amount)}</span>
                </div>
              ))}
              <div className="note" style={{ marginTop: 14 }}>
                {t(
                  "Penerimaan yang berasal dari mutasi bank otomatis ditandai pada rekonsiliasi, jadi tidak perlu dijurnal dua kali.",
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        title={t("Buat invoice penjualan")}
        badge={nextInvoiceNumber}
        maxWidth={600}
        footer={
          <>
            <button className="btn" onClick={() => setInvoiceOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn" style={{ marginLeft: "auto" }} disabled={invoiceBusy} onClick={() => void submitInvoice(false)}>
              {t("Simpan draf")}
            </button>
            <button className="btn btn-primary" disabled={invoiceBusy} onClick={() => void submitInvoice(true)}>
              {invoiceBusy ? t("Menyimpan…") : t("Posting & kirim")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Pelanggan")}</label>
            <select
              className={invoiceErrors.customerId ? "field-error" : undefined}
              value={draft.customerId}
              onChange={(event) => updateDraft("customerId", event.target.value)}
            >
              <option value="">{t("— Pilih pelanggan —")}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} · {customer.name}
                </option>
              ))}
            </select>
            {customers.length === 0 && (
              <span className="sm muted">{t("Belum ada pelanggan — tambahkan di layar Customer dulu.")}</span>
            )}
          </div>
          <div>
            <label className="f">{t("Buku unit")}</label>
            <select value={draft.unitId} onChange={(event) => updateDraft("unitId", event.target.value)}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Tanggal")}</label>
            <input
              type="date"
              className={invoiceErrors.invoiceDate ? "field-error" : undefined}
              value={draft.invoiceDate}
              onChange={(event) => updateDraft("invoiceDate", event.target.value)}
            />
          </div>
          <div>
            <label className="f">{t("Termin")}</label>
            <select value={draft.term} onChange={(event) => updateDraft("term", event.target.value)}>
              {TERM_OPTIONS.map((term) => (
                <option key={term} value={String(term)}>
                  {term === 0 ? t("Tunai") : `${term} ${t("hari")}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Jatuh tempo")}</label>
            <input type="date" value={draft.dueDate} onChange={(event) => updateDraft("dueDate", event.target.value)} />
          </div>
        </div>
        <div style={{ border: "1px solid var(--rule)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>{t("Barang / jasa")}</th>
                <th className="r" style={{ width: 74 }}>{t("Qty")}</th>
                <th className="r" style={{ width: 118 }}>{t("Harga")}</th>
                <th className="r" style={{ width: 124 }}>{t("Jumlah")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const rowTotal = parseAmountInput(line.quantity) * parseAmountInput(line.unitPrice);
                return (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        style={{ textAlign: "left" }}
                        placeholder={t("Barang / jasa")}
                        value={line.description}
                        onChange={(event) => updateLine(index, "description", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="num"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, "quantity", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="num"
                        placeholder="0"
                        value={line.unitPrice}
                        onChange={(event) => updateLine(index, "unitPrice", event.target.value)}
                      />
                    </td>
                    <td className="r num">{dash(rowTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="bal" style={{ padding: "9px 14px" }}>
            <button className="btn btn-sm" onClick={() => setLines((current) => [...current, { ...emptyLine }])}>
              {t("Tambah baris")}
            </button>
            <span className="k" style={{ marginLeft: "auto" }}>{t("Subtotal")}</span>
            <span className="v num">{dash(subtotal)}</span>
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f">{t("Faktur pajak")}</label>
            <select value={draft.ppnMode} onChange={(event) => updateDraft("ppnMode", event.target.value)}>
              <option value="11">{t("010 · PPN 11%")}</option>
              <option value="0">{t("Tanpa PPN")}</option>
            </select>
          </div>
          <div>
            <label className="f">{t("PPN keluaran")}</label>
            <input type="text" className="num" value={formatAmount(ppn)} readOnly style={{ background: "var(--sunk)" }} />
          </div>
          <div>
            <label className="f">{t("Total invoice")}</label>
            <input
              type="text"
              className="num"
              value={formatAmount(invoiceTotal)}
              readOnly
              style={{ background: "var(--sunk)", fontWeight: 600 }}
            />
          </div>
        </div>
        <div className="note">
          {`${t("Jurnal terbentuk otomatis: debit piutang usaha")} ${receivableAccountCode}${t(
            ", kredit pendapatan penjualan 4-1000 dan PPN keluaran 2-1100.",
          )}`}
        </div>
        {Object.values(invoiceErrors).some(Boolean) && (
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
            {Object.values(invoiceErrors).filter(Boolean)[0]}
          </div>
        )}
      </Dialog>

      <Dialog
        open={receiveFor !== null}
        onClose={() => setReceiveFor(null)}
        title={t("Terima pembayaran")}
        badge={`${t("sisa")} ${formatAmount(receiveRemaining)}`}
        badgeTone="warn"
        maxWidth={520}
        footer={
          <>
            <button className="btn" onClick={() => setReceiveFor(null)}>
              {t("Batal")}
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
              disabled={receiveBusy}
              onClick={() => void submitReceive()}
            >
              {receiveBusy ? t("Menyimpan…") : t("Terima & posting")}
            </button>
          </>
        }
      >
        {receiveFor && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
              padding: "11px 13px",
              background: "var(--paper)",
              borderRadius: 10,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>{receiveFor.customerName}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              <span className="num">{receiveFor.number}</span> · {t("nilai")}{" "}
              <span className="num">{formatAmount(receiveFor.amount)}</span> · {t("diterima")}{" "}
              <span className="num">{formatAmount(receiveFor.paidAmount)}</span> · {t("jatuh tempo")}{" "}
              <span className="num">{formatDate(receiveFor.dueDate)}</span>
            </div>
          </div>
        )}
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Tanggal terima")}</label>
            <input
              type="date"
              className={receiveErrors.date ? "field-error" : undefined}
              value={receive.date}
              onChange={(event) => setReceive((current) => ({ ...current, date: event.target.value }))}
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("Masuk ke akun")}</label>
            <select
              className={receiveErrors.accountId ? "field-error" : undefined}
              value={receive.accountId}
              onChange={(event) => setReceive((current) => ({ ...current, accountId: event.target.value }))}
            >
              <option value="">{t("— Pilih akun kas/bank —")}</option>
              {cashAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Nilai diterima")}</label>
            <input
              type="text"
              className={receiveErrors.amount ? "num field-error" : "num"}
              placeholder="0"
              value={receive.amount}
              onChange={(event) => setReceive((current) => ({ ...current, amount: event.target.value }))}
            />
          </div>
          <div>
            <label className="f">{t("Cara pembayaran")}</label>
            <select
              value={receive.method}
              onChange={(event) => setReceive((current) => ({ ...current, method: event.target.value }))}
            >
              <option value="Transfer bank">{t("Transfer bank")}</option>
              <option value="Tunai">{t("Tunai")}</option>
              <option value="Cek / giro">{t("Cek / giro")}</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Cocokkan dengan mutasi bank")}</label>
            <select
              value={receive.statementNote}
              onChange={(event) => setReceive((current) => ({ ...current, statementNote: event.target.value }))}
            >
              <option value="">{t("Belum ada mutasi yang cocok")}</option>
            </select>
          </div>
        </div>
        <div className="note">
          {t("Jika dicocokkan dengan mutasi bank, baris tersebut langsung ditandai selesai di layar rekonsiliasi.")}
        </div>
        {Object.values(receiveErrors).some(Boolean) && (
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
            {Object.values(receiveErrors).filter(Boolean)[0]}
          </div>
        )}
      </Dialog>

      <Dialog
        open={allowanceOpen}
        onClose={() => setAllowanceOpen(false)}
        title={t("Usulkan cadangan kerugian piutang")}
        maxWidth={470}
        footer={
          <>
            <button className="btn" onClick={() => setAllowanceOpen(false)}>
              {t("Batal")}
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
              disabled={allowanceBusy}
              onClick={() => void submitAllowance()}
            >
              {allowanceBusy ? t("Mengirim…") : t("Kirim usulan")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f">{t("Dasar usulan")}</label>
            <select value={allowance.basis} onChange={(event) => updateAllowance("basis", event.target.value)}>
              <option value="60">{t("Piutang > 60 hari")}</option>
              <option value="90">{t("Piutang > 90 hari")}</option>
              <option value="MANUAL">{t("Pilih invoice manual")}</option>
            </select>
          </div>
          <div>
            <label className="f" data-req="1">{t("Nilai usulan")}</label>
            <input
              type="text"
              className={allowanceErrors.amount ? "num field-error" : "num"}
              placeholder="0"
              value={allowance.amount}
              onChange={(event) => updateAllowance("amount", event.target.value)}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">{t("Alasan")}</label>
            <input
              type="text"
              className={allowanceErrors.reason ? "field-error" : undefined}
              placeholder={t("Misal: pelanggan tidak merespons 3 kali penagihan")}
              value={allowance.reason}
              onChange={(event) => updateAllowance("reason", event.target.value)}
            />
          </div>
        </div>
        <div className="note note-warn">
          {t(
            "Usulan dikirim ke Administrator. Jurnal cadangan baru terbentuk setelah disetujui, dan tidak bisa diubah setelah periode dikunci.",
          )}
        </div>
        {Object.values(allowanceErrors).some(Boolean) && (
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
            {Object.values(allowanceErrors).filter(Boolean)[0]}
          </div>
        )}
      </Dialog>
    </>
  );
}
