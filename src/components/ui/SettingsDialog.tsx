"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { useLocale, type Locale } from "@/i18n/LocaleProvider";
import { titleCase } from "@/lib/format";

type Pane = "pw" | "lang";

/**
 * The compact settings modal from the prototype: change your own password, or
 * switch the interface language. Kept self-contained — it reports success and
 * failure inside itself — so it also works on screens that sit outside the app
 * shell and have no toast provider.
 */
export default function SettingsDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: { name: string; email: string; initials: string };
}) {
  const { locale, setLocale, t } = useLocale();

  const [pane, setPane] = useState<Pane>("pw");
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [language, setLanguage] = useState<Locale>(locale);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Start clean every time the dialog is opened rather than showing the last
  // attempt's fields and message.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPane("pw");
      setForm({ current: "", next: "", confirm: "" });
      setShowPass(false);
      setLanguage(locale);
      setMessage(null);
    }
  }

  async function save() {
    if (pane === "lang") {
      setLocale(language);
      onClose();
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? t("Kata sandi gagal diganti.") });
        return;
      }
      setForm({ current: "", next: "", confirm: "" });
      setMessage({ ok: true, text: t("Kata sandi berhasil diganti. Sesi di perangkat lain diakhiri.") });
    } catch {
      setMessage({ ok: false, text: t("Tidak dapat terhubung ke server.") });
    } finally {
      setBusy(false);
    }
  }

  function tabStyle(key: Pane): React.CSSProperties {
    const on = pane === key;
    return {
      flex: 1,
      padding: "7px 8px",
      borderRadius: 7,
      fontSize: 12,
      fontWeight: 500,
      background: on ? "var(--card)" : "transparent",
      color: on ? "var(--ink)" : "var(--ink3)",
      boxShadow: on ? "0 1px 3px rgba(22,32,27,.12)" : "none",
    };
  }

  return (
    <Dialog
      open={open}
      title={t("Pengaturan")}
      maxWidth={404}
      onClose={onClose}
      footer={
        <>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>
            {t("Batal")}
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
            {busy ? t("Menyimpan…") : pane === "pw" ? t("Simpan Kata Sandi") : t("Simpan")}
          </button>
        </>
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "9px 11px",
          background: "var(--paper)",
          borderRadius: 9,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--ledger)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 600,
            flex: "none",
          }}
        >
          {user.initials}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
            {titleCase(user.name)}
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--ink3)" }}>{user.email}</span>
        </span>
      </div>

      <div style={{ display: "flex", gap: 3, background: "var(--paper)", borderRadius: 9, padding: 3, marginBottom: 14 }}>
        <button onClick={() => setPane("pw")} style={tabStyle("pw")}>
          {t("Kata Sandi")}
        </button>
        <button onClick={() => setPane("lang")} style={tabStyle("lang")}>
          {t("Bahasa")}
        </button>
      </div>

      {pane === "pw" ? (
        <>
          <div className="row">
            <div>
              <label className="f" htmlFor="setPwOld">
                {t("Kata sandi lama")}
              </label>
              <input
                id="setPwOld"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.current}
                onChange={(event) => setForm((current) => ({ ...current, current: event.target.value }))}
              />
            </div>
          </div>
          <div className="row">
            <div>
              <label className="f" htmlFor="setPwNew">
                {t("Kata sandi baru")}
              </label>
              <input
                id="setPwNew"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("Minimal 8 karakter, huruf + angka")}
                value={form.next}
                onChange={(event) => setForm((current) => ({ ...current, next: event.target.value }))}
              />
            </div>
          </div>
          <div className="row">
            <div>
              <label className="f" htmlFor="setPwConfirm">
                {t("Konfirmasi kata sandi baru")}
              </label>
              <input
                id="setPwConfirm"
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                placeholder={t("Ulangi kata sandi baru")}
                value={form.confirm}
                onChange={(event) => setForm((current) => ({ ...current, confirm: event.target.value }))}
              />
            </div>
          </div>
          <label
            style={{
              whiteSpace: "nowrap",
              width: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "var(--ink2)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showPass}
              onChange={(event) => setShowPass(event.target.checked)}
              style={{ width: "auto" }}
            />
            <span>{t("Lihat kata sandi")}</span>
          </label>
        </>
      ) : (
        <>
          <label className="f">{t("Bahasa tampilan")}</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {(
              [
                ["ID", "Bahasa"],
                ["EN", "English"],
              ] as Array<[Locale, string]>
            ).map(([value, label]) => (
              <label
                key={value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "10px 12px",
                  border: `1px solid ${language === value ? "var(--ledger)" : "var(--rule)"}`,
                  borderRadius: 9,
                  background: "var(--paper)",
                  cursor: "pointer",
                  fontSize: 12.5,
                }}
              >
                <input
                  type="radio"
                  name="setLang"
                  value={value}
                  checked={language === value}
                  onChange={() => setLanguage(value)}
                  style={{ width: "auto" }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="sm muted" style={{ marginTop: 10 }}>
            {t("Nama perusahaan, kode akun, dan angka tidak diterjemahkan.")}
          </div>
        </>
      )}

      {message && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: "9px 11px",
            borderRadius: 8,
            fontSize: 12,
            background: message.ok ? "#E4EFE3" : "var(--brick-bg)",
            color: message.ok ? "var(--moss)" : "var(--brick)",
          }}
        >
          {message.text}
        </div>
      )}
    </Dialog>
  );
}
