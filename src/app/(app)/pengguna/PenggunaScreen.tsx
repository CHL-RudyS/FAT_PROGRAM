"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { humanizeEnum } from "@/lib/format";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  status: "AKTIF" | "NONAKTIF" | "DIKUNCI";
  jobTitle: string | null;
  phone: string | null;
  roleId: string;
  roleCode: string;
  roleName: string;
  companyIds: string[];
  unitIds: string[];
};

export type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
};

export type PermissionRow = {
  code: string;
  module: string;
  action: string;
  description: string | null;
};

export type CompanyColumn = { id: string; label: string; code: string };
export type UnitOption = { id: string; code: string; name: string };

const emptyForm = {
  name: "",
  email: "",
  password: "",
  roleId: "",
  jobTitle: "",
  phone: "",
  status: "AKTIF",
};

function statusChip(status: UserRow["status"]) {
  if (status === "AKTIF") return "chip chip-ok";
  if (status === "DIKUNCI") return "chip chip-bad";
  return "chip chip-lock";
}

export default function PenggunaScreen({
  users,
  roles,
  permissions,
  companies,
  units,
  activeCompanyName,
  canManage,
}: {
  users: UserRow[];
  roles: RoleRow[];
  permissions: PermissionRow[];
  companies: CompanyColumn[];
  units: UnitOption[];
  activeCompanyName: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, roleId: roles[0]?.id ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ roleId: "", status: "AKTIF" as UserRow["status"], unitIds: [] as string[] });

  const modules = useMemo(() => {
    const groups = new Map<string, PermissionRow[]>();
    for (const permission of permissions) {
      const list = groups.get(permission.module) ?? [];
      list.push(permission);
      groups.set(permission.module, list);
    }
    return [...groups.entries()];
  }, [permissions]);

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  async function submit() {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = t("Nama pengguna harus diisi.");
    if (!form.email.trim()) next.email = t("Email harus diisi.");
    if (form.password.length < 8) next.password = t("Kata sandi minimal 8 karakter.");
    else if (!/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password)) {
      next.password = t("Kata sandi harus berisi huruf dan angka.");
    }
    if (!form.roleId) next.roleId = t("Peran harus dipilih.");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menambah pengguna."));
      return;
    }

    setOpen(false);
    setForm({ ...emptyForm, roleId: roles[0]?.id ?? "" });
    toast(t("Pengguna baru ditambahkan"));
    router.refresh();
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    setEditForm({ roleId: user.roleId, status: user.status, unitIds: user.unitIds });
  }

  async function saveEdit() {
    if (!editing) return;
    // Grants for other entities are not shown here — keep them untouched.
    const otherCompanyUnits = editing.unitIds.filter((id) => !units.some((unit) => unit.id === id));
    const unitIds = [...new Set([...otherCompanyUnits, ...editForm.unitIds])];

    setBusy(true);
    const res = await fetch(`/api/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId: editForm.roleId, status: editForm.status, unitIds }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);

    if (!res.ok) {
      toast(data.error ?? t("Gagal menyimpan pengguna."));
      return;
    }

    setEditing(null);
    toast(t("Akses pengguna tersimpan"));
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Pengguna & Akses")}
        subtitle={t(
          "Tiga tingkatan peran · akses dibatasi per entitas, dan untuk klien multi-unit bisa dipersempit sampai per buku unit",
        )}
        actions={
          canManage ? (
            <button className="btn btn-primary" onClick={() => setOpen(true)}>
              {t("Tambah Pengguna")}
            </button>
          ) : null
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-h">
          <h2>{t("Matriks akses per entitas")}</h2>
          <span className="sub">
            {t("Centang menandakan pengguna dapat membuka entitas · apa yang bisa dilakukan ditentukan oleh peran")}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ width: "22%" }}>{t("Pengguna")}</th>
                <th style={{ width: 130 }}>{t("Peran")}</th>
                {companies.map((company) => (
                  <th key={company.id} className="r" style={{ whiteSpace: "nowrap" }}>
                    {company.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={2 + companies.length} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {canManage ? (
                      <button
                        onClick={() => openEdit(user)}
                        style={{ display: "block", textAlign: "left", fontWeight: 500, color: "var(--ledger-dk)" }}
                      >
                        {user.name}
                      </button>
                    ) : (
                      <span style={{ display: "block", fontWeight: 500 }}>{user.name}</span>
                    )}
                    <span className="sm muted">{user.email}</span>
                  </td>
                  <td>
                    <span style={{ display: "block" }}>{user.roleName}</span>
                    <span className={statusChip(user.status)}>{humanizeEnum(user.status)}</span>
                  </td>
                  {companies.map((company) => {
                    const granted = user.roleCode === "ADMIN" || user.companyIds.includes(company.id);
                    return (
                      <td key={company.id} className="r" style={{ color: granted ? "var(--ledger)" : undefined }}>
                        {granted ? "✓" : <span className="muted">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bal">
          <span className="k">{t("Batasan per unit berlaku untuk input dan lihat buku")}</span>
          <span className="chip chip-info">
            {t("Administrator selalu melihat seluruh buku — persetujuan butuh gambaran utuh")}
          </span>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>{t("Kewenangan per peran")}</h2>
          <span className="sub">{t("Yang menginput tidak menyetujui · yang menyetujui tidak menginput")}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>{t("Kewenangan")}</th>
                {roles.map((role) => (
                  <th key={role.id} className="r" style={{ width: 120 }}>
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.length === 0 && (
                <tr>
                  <td colSpan={1 + roles.length} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {modules.map(([module, items]) => (
                <Fragment key={module}>
                  <tr>
                    <td colSpan={1 + roles.length} className="sm muted" style={{ background: "var(--sunk)" }}>
                      {t(module)}
                    </td>
                  </tr>
                  {items.map((permission) => (
                    <tr key={permission.code}>
                      <td>
                        <span style={{ display: "block" }}>{permission.description ?? humanizeEnum(permission.action)}</span>
                        <span className="sm muted num">{permission.code}</span>
                      </td>
                      {roles.map((role) => (
                        <td key={role.id} className="r" style={{ color: role.permissions.includes(permission.code) ? "var(--ledger)" : undefined }}>
                          {role.permissions.includes(permission.code) ? "✓" : <span className="muted">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bal" style={{ display: "block" }}>
          <div className="k" style={{ marginBottom: 6 }}>
            {t("Empat hal yang perlu Anda putuskan sebelum ini dikunci sebagai spesifikasi:")}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.7 }}>
            {t(
              "1 · Administrator hanya bisa menyetujui atau menolak, tidak bisa memperbaiki angka sendiri — koreksi selalu dikembalikan ke User. Kalau supervisor perlu bisa mengedit langsung, pemisahan tugas ini hilang.",
            )}
            <br />
            {t(
              "2 · Admin bisa mengubah bagan akun, dan itu memengaruhi angka laporan. Perlu diputuskan apakah perubahan akun yang sudah dipakai transaksi juga butuh persetujuan Administrator.",
            )}
            <br />
            {t(
              "3 · Admin di sini otomatis melihat semua entitas karena ia yang mengatur akses. Kalau kerahasiaan antar klien harus ketat sampai ke level Admin, perlu peran keempat khusus IT.",
            )}
            <br />
            {t(
              "4 · Jurnal antar-unit menyentuh dua buku sekaligus. Saat ini User harus punya akses ke kedua buku; alternatifnya sistem membuat sisi pasangan sebagai draf yang menunggu User unit tujuan.",
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Tambah Pengguna")}
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
            <label className="f" data-req="1">{t("Nama lengkap")}</label>
            <input
              type="text"
              className={errors.name ? "field-error" : undefined}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
            />
            {errors.name && <span className="sm" style={{ color: "#C8382F" }}>{errors.name}</span>}
          </div>
          <div>
            <label className="f" data-req="1">{t("Email kantor")}</label>
            <input
              type="email"
              className={errors.email ? "field-error" : undefined}
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
            />
            {errors.email && <span className="sm" style={{ color: "#C8382F" }}>{errors.email}</span>}
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Kata sandi")}</label>
            <input
              type="password"
              className={errors.password ? "field-error" : undefined}
              placeholder={t("Minimal 8 karakter, huruf + angka")}
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
            />
            {errors.password && <span className="sm" style={{ color: "#C8382F" }}>{errors.password}</span>}
          </div>
          <div>
            <label className="f" data-req="1">{t("Peran")}</label>
            <select className={errors.roleId ? "field-error" : undefined} value={form.roleId} onChange={(event) => update("roleId", event.target.value)}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f">{t("Jabatan")}</label>
            <input type="text" value={form.jobTitle} onChange={(event) => update("jobTitle", event.target.value)} />
          </div>
          <div>
            <label className="f">{t("Telepon")}</label>
            <input type="text" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
          </div>
          <div>
            <label className="f">{t("Status")}</label>
            <select value={form.status} onChange={(event) => update("status", event.target.value)}>
              <option value="AKTIF">{t("Aktif")}</option>
              <option value="NONAKTIF">{t("Non-Aktif")}</option>
              <option value="DIKUNCI">{t("Dikunci")}</option>
            </select>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t("Atur akses pengguna")}
        badge={editing?.name}
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
            <label className="f">{t("Peran")}</label>
            <select value={editForm.roleId} onChange={(event) => setEditForm((current) => ({ ...current, roleId: event.target.value }))}>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Status")}</label>
            <select
              value={editForm.status}
              onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as UserRow["status"] }))}
            >
              <option value="AKTIF">{t("Aktif")}</option>
              <option value="NONAKTIF">{t("Non-Aktif")}</option>
              <option value="DIKUNCI">{t("Dikunci")}</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{`${t("Buku unit")} · ${activeCompanyName}`}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {units.length === 0 && <span className="sm muted">{t("Belum ada unit bisnis")}</span>}
              {units.map((unit) => (
                <label
                  key={unit.id}
                  style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--ink2)", cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    style={{ width: "auto" }}
                    checked={editForm.unitIds.includes(unit.id)}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        unitIds: event.target.checked
                          ? [...current.unitIds, unit.id]
                          : current.unitIds.filter((id) => id !== unit.id),
                      }))
                    }
                  />
                  <span>
                    <span className="num">{unit.code}</span> · {unit.name}
                  </span>
                </label>
              ))}
            </div>
            <div className="note" style={{ marginTop: 12 }}>
              {t("Akses ke buku unit entitas lain diatur dari entitas yang bersangkutan.")}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  );
}
