"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { MONTHS_ID, dash, formatAmount, formatDate, parseAmountInput } from "@/lib/format";

export type CustomerOption = { id: string; code: string; name: string; paymentTerm: number };
export type LedgerAccountOption = { id: string; code: string; name: string };
export type UnitOption = { id: string; code: string; name: string };

export type SalesInvoiceRow = {
  id: string;
  number: string;
  invoiceDate: string;
  dueDate: string;
  dpp: number;
  ppn: number;
  total: number;
  paidAmount: number;
  termDays: number;
  efaktur: "BELUM" | "DIAJUKAN" | "DISETUJUI" | "DITOLAK";
  efakturNo: string | null;
  status: "DRAF" | "TERBUKA" | "SEBAGIAN" | "LUNAS" | "JATUH_TEMPO" | "BATAL";
  unitId: string;
  unitCode: string;
  customerId: string;
  customerCode: string;
  customerName: string;
};

const DAY = 86_400_000;

const EFAKTUR_LABEL: Record<SalesInvoiceRow["efaktur"], string> = {
  BELUM: "Belum",
  DIAJUKAN: "Diajukan",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
};

const EFAKTUR_CHIP: Record<SalesInvoiceRow["efaktur"], string> = {
  BELUM: "chip chip-lock",
  DIAJUKAN: "chip chip-warn",
  DISETUJUI: "chip chip-ok",
  DITOLAK: "chip chip-bad",
};

const STATUS_LABEL: Record<SalesInvoiceRow["status"], string> = {
  DRAF: "Draf",
  TERBUKA: "Terkirim",
  SEBAGIAN: "Sebagian",
  LUNAS: "Dibayar",
  JATUH_TEMPO: "Jatuh tempo",
  BATAL: "Batal",
};

const STATUS_CHIP: Record<SalesInvoiceRow["status"], string> = {
  DRAF: "chip chip-lock",
  TERBUKA: "chip chip-open",
  SEBAGIAN: "chip chip-warn",
  LUNAS: "chip chip-ok",
  JATUH_TEMPO: "chip chip-bad",
  BATAL: "chip chip-bad",
};

/** Tab "Terkirim" menampung faktur terbit yang belum lunas. */
const TAB_STATUS: Record<string, SalesInvoiceRow["status"][]> = {
  draf: ["DRAF"],
  terkirim: ["TERBUKA", "SEBAGIAN", "JATUH_TEMPO"],
  dibayar: ["LUNAS"],
  batal: ["BATAL"],
};

const TERM_OPTIONS = [30, 14, 60, 0];

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Date(date.getTime() + days * DAY).toISOString().slice(0, 10);
}

