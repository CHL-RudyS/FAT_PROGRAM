"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { StatTile, StatTileRow } from "@/components/ui/Metrics";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconSearch } from "@/components/shell/icons";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount } from "@/lib/format";

export type VendorRow = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  npwp: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  paymentTerm: number;
  status: "AKTIF" | "NONAKTIF";
  outstanding: number;
  dueThisMonth: boolean;
};

const CATEGORIES = ["Logistik", "Barang", "Jasa"];

const emptyForm = {
  code: "",
  name: "",
  category: "Barang",
  npwp: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  paymentTerm: "30",
};

export default function VendorScreen({
  vendors,
  unitLabel,
  canEdit,
}: {
  vendors: VendorRow[];
  unitLabel: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vendors.filter((vendor) => {
      if (category && vendor.category !== category) return false;
      if (status && vendor.status !== status) return false;
      if (!needle) return true;
      return `${vendor.code} ${vendor.name} ${vendor.npwp ?? ""}`.toLowerCase().includes(needle);
    });
  }, [vendors, query, category, status]);

  const totals = useMemo(
    () => ({
      total: vendors.length,
      active: vendors.filter((vendor) => vendor.status === "AKTIF").length,
      payable: vendors.reduce((sum, vendor) => sum + vendor.outstanding, 0),
      dueThisMonth: vendors.filter((vendor) => vendor.dueThisMonth).length,
    }),
    [vendors],
  );

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit() {
    const nextErrors: Record<string, string> = {};
    if (!form.code.trim()) nextErrors.code = t("Kode vendor harus diisi.");
    if (!form.name.trim()) nextErrors.name = t("Nama vendor harus diisi.");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/vendor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, paymentTerm: Number(form.paymentTerm) || 30 }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan vendor."));
      return;
    }

    setOpen(false);
    setForm(emptyForm);
    toast(t("Vendor tersimpan"));
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Vendor")}
        subtitle={t("Data master pemasok & vendor")}
        actions={
          canEdit ? (
            <button className="btn btn-primary" onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <IconPlus />
              {t("Tambah Vendor")}
            </button>
          ) : null
        }
      />

      <StatTileRow>
        <StatTile
          background="#E8EFF4"
          color="#37627E"
          value={String(totals.total)}
          label={t("Total Vendor")}
          icon={
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="1" y="6" width="13" height="10" rx="1" />
              <path d="M14 9h4l3 3v4h-7z" />
              <circle cx="6" cy="18" r="1.8" />
              <circle cx="17" cy="18" r="1.8" />
            </svg>
          }
        />
        <StatTile
          background="#E4EFE3"
          color="#3D6B3C"
          value={String(totals.active)}
          label={t("Aktif")}
          icon={
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 12.3l2.4 2.4 4.6-5" />
            </svg>
          }
        />
        <StatTile
          background="#F7E5E2"
          color="#8C3A2B"
          value={formatAmount(totals.payable)}
          label={t("Total Utang")}
          icon={
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 3h10l3 4v14H4V7z" />
              <path d="M12 10v6M10 12h4M10 15h4" />
            </svg>
          }
        />
        <StatTile
          background="#F9EFD5"
          color="#8A5D14"
          value={String(totals.dueThisMonth)}
          label={t("Jatuh Tempo Bulan Ini")}
          icon={
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
        />
      </StatTileRow>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap", padding: "14px 18px", borderBottom: "1px solid var(--rule)" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200, maxWidth: 390 }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder={t("Cari vendor…")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ paddingLeft: 33, width: "100%" }}
            />
          </div>
          <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ width: "auto", minWidth: 120 }}>
            <option value="">{t("Semua Kategori")}</option>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {t(item)}
              </option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ width: "auto", minWidth: 110 }}>
            <option value="">{t("Semua Status")}</option>
            <option value="AKTIF">{t("Aktif")}</option>
            <option value="NONAKTIF">{t("Non-Aktif")}</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 960, fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 18 }}>{t("Vendor")}</th>
                <th style={{ width: 120 }}>{t("Kategori")}</th>
                <th style={{ width: 172 }}>{t("NPWP")}</th>
                <th style={{ width: 190 }}>{t("Kontak")}</th>
                <th className="r" style={{ width: 150 }}>
                  {t("Saldo Utang")}
                </th>
                <th style={{ width: 112 }}>{t("Status")}</th>
                <th className="r" style={{ width: 86, paddingRight: 18 }}>
                  {t("Aksi")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data vendor")}
                  </td>
                </tr>
              )}
              {filtered.map((vendor) => (
                <tr key={vendor.id}>
                  <td style={{ paddingLeft: 18 }}>
                    <span className="num" style={{ color: "var(--ledger-dk)", fontWeight: 500 }}>
                      {vendor.code}
                    </span>
                    <span style={{ display: "block", fontWeight: 500 }}>{vendor.name}</span>
                  </td>
                  <td>{vendor.category ?? "—"}</td>
                  <td className="num">{vendor.npwp ?? "—"}</td>
                  <td>
                    <span style={{ display: "block" }}>{vendor.contactName ?? "—"}</span>
                    <span className="sm muted">{vendor.phone ?? vendor.email ?? ""}</span>
                  </td>
                  <td className="r num">{vendor.outstanding === 0 ? "—" : formatAmount(vendor.outstanding)}</td>
                  <td>
                    <span className={vendor.status === "AKTIF" ? "chip chip-ok" : "chip chip-lock"}>
                      {vendor.status === "AKTIF" ? t("Aktif") : t("Non-Aktif")}
                    </span>
                  </td>
                  <td className="r" style={{ paddingRight: 18 }}>
                    <span className="sm muted">{vendor.paymentTerm} {t("hari")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bal">
          <span className="k">
            {filtered.length === 0
              ? t("Belum ada vendor")
              : `${filtered.length} ${t("vendor")}${filtered.length === vendors.length ? "" : ` ${t("dari")} ${vendors.length}`}`}
          </span>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Tambah Vendor")}
        badge={`${t("buku")} ${unitLabel}`}
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
              {t("Kode vendor")}
            </label>
            <input
              type="text"
              className={errors.code ? "field-error" : undefined}
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              placeholder="V-0001"
            />
            {errors.code && <span className="sm" style={{ color: "#C8382F" }}>{errors.code}</span>}
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Nama vendor")}
            </label>
            <input
              type="text"
              className={errors.name ? "field-error" : undefined}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
            />
            {errors.name && <span className="sm" style={{ color: "#C8382F" }}>{errors.name}</span>}
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f">{t("Kategori")}</label>
            <select value={form.category} onChange={(event) => update("category", event.target.value)}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("NPWP")}</label>
            <input type="text" className="num" value={form.npwp} onChange={(event) => update("npwp", event.target.value)} placeholder="00.000.000.0-000.000" />
          </div>
          <div>
            <label className="f">{t("Termin")}</label>
            <select value={form.paymentTerm} onChange={(event) => update("paymentTerm", event.target.value)}>
              <option value="30">30 {t("hari")}</option>
              <option value="14">14 {t("hari")}</option>
              <option value="7">7 {t("hari")}</option>
              <option value="0">{t("Tunai")}</option>
            </select>
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
