"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useLocale } from "@/i18n/LocaleProvider";
import { formatDateTime } from "@/lib/format";

type SessionRow = { id: string; device: string | null; location: string | null; lastActiveAt: string };

const NOTIFICATIONS: Array<[string, string]> = [
  ["approval", "Permintaan persetujuan baru"],
  ["import", "Impor mutasi bank selesai"],
  ["period", "Periode dikunci atau dibuka kembali"],
  ["daily", "Ringkasan harian buku unit"],
];

const START_SCREENS = ["Beranda modul", "Dashboard pembukuan", "Kotak persetujuan"];
const DENSITIES = ["Normal", "Padat"];
const DATE_FORMATS = ["31 Agu 2026", "31/08/2026"];

export default function ProfilScreen({
  user,
  entityCount,
  units,
  activeUnitId,
  sessions,
  preferences,
  passwordChangedAt,
}: {
  user: { name: string; email: string; jobTitle: string | null; phone: string | null; locale: "ID" | "EN"; initials: string; roleName: string };
  entityCount: number;
  units: Array<{ id: string; code: string; name: string }>;
  activeUnitId: string;
  sessions: SessionRow[];
  preferences: { startScreen: string; density: string; dateFormat: string; emailNotifications: string[] };
  passwordChangedAt: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { locale, setLocale, t } = useLocale();

  const [form, setForm] = useState({
    name: user.name,
    jobTitle: user.jobTitle ?? "",
    email: user.email,
    phone: user.phone ?? "",
    unitId: activeUnitId,
  });
  const [prefs, setPrefs] = useState(preferences);
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function saveProfile() {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        jobTitle: form.jobTitle,
        phone: form.phone,
        locale,
        preferences: prefs,
      }),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      toast(data.error ?? t("Gagal menyimpan profil."));
      return;
    }
    toast(t("Profil tersimpan"));
    router.refresh();
  }

  async function changePassword() {
    setPwBusy(true);
    setPwError("");
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pw),
    });
    const data = (await res.json()) as { error?: string };
    setPwBusy(false);
    if (!res.ok) {
      setPwError(data.error ?? t("Gagal mengubah kata sandi."));
      return;
    }
    setPwOpen(false);
    setPw({ current: "", next: "", confirm: "" });
    toast(t("Kata sandi diubah dan sesi lain diakhiri"));
    router.refresh();
  }

  async function endSession(sessionId?: string) {
    const res = await fetch("/api/profile/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionId ? { sessionId } : { all: true }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast(data.error ?? t("Gagal mengakhiri sesi."));
      return;
    }
    toast(sessionId ? t("Sesi perangkat diakhiri") : t("Semua sesi lain diakhiri"));
    router.refresh();
  }

  function toggleNotification(key: string) {
    setPrefs((current) => ({
      ...current,
      emailNotifications: current.emailNotifications.includes(key)
        ? current.emailNotifications.filter((item) => item !== key)
        : [...current.emailNotifications, key],
    }));
  }

  return (
    <>
      <PageHead
        title={t("Profil & Preferensi")}
        subtitle={t("Data pengguna, keamanan akun, dan preferensi tampilan")}
        actions={
          <>
            <button
              className="btn"
              onClick={() => {
                setForm({
                  name: user.name,
                  jobTitle: user.jobTitle ?? "",
                  email: user.email,
                  phone: user.phone ?? "",
                  unitId: activeUnitId,
                });
                setPrefs(preferences);
                toast(t("Perubahan profil dibatalkan"));
              }}
            >
              {t("Batalkan")}
            </button>
            <button className="btn btn-primary" disabled={saving} onClick={() => void saveProfile()}>
              {saving ? t("Menyimpan…") : t("Simpan profil")}
            </button>
          </>
        }
      />

      <div className="grid2">
        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Data pengguna")}</h2>
            </div>
            <div className="card-b">
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <span
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: "50%",
                    background: "var(--ledger)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 17,
                    fontWeight: 600,
                    flex: "none",
                  }}
                >
                  {user.initials}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>{user.name}</div>
                  <div className="sm muted">
                    {t(user.roleName)} · {t("akses")} {entityCount} {t("entitas")}
                  </div>
                </div>
                <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => toast(t("Pemilih foto profil dibuka"))}>
                  {t("Ganti foto")}
                </button>
              </div>

              <div className="row row-2">
                <div>
                  <label className="f">{t("Nama lengkap")}</label>
                  <input type="text" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </div>
                <div>
                  <label className="f">{t("Jabatan")}</label>
                  <input type="text" value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} />
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label className="f">{t("Email kantor")}</label>
                  <input type="email" value={form.email} readOnly title={t("Email diubah oleh Administrator")} />
                </div>
                <div>
                  <label className="f">{t("Telepon")}</label>
                  <input type="text" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                </div>
              </div>
              <div className="row">
                <div>
                  <label className="f">{t("Unit bisnis utama")}</label>
                  <select value={form.unitId} onChange={(event) => setForm({ ...form, unitId: event.target.value })}>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.code} · {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Keamanan")}</h2>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>{t("Kata sandi")}</td>
                  <td className="r muted">
                    {passwordChangedAt ? `${t("Diubah")} ${formatDateTime(passwordChangedAt)}` : t("Belum pernah diubah")}
                  </td>
                  <td className="r">
                    <button className="btn btn-sm" onClick={() => setPwOpen(true)}>
                      {t("Ubah")}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>{t("Verifikasi dua langkah")}</td>
                  <td className="r">
                    <span className="chip chip-warn">{t("belum aktif")}</span>
                  </td>
                  <td className="r">
                    <button className="btn btn-sm" onClick={() => toast(t("Panduan verifikasi dua langkah dibuka"))}>
                      {t("Aktifkan")}
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>{t("Kode akses cepat")}</td>
                  <td className="r">
                    <span className="chip chip-open">{t("aktif")}</span>
                  </td>
                  <td className="r">
                    <button className="btn btn-sm" onClick={() => toast(t("Pengaturan kode akses dibuka"))}>
                      {t("Kelola")}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Preferensi tampilan")}</h2>
            </div>
            <div className="card-b">
              <div className="row row-2">
                <div>
                  <label className="f">{t("Bahasa")}</label>
                  <select value={locale} onChange={(event) => setLocale(event.target.value === "EN" ? "EN" : "ID")}>
                    <option value="ID">Bahasa Indonesia</option>
                    <option value="EN">English</option>
                  </select>
                </div>
                <div>
                  <label className="f">{t("Layar awal setelah masuk")}</label>
                  <select value={prefs.startScreen} onChange={(event) => setPrefs({ ...prefs, startScreen: event.target.value })}>
                    {START_SCREENS.map((item) => (
                      <option key={item} value={item}>
                        {t(item)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label className="f">{t("Kerapatan tabel")}</label>
                  <select value={prefs.density} onChange={(event) => setPrefs({ ...prefs, density: event.target.value })}>
                    {DENSITIES.map((item) => (
                      <option key={item} value={item}>
                        {t(item)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="f">{t("Format tanggal")}</label>
                  <select value={prefs.dateFormat} onChange={(event) => setPrefs({ ...prefs, dateFormat: event.target.value })}>
                    {DATE_FORMATS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Notifikasi email")}</h2>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {NOTIFICATIONS.map(([key, label]) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={prefs.emailNotifications.includes(key)}
                    onChange={() => toggleNotification(key)}
                    style={{ width: "auto" }}
                  />
                  <span>{t(label)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Sesi aktif")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Perangkat")}</th>
                  <th>{t("Lokasi")}</th>
                  <th className="r">{t("Terakhir aktif")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="sm muted">
                      {t("Tidak ada sesi aktif")}
                    </td>
                  </tr>
                )}
                {sessions.map((session, index) => (
                  <tr key={session.id}>
                    <td>{session.device ?? "—"}</td>
                    <td className="muted">{session.location ?? "—"}</td>
                    <td className="r muted">{index === 0 ? t("Sesi ini") : formatDateTime(session.lastActiveAt)}</td>
                    <td className="r">
                      {index === 0 ? (
                        <span className="chip chip-open">{t("sekarang")}</span>
                      ) : (
                        <button className="btn btn-sm" onClick={() => void endSession(session.id)}>
                          {t("Akhiri")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bal">
              <span style={{ marginLeft: "auto" }}>
                <button className="btn btn-sm" disabled={sessions.length < 2} onClick={() => void endSession()}>
                  {t("Akhiri semua sesi lain")}
                </button>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={t("Ubah kata sandi")}
        maxWidth={460}
        footer={
          <>
            <button className="btn" onClick={() => setPwOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={pwBusy} onClick={() => void changePassword()}>
              {pwBusy ? t("Menyimpan…") : t("Ubah kata sandi")}
            </button>
          </>
        }
      >
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Kata sandi lama")}
            </label>
            <input type="password" placeholder="••••••••" value={pw.current} onChange={(event) => setPw({ ...pw, current: event.target.value })} />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Kata sandi baru")}
            </label>
            <input
              type="password"
              placeholder={t("Minimal 8 karakter, huruf + angka")}
              value={pw.next}
              onChange={(event) => setPw({ ...pw, next: event.target.value })}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Konfirmasi kata sandi baru")}
            </label>
            <input
              type="password"
              placeholder={t("Ulangi kata sandi baru")}
              value={pw.confirm}
              onChange={(event) => setPw({ ...pw, confirm: event.target.value })}
            />
          </div>
        </div>
        <div className="note">{t("Setelah kata sandi diubah, semua sesi di perangkat lain akan diakhiri.")}</div>
        {pwError && (
          <div className="note" style={{ background: "var(--brick-bg)", borderLeftColor: "var(--brick)", color: "var(--brick)", marginTop: 10 }}>
            {pwError}
          </div>
        )}
      </Dialog>
    </>
  );
}
