"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatDate } from "@/lib/format";

export type LegalFormOption = { code: string; label: string };
export type ParentOption = { id: string; name: string; legalForm: string | null };

type Tab = "umum" | "fiskal" | "direksi" | "induk" | "legal";

type DirectorRow = {
  position: string;
  name: string;
  nik: string;
  npwp: string;
  address: string;
  startDate: string;
};

const emptyDirector: DirectorRow = { position: "", name: "", nik: "", npwp: "", address: "", startDate: "" };

const emptyForm = {
  // Umum
  legalForm: "",
  name: "",
  address: "",
  postalCode: "",
  phone: "",
  country: "",
  currency: "",
  // Data fiskal
  npwp: "",
  industry: "",
  pkp: "",
  sppkp: "",
  pengukuhan: "",
  kpp: "",
  jenisPajak: "",
  tarifPph: "",
  standard: "",
  fiscalStart: "",
  coaTemplate: "",
  bookStructure: "",
  // Induk & anak
  position: "",
  parentId: "",
  ownership: "",
  consolidation: "",
  // Legalitas
  legalEntity: "",
  nib: "",
  deedNumber: "",
  deedDate: "",
  notary: "",
  skNumber: "",
  authorizedCapital: "",
  paidCapital: "",
  shares: "",
};

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "umum", label: "Umum" },
  { key: "fiskal", label: "Data Fiskal" },
  { key: "direksi", label: "Susunan Direksi" },
  { key: "induk", label: "Induk & Anak" },
  { key: "legal", label: "Data Legalitas" },
];

