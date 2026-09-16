"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { Metrics } from "@/components/ui/Metrics";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { dash, formatAmount, parseAmountInput } from "@/lib/format";

export type CustomerOpenInvoice = {
  unitId: string;
  unitCode: string;
  outstanding: number;
  invoiceDate: string;
  dueDate: string;
};

export type CustomerRow = {
  id: string;
  code: string;
  name: string;
  npwp: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTerm: number;
  creditLimit: number;
  status: "AKTIF" | "NONAKTIF";
  open: CustomerOpenInvoice[];
};

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

const emptyForm = {
  code: "",
  name: "",
  npwp: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  paymentTerm: "45",
  creditLimit: "",
};

const emptyDetail = {
  code: "",
  name: "",
  npwp: "",
  paymentTerm: "45",
  creditLimit: "",
};

function daysPastDue(dueDate: string, today: number) {
  return Math.floor((today - new Date(dueDate).getTime()) / DAY);
}

export default function CustomerScreen({
  customers,
  units,
  receivableAccounts,
  revenueAccounts,
  receivableAccountCode,
  todayIso,
  activeUnit,
  canEdit,
}: {
  customers: CustomerRow[];
  units: UnitRow[];
  receivableAccounts: AccountRow[];
  revenueAccounts: AccountRow[];
  receivableAccountCode: string;
  todayIso: string;
  activeUnit: UnitRow;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [buku, setBuku] = useState("");
  const [sort, setSort] = useState("piutang");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [detail, setDetail] = useState(emptyDetail);
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [detailBusy, setDetailBusy] = useState(false);

  /** Today at UTC midnight, fixed by the server render so hydration stays stable. */
  const today = useMemo(() => new Date(todayIso).getTime(), [todayIso]);

  const selected = useMemo(
    () => customers.find((customer) => customer.id === selectedId) ?? null,
    [customers, selectedId],
  );

  /** Reload the detail pane when another row is picked (state adjusted during render). */
  const [detailFor, setDetailFor] = useState<string | null>(null);
  if (detailFor !== selectedId) {
    setDetailFor(selectedId);
    setDetail(
      selected
        ? {
            code: selected.code,
            name: selected.name,
            npwp: selected.npwp ?? "",
            paymentTerm: String(selected.paymentTerm),
            creditLimit: selected.creditLimit ? formatAmount(selected.creditLimit) : "",
          }
        : emptyDetail,
    );
    setDetailErrors({});
  }

  /** Open receivables of one customer, restricted to the selected book. */
  function openOf(customer: CustomerRow) {
    return buku ? customer.open.filter((invoice) => invoice.unitId === buku) : customer.open;
  }

  const enriched = useMemo(() => {
    return customers.map((customer) => {
      const rows = openOf(customer);
      const outstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
      const overdue = rows.reduce((sum, row) => (daysPastDue(row.dueDate, today) > 0 ? sum + row.outstanding : sum), 0);
      const maxPastDue = rows.reduce((max, row) => Math.max(max, daysPastDue(row.dueDate, today)), 0);
      const books = Array.from(new Set(rows.map((row) => row.unitCode))).sort();
      const ageSum = rows.reduce((sum, row) => sum + row.outstanding * Math.max(0, Math.floor((today - new Date(row.invoiceDate).getTime()) / DAY)), 0);
      return { customer, rows, outstanding, overdue, maxPastDue, books, ageSum };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, buku, today]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = enriched.filter((entry) => {
      if (!needle) return true;
      return `${entry.customer.code} ${entry.customer.name} ${entry.customer.npwp ?? ""}`.toLowerCase().includes(needle);
    });
    const sorted = [...list];
    if (sort === "piutang") sorted.sort((a, b) => b.outstanding - a.outstanding || a.customer.code.localeCompare(b.customer.code));
    if (sort === "tempo") sorted.sort((a, b) => b.maxPastDue - a.maxPastDue || b.overdue - a.overdue);
    if (sort === "nama") sorted.sort((a, b) => a.customer.name.localeCompare(b.customer.name));
    return sorted;
  }, [enriched, query, sort]);

  const totals = useMemo(() => {
    const active = customers.filter((customer) => customer.status === "AKTIF").length;
    const receivable = enriched.reduce((sum, entry) => sum + entry.outstanding, 0);
    const overdue = enriched.reduce((sum, entry) => sum + entry.overdue, 0);
    const overLimit = enriched.filter((entry) => entry.customer.creditLimit > 0 && entry.outstanding > entry.customer.creditLimit).length;
    const ageSum = enriched.reduce((sum, entry) => sum + entry.ageSum, 0);
    const averageAge = receivable > 0 ? Math.round(ageSum / receivable) : 0;
    return {
      active,
      inactive: customers.length - active,
      receivable,
      overdue,
      overduePercent: receivable > 0 ? Math.round((overdue / receivable) * 100) : 0,
      overLimit,
      averageAge,
    };
  }, [customers, enriched]);

  const aging = useMemo(() => {
    const rows = AGING_BUCKETS.map((bucket) => ({ label: bucket.label, value: 0 }));
    for (const entry of enriched) {
      for (const invoice of entry.rows) {
        const age = daysPastDue(invoice.dueDate, today);
        const index = AGING_BUCKETS.findIndex((bucket) => age >= bucket.from && age <= bucket.to);
        if (index >= 0) rows[index].value += invoice.outstanding;
      }
    }
    const total = rows.reduce((sum, row) => sum + row.value, 0);
    return { rows, total };
  }, [enriched, today]);

  const shownReceivable = filtered.reduce((sum, entry) => sum + entry.outstanding, 0);

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit() {
    const nextErrors: Record<string, string> = {};
    if (!form.code.trim()) nextErrors.code = t("Kode customer harus diisi.");
    if (!form.name.trim()) nextErrors.name = t("Nama customer harus diisi.");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        paymentTerm: Number(form.paymentTerm) || 30,
        creditLimit: parseAmountInput(form.creditLimit),
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan customer."));
      return;
    }

    setOpen(false);
    setForm(emptyForm);
    toast(t("Customer tersimpan"));
    router.refresh();
  }

  async function patchSelected(payload: Record<string, unknown>, message: string) {
    if (!selected) return;
    setDetailBusy(true);
    const res = await fetch(`/api/customer/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setDetailBusy(false);

    if (!res.ok) {
      if (data.field) setDetailErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan customer."));
      return;
    }
    toast(message);
    router.refresh();
  }

  async function saveDetail() {
    const nextErrors: Record<string, string> = {};
    if (!detail.code.trim()) nextErrors.code = t("Kode customer harus diisi.");
    if (!detail.name.trim()) nextErrors.name = t("Nama customer harus diisi.");
    if (Object.keys(nextErrors).length > 0) {
      setDetailErrors(nextErrors);
      return;
    }
    await patchSelected(
      {
        code: detail.code.trim(),
        name: detail.name.trim(),
        npwp: detail.npwp.trim(),
        paymentTerm: Number(detail.paymentTerm) || 30,
        creditLimit: parseAmountInput(detail.creditLimit),
      },
      t("Data customer tersimpan"),
    );
  }

  return (
    <>
      <PageHead
        title={t("Customer")}
        subtitle={t("Piutang dilacak per buku unit")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari nama, kode, atau NPWP")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 230 }}
            />
            <button className="btn" onClick={() => toast(t("Berkas impor customer dipilih"))}>
              {t("Impor dari Excel")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={() => setOpen(true)}>
                {t("Tambah customer")}
              </button>
            )}
          </>
        }
      />

      <Metrics
        items={[
          { label: t("Customer aktif"), value: String(totals.active), delta: `${totals.inactive} ${t("nonaktif")}` },
          {
            label: t("Total piutang usaha"),
            value: formatAmount(totals.receivable),
            delta: `${t("akun")} ${receivableAccountCode} ${t("konsolidasi")}`,
          },
          {
            label: t("Lewat jatuh tempo"),
            value: formatAmount(totals.overdue),
            delta: `${totals.overduePercent}% ${t("dari piutang")}`,
          },
          { label: t("Melewati limit kredit"), value: String(totals.overLimit), delta: t("perlu persetujuan") },
          {
            label: t("Rata-rata umur piutang"),
            value: String(totals.averageAge),
            delta: `${t("hari")} · ${t("target")} 30`,
          },
        ]}
      />

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Daftar customer")}</h2>
            <div className="rt">
              <select value={buku} onChange={(event) => setBuku(event.target.value)} style={{ width: "auto" }}>
                <option value="">{t("Semua buku")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
              <select value={sort} onChange={(event) => setSort(event.target.value)} style={{ width: "auto" }}>
                <option value="piutang">{t("Urut: piutang terbesar")}</option>
                <option value="tempo">{t("Urut: paling lewat tempo")}</option>
                <option value="nama">{t("Urut: nama")}</option>
              </select>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>{t("Kode")}</th>
                  <th style={{ width: "22%" }}>{t("Nama customer")}</th>
                  <th>{t("NPWP")}</th>
                  <th>{t("Buku")}</th>
                  <th>{t("Termin")}</th>
                  <th className="r">{t("Limit kredit")}</th>
                  <th className="r">{t("Piutang")}</th>
                  <th>{t("Status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data customer")}
                    </td>
                  </tr>
                )}
                {filtered.map((entry) => (
                  <tr
                    key={entry.customer.id}
                    onClick={() => setSelectedId(entry.customer.id)}
                    style={{ cursor: "pointer", background: entry.customer.id === selectedId ? "var(--ledger-bg)" : undefined }}
                  >
                    <td className="num">{entry.customer.code}</td>
                    <td style={{ fontWeight: 500 }}>{entry.customer.name}</td>
                    <td className="num">{entry.customer.npwp ?? "—"}</td>
                    <td className="sm">{entry.books.length > 0 ? entry.books.join(", ") : "—"}</td>
                    <td className="sm">{entry.customer.paymentTerm === 0 ? t("Tunai") : `${entry.customer.paymentTerm} ${t("hari")}`}</td>
                    <td className="r num">{dash(entry.customer.creditLimit)}</td>
                    <td className="r num">{dash(entry.outstanding)}</td>
                    <td>
                      <span className={entry.customer.status === "AKTIF" ? "chip chip-ok" : "chip chip-lock"}>
                        {entry.customer.status === "AKTIF" ? t("Aktif") : t("Non-Aktif")}
                      </span>
                    </td>
                    <td className="r">
                      <button className="btn btn-sm" onClick={(event) => { event.stopPropagation(); setSelectedId(entry.customer.id); }}>
                        {t("Detail")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">
              {filtered.length} {t("customer ditampilkan")}
            </span>
            <span className="k">{t("Jumlah piutang")}</span>
            <span className="v num">{formatAmount(shownReceivable)}</span>
            <span style={{ marginLeft: "auto" }}>
              <button className="btn btn-sm" onClick={() => toast(t("Daftar customer diekspor ke Excel"))}>
                {t("Ekspor daftar")}
              </button>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Detail customer")}</h2>
              <span className="sub num">{selected ? `${selected.code} · ${selected.name}` : ""}</span>
            </div>
            <div className="card-b">
              <div className="row row-2">
                <div>
                  <label className="f">{t("Kode customer")}</label>
                  <input
                    type="text"
                    className={detailErrors.code ? "num field-error" : "num"}
                    placeholder="C-0000"
                    value={detail.code}
                    disabled={!selected}
                    onChange={(event) => setDetail((current) => ({ ...current, code: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="f">{t("Nama")}</label>
                  <input
                    type="text"
                    className={detailErrors.name ? "field-error" : undefined}
                    placeholder={t("Nama customer")}
                    value={detail.name}
                    disabled={!selected}
                    onChange={(event) => setDetail((current) => ({ ...current, name: event.target.value }))}
                  />
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label className="f">{t("NPWP")}</label>
                  <input
                    type="text"
                    className="num"
                    inputMode="numeric"
                    maxLength={24}
                    placeholder="0000 0000 0000 0000"
                    value={detail.npwp}
                    disabled={!selected}
                    onChange={(event) => setDetail((current) => ({ ...current, npwp: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="f">{t("Status PKP")}</label>
                  <select disabled={!selected} defaultValue="PKP">
                    <option value="PKP">{t("PKP — faktur pajak keluaran")}</option>
                    <option value="NONPKP">{t("Non-PKP")}</option>
                  </select>
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label className="f">{t("Termin penagihan")}</label>
                  <select
                    value={detail.paymentTerm}
                    disabled={!selected}
                    onChange={(event) => setDetail((current) => ({ ...current, paymentTerm: event.target.value }))}
                  >
                    <option value="45">45 {t("hari")}</option>
                    <option value="30">30 {t("hari")}</option>
                    <option value="14">14 {t("hari")}</option>
                    <option value="0">{t("Tunai")}</option>
                  </select>
                </div>
                <div>
                  <label className="f">{t("Limit kredit")}</label>
                  <input
                    type="text"
                    className="num"
                    placeholder="0"
                    value={detail.creditLimit}
                    disabled={!selected}
                    onChange={(event) => setDetail((current) => ({ ...current, creditLimit: event.target.value }))}
                  />
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label className="f">{t("Akun piutang default")}</label>
                  <select disabled={!selected} defaultValue={receivableAccounts[0]?.id ?? ""}>
                    {receivableAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="f">{t("Akun pendapatan default")}</label>
                  <select disabled={!selected} defaultValue={revenueAccounts[0]?.id ?? ""}>
                    {revenueAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} · {account.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row">
                <div>
                  <label className="f">{t("Buku penagih")}</label>
                  <select disabled={!selected} defaultValue={activeUnit.id}>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code} · {unit.name}
                      </option>
                    ))}
                    <option value="">{t("Boleh di semua buku")}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button
                  className="btn"
                  disabled={!selected || !canEdit || detailBusy}
                  onClick={() =>
                    void patchSelected(
                      { status: selected?.status === "AKTIF" ? "NONAKTIF" : "AKTIF" },
                      selected?.status === "AKTIF" ? t("Customer dinonaktifkan") : t("Customer diaktifkan"),
                    )
                  }
                >
                  {selected?.status === "NONAKTIF" ? t("Aktifkan") : t("Non Aktif")}
                </button>
                <button className="btn btn-primary" disabled={!selected || !canEdit || detailBusy} onClick={() => void saveDetail()}>
                  {detailBusy ? t("Menyimpan…") : t("Simpan")}
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Aging piutang")}</h2>
              <span className="sub">{t("Seluruh customer · konsolidasi")}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Umur")}</th>
                  <th className="r">{t("Nilai")}</th>
                  <th className="r">{t("Porsi")}</th>
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
                      <td className="r num">{Math.round((row.value / aging.total) * 100)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="bal">
              <span className="k">{t("Angka ini yang dipakai halaman aging pada paket bank")}</span>
              <span style={{ marginLeft: "auto" }}>
                <a className="btn btn-sm" href="/laporan-khusus">
                  {t("Lihat paket")}
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Tambah customer")}
        badge={`${t("buku")} ${activeUnit.code} · ${activeUnit.name}`}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void submit()}>
              {busy ? t("Menyimpan…") : t("Simpan")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Kode customer")}
            </label>
            <input
              type="text"
              className={errors.code ? "num field-error" : "num"}
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              placeholder="C-0000"
            />
            {errors.code && <span className="sm" style={{ color: "#C8382F" }}>{errors.code}</span>}
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Nama")}
            </label>
            <input
              type="text"
              className={errors.name ? "field-error" : undefined}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder={t("Nama customer")}
            />
            {errors.name && <span className="sm" style={{ color: "#C8382F" }}>{errors.name}</span>}
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f">{t("NPWP")}</label>
            <input
              type="text"
              className="num"
              inputMode="numeric"
              maxLength={24}
              value={form.npwp}
              onChange={(event) => update("npwp", event.target.value)}
              placeholder="0000 0000 0000 0000"
            />
          </div>
          <div>
            <label className="f">{t("Termin penagihan")}</label>
            <select value={form.paymentTerm} onChange={(event) => update("paymentTerm", event.target.value)}>
              <option value="45">45 {t("hari")}</option>
              <option value="30">30 {t("hari")}</option>
              <option value="14">14 {t("hari")}</option>
              <option value="0">{t("Tunai")}</option>
            </select>
          </div>
          <div>
            <label className="f">{t("Limit kredit")}</label>
            <input type="text" className="num" value={form.creditLimit} onChange={(event) => update("creditLimit", event.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f">{t("Kontak")}</label>
            <input type="text" value={form.contactName} onChange={(event) => update("contactName", event.target.value)} />
          </div>
          <div>
            <label className="f">{t("Telepon")}</label>
            <input type="text" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          </div>
          <div>
            <label className="f">{t("Email")}</label>
            <input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Alamat")}</label>
            <textarea rows={2} value={form.address} onChange={(event) => update("address", event.target.value)} />
          </div>
        </div>
      </Dialog>
    </>
  );
}