export default function FakturPenjualanScreen({
  invoices,
  customers,
  revenueAccounts,
  units,
  activeUnit,
  todayIso,
  nextNumber,
  canEdit,
}: {
  invoices: SalesInvoiceRow[];
  customers: CustomerOption[];
  revenueAccounts: LedgerAccountOption[];
  units: UnitOption[];
  activeUnit: UnitOption;
  todayIso: string;
  nextNumber: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const todayInput = todayIso.slice(0, 10);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthLabel = `${MONTHS_ID[today.getMonth()]} ${year}`;
  const previousMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const previousLabel = `${MONTHS_ID[previousMonth.month - 1]} ${previousMonth.year}`;
  const quarter = Math.floor((month - 1) / 3) + 1;
  const quarterLabel = `${t("Kuartal")} ${["I", "II", "III", "IV"][quarter - 1]} ${year}`;

  const [query, setQuery] = useState("");
  const [buku, setBuku] = useState("");
  const [period, setPeriod] = useState("bulan");
  const [tab, setTab] = useState("all");

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    customerId: "",
    number: nextNumber,
    invoiceDate: todayInput,
    term: "30",
    dueDate: addDays(todayInput, 30),
    revenueAccountId: "",
    ppnMode: "11",
    description: "",
    quantity: "1",
    unitPrice: "",
    takeSeries: true,
  });

  const dpp = useMemo(
    () => Math.round(parseAmountInput(form.quantity) * parseAmountInput(form.unitPrice) * 100) / 100,
    [form.quantity, form.unitPrice],
  );
  const ppnRate = Number(form.ppnMode);
  const ppn = useMemo(() => Math.round(((dpp * ppnRate) / 100) * 100) / 100, [dpp, ppnRate]);
  const total = dpp + ppn;

  const scoped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return invoices.filter((invoice) => {
      if (buku && invoice.unitId !== buku) return false;
      const date = new Date(invoice.invoiceDate);
      if (period === "bulan" && (date.getFullYear() !== year || date.getMonth() + 1 !== month)) return false;
      if (
        period === "lalu" &&
        (date.getFullYear() !== previousMonth.year || date.getMonth() + 1 !== previousMonth.month)
      ) {
        return false;
      }
      if (
        period === "kuartal" &&
        (date.getFullYear() !== year || Math.floor(date.getMonth() / 3) + 1 !== quarter)
      ) {
        return false;
      }
      if (!needle) return true;
      return `${invoice.number} ${invoice.customerCode} ${invoice.customerName}`.toLowerCase().includes(needle);
    });
  }, [invoices, query, buku, period, year, month, previousMonth.year, previousMonth.month, quarter]);

  const counts = useMemo(
    () => ({
      all: scoped.length,
      draf: scoped.filter((invoice) => TAB_STATUS.draf.includes(invoice.status)).length,
      terkirim: scoped.filter((invoice) => TAB_STATUS.terkirim.includes(invoice.status)).length,
      dibayar: scoped.filter((invoice) => TAB_STATUS.dibayar.includes(invoice.status)).length,
      batal: scoped.filter((invoice) => TAB_STATUS.batal.includes(invoice.status)).length,
    }),
    [scoped],
  );

  const filtered = useMemo(
    () => (tab === "all" ? scoped : scoped.filter((invoice) => TAB_STATUS[tab]?.includes(invoice.status))),
    [scoped, tab],
  );

  const shownTotal = filtered.reduce((sum, invoice) => sum + invoice.total, 0);

  const metrics = useMemo(() => {
    const thisMonth = invoices.filter((invoice) => {
      const date = new Date(invoice.invoiceDate);
      return date.getFullYear() === year && date.getMonth() + 1 === month && invoice.status !== "BATAL";
    });
    const usedSeries = invoices.filter(
      (invoice) => new Date(invoice.invoiceDate).getFullYear() === year && invoice.efaktur !== "BELUM",
    ).length;
    return {
      count: thisMonth.length,
      books: new Set(thisMonth.map((invoice) => invoice.unitId)).size,
      value: thisMonth.reduce((sum, invoice) => sum + invoice.total, 0),
      draft: invoices.filter((invoice) => invoice.status === "DRAF").length,
      rejected: invoices.filter((invoice) => invoice.efaktur === "DITOLAK").length,
      usedSeries,
    };
  }, [invoices, year, month]);

  /** Termin pembayaran — customer dan nilai terbuka per termin. */
  const terms = useMemo(() => {
    const openInvoices = invoices.filter(
      (invoice) => invoice.status !== "DRAF" && invoice.status !== "BATAL" && invoice.status !== "LUNAS",
    );
    return TERM_OPTIONS.map((term) => {
      const rows = openInvoices.filter((invoice) => invoice.termDays === term);
      return {
        term,
        customers: new Set(rows.map((invoice) => invoice.customerId)).size,
        value: rows.reduce((sum, invoice) => sum + invoice.total - invoice.paidAmount, 0),
      };
    }).sort((a, b) => a.term - b.term);
  }, [invoices]);

  function update(field: keyof typeof form, value: string | boolean) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "invoiceDate" || field === "term") {
        next.dueDate = addDays(String(next.invoiceDate), Number(next.term) || 0);
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: "" }));
    setError("");
  }

  function openDialog() {
    setForm({
      customerId: "",
      number: nextNumber,
      invoiceDate: todayInput,
      term: "30",
      dueDate: addDays(todayInput, 30),
      revenueAccountId: "",
      ppnMode: "11",
      description: "",
      quantity: "1",
      unitPrice: "",
      takeSeries: true,
    });
    setErrors({});
    setError("");
    setOpen(true);
  }

  async function submit(issue: boolean) {
    const nextErrors: Record<string, string> = {};
    if (!form.customerId) nextErrors.customerId = t("Customer harus dipilih.");
    if (!form.number.trim()) nextErrors.number = t("No. faktur harus diisi.");
    if (!form.invoiceDate) nextErrors.invoiceDate = t("Tanggal faktur harus diisi.");
    if (!form.revenueAccountId) nextErrors.revenueAccountId = t("Akun pendapatan harus dipilih.");
    if (!form.description.trim()) nextErrors.description = t("Uraian harus diisi.");
    if (parseAmountInput(form.quantity) <= 0) nextErrors.quantity = t("Kuantitas harus lebih dari nol.");
    if (parseAmountInput(form.unitPrice) <= 0) nextErrors.unitPrice = t("Harga satuan harus diisi.");

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setError(t("Lengkapi dulu kolom yang ditandai."));
      return;
    }

    setBusy(true);
    const res = await fetch("/api/sales-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: form.customerId,
        // Nomor preview dibiarkan kosong supaya urutan dokumen naik di server.
        number: form.number.trim() === nextNumber ? undefined : form.number.trim(),
        invoiceDate: form.invoiceDate,
        termDays: Number(form.term) || 0,
        dueDate: form.dueDate || undefined,
        revenueAccountId: form.revenueAccountId,
        ppnRate,
        description: form.description.trim(),
        quantity: parseAmountInput(form.quantity),
        unitPrice: parseAmountInput(form.unitPrice),
        takeEfakturSeries: form.takeSeries,
        issue,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      setError(data.error ?? t("Faktur gagal disimpan."));
      return;
    }

    setOpen(false);
    toast(
      issue
        ? t("Faktur terbit dan dijurnal ke piutang, pendapatan, dan PPN keluaran")
        : t("Faktur disimpan sebagai draf"),
    );
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Faktur Penjualan")}
        subtitle={t("Penerbitan faktur dan nomor seri e-Faktur per buku unit")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari no. faktur atau customer")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 240 }}
            />
            <button className="btn" onClick={() => toast(t("Daftar faktur diekspor ke Excel"))}>
              {t("Ekspor daftar")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openDialog}>
                {t("Faktur baru")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{`${t("Faktur")} ${t(MONTHS_ID[today.getMonth()])}`}</div>
          <div className="v">{metrics.count === 0 ? "—" : String(metrics.count)}</div>
          <div className="d muted">{`${t("terbit di")} ${metrics.books} ${t("buku unit")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Nilai faktur")}</div>
          <div className="v">{dash(metrics.value)}</div>
          <div className="d muted">{t("termasuk PPN 11%")}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Belum terkirim")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>
            {metrics.draft === 0 ? "—" : String(metrics.draft)}
          </div>
          <div className="d" style={{ color: "var(--amber)" }}>
            {t("masih draf")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Ditolak e-Faktur")}</div>
          <div className="v" style={{ color: "var(--brick)" }}>
            {metrics.rejected === 0 ? "—" : String(metrics.rejected)}
          </div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {t("perlu perbaikan NPWP")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Nomor seri tersisa")}</div>
          <div className="v">—</div>
          <div className="d muted">{`${t("jatah")} ${year}`}</div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Daftar faktur")}</h2>
            <div className="rt">
              <select style={{ width: "auto" }} value={buku} onChange={(event) => setBuku(event.target.value)}>
                <option value="">{t("Semua buku")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
              <select style={{ width: "auto" }} value={period} onChange={(event) => setPeriod(event.target.value)}>
                <option value="bulan">{monthLabel}</option>
                <option value="lalu">{previousLabel}</option>
                <option value="kuartal">{quarterLabel}</option>
              </select>
            </div>
          </div>
          <div style={{ padding: "12px 18px 0" }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={tab === "all" ? "tab on" : "tab"} onClick={() => setTab("all")}>
                {t("Semua")} <span className="muted">{counts.all}</span>
              </button>
              <button className={tab === "draf" ? "tab on" : "tab"} onClick={() => setTab("draf")}>
                {t("Draf")} <span className="muted">{counts.draf}</span>
              </button>
              <button className={tab === "terkirim" ? "tab on" : "tab"} onClick={() => setTab("terkirim")}>
                {t("Terkirim")} <span className="muted">{counts.terkirim}</span>
              </button>
              <button className={tab === "dibayar" ? "tab on" : "tab"} onClick={() => setTab("dibayar")}>
                {t("Dibayar")} <span className="muted">{counts.dibayar}</span>
              </button>
              <button className={tab === "batal" ? "tab on" : "tab"} onClick={() => setTab("batal")}>
                {t("Batal")} <span style={{ color: "var(--brick)" }}>{counts.batal}</span>
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 1000, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 128, whiteSpace: "nowrap" }}>{t("No. faktur")}</th>
                  <th style={{ width: "22%" }}>{t("Customer")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Tanggal")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Jatuh tempo")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("DPP")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("PPN")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Total")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("e-Faktur")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Status")}</th>
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
                {filtered.map((invoice) => {
                  const openAmount = invoice.total - invoice.paidAmount;
                  return (
                    <tr key={invoice.id}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {invoice.number}
                      </td>
                      <td>
                        <span style={{ display: "block", fontWeight: 500 }}>{invoice.customerName}</span>
                        <span className="sm muted num">
                          {invoice.customerCode} · {invoice.unitCode}
                        </span>
                      </td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {formatDate(invoice.invoiceDate)}
                      </td>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>
                        {formatDate(invoice.dueDate)}
                      </td>
                      <td className="r num">{dash(invoice.dpp)}</td>
                      <td className="r num">{dash(invoice.ppn)}</td>
                      <td className="r num">{dash(invoice.total)}</td>
                      <td>
                        <span className={EFAKTUR_CHIP[invoice.efaktur]}>{t(EFAKTUR_LABEL[invoice.efaktur])}</span>
                        {invoice.efakturNo && <span className="sm muted num" style={{ display: "block" }}>{invoice.efakturNo}</span>}
                      </td>
                      <td>
                        <span className={STATUS_CHIP[invoice.status]}>{t(STATUS_LABEL[invoice.status])}</span>
                        {openAmount > 0 && invoice.status !== "DRAF" && invoice.status !== "BATAL" && (
                          <span className="sm muted num" style={{ display: "block" }}>
                            {`${t("sisa")} ${formatAmount(openAmount)}`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{`${filtered.length} ${t("dari")} ${scoped.length} ${t("faktur ditampilkan")}`}</span>
            <span className="k">{t("Total yang ditampilkan")}</span>
            <span className="v num">{dash(shownTotal)}</span>
            <span style={{ marginLeft: "auto" }}>
              <a className="btn btn-sm" href="/piutang">
                {t("Buka piutang usaha")}
              </a>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Nomor seri e-Faktur")}</h2>
              <span className="sub">{`${t("jatah")} ${year}`}</span>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>{t("Rentang jatah")}</td>
                  <td className="r num">—</td>
                </tr>
                <tr>
                  <td>{t("Terpakai")}</td>
                  <td className="r num">{dash(metrics.usedSeries)}</td>
                </tr>
                <tr>
                  <td>{t("Tersisa")}</td>
                  <td className="r num">—</td>
                </tr>
                <tr>
                  <td>{t("Permintaan jatah baru")}</td>
                  <td className="r">
                    <span className="chip chip-lock">{t("belum diajukan")}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="bal">
              <span style={{ marginLeft: "auto" }}>
                <a className="btn btn-sm" href="/pajak">
                  {t("Kelola di modul Pajak")}
                </a>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Termin pembayaran")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Termin")}</th>
                  <th className="r">{t("Customer")}</th>
                  <th className="r">{t("Nilai terbuka")}</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((row) => (
                  <tr key={row.term}>
                    <td>{row.term === 0 ? t("Tunai") : `${row.term} ${t("hari")}`}</td>
                    <td className="r num">{dash(row.customers)}</td>
                    <td className="r num">{dash(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note">
            {t(
              "Faktur yang disimpan langsung menjurnal piutang usaha, pendapatan, dan PPN keluaran di buku unit penerbit.",
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Faktur penjualan baru")}
        maxWidth={600}
        badge={`${t("buku")} ${activeUnit.code} · ${activeUnit.name}`}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void submit(false)}>
              {t("Simpan draf")}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submit(true)}>
              {busy ? t("Menyimpan…") : t("Terbitkan faktur")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Customer")}</label>
            <select
              className={errors.customerId ? "field-error" : undefined}
              value={form.customerId}
              onChange={(event) => update("customerId", event.target.value)}
            >
              <option value="">{t("— Pilih customer —")}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.code} · {customer.name}
                </option>
              ))}
            </select>
            {customers.length === 0 && (
              <span className="sm muted">{t("Belum ada customer — tambahkan di layar Customer dulu.")}</span>
            )}
          </div>
          <div>
            <label className="f" data-req="1">{t("No. faktur")}</label>
            <input
              type="text"
              className={errors.number ? "num field-error" : "num"}
              value={form.number}
              onChange={(event) => update("number", event.target.value)}
              placeholder={nextNumber}
            />
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Tanggal faktur")}</label>
            <input
              type="date"
              className={errors.invoiceDate ? "field-error" : undefined}
              value={form.invoiceDate}
              onChange={(event) => update("invoiceDate", event.target.value)}
            />
          </div>
          <div>
            <label className="f">{t("Termin")}</label>
            <select value={form.term} onChange={(event) => update("term", event.target.value)}>
              {TERM_OPTIONS.map((term) => (
                <option key={term} value={String(term)}>
                  {term === 0 ? t("Tunai") : `${term} ${t("hari")}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Jatuh tempo")}</label>
            <input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Akun pendapatan")}</label>
            <select
              className={errors.revenueAccountId ? "field-error" : undefined}
              value={form.revenueAccountId}
              onChange={(event) => update("revenueAccountId", event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {revenueAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Perlakuan PPN")}</label>
            <select value={form.ppnMode} onChange={(event) => update("ppnMode", event.target.value)}>
              <option value="11">{t("PPN keluaran 11%")}</option>
              <option value="0">{t("Tanpa PPN")}</option>
            </select>
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Uraian")}</label>
            <input
              type="text"
              className={errors.description ? "field-error" : undefined}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder={t("Misal: Penjualan barang dagang")}
            />
          </div>
          <div>
            <label className="f">{t("Kuantitas")}</label>
            <input
              type="text"
              className={errors.quantity ? "num field-error" : "num"}
              value={form.quantity}
              onChange={(event) => update("quantity", event.target.value)}
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("Harga satuan")}</label>
            <input
              type="text"
              className={errors.unitPrice ? "num field-error" : "num"}
              value={form.unitPrice}
              onChange={(event) => update("unitPrice", event.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="bal" style={{ borderRadius: 9, borderTop: "none", marginBottom: 12 }}>
          <span className="k">{t("DPP")}</span>
          <span className="v num">{dash(dpp)}</span>
          <span className="k">{t("PPN")}</span>
          <span className="v num">{dash(ppn)}</span>
          <span className="k">{t("Total")}</span>
          <span className="v num">{dash(total)}</span>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            fontSize: 12.5,
            color: "var(--ink2)",
            cursor: "pointer",
            marginBottom: 12,
          }}
        >
          <input
            type="checkbox"
            checked={form.takeSeries}
            onChange={(event) => update("takeSeries", event.target.checked)}
            style={{ width: "auto" }}
          />
          <span>{`${t("Ambil nomor seri e-Faktur dari jatah")} ${year}`}</span>
        </label>

        {error && (
          <div
            style={{
              marginTop: 4,
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
