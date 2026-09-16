"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { Metrics } from "@/components/ui/Metrics";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { dash, formatAmount, toInputDate } from "@/lib/format";

export type UnitRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  isActive: boolean;
  needsWork: boolean;
  hasVariance: boolean;
  owner: string | null;
  ownerTitle: string | null;
  accessCount: number;
  totalAsset: number;
  rakDebit: number;
  rakCredit: number;
};

const emptyForm = { code: "", name: "", city: "", startDate: "", coa: "", bank: "" };

export default function UnitBisnisScreen({
  rows,
  companyName,
  monthLabel,
  accountCount,
  interUnitJournals,
  eliminatedTotal,
  canEdit,
}: {
  rows: UnitRow[];
  companyName: string;
  monthLabel: string;
  accountCount: number;
  interUnitJournals: number;
  eliminatedTotal: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const codeRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ ...emptyForm, startDate: toInputDate(new Date()) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<UnitRow | null>(null);
  const [editForm, setEditForm] = useState({ code: "", name: "", city: "", isActive: true, needsWork: false, hasVariance: false });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const totals = useMemo(() => {
    const active = rows.filter((row) => row.isActive).length;
    const done = rows.filter((row) => !row.needsWork && !row.hasVariance).length;
    const variance = rows.filter((row) => row.hasVariance).length;
    const needsWork = rows.filter((row) => row.needsWork).length;
    const asset = rows.reduce((sum, row) => sum + row.totalAsset, 0);
    const unbalanced = rows.filter((row) => Math.abs(row.rakDebit - row.rakCredit) > 0.005).length;
    return { active, done, variance, needsWork, asset, unbalanced };
  }, [rows]);

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function create() {
    const next: Record<string, string> = {};
    if (!form.code.trim()) next.code = t("Kode unit harus diisi.");
    if (!form.name.trim()) next.name = t("Nama cabang harus diisi.");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: form.code.trim(), name: form.name.trim(), city: form.city.trim() }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal membuat unit bisnis."));
      return;
    }

    setForm({ ...emptyForm, startDate: toInputDate(new Date()) });
    toast(t("Unit bisnis dibuat"));
    router.refresh();
  }

  function openEdit(row: UnitRow) {
    setEditing(row);
    setEditErrors({});
    setEditForm({
      code: row.code,
      name: row.name,
      city: row.city ?? "",
      isActive: row.isActive,
      needsWork: row.needsWork,
      hasVariance: row.hasVariance,
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const res = await fetch(`/api/units/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: editForm.code.trim(),
        name: editForm.name.trim(),
        city: editForm.city.trim() || null,
        isActive: editForm.isActive,
        needsWork: editForm.needsWork,
        hasVariance: editForm.hasVariance,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setEditErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan unit bisnis."));
      return;
    }

    setEditing(null);
    toast(t("Unit bisnis tersimpan"));
    router.refresh();
  }

  function bookChip(row: UnitRow) {
    if (row.hasVariance) return <span className="chip chip-bad">{t("masih selisih")}</span>;
    if (row.needsWork) return <span className="chip chip-warn">{t("perlu dikerjakan")}</span>;
    return <span className="chip chip-ok">{t("selesai")}</span>;
  }

  return (
    <>
      <PageHead
        title={t("Unit Bisnis")}
        subtitle={t("Setiap unit punya buku besar sendiri, dikonsolidasi ke laporan induk")}
        actions={
          <>
            <button className="btn" onClick={() => toast(t("Bagan akun pusat disalin ke unit baru"))}>
              {t("Salin bagan akun pusat")}
            </button>
            {canEdit && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  codeRef.current?.focus();
                  toast(t("Form unit bisnis baru dibuka"));
                }}
              >
                {t("Tambah unit bisnis")}
              </button>
            )}
          </>
        }
      />

      <Metrics
        items={[
          {
            label: t("Unit bisnis aktif"),
            value: String(totals.active),
            delta: totals.active === 0 ? t("Belum ada unit") : `${rows.length} ${t("unit terdaftar")}`,
          },
          {
            label: `${t("Buku")} ${t(monthLabel)} ${t("selesai")}`,
            value: String(totals.done),
            delta: totals.done === 0 ? t("Belum ada buku") : `${totals.needsWork} ${t("modul perlu dikerjakan")}`,
          },
          {
            label: t("Selisih akun antar-unit"),
            value: String(totals.variance),
            delta: t("harus nol sebelum konsolidasi"),
            deltaColor: totals.variance > 0 ? "#A32E22" : undefined,
          },
          {
            label: `${t("Jurnal antar-unit")} ${t(monthLabel)}`,
            value: String(interUnitJournals),
            delta: t("akun 1-1900 / 2-1900 RAK"),
          },
        ]}
      />

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Daftar cabang")}</h2>
            <span className="sub">{t("Kode unit melekat pada nomor jurnal, tidak bisa diubah setelah ada transaksi")}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>{t("Kode")}</th>
                  <th style={{ width: "24%" }}>{t("Cabang")}</th>
                  <th>{t("Kota")}</th>
                  <th>{`${t("Buku")} ${t(monthLabel)}`}</th>
                  <th>{t("Penanggung jawab")}</th>
                  <th className="r">{t("Total aset")}</th>
                  <th>{t("Status")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="num" style={{ color: "var(--ledger-dk)", fontWeight: 500 }}>
                      {row.code}
                    </td>
                    <td style={{ fontWeight: 500 }}>{row.name}</td>
                    <td>{row.city ?? "—"}</td>
                    <td>{bookChip(row)}</td>
                    <td>
                      <span style={{ display: "block" }}>{row.owner ?? "—"}</span>
                      {row.ownerTitle && <span className="sm muted">{row.ownerTitle}</span>}
                    </td>
                    <td className="r num">{dash(row.totalAsset)}</td>
                    <td>
                      <span className={row.isActive ? "chip chip-ok" : "chip chip-lock"}>
                        {row.isActive ? t("aktif") : t("nonaktif")}
                      </span>
                    </td>
                    <td className="r">
                      {canEdit && (
                        <button className="btn btn-sm" onClick={() => openEdit(row)}>
                          {t("Ubah")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{t("Jumlah aset seluruh buku")}</span>
            <span className="v num">{dash(totals.asset)}</span>
            <span className="k">{t("setelah eliminasi RAK")}</span>
            <span className="v num">{dash(eliminatedTotal)}</span>
            <span style={{ marginLeft: "auto" }}>
              <button className="btn btn-sm" onClick={() => router.push("/konsolidasi")}>
                {t("Ke kertas kerja konsolidasi")}
              </button>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Akun antar-unit (RAK)")}</h2>
              <span className="sub">{t("Harus saling nol")}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Pasangan")}</th>
                  <th className="r">{t("Debit")}</th>
                  <th className="r">{t("Kredit")}</th>
                  <th className="r">{t("Selisih")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="num" style={{ color: "var(--ledger-dk)" }}>{row.code}</span>{" "}
                      <span className="sm muted">{row.name}</span>
                    </td>
                    <td className="r num">{dash(row.rakDebit)}</td>
                    <td className="r num">{dash(row.rakCredit)}</td>
                    <td className="r num" style={{ color: Math.abs(row.rakDebit - row.rakCredit) > 0.005 ? "#A32E22" : undefined }}>
                      {dash(row.rakDebit - row.rakCredit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bal">
              <span className={totals.unbalanced > 0 ? "chip chip-bad" : "chip chip-open"}>
                {`${totals.unbalanced} ${t("pasangan tidak nol")}`}
              </span>
              <span className="k">
                {rows.length === 0 ? t("Belum ada data") : `${formatAmount(totals.asset)} ${t("total aset seluruh buku")}`}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Tambah unit bisnis")}</h2>
            </div>
            <div className="card-b">
              <div className="row row-2">
                <div>
                  <label className="f" data-req="1">{t("Kode unit")}</label>
                  <input
                    ref={codeRef}
                    type="text"
                    className={`num ${errors.code ? "field-error" : ""}`.trim()}
                    placeholder="YOG"
                    maxLength={4}
                    disabled={!canEdit}
                    value={form.code}
                    onChange={(event) => update("code", event.target.value.toUpperCase())}
                  />
                  {errors.code && <span className="sm" style={{ color: "#C8382F" }}>{errors.code}</span>}
                </div>
                <div>
                  <label className="f" data-req="1">{t("Nama cabang")}</label>
                  <input
                    type="text"
                    className={errors.name ? "field-error" : undefined}
                    placeholder={t("Unit Yogyakarta")}
                    disabled={!canEdit}
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                  />
                  {errors.name && <span className="sm" style={{ color: "#C8382F" }}>{errors.name}</span>}
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label className="f">{t("Kota")}</label>
                  <input
                    type="text"
                    placeholder={t("Yogyakarta")}
                    disabled={!canEdit}
                    value={form.city}
                    onChange={(event) => update("city", event.target.value)}
                  />
                </div>
                <div>
                  <label className="f">{t("Buku mulai berlaku")}</label>
                  <input type="date" disabled={!canEdit} value={form.startDate} onChange={(event) => update("startDate", event.target.value)} />
                </div>
              </div>
              <div className="row">
                <div>
                  <label className="f">{t("Bagan akun")}</label>
                  <select disabled={!canEdit} value={form.coa} onChange={(event) => update("coa", event.target.value)}>
                    <option value="">{`${t("Salin dari")} ${companyName} (${accountCount} ${t("akun")})`}</option>
                    <option value="psak">{t("Template PSAK dagang")}</option>
                  </select>
                </div>
              </div>
              <div className="row">
                <div>
                  <label className="f">{t("Akun bank cabang")}</label>
                  <select disabled={!canEdit} value={form.bank} onChange={(event) => update("bank", event.target.value)}>
                    <option value="">{t("Buat baru — 1-12xx Bank cabang")}</option>
                    <option value="pusat">{t("Gunakan rekening pusat 1-1210")}</option>
                  </select>
                </div>
              </div>
              <div className="note">
                {t(
                  "Bagan akun unit dikunci mengikuti pusat: kode dan nama akun hanya bisa diubah Admin di level entitas, agar kertas kerja konsolidasi tetap bisa dijumlahkan sebaris.",
                )}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
                <button className="btn" onClick={() => setForm({ ...emptyForm, startDate: toInputDate(new Date()) })}>
                  {t("Batal")}
                </button>
                <button className="btn btn-primary" disabled={!canEdit || busy} onClick={() => void create()}>
                  {busy ? t("Menyimpan…") : t("Buat unit bisnis")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="legend">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8A317", display: "inline-block", flex: "none" }} />
          <span>{`${totals.needsWork} ${t("Modul Perlu Dikerjakan")}`}</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <i
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#C0392B",
              display: "inline-block",
              flex: "none",
              boxShadow: "0 0 0 3px rgba(192,57,43,.18)",
            }}
          />
          <span style={{ fontWeight: 600, color: "#A32E22" }}>{`${totals.variance} ${t("Modul Masih Selisih")}`}</span>
        </span>
        <span>
          {t(
            "Unit tidak diberi warna sendiri — warna tetap hanya milik entitas klien, supaya penanda salah-klien tidak kehilangan arti. Unit dibedakan oleh kode mono di topbar dan strip buku aktif.",
          )}
        </span>
      </div>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t("Ubah unit bisnis")}
        badge={editing ? `${editing.code} · ${editing.name}` : undefined}
        footer={
          <>
            <button className="btn" onClick={() => setEditing(null)}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void saveEdit()}>
              {busy ? t("Menyimpan…") : t("Simpan")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Kode unit")}</label>
            <input
              type="text"
              className={`num ${editErrors.code ? "field-error" : ""}`.trim()}
              maxLength={4}
              value={editForm.code}
              onChange={(event) => setEditForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
            />
            {editErrors.code && <span className="sm" style={{ color: "#C8382F" }}>{editErrors.code}</span>}
          </div>
          <div>
            <label className="f" data-req="1">{t("Nama cabang")}</label>
            <input
              type="text"
              className={editErrors.name ? "field-error" : undefined}
              value={editForm.name}
              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Kota")}</label>
            <input
              type="text"
              value={editForm.city}
              onChange={(event) => setEditForm((current) => ({ ...current, city: event.target.value }))}
            />
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--ink2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={editForm.isActive}
              onChange={(event) => setEditForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>{t("Unit aktif")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--ink2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={editForm.needsWork}
              onChange={(event) => setEditForm((current) => ({ ...current, needsWork: event.target.checked }))}
            />
            <span>{t("Modul Perlu Dikerjakan")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--ink2)", cursor: "pointer" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={editForm.hasVariance}
              onChange={(event) => setEditForm((current) => ({ ...current, hasVariance: event.target.checked }))}
            />
            <span>{t("Masih Selisih")}</span>
          </label>
        </div>
      </Dialog>
    </>
  );
}
