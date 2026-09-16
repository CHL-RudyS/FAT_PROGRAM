"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import LoadingOverlay, { Spinner } from "@/components/ui/LoadingOverlay";

const VALUES: Array<[string, string]> = [
  ["L", "Living with Integrity"],
  ["E", "Encourage Assertiveness & Professionalism"],
  ["S", "Strong Commitment"],
  ["T", "Teamwork with Loyalty"],
  ["A", "Achieve Services Level Agreements"],
  ["R", "Reliable Worth Ethic"],
  ["I", "Internal Harmony and Solidarity"],
];

const ID_FLAG = "linear-gradient(to bottom,#E01020 0 50%,#fff 50% 100%)";
const EN_FLAG =
  "linear-gradient(#3C3B6E,#3C3B6E) no-repeat top left/50% 50%,repeating-linear-gradient(to bottom,#B22234 0 14.28%,#fff 14.28% 28.56%)";

function formatLastLogin(date: Date, locale: "ID" | "EN") {
  const months =
    locale === "EN"
      ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      : ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${hh}:${mm} WIB`;
}

export default function LoginScreen({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const [langOpen, setLangOpen] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  /**
   * "memeriksa" covers the request itself; "masuk" covers the navigation that
   * follows it, which renders the company picker from the database and is the
   * longer of the two. Both keep the form locked.
   */
  const [phase, setPhase] = useState<null | "memeriksa" | "masuk">(null);
  const busy = phase !== null;
  const [clock, setClock] = useState<string>("");
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => setClock(formatLastLogin(new Date(), locale));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [locale]);

  useEffect(() => {
    if (!langOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!langRef.current?.contains(event.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [langOpen]);

  async function submit() {
    if (!email.trim() || !password) {
      setError(t("Email dan kata sandi harus diisi."));
      return;
    }
    setPhase("memeriksa");
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("Email atau kata sandi salah."));
        setPhase(null);
        return;
      }
      // Deliberately left in the loading state: this screen stays on display
      // until the next one has rendered, and clearing it here would show an
      // idle form for the second or two that takes.
      setPhase("masuk");
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError(t("Tidak dapat terhubung ke server."));
      setPhase(null);
    }
  }

  return (
    <div
      className="noscrollbar"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        background: "#EAF3F8",
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      <div
        ref={langRef}
        style={{
          position: "absolute",
          top: "calc(12vh + 22px)",
          right: "calc(clamp(20px,5vw,66px) + 34px)",
          zIndex: 2,
        }}
      >
        <button
          onClick={() => setLangOpen((open) => !open)}
          aria-haspopup="true"
          aria-expanded={langOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: "var(--card)",
            border: "none",
            borderRadius: 999,
            padding: "4px 11px 4px 4px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink)",
            boxShadow: "0 2px 8px rgba(22,32,27,.10)",
          }}
        >
          <span
            style={{
              width: 21,
              height: 21,
              borderRadius: "50%",
              flex: "none",
              overflow: "hidden",
              boxShadow: "0 0 0 1px rgba(22,32,27,.10)",
              background: locale === "EN" ? EN_FLAG : ID_FLAG,
            }}
          />
          <span>{locale === "EN" ? "EN" : "ID"}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink2)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {langOpen && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              background: "var(--card)",
              border: "none",
              borderRadius: 11,
              boxShadow: "0 8px 22px rgba(22,32,27,.16)",
              width: "max-content",
              minWidth: "100%",
              overflow: "hidden",
              padding: 5,
            }}
          >
            {(
              [
                ["ID", "Bahasa", ID_FLAG],
                ["EN", "English", EN_FLAG],
              ] as const
            ).map(([code, label, flag], index) => (
              <button
                key={code}
                onClick={() => {
                  setLocale(code);
                  setLangOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 12px 5px 5px",
                  fontSize: 11.5,
                  fontWeight: locale === code ? 600 : 400,
                  color: "var(--ink)",
                  borderRadius: 9,
                  whiteSpace: "nowrap",
                  marginTop: index === 0 ? 0 : 2,
                  background: locale === code ? "var(--sunk)" : "transparent",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    flex: "none",
                    overflow: "hidden",
                    boxShadow: "0 0 0 1px rgba(22,32,27,.10)",
                    background: flag,
                  }}
                />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          padding: "calc(12vh + 30px) clamp(28px,7vw,96px) clamp(28px,7vh,88px)",
          display: "flex",
          flexDirection: "column",
          color: "var(--ink)",
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--ledger)", textTransform: "uppercase", fontWeight: 600 }}>
            Internal System
          </div>
          <div
            style={{
              animation: "lgFloat 4.6s ease-in-out infinite",
              willChange: "transform",
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 8,
              flexWrap: "nowrap",
            }}
          >
            <Image src="/assets/logo-chl.png" alt="Logo PT. Cipta Harmoni Lestari" width={61} height={58} style={{ height: 58, width: "auto", display: "block", flex: "none" }} priority />
            <span
              style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: "-.02em",
                lineHeight: 1.15,
                color: "#C79A2E",
                whiteSpace: "nowrap",
                textShadow: "0 1px 0 rgba(255,255,255,.85),0 2px 1px rgba(138,93,20,.45),0 4px 7px rgba(22,32,27,.22)",
              }}
            >
              CIPTA HARMONI LESTARI
            </span>
          </div>
          <div
            style={{
              animation: "lgFloat 5.4s ease-in-out infinite",
              willChange: "transform",
              textShadow: "0 1px 0 rgba(255,255,255,.9),0 2px 5px rgba(22,32,27,.16)",
              marginTop: 20,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--ink2)", textTransform: "uppercase" }}>
              Company Values
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
              {VALUES.map(([initial, text]) => (
                <div key={initial} style={{ display: "grid", gridTemplateColumns: "18px 1fr", alignItems: "baseline", columnGap: 8 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 14, fontWeight: 600, color: "var(--ledger)" }}>{initial}</span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink2)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11.5, color: "var(--ink2)" }}>
          <span>IAS-based Accounting System</span>
        </div>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        style={{
          flex: "0 0 448px",
          width: 448,
          maxWidth: "56%",
          background: "linear-gradient(160deg,#FFFFFF 0%,#F4F8FB 46%,#E7EFF6 100%)",
          borderRadius: 18,
          boxShadow:
            "0 26px 48px -18px rgba(22,32,27,.34),0 10px 20px -12px rgba(22,32,27,.22),inset 0 1px 0 rgba(255,255,255,.85),inset 0 -1px 0 rgba(22,32,27,.08)",
          animation: "lgFloat 6s ease-in-out infinite",
          willChange: "transform",
          height: "auto",
          minHeight: "76%",
          maxHeight: "92%",
          alignSelf: "center",
          margin: "0 clamp(20px,5vw,66px) 0 0",
          padding: "clamp(24px,4vh,44px) 34px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
        }}
      >
        <div style={{ marginTop: "auto", marginLeft: -8, display: "flex", alignItems: "center", gap: 2 }}>
          <Image src="/assets/logo-chl.png" alt="Logo CHL Group" width={40} height={38} style={{ height: 38, width: "auto", display: "block", flex: "none" }} />
          <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.01em", color: "#C79A2E", whiteSpace: "nowrap" }}>CHL Group</span>
        </div>
        <p style={{ fontSize: 17, fontWeight: 600, color: "var(--ink)", marginTop: 2 }}>{t("Selamat Datang Kembali")}</p>
        <h1 style={{ fontSize: 14, fontWeight: 400, letterSpacing: "-.01em", color: "var(--ink2)", marginTop: 2 }}>
          {t("Masuk Email Kantor Anda")}
        </h1>

        <div className="row" style={{ marginTop: 18 }}>
          <div>
            <label className="f" htmlFor="loginUser">
              {t("Email")}
            </label>
            <input
              id="loginUser"
              type="text"
              autoComplete="username"
              placeholder="nama@kantor.id"
              disabled={busy}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" htmlFor="loginPass">
              {t("Kata Sandi")}
            </label>
            <input
              id="loginPass"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              placeholder={t("Kata sandi")}
              disabled={busy}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>

        {error && (
          <div
            className="note"
            role="alert"
            style={{ background: "var(--brick-bg)", borderLeftColor: "var(--brick)", color: "var(--brick)", marginBottom: 12 }}
          >
            {error}
          </div>
        )}

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12.5,
            color: "var(--ink2)",
            margin: "2px 0 18px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            width: "auto",
          }}
        >
          <input type="checkbox" checked={showPass} onChange={(event) => setShowPass(event.target.checked)} style={{ width: "auto" }} />
          <span>{t("Lihat kata sandi")}</span>
        </label>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ width: "100%", padding: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {busy && <Spinner color="#fff" />}
          {phase === "masuk" ? t("Menyiapkan ruang kerja…") : phase ? t("Memeriksa…") : t("Masuk")}
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 14, fontSize: 12.5 }}>
          <a href="#" style={{ color: "var(--ledger)" }}>
            {t("Lupa kata sandi")}
          </a>
          <span className="muted">{t("Butuh akun? Hubungi Admin")}</span>
        </div>

        <div
          style={{
            marginTop: 20,
            marginBottom: "auto",
            paddingTop: 14,
            borderTop: "1px solid var(--rule)",
            fontSize: 11.5,
            color: "var(--ink4)",
          }}
        >
          <span>{t("Logout terakhir dari perangkat ini")}</span> · <span className="num">{clock}</span>
        </div>
      </form>

      {/* The company picker is server-rendered, so this covers the gap between
          a verified password and the screen that replaces this one. */}
      {phase === "masuk" && <LoadingOverlay label={t("Menyiapkan ruang kerja…")} />}
    </div>
  );
}
