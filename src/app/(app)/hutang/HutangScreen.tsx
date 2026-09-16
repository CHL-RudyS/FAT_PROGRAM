"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { chipClassFor, dash, formatAmount, formatDate, humanizeEnum, parseAmountInput } from "@/lib/format";

export type ApInvoiceRow = {
  id: string;
  number: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  vendorTerm: number;
  unitId: string;
  unitCode: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: "DRAF" | "TERBUKA" | "SEBAGIAN" | "LUNAS" | "JATUH_TEMPO" | "BATAL";
  description: string | null;
};

type VendorRow = { id: string; code: string; name: string; paymentTerm: number };
type UnitRow = { id: string; code: string; name: string };
type AccountRow = { id: string; code: string; name: string };

const DAY = 86_400_000;

/** Umur hutang — same buckets the Customer screen uses for its aging card. */
const AGING_BUCKETS: Array<{ label: string; from: number; to: number }> = [
  { label: "Belum jatuh tempo", from: -Infinity, to: 0 },
  { label: "1–30 hari", from: 1, to: 30 },
  { label: "31–60 hari", from: 31, to: 60 },
  { label: "61–90 hari", from: 61, to: 90 },
  { label: "> 90 hari", from: 91, to: Infinity },
];

const PPH_OPTIONS = [
  { label: "PPh 23 — 2%", rate: 2 },
  { label: "PPh 4(2) — 10%", rate: 10 },
  { label: "Tidak ada", rate: 0 },
];

const TERM_OPTIONS = [30, 14, 7, 0];

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Date(date.getTime() + days * DAY).toISOString().slice(0, 10);
}