/** "0000 0000 0000 0000" — 16 NPWP digits in groups of four. */
function formatNpwp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function digitsOnly(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

function thousands(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

const FIELD_TAB: Record<string, Tab> = {
  legalForm: "umum",
  name: "umum",
  address: "umum",
  country: "umum",
  currency: "umum",
  npwp: "fiskal",
  industry: "fiskal",
  pkp: "fiskal",
  standard: "fiskal",
  fiscalStart: "fiskal",
  bookStructure: "fiskal",
  position: "induk",
  legalEntity: "legal",
  nib: "legal",
};

export default function KlienBaruScreen({
  legalForms,
  parents,
  canEdit,
}: {
  legalForms: LegalFormOption[];
  parents: ParentOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [kind, setKind] = useState<"PERUSAHAAN" | "ENTITAS" | null>(null);
  const [tab, setTab] = useState<Tab>("umum");
  const [form, setForm] = useState(emptyForm);
  const [directors, setDirectors] = useState<DirectorRow[]>([]);
  const [draft, setDraft] = useState<DirectorRow>(emptyDirector);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [forms, setForms] = useState<LegalFormOption[]>(legalForms);
  const [kodeOpen, setKodeOpen] = useState(false);
  const [kodeBaruOpen, setKodeBaruOpen] = useState(false);
  const [kodeHapus, setKodeHapus] = useState<LegalFormOption | null>(null);
  const [kodeCari, setKodeCari] = useState("");
  const [kodeCariNama, setKodeCariNama] = useState("");
  const [kodeErr, setKodeErr] = useState("");
  const [kbCode, setKbCode] = useState("");
  const [kbLabel, setKbLabel] = useState("");
  const [kbErr, setKbErr] = useState("");

  const locked = !kind;

  const filteredForms = useMemo(() => {
    const code = kodeCari.trim().toLowerCase();
    const label = kodeCariNama.trim().toLowerCase();
    return forms.filter(
      (entry) =>
        (!code || entry.code.toLowerCase().includes(code)) &&
        (!label || entry.label.toLowerCase().includes(label)),
    );
  }, [forms, kodeCari, kodeCariNama]);

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function reset() {
    setForm(emptyForm);
    setDirectors([]);
    setDraft(emptyDirector);
    setErrors({});
    setKind(null);
    setTab("umum");
  }

  function addDirector() {
    const missing: Record<string, string> = {};
    if (!draft.position) missing.dirPosition = t("Jabatan harus dipilih.");
    if (!draft.name.trim()) missing.dirName = t("Nama pengurus harus diisi.");
    if (draft.nik.replace(/\D/g, "").length !== 16) missing.dirNik = t("NIK harus 16 digit.");
    if (!draft.npwp.trim()) missing.dirNpwp = t("NPWP pengurus harus diisi.");
    if (!draft.address.trim()) missing.dirAddress = t("Alamat pengurus harus diisi.");
    if (!draft.startDate) missing.dirStart = t("Tanggal mulai harus diisi.");
    if (Object.keys(missing).length > 0) {
      setErrors((current) => ({ ...current, ...missing }));
      return;
    }
    setDirectors((current) => [...current, draft]);
    setDraft(emptyDirector);
    setErrors({});
  }

  async function submit() {
    const next: Record<string, string> = {};
    if (!kind) {
      toast(t("Pilih dulu jenis: Perusahaan atau Entitas"));
      return;
    }
    if (!form.legalForm.trim()) next.legalForm = t("Inisial harus diisi.");
    if (!form.name.trim()) next.name = t("Nama harus diisi.");
    if (!form.address.trim()) next.address = t("Alamat harus diisi.");
    if (!form.country) next.country = t("Negara harus dipilih.");
    if (!form.currency) next.currency = t("Mata uang harus dipilih.");
    if (!form.npwp.trim()) next.npwp = t("NPWP harus diisi.");
    if (!form.industry.trim()) next.industry = t("KLU / KBLI harus diisi.");
    if (!form.pkp) next.pkp = t("Status PKP harus dipilih.");
    if (!form.standard) next.standard = t("Standar akuntansi harus dipilih.");
    if (!form.fiscalStart) next.fiscalStart = t("Awal periode fiskal harus dipilih.");
    if (!form.bookStructure) next.bookStructure = t("Struktur buku harus dipilih.");
    if (!form.position) next.position = t("Posisi entitas harus dipilih.");
    if (!form.legalEntity) next.legalEntity = t("Bentuk badan usaha harus dipilih.");
    if (!form.nib.trim()) next.nib = t("NIB harus diisi.");

    if (Object.keys(next).length > 0) {
      setErrors(next);
      const first = Object.keys(next)[0];
      setTab(FIELD_TAB[first] ?? "umum");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        legalForm: form.legalForm.trim(),
        name: form.name.trim(),
        address: form.address.trim(),
        postalCode: form.postalCode,
        phone: form.phone,
        npwp: form.npwp,
        industry: form.industry,
        parentId: form.parentId || null,
        directors: directors.map((director) => ({
          position: director.position,
          name: director.name,
          nik: director.nik,
          npwp: director.npwp,
          address: director.address,
          startDate: director.startDate,
        })),
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) {
        setErrors({ [data.field]: data.error ?? "" });
        setTab(FIELD_TAB[data.field] ?? "umum");
      }
      toast(data.error ?? t("Gagal menyimpan entitas."));
      return;
    }

    toast(kind === "ENTITAS" ? t("Entitas tersimpan") : t("Perusahaan tersimpan"));
    router.push("/klien");
    router.refresh();
  }

  async function saveLegalForm() {
    if (!kbCode.trim()) {
      setKbErr(t("Inisial harus diisi."));
      return;
    }
    const res = await fetch("/api/settings/legal-forms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: kbCode.trim(), label: kbLabel.trim() }),
    });
    const data = (await res.json()) as LegalFormOption[] | { error?: string };
    if (!res.ok) {
      setKbErr((data as { error?: string }).error ?? t("Gagal menyimpan inisial."));
      return;
    }
    setForms(data as LegalFormOption[]);
    setKbCode("");
    setKbLabel("");
    setKbErr("");
    setKodeBaruOpen(false);
    toast(t("Inisial perusahaan ditambahkan"));
  }

  async function deleteLegalForm() {
    if (!kodeHapus) return;
    const res = await fetch("/api/settings/legal-forms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: kodeHapus.code }),
    });
    const data = (await res.json()) as LegalFormOption[] | { error?: string };
    if (!res.ok) {
      setKodeErr((data as { error?: string }).error ?? t("Gagal menghapus inisial."));
      setKodeHapus(null);
      return;
    }
    setForms(data as LegalFormOption[]);
    setKodeHapus(null);
    setKodeErr("");
    toast(t("Inisial perusahaan dihapus"));
  }

  const err = (field: string) => (errors[field] ? "field-error" : undefined);
  const hint = (field: string) =>
    errors[field] ? (
      <span className="sm" style={{ color: "#C8382F" }}>
        {errors[field]}
      </span>
    ) : null;

  const tabStyle = { marginRight: 0, padding: "10.8px 15px 7.2px", borderRadius: "10px 10px 0 0" } as const;
  const chevron = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );

  return (
    <>
      <div className="head" style={{ marginBottom: 9 }}>
        <div>
          <h1>{kind === "ENTITAS" ? t("Entitas") : t("Perusahaan & Entitas")}</h1>
          <nav
            aria-label={t("Jejak halaman")}
            style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, fontSize: 12.5, flexWrap: "wrap" }}
          >
            <button
              onClick={() => router.push("/klien")}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--ink3)", cursor: "pointer", background: "transparent" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 10.6 12 4l8 6.6V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1Z" />
              </svg>
              {t("Manajemen")}
            </button>
            {chevron}
            <button onClick={() => router.push("/klien")} style={{ color: "var(--ink2)", cursor: "pointer", background: "transparent" }}>
              {t("Perusahaan & Entitas")}
            </button>
            {chevron}
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{t("Tambah Perusahaan / Entitas")}</span>
          </nav>
        </div>
        <div className="head-act">
          <button className="btn" onClick={() => router.push("/klien")} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {t("Kembali")}
          </button>
        </div>
        <div
          className="tabs"
          role="tablist"
          style={{
            gap: 0,
            margin: "6px -20px -16px",
            padding: "6px 20px 0",
            borderTop: "1px solid rgba(31,78,70,.14)",
            flexWrap: "wrap",
            overflow: "visible",
            borderBottom: "none",
            width: "calc(100% + 40px)",
          }}
        >
          {TABS.map((entry) => (
            <button
              key={entry.key}
              role="tab"
              aria-selected={tab === entry.key}
              className={tab === entry.key ? "tab on" : "tab"}
              style={tabStyle}
              onClick={() => setTab(entry.key)}
            >
              {t(entry.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ position: "relative", overflow: "visible", background: "rgba(255,255,255,.60)" }}>
        <div className="card-h">
          <h2>{t("Entri Data")}</h2>
          <div className="rt" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink2)", cursor: "pointer" }}>
              <input
                type="radio"
                name="entJenis"
                style={{ width: "auto" }}
                checked={kind === "PERUSAHAAN"}
                onChange={() => setKind("PERUSAHAAN")}
              />
              <span>{t("Perusahaan")}</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink2)", cursor: "pointer" }}>
              <input
                type="radio"
                name="entJenis"
                style={{ width: "auto" }}
                checked={kind === "ENTITAS"}
                onChange={() => setKind("ENTITAS")}
              />
              <span>{t("Entitas")}</span>
            </label>
          </div>
        </div>
        <div className="card-b">
          {locked && (
            <div className="note" style={{ marginBottom: 14 }}>
              {t("Pilih dulu jenis: Perusahaan atau Entitas")}
            </div>
          )}

          {tab === "umum" && (
            <div>
              <div className="row" style={{ display: "grid", gridTemplateColumns: "150px 2fr", gap: 14 }}>
                <div>
                  <label className="f" data-req="1">{t("Inisial")}</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      className={`num ${err("legalForm") ?? ""}`.trim()}
                      disabled={locked}
                      value={form.legalForm}
                      onChange={(event) => update("legalForm", event.target.value.toUpperCase())}
                      style={{ paddingRight: 34, paddingLeft: 9, textAlign: "left", cursor: "text", letterSpacing: "-.01em" }}
                    />
                    <button
                      type="button"
                      aria-label={t("Cari inisial")}
                      disabled={locked}
                      onClick={() => setKodeOpen(true)}
                      style={{
                        position: "absolute",
                        right: 5,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 26,
                        height: 26,
                        borderRadius: 6,
                        display: "grid",
                        placeItems: "center",
                        color: "var(--ledger-dk)",
                        background: "var(--sunk)",
                        border: "1px solid var(--rule)",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16l4 4" />
                      </svg>
                    </button>
                  </div>
                  {hint("legalForm")}
                </div>
                <div>
                  <label className="f" data-req="1">{t("Nama")}</label>
                  <input
                    type="text"
                    className={err("name")}
                    disabled={locked}
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder={t("Contoh Sejahtera")}
                    style={{ textTransform: "uppercase" }}
                  />
                  {hint("name")}
                </div>
              </div>
              <div className="row" style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.2fr", gap: 14 }}>
                <div>
                  <label className="f" data-req="1">{t("Alamat")}</label>
                  <input
                    type="text"
                    className={err("address")}
                    disabled={locked}
                    value={form.address}
                    onChange={(event) => update("address", event.target.value)}
                    placeholder={t("Alamat lengkap entitas")}
                  />
                  {hint("address")}
                </div>
                <div>
                  <label className="f">{t("Kode pos")}</label>
                  <input
                    type="text"
                    className="num"
                    disabled={locked}
                    value={form.postalCode}
                    onChange={(event) => update("postalCode", digitsOnly(event.target.value, 5))}
                    placeholder="00000"
                    style={{ textAlign: "left" }}
                  />
                </div>
                <div>
                  <label className="f">{t("No telepon")}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={locked}
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="021 0000 0000"
                  />
                </div>
              </div>
              <div className="row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="f" data-req="1">{t("Negara")}</label>
                  <select className={err("country")} disabled={locked} value={form.country} onChange={(event) => update("country", event.target.value)}>
                    <option value=""></option>
                    <option>Indonesia</option>
                    <option>Singapura</option>
                    <option>Malaysia</option>
                    <option>Australia</option>
                  </select>
                  {hint("country")}
                </div>
                <div>
                  <label className="f" data-req="1">{t("Mata uang")}</label>
                  <select className={err("currency")} disabled={locked} value={form.currency} onChange={(event) => update("currency", event.target.value)}>
                    <option value=""></option>
                    <option>IDR — Rupiah</option>
                    <option>USD — Dolar AS</option>
                    <option>SGD — Dolar Singapura</option>
                  </select>
                  {hint("currency")}
                </div>
              </div>
            </div>
          )}

          {tab === "fiskal" && (
            <div>
              <div className="row row-4">
                <div>
                  <label className="f" data-req="1">{t("NPWP")}</label>
                  <input
                    type="text"
                    className={`num ${err("npwp") ?? ""}`.trim()}
                    inputMode="numeric"
                    maxLength={24}
                    disabled={locked}
                    value={form.npwp}
                    onChange={(event) => update("npwp", formatNpwp(event.target.value))}
                    placeholder="0000 0000 0000 0000"
                    style={{ textAlign: "left" }}
                  />
                  {hint("npwp")}
                </div>
                <div>
                  <label className="f" data-req="1">{t("KLU / KBLI")}</label>
                  <input
                    type="text"
                    className={err("industry")}
                    disabled={locked}
                    value={form.industry}
                    onChange={(event) => update("industry", event.target.value)}
                    placeholder={t("Perdagangan besar")}
                  />
                  {hint("industry")}
                </div>
                <div>
                  <label className="f" data-req="1">{t("Status PKP")}</label>
                  <select className={err("pkp")} disabled={locked} value={form.pkp} onChange={(event) => update("pkp", event.target.value)}>
                    <option value=""></option>
                    <option>PKP</option>
                    <option>Non-PKP</option>
                  </select>
                  {hint("pkp")}
                </div>
                <div>
                  <label className="f">{t("Nomor SPPKP")}</label>
                  <input
                    type="text"
                    className="num"
                    disabled={locked}
                    value={form.sppkp}
                    onChange={(event) => update("sppkp", event.target.value)}
                    placeholder="PEM-00000/WPJ.00/KP.0000/0000"
                    style={{ textAlign: "left" }}
                  />
                </div>
              </div>
              <div className="row row-4">
                <div>
                  <label className="f">{t("Tanggal pengukuhan")}</label>
                  <input type="date" disabled={locked} value={form.pengukuhan} onChange={(event) => update("pengukuhan", event.target.value)} />
                </div>
                <div>
                  <label className="f">{t("KPP terdaftar")}</label>
                  <input type="text" disabled={locked} value={form.kpp} onChange={(event) => update("kpp", event.target.value)} placeholder="KPP Pratama Jakarta Setiabudi" />
                </div>
                <div>
                  <label className="f">{t("Jenis pajak dipungut")}</label>
                  <select disabled={locked} value={form.jenisPajak} onChange={(event) => update("jenisPajak", event.target.value)}>
                    <option value=""></option>
                    <option>PPN &amp; PPh</option>
                    <option>PPh saja</option>
                    <option>PPN saja</option>
                  </select>
                </div>
                <div>
                  <label className="f">{t("Tarif PPh badan")}</label>
                  <select disabled={locked} value={form.tarifPph} onChange={(event) => update("tarifPph", event.target.value)}>
                    <option value=""></option>
                    <option>22% — umum</option>
                    <option>11% — fasilitas Pasal 31E</option>
                    <option>0,5% — PP 55/2022</option>
                  </select>
                </div>
              </div>
              <div className="row row-4">
                <div>
                  <label className="f" data-req="1">{t("Standar akuntansi")}</label>
                  <select className={err("standard")} disabled={locked} value={form.standard} onChange={(event) => update("standard", event.target.value)}>
                    <option value=""></option>
                    <option>SAK EMKM</option>
                    <option>PSAK</option>
                  </select>
                  {hint("standard")}
                </div>
                <div>
                  <label className="f" data-req="1">{t("Awal periode fiskal")}</label>
                  <select className={err("fiscalStart")} disabled={locked} value={form.fiscalStart} onChange={(event) => update("fiscalStart", event.target.value)}>
                    <option value=""></option>
                    <option>Januari</option>
                    <option>April</option>
                    <option>Juli</option>
                  </select>
                  {hint("fiscalStart")}
                </div>
                <div>
                  <label className="f">{t("Template bagan akun")}</label>
                  <select disabled={locked} value={form.coaTemplate} onChange={(event) => update("coaTemplate", event.target.value)}>
                    <option value=""></option>
                    <option>Umum — dagang</option>
                    <option>Umum — jasa</option>
                    <option>Koperasi</option>
                    <option>Kosong</option>
                  </select>
                </div>
                <div>
                  <label className="f" data-req="1">{t("Struktur buku")}</label>
                  <select className={err("bookStructure")} disabled={locked} value={form.bookStructure} onChange={(event) => update("bookStructure", event.target.value)}>
                    <option value=""></option>
                    <option>Buku Tunggal</option>
                    <option>Pusat &amp; Unit (Combine)</option>
                    <option>Pusat &amp; Anak (Konsolidasi)</option>
                  </select>
                  {hint("bookStructure")}
                </div>
              </div>
            </div>
          )}

          {tab === "direksi" && (
            <div>
              <div style={{ border: "1px solid var(--rule)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: "var(--paper)" }}>
                      {["Jabatan", "Nama", "NIK", "NPWP", "Alamat", "Mulai", "Masa jabatan"].map((title) => (
                        <th
                          key={title}
                          style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--ink2)", borderBottom: "1px solid var(--rule)" }}
                        >
                          {t(title)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {directors.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: "14px 12px", color: "var(--ink4)", fontSize: 12.5 }}>
                          {t("Belum ada pengurus")}
                        </td>
                      </tr>
                    )}
                    {directors.map((director, index) => (
                      <tr key={`${director.nik}-${index}`}>
                        <td style={{ padding: "8px 12px" }}>{director.position}</td>
                        <td style={{ padding: "8px 12px" }}>{director.name}</td>
                        <td className="num" style={{ padding: "8px 12px" }}>{director.nik}</td>
                        <td className="num" style={{ padding: "8px 12px" }}>{director.npwp}</td>
                        <td style={{ padding: "8px 12px" }}>{director.address}</td>
                        <td className="num" style={{ padding: "8px 12px" }}>{formatDate(director.startDate)}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => setDirectors((current) => current.filter((_, position) => position !== index))}
                          >
                            {t("Hapus")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="row"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0,.9fr) minmax(0,1.2fr) minmax(150px,1.5fr) minmax(150px,1.5fr) minmax(0,1.3fr) minmax(0,1fr) auto",
                  gap: 12,
                  alignItems: "end",
                }}
              >
                <div>
                  <label className="f" data-req="1">{t("Jabatan")}</label>
                  <select
                    className={err("dirPosition")}
                    disabled={locked}
                    value={draft.position}
                    onChange={(event) => setDraft((current) => ({ ...current, position: event.target.value }))}
                  >
                    <option value=""></option>
                    <option>Direktur Utama</option>
                    <option>Direktur</option>
                    <option>Direktur Keuangan</option>
                    <option>Komisaris Utama</option>
                    <option>Komisaris</option>
                  </select>
                </div>
                <div>
                  <label className="f" data-req="1">{t("Nama")}</label>
                  <input
                    type="text"
                    className={err("dirName")}
                    disabled={locked}
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder={t("Nama lengkap sesuai KTP")}
                  />
                </div>
                <div>
                  <label className="f" data-req="1">{t("NIK")}</label>
                  <input
                    type="text"
                    className={`num ${err("dirNik") ?? ""}`.trim()}
                    inputMode="numeric"
                    maxLength={16}
                    disabled={locked}
                    value={draft.nik}
                    onChange={(event) => setDraft((current) => ({ ...current, nik: digitsOnly(event.target.value, 16) }))}
                    placeholder={t("16 digit")}
                    style={{ textAlign: "left" }}
                  />
                </div>
                <div>
                  <label className="f" data-req="1">{t("NPWP")}</label>
                  <input
                    type="text"
                    className={`num ${err("dirNpwp") ?? ""}`.trim()}
                    inputMode="numeric"
                    maxLength={19}
                    disabled={locked}
                    value={draft.npwp}
                    onChange={(event) => setDraft((current) => ({ ...current, npwp: formatNpwp(event.target.value) }))}
                    placeholder="0000 0000 0000 0000"
                    style={{ textAlign: "left" }}
                  />
                </div>
                <div>
                  <label className="f" data-req="1">{t("Alamat")}</label>
                  <input
                    type="text"
                    className={err("dirAddress")}
                    disabled={locked}
                    value={draft.address}
                    onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                    placeholder={t("Alamat sesuai KTP")}
                  />
                </div>
                <div>
                  <label className="f" data-req="1">{t("Mulai")}</label>
                  <input
                    type="date"
                    className={err("dirStart")}
                    disabled={locked}
                    value={draft.startDate}
                    onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", height: "100%" }}>
                  <button
                    className="btn"
                    title={t("Tambah pengurus")}
                    aria-label={t("Tambah pengurus")}
                    disabled={locked}
                    onClick={addDirector}
                    style={{ display: "grid", placeItems: "center", width: 34, height: 34, padding: 0, lineHeight: 0, color: "var(--ledger-dk)" }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" aria-hidden="true" style={{ display: "block" }}>
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "induk" && (
            <div>
              <div className="row row-4">
                <div>
                  <label className="f" data-req="1">{t("Posisi entitas")}</label>
                  <select className={err("position")} disabled={locked} value={form.position} onChange={(event) => update("position", event.target.value)}>
                    <option value=""></option>
                    <option>Anak entitas</option>
                    <option>Entitas induk</option>
                    <option>Berdiri sendiri</option>
                  </select>
                  {hint("position")}
                </div>
                <div>
                  <label className="f">{t("Entitas induk")}</label>
                  <select disabled={locked} value={form.parentId} onChange={(event) => update("parentId", event.target.value)}>
                    <option value=""></option>
                    {parents.length === 0 && <option value="">—</option>}
                    {parents.map((parent) => (
                      <option key={parent.id} value={parent.id}>
                        {parent.legalForm ? `${parent.legalForm} ${parent.name}` : parent.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="f">{t("Kepemilikan induk")}</label>
                  <input
                    type="text"
                    className="num"
                    disabled={locked}
                    value={form.ownership}
                    onChange={(event) => update("ownership", digitsOnly(event.target.value, 3))}
                    placeholder="0"
                    style={{ textAlign: "left" }}
                  />
                </div>
                <div>
                  <label className="f">{t("Metode konsolidasi")}</label>
                  <select disabled={locked} value={form.consolidation} onChange={(event) => update("consolidation", event.target.value)}>
                    <option value=""></option>
                    <option>Konsolidasi penuh</option>
                    <option>Metode ekuitas</option>
                    <option>Tidak dikonsolidasi</option>
                  </select>
                </div>
              </div>
              <div style={{ border: "1px solid var(--rule)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "var(--paper)", borderBottom: "1px solid var(--rule)", fontSize: 12, fontWeight: 600, color: "var(--ink2)" }}>
                  {t("Anak entitas")}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: "14px 12px", color: "var(--ink4)", fontSize: 12.5 }}>{t("Belum ada anak entitas")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "legal" && (
            <div>
              <div className="row row-4">
                <div>
                  <label className="f" data-req="1">{t("Bentuk badan usaha")}</label>
                  <select className={err("legalEntity")} disabled={locked} value={form.legalEntity} onChange={(event) => update("legalEntity", event.target.value)}>
                    <option value=""></option>
                    <option>Perseroan Terbatas</option>
                    <option>CV</option>
                    <option>Firma</option>
                    <option>Koperasi</option>
                    <option>Yayasan</option>
                  </select>
                  {hint("legalEntity")}
                </div>
                <div>
                  <label className="f" data-req="1">{t("NIB")}</label>
                  <input
                    type="text"
                    className={`num ${err("nib") ?? ""}`.trim()}
                    disabled={locked}
                    value={form.nib}
                    onChange={(event) => update("nib", digitsOnly(event.target.value, 13))}
                    placeholder={t("13 digit")}
                    style={{ textAlign: "left" }}
                  />
                  {hint("nib")}
                </div>
                <div>
                  <label className="f">{t("Nomor akta pendirian")}</label>
                  <input
                    type="text"
                    className="num"
                    disabled={locked}
                    value={form.deedNumber}
                    onChange={(event) => update("deedNumber", event.target.value)}
                    placeholder={t("Nomor akta")}
                    style={{ textAlign: "left" }}
                  />
                </div>
                <div>
                  <label className="f">{t("Tanggal akta")}</label>
                  <input type="date" disabled={locked} value={form.deedDate} onChange={(event) => update("deedDate", event.target.value)} />
                </div>
              </div>
              <div className="row row-4">
                <div>
                  <label className="f">{t("Notaris")}</label>
                  <input type="text" disabled={locked} value={form.notary} onChange={(event) => update("notary", event.target.value)} placeholder={t("Nama notaris")} />
                </div>
                <div>
                  <label className="f">{t("SK Kemenkumham")}</label>
                  <input
                    type="text"
                    className="num"
                    disabled={locked}
                    value={form.skNumber}
                    onChange={(event) => update("skNumber", event.target.value)}
                    placeholder="AHU-0000000.AH.01.01"
                    style={{ textAlign: "left" }}
                  />
                </div>
                <div>
                  <label className="f">{t("Modal dasar")}</label>
                  <input
                    type="text"
                    className="num"
                    disabled={locked}
                    value={form.authorizedCapital}
                    onChange={(event) => update("authorizedCapital", thousands(event.target.value))}
                    placeholder="0"
                    style={{ textAlign: "left" }}
                  />
                </div>
                <div>
                  <label className="f">{t("Modal disetor")}</label>
                  <input
                    type="text"
                    className="num"
                    disabled={locked}
                    value={form.paidCapital}
                    onChange={(event) => update("paidCapital", thousands(event.target.value))}
                    placeholder="0"
                    style={{ textAlign: "left" }}
                  />
                </div>
              </div>
              <div className="row row-4">
                <div>
                  <label className="f">{t("Saham")}</label>
                  <input
                    type="text"
                    className="num"
                    disabled={locked}
                    value={form.shares}
                    onChange={(event) => update("shares", thousands(event.target.value))}
                    placeholder="0"
                    style={{ textAlign: "left" }}
                  />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid var(--rule)", paddingTop: 14 }}>
            <button className="btn" onClick={reset}>
              {t("Tambah")}
            </button>
            {!locked && (
              <button className="btn" onClick={() => router.push("/klien")}>
                {t("Batal")}
              </button>
            )}
            <button className="btn btn-primary" disabled={locked || busy || !canEdit} onClick={() => void submit()}>
              {busy ? t("Menyimpan…") : t("Lanjut")}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-h">
          <h2>{kind === "ENTITAS" ? t("Data Entitas") : t("Data Perusahaan")}</h2>
        </div>
        <div className="card-b" style={{ paddingTop: 4 }}>
          {locked ? (
            <div className="sm muted">{t("Belum ada data")}</div>
          ) : (
            <table>
              <tbody>
                <tr>
                  <td className="muted sm" style={{ width: 200 }}>{t("Inisial")}</td>
                  <td className="num">{form.legalForm || "—"}</td>
                </tr>
                <tr>
                  <td className="muted sm">{t("Nama")}</td>
                  <td>{form.name || "—"}</td>
                </tr>
                <tr>
                  <td className="muted sm">{t("NPWP")}</td>
                  <td className="num">{form.npwp || "—"}</td>
                </tr>
                <tr>
                  <td className="muted sm">{t("Alamat")}</td>
                  <td>
                    {form.address || "—"}
                    {form.postalCode ? ` ${form.postalCode}` : ""}
                  </td>
                </tr>
                <tr>
                  <td className="muted sm">{t("KLU / KBLI")}</td>
                  <td>{form.industry || "—"}</td>
                </tr>
                <tr>
                  <td className="muted sm">{t("Susunan Direksi")}</td>
                  <td className="num">{directors.length === 0 ? "—" : `${directors.length} ${t("pengurus")}`}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {kodeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Inisial Perusahaan")}
          style={{ display: "flex", position: "fixed", inset: 0, zIndex: 93, background: "rgba(22,32,27,.42)", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div style={{ width: "100%", maxWidth: 600, maxHeight: "80vh", display: "flex", flexDirection: "column", background: "var(--card)", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 50px rgba(22,32,27,.28)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--ledger-dk)" }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: ".01em" }}>{t("Inisial Perusahaan")}</h2>
              <button aria-label={t("Tutup")} onClick={() => setKodeOpen(false)} style={{ color: "rgba(255,255,255,.85)", padding: "2px 6px", fontSize: 14, marginLeft: "auto", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "190px minmax(0,1fr)", gap: 8, padding: "10px 12px", background: "var(--paper)", borderBottom: "1px solid var(--rule)" }}>
              <input
                type="text"
                placeholder={t("Cari inisial…")}
                autoComplete="off"
                className="num"
                value={kodeCari}
                onChange={(event) => setKodeCari(event.target.value)}
                style={{ fontSize: 12, height: 30, background: "var(--card)" }}
              />
              <input
                type="text"
                placeholder={t("Cari nama entitas…")}
                autoComplete="off"
                value={kodeCariNama}
                onChange={(event) => setKodeCariNama(event.target.value)}
                style={{ fontSize: 12, height: 30, background: "var(--card)" }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "150px minmax(0,1fr)",
                padding: "7px 0",
                background: "linear-gradient(180deg,#DCE8F5 0%,#C4D8EC 100%)",
                borderBottom: "1px solid var(--rule2)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: "#2C4257",
              }}
            >
              <span style={{ padding: "0 10px 0 14px", borderRight: "1px solid rgba(44,66,87,.22)" }}>{t("Inisial")}</span>
              <span style={{ padding: "0 14px 0 10px" }}>{t("Keterangan")}</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", minHeight: 230, background: "var(--card)" }}>
              {filteredForms.length === 0 && (
                <div className="sm muted" style={{ padding: "18px 14px" }}>
                  {t("Belum ada data")}
                </div>
              )}
              {filteredForms.map((entry) => (
                <div
                  key={entry.code}
                  style={{ display: "grid", gridTemplateColumns: "150px minmax(0,1fr) auto", alignItems: "center", borderBottom: "1px solid var(--rule)" }}
                >
                  <button
                    className="num"
                    onClick={() => {
                      update("legalForm", entry.code);
                      setKodeOpen(false);
                    }}
                    style={{ textAlign: "left", padding: "8px 10px 8px 14px", fontSize: 12.5, color: "var(--ink)", cursor: "pointer" }}
                  >
                    {entry.code}
                  </button>
                  <button
                    onClick={() => {
                      update("legalForm", entry.code);
                      setKodeOpen(false);
                    }}
                    style={{ textAlign: "left", padding: "8px 10px", fontSize: 12.5, color: "var(--ink2)", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {entry.label || "—"}
                  </button>
                  <button
                    aria-label={t("Hapus Inisial")}
                    onClick={() => setKodeHapus(entry)}
                    style={{ padding: "6px 12px", color: "var(--brick)", cursor: "pointer", fontSize: 12 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid var(--rule)", background: "var(--paper)" }}>
              <span style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                {`${filteredForms.length} ${t("inisial")}`}
              </span>
              <button className="btn btn-sm btn-primary" onClick={() => setKodeBaruOpen(true)} style={{ marginLeft: "auto" }}>
                {t("Tambah")}
              </button>
            </div>
            {kodeErr && (
              <div style={{ margin: "0 14px 12px", padding: "9px 11px", borderRadius: 8, fontSize: 12, background: "var(--brick-bg)", color: "var(--brick)" }}>
                {kodeErr}
              </div>
            )}
          </div>
        </div>
      )}

      {kodeBaruOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Inisial Perusahaan")}
          style={{ display: "flex", position: "fixed", inset: 0, zIndex: 94, background: "rgba(22,32,27,.42)", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div style={{ width: "100%", maxWidth: 420, background: "var(--card)", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 50px rgba(22,32,27,.28)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--ledger-dk)" }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{t("Inisial Perusahaan")}</h2>
              <button aria-label={t("Tutup")} onClick={() => setKodeBaruOpen(false)} style={{ color: "rgba(255,255,255,.85)", padding: "2px 6px", fontSize: 14, marginLeft: "auto", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <div style={{ padding: "16px 18px 8px" }}>
              <div className="row">
                <div>
                  <label className="f">{t("Inisial")}</label>
                  <input
                    type="text"
                    className="num"
                    autoComplete="off"
                    value={kbCode}
                    onChange={(event) => setKbCode(event.target.value.toUpperCase())}
                    style={{ textAlign: "left" }}
                  />
                </div>
              </div>
              <div className="row">
                <div>
                  <label className="f">{t("Keterangan")}</label>
                  <input
                    type="text"
                    placeholder={t("Pengertian Perusahaan dari inisial ini")}
                    autoComplete="off"
                    value={kbLabel}
                    onChange={(event) => setKbLabel(event.target.value)}
                  />
                </div>
              </div>
              {kbErr && (
                <div style={{ marginTop: 4, padding: "9px 11px", borderRadius: 8, fontSize: 12, background: "var(--brick-bg)", color: "var(--brick)" }}>
                  {kbErr}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 18px", borderTop: "1px solid var(--rule)" }}>
              <button className="btn" onClick={() => setKodeBaruOpen(false)}>
                {t("Batal")}
              </button>
              <button className="btn btn-primary" onClick={() => void saveLegalForm()}>
                {t("Tambah")}
              </button>
            </div>
          </div>
        </div>
      )}

      {kodeHapus && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("Hapus Inisial")}
          style={{ display: "flex", position: "fixed", inset: 0, zIndex: 95, background: "rgba(22,32,27,.42)", alignItems: "center", justifyContent: "center", padding: 24 }}
        >
          <div style={{ width: "100%", maxWidth: 380, background: "var(--card)", borderRadius: 12, overflow: "hidden", boxShadow: "0 20px 50px rgba(22,32,27,.28)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--brick)" }}>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{t("Hapus Inisial")}</h2>
              <button aria-label={t("Tutup")} onClick={() => setKodeHapus(null)} style={{ color: "rgba(255,255,255,.85)", padding: "2px 6px", fontSize: 14, marginLeft: "auto", cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <div style={{ padding: "16px 18px", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6 }}>
              {t("Anda yakin ingin menghapus inisial")}{" "}
              <b className="num" style={{ color: "var(--ink)" }}>{kodeHapus.code}</b>
              <span style={{ display: "block", color: "var(--ink3)", fontSize: 11.5, marginTop: 3 }}>{kodeHapus.label}</span>
              <div style={{ marginTop: 10, color: "var(--ink3)" }}>{t("Tindakan ini tidak bisa dibatalkan.")}</div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 18px", borderTop: "1px solid var(--rule)" }}>
              <button className="btn" onClick={() => setKodeHapus(null)}>
                {t("Batal")}
              </button>
              <button className="btn" onClick={() => void deleteLegalForm()} style={{ background: "var(--brick)", borderColor: "var(--brick)", color: "#fff" }}>
                {t("Hapus")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