export default function HutangScreen({
  invoices,
  vendors,
  units,
  expenseAccounts,
  payableAccounts,
  cashAccounts,
  payableAccountCode,
  paidPreviousMonth,
  previousMonthLabel,
  todayIso,
  activeUnit,
  canEdit,
}: {
  invoices: ApInvoiceRow[];
  vendors: VendorRow[];
  units: UnitRow[];
  expenseAccounts: AccountRow[];
  payableAccounts: AccountRow[];
  cashAccounts: AccountRow[];
  payableAccountCode: string;
  paidPreviousMonth: Array<{ unitId: string; amount: number }>;
  previousMonthLabel: string;
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
  const [vendorFilter, setVendorFilter] = useState("");
  const [tab, setTab] = useState("all");

  const [billOpen, setBillOpen] = useState(false);
  const [billBusy, setBillBusy] = useState(false);
  const [billErrors, setBillErrors] = useState<Record<string, string>>({});
  const [bill, setBill] = useState({
    vendorId: "",
    vendorRef: "",
    invoiceDate: todayInput,
    term: "30",
    dueDate: addDays(todayInput, 30),
    unitId: activeUnit.id,
    expenseAccountId: "",
    dpp: "",
    pphRate: "0",
    payableAccountId: "",
    description: "",
  });

  const [payFor, setPayFor] = useState<ApInvoiceRow | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [pay, setPay] = useState({
    date: todayInput,
    accountId: "",
    amount: "",
    method: "Transfer bank",
    reference: "",
    note: "",
  });

  /** The stored status can go stale between page loads, so recompute it for display. */
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
      if (vendorFilter && entry.invoice.vendorId !== vendorFilter) return false;
      if (tab === "telat" && entry.status !== "JATUH_TEMPO") return false;
      if (tab === "buka" && entry.status !== "TERBUKA" && entry.status !== "DRAF") return false;
      if (tab === "sebagian" && entry.status !== "SEBAGIAN") return false;
      if (tab === "lunas" && entry.status !== "LUNAS") return false;
      if (!needle) return true;
      return `${entry.invoice.number} ${entry.invoice.vendorCode} ${entry.invoice.vendorName} ${entry.invoice.description ?? ""}`
        .toLowerCase()
        .includes(needle);
    });
  }, [scoped, query, vendorFilter, tab]);

  const openEntries = useMemo(
    () => scoped.filter((entry) => entry.status !== "LUNAS" && entry.status !== "BATAL" && entry.status !== "DRAF"),
    [scoped],
  );

  const metrics = useMemo(() => {
    const outstanding = openEntries.reduce((sum, entry) => sum + entry.remaining, 0);

    const dueSoon = openEntries.filter((entry) => entry.overdueDays <= 0 && entry.overdueDays > -8);
    const overdue = openEntries.filter((entry) => entry.overdueDays > 0);
    const overdueVendors = new Set(overdue.map((entry) => entry.invoice.vendorId)).size;

    const paid = paidPreviousMonth.filter((row) => (buku ? row.unitId === buku : true));
    const paidTotal = paid.reduce((sum, row) => sum + row.amount, 0);

    const ageSum = openEntries.reduce(
      (sum, entry) =>
        sum + entry.remaining * Math.max(0, Math.floor((today - new Date(entry.invoice.invoiceDate).getTime()) / DAY)),
      0,
    );
    const averageAge = outstanding > 0 ? Math.round(ageSum / outstanding) : 0;
    const averageTerm = openEntries.length
      ? Math.round(openEntries.reduce((sum, entry) => sum + entry.invoice.vendorTerm, 0) / openEntries.length)
      : 30;

    return {
      outstanding,
      dueSoon: { amount: dueSoon.reduce((sum, entry) => sum + entry.remaining, 0), count: dueSoon.length },
      overdue: { amount: overdue.reduce((sum, entry) => sum + entry.remaining, 0), count: overdue.length, vendors: overdueVendors },
      paid: { amount: paidTotal, count: paid.length },
      averageAge,
      averageTerm,
    };
  }, [openEntries, paidPreviousMonth, buku, today]);

  const aging = useMemo(() => {
    const rows = AGING_BUCKETS.map((bucket) => ({ label: bucket.label, value: 0 }));
    for (const entry of openEntries) {
      const index = AGING_BUCKETS.findIndex((bucket) => entry.overdueDays >= bucket.from && entry.overdueDays <= bucket.to);
      if (index >= 0) rows[index].value += entry.remaining;
    }
    return { rows, total: rows.reduce((sum, row) => sum + row.value, 0) };
  }, [openEntries]);

  /** Tagihan jatuh tempo dalam 7 hari ke depan — rencana pembayaran minggu ini. */
  const weekPlan = useMemo(
    () =>
      openEntries
        .filter((entry) => entry.overdueDays > -8)
        .sort((a, b) => b.overdueDays - a.overdueDays)
        .slice(0, 5),
    [openEntries],
  );

  const shownRemaining = filtered.reduce(
    (sum, entry) => sum + (entry.status === "LUNAS" || entry.status === "BATAL" ? 0 : entry.remaining),
    0,
  );

  const bukuLabel = buku ? units.find((unit) => unit.id === buku)?.code ?? activeUnit.code : t("semua buku");

  const billDpp = parseAmountInput(bill.dpp);
  const billPpn = Math.round(billDpp * 0.11);
  const billTotal = billDpp + billPpn;

  const payRemaining = payFor ? payFor.amount - payFor.paidAmount : 0;

  function updateBill(field: keyof typeof bill, value: string) {
    setBill((current) => {
      const next = { ...current, [field]: value };
      if (field === "term") next.dueDate = addDays(next.invoiceDate, Number(value) || 0);
      if (field === "invoiceDate") next.dueDate = addDays(value, Number(next.term) || 0);
      return next;
    });
    setBillErrors((current) => ({ ...current, [field]: "" }));
  }

  function openBill() {
    setBill({
      vendorId: vendors[0]?.id ?? "",
      vendorRef: "",
      invoiceDate: todayInput,
      term: "30",
      dueDate: addDays(todayInput, 30),
      unitId: activeUnit.id,
      expenseAccountId: expenseAccounts[0]?.id ?? "",
      dpp: "",
      pphRate: "0",
      payableAccountId: payableAccounts.find((account) => account.code === payableAccountCode)?.id ?? payableAccounts[0]?.id ?? "",
      description: "",
    });
    setBillErrors({});
    setBillOpen(true);
  }

  async function submitBill(post: boolean) {
    const nextErrors: Record<string, string> = {};
    if (!bill.vendorId) nextErrors.vendorId = t("Vendor harus dipilih.");
    if (!bill.vendorRef.trim()) nextErrors.vendorRef = t("No. tagihan vendor harus diisi.");
    if (!bill.invoiceDate) nextErrors.invoiceDate = t("Tanggal tagihan harus diisi.");
    if (!bill.expenseAccountId) nextErrors.expenseAccountId = t("Akun beban / persediaan harus dipilih.");
    if (billDpp <= 0) nextErrors.dpp = t("DPP harus lebih besar dari nol.");
    if (Object.keys(nextErrors).length > 0) {
      setBillErrors(nextErrors);
      return;
    }

    setBillBusy(true);
    const res = await fetch("/api/ap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: bill.vendorId,
        vendorRef: bill.vendorRef.trim(),
        unitId: bill.unitId,
        invoiceDate: bill.invoiceDate,
        dueDate: bill.dueDate || bill.invoiceDate,
        expenseAccountId: bill.expenseAccountId,
        payableAccountId: bill.payableAccountId || undefined,
        dpp: billDpp,
        ppnRate: 11,
        pphRate: Number(bill.pphRate) || 0,
        description: bill.description.trim() || undefined,
        post,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      field?: string;
      journal?: { number: string } | null;
      unitCode?: string;
    };
    setBillBusy(false);

    if (!res.ok) {
      if (data.field) setBillErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan tagihan."));
      return;
    }

    setBillOpen(false);
    toast(
      post
        ? `${t("Tagihan tersimpan · jurnal")} ${data.journal?.number ?? ""} ${t("diposting ke buku")} ${data.unitCode ?? activeUnit.code}`
        : t("Tagihan disimpan sebagai draf, belum masuk buku besar"),
    );
    router.refresh();
  }

  function openPay(invoice: ApInvoiceRow) {
    setPayFor(invoice);
    setPay({
      date: todayInput,
      accountId: cashAccounts[0]?.id ?? "",
      amount: "",
      method: "Transfer bank",
      reference: "",
      note: "",
    });
    setPayErrors({});
  }

  async function submitPay() {
    if (!payFor) return;
    const amount = parseAmountInput(pay.amount);
    const nextErrors: Record<string, string> = {};
    if (!pay.date) nextErrors.date = t("Tanggal bayar harus diisi.");
    if (!pay.accountId) nextErrors.accountId = t("Sumber dana harus dipilih.");
    if (amount <= 0) nextErrors.amount = t("Nilai pembayaran harus diisi.");
    else if (amount > payRemaining) {
      nextErrors.amount = `${t("Nilai pembayaran melebihi sisa tagihan")} ${formatAmount(payRemaining)}.`;
    }
    if (Object.keys(nextErrors).length > 0) {
      setPayErrors(nextErrors);
      return;
    }

    setPayBusy(true);
    const res = await fetch(`/api/ap/${payFor.id}/bayar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: pay.date,
        accountId: pay.accountId,
        amount,
        method: pay.method,
        reference: pay.reference.trim() || undefined,
        note: pay.note.trim() || undefined,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string; approval?: boolean; journal?: { number: string } | null };
    setPayBusy(false);

    if (!res.ok) {
      if (data.field) setPayErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal mencatat pembayaran."));
      return;
    }

    setPayFor(null);
    toast(
      data.approval
        ? t("Pembayaran menunggu persetujuan Administrator sebelum jurnal kas keluar diposting")
        : `${t("Pembayaran dicatat · jurnal kas keluar")} ${data.journal?.number ?? ""} ${t("diposting")}`,
    );
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Hutang Usaha")}
        subtitle={t("Tagihan terbuka per buku unit")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari no. tagihan atau vendor")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 236 }}
            />
            <button className="btn" onClick={() => toast(t("Daftar hutang diekspor ke Excel"))}>
              {t("Ekspor daftar")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openBill}>
                {t("Catat tagihan")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Total utang usaha")}</div>
          <div className="v">{dash(metrics.outstanding)}</div>
          <div className="d muted">{`${t("akun")} ${payableAccountCode} · ${t("buku")} ${bukuLabel}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Jatuh tempo ≤ 7 hari")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>{dash(metrics.dueSoon.amount)}</div>
          <div className="d" style={{ color: "var(--amber)" }}>{`${metrics.dueSoon.count} ${t("tagihan")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Lewat jatuh tempo")}</div>
          <div className="v" style={{ color: "var(--brick)" }}>{dash(metrics.overdue.amount)}</div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {`${metrics.overdue.count} ${t("tagihan")} · ${metrics.overdue.vendors} ${t("vendor")}`}
          </div>
        </div>
        <div className="metric">
          <div className="l">{`${t("Dibayar")} ${t(previousMonthLabel)}`}</div>
          <div className="v">{dash(metrics.paid.amount)}</div>
          <div className="d muted">{`${metrics.paid.count} ${t("pembayaran")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Rata-rata umur bayar")}</div>
          <div className="v">{metrics.averageAge === 0 ? "—" : String(metrics.averageAge)}</div>
          <div className="d muted">{`${t("hari")} · ${t("termin rata-rata")} ${metrics.averageTerm}`}</div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Tagihan vendor")}</h2>
            <div className="rt">
              <select value={buku} onChange={(event) => setBuku(event.target.value)} style={{ width: "auto" }}>
                <option value="">{t("Semua buku")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
              <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} style={{ width: "auto" }}>
                <option value="">{t("Semua vendor")}</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
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
                  <th style={{ width: 124, whiteSpace: "nowrap" }}>{t("No. tagihan")}</th>
                  <th style={{ width: "22%" }}>{t("Vendor")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Tanggal")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Jatuh tempo")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Nilai")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Terbayar")}</th>
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
                      <span style={{ display: "block", fontWeight: 500 }}>{entry.invoice.vendorName}</span>
                      <span className="sm muted num">{entry.invoice.vendorCode} · {entry.invoice.unitCode}</span>
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
                        <button className="btn btn-sm" onClick={() => openPay(entry.invoice)}>
                          {t("Bayar")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">
              {`${filtered.length} ${t("dari")} ${scoped.length} ${t("tagihan ditampilkan")}`}
            </span>
            <span className="k">{t("Sisa yang ditampilkan")}</span>
            <span className="v num">{dash(shownRemaining)}</span>
            <span style={{ marginLeft: "auto" }}>
              <a className="btn btn-sm" href="/jurnal">
                {t("Buka jurnal terkait")}
              </a>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Umur hutang")}</h2>
              <span className="sub">{`${t("buku")} ${bukuLabel} · ${openEntries.length} ${t("tagihan")}`}</span>
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
              <span className="k">{t("Angka ini yang masuk paket laporan bank")}</span>
              <span style={{ marginLeft: "auto" }}>
                <a className="btn btn-sm" href="/laporan-khusus">
                  {t("Lihat paket")}
                </a>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Rencana Pembayaran Minggu Ini")}</h2>
            </div>
            <div className="card-b">
              {weekPlan.length === 0 && <div className="sm muted">{t("Belum ada rencana pembayaran")}</div>}
              {weekPlan.map((entry) => (
                <div
                  key={entry.invoice.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--rule)" }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 500 }}>{entry.invoice.vendorName}</span>
                    <span className="sm muted num">
                      {entry.invoice.number} · {formatDate(entry.invoice.dueDate)}
                    </span>
                  </span>
                  <span className="num" style={{ marginLeft: "auto", fontSize: 12.5 }}>{formatAmount(entry.remaining)}</span>
                </div>
              ))}
              <div className="note note-warn" style={{ marginTop: 14 }}>
                {`${t("Pembayaran di atas")} ${formatAmount(50_000_000)} — ${t("perlu persetujuan Administrator sebelum jurnal kas keluar diposting.")}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={billOpen}
        onClose={() => setBillOpen(false)}
        title={t("Catat tagihan vendor")}
        badge={`${t("buku")} ${units.find((unit) => unit.id === bill.unitId)?.code ?? activeUnit.code} · ${
          units.find((unit) => unit.id === bill.unitId)?.name ?? activeUnit.name
        }`}
        footer={
          <>
            <button className="btn" onClick={() => setBillOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn" style={{ marginLeft: "auto" }} disabled={billBusy} onClick={() => void submitBill(false)}>
              {t("Simpan draf")}
            </button>
            <button className="btn btn-primary" disabled={billBusy} onClick={() => void submitBill(true)}>
              {billBusy ? t("Menyimpan…") : t("Simpan & posting")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Vendor")}</label>
            <select
              className={billErrors.vendorId ? "field-error" : undefined}
              value={bill.vendorId}
              onChange={(event) => updateBill("vendorId", event.target.value)}
            >
              <option value="">{t("— Pilih vendor —")}</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.code} · {vendor.name}
                </option>
              ))}
            </select>
            {vendors.length === 0 && <span className="sm muted">{t("Belum ada vendor — tambahkan di layar Vendor dulu.")}</span>}
          </div>
          <div>
            <label className="f" data-req="1">{t("No. tagihan vendor")}</label>
            <input
              type="text"
              className={billErrors.vendorRef ? "num field-error" : "num"}
              placeholder="TG-2026-…"
              value={bill.vendorRef}
              onChange={(event) => updateBill("vendorRef", event.target.value)}
            />
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Tanggal tagihan")}</label>
            <input
              type="date"
              className={billErrors.invoiceDate ? "field-error" : undefined}
              value={bill.invoiceDate}
              onChange={(event) => updateBill("invoiceDate", event.target.value)}
            />
          </div>
          <div>
            <label className="f">{t("Termin")}</label>
            <select value={bill.term} onChange={(event) => updateBill("term", event.target.value)}>
              {TERM_OPTIONS.map((term) => (
                <option key={term} value={String(term)}>
                  {term === 0 ? t("Tunai") : `${term} ${t("hari")}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Jatuh tempo")}</label>
            <input type="date" value={bill.dueDate} onChange={(event) => updateBill("dueDate", event.target.value)} />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f">{t("Buku unit")}</label>
            <select value={bill.unitId} onChange={(event) => updateBill("unitId", event.target.value)}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f" data-req="1">{t("Akun beban / persediaan")}</label>
            <select
              className={billErrors.expenseAccountId ? "field-error" : undefined}
              value={bill.expenseAccountId}
              onChange={(event) => updateBill("expenseAccountId", event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {expenseAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("DPP")}</label>
            <input
              type="text"
              className={billErrors.dpp ? "num field-error" : "num"}
              placeholder="0"
              value={bill.dpp}
              onChange={(event) => updateBill("dpp", event.target.value)}
            />
          </div>
          <div>
            <label className="f">{t("PPN 11%")}</label>
            <input type="text" className="num" value={formatAmount(billPpn)} readOnly style={{ background: "var(--sunk)" }} />
          </div>
          <div>
            <label className="f">{t("Total tagihan")}</label>
            <input
              type="text"
              className="num"
              value={formatAmount(billTotal)}
              readOnly
              style={{ background: "var(--sunk)", fontWeight: 600 }}
            />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f">{t("Potongan PPh")}</label>
            <select value={bill.pphRate} onChange={(event) => updateBill("pphRate", event.target.value)}>
              {PPH_OPTIONS.map((option) => (
                <option key={option.label} value={String(option.rate)}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Akun utang")}</label>
            <select value={bill.payableAccountId} onChange={(event) => updateBill("payableAccountId", event.target.value)}>
              {payableAccounts.map((account) => (
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
              placeholder={t("Misal: pembelian karton bulan Agustus")}
              value={bill.description}
              onChange={(event) => updateBill("description", event.target.value)}
            />
          </div>
        </div>
        <div className="dz" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t("Lampirkan bukti tagihan")}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
            {t("Tarik file PDF/JPG ke sini · maksimal 5 MB per file")}
          </div>
        </div>
        <div className="note">
          {t(
            "Jurnal terbentuk otomatis: debit akun beban/persediaan dan PPN masukan, kredit utang usaha. Nomor jurnal diberikan setelah disimpan.",
          )}
        </div>
        {Object.values(billErrors).some(Boolean) && (
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
            {Object.values(billErrors).filter(Boolean)[0]}
          </div>
        )}
      </Dialog>

      <Dialog
        open={payFor !== null}
        onClose={() => setPayFor(null)}
        title={t("Bayar tagihan")}
        badge={`${t("sisa")} ${formatAmount(payRemaining)}`}
        badgeTone="warn"
        maxWidth={520}
        footer={
          <>
            <button className="btn" onClick={() => setPayFor(null)}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={payBusy} onClick={() => void submitPay()}>
              {payBusy ? t("Menyimpan…") : t("Bayar & posting")}
            </button>
          </>
        }
      >
        {payFor && (
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
            <div style={{ fontSize: 13, fontWeight: 600 }}>{payFor.vendorName}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>
              <span className="num">{payFor.number}</span> · {t("nilai")} <span className="num">{formatAmount(payFor.amount)}</span> ·{" "}
              {t("terbayar")} <span className="num">{formatAmount(payFor.paidAmount)}</span> · {t("jatuh tempo")}{" "}
              <span className="num">{formatDate(payFor.dueDate)}</span>
            </div>
          </div>
        )}
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Tanggal bayar")}</label>
            <input
              type="date"
              className={payErrors.date ? "field-error" : undefined}
              value={pay.date}
              onChange={(event) => setPay((current) => ({ ...current, date: event.target.value }))}
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("Sumber dana")}</label>
            <select
              className={payErrors.accountId ? "field-error" : undefined}
              value={pay.accountId}
              onChange={(event) => setPay((current) => ({ ...current, accountId: event.target.value }))}
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
            <label className="f" data-req="1">{t("Nilai pembayaran")}</label>
            <input
              type="text"
              className={payErrors.amount ? "num field-error" : "num"}
              placeholder="0"
              value={pay.amount}
              onChange={(event) => setPay((current) => ({ ...current, amount: event.target.value }))}
            />
          </div>
          <div>
            <label className="f">{t("Metode")}</label>
            <select value={pay.method} onChange={(event) => setPay((current) => ({ ...current, method: event.target.value }))}>
              <option value="Transfer bank">{t("Transfer bank")}</option>
              <option value="Cek / giro">{t("Cek / giro")}</option>
              <option value="Tunai">{t("Tunai")}</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Nomor referensi bank")}</label>
            <input
              type="text"
              className="num"
              placeholder={t("Opsional · muncul di rekonsiliasi")}
              value={pay.reference}
              onChange={(event) => setPay((current) => ({ ...current, reference: event.target.value }))}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Catatan")}</label>
            <input
              type="text"
              placeholder={t("Misal: pelunasan tahap kedua")}
              value={pay.note}
              onChange={(event) => setPay((current) => ({ ...current, note: event.target.value }))}
            />
          </div>
        </div>
        <div className="note note-warn">
          {t(
            "Pembayaran di atas 50.000.000 masuk daftar persetujuan Administrator dan belum memotong saldo bank sampai disetujui.",
          )}
        </div>
        {Object.values(payErrors).some(Boolean) && (
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
            {Object.values(payErrors).filter(Boolean)[0]}
          </div>
        )}
      </Dialog>
    </>
  );
}
