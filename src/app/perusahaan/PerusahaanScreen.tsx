"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { titleCase } from "@/lib/format";
import SettingsDialog from "@/components/ui/SettingsDialog";
import {
  BackdropWaves,
  IconChevronDown,
  IconHelp,
  IconBell,
  IconGear,
  IconLogout,
  IconSearch,
} from "@/components/shell/icons";

export type CompanyOption = {
  id: string;
  name: string;
  colorTag: string | null;
  unitCount: number;
};

export type UnitOption = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  needsWork: boolean;
  hasVariance: boolean;
};

const MEGA_TABS = ["Beranda", "Transaksi", "Mitra", "Laporan", "Manajemen"];

const userMenuItem: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  width: "100%",
  textAlign: "left",
  padding: "8px 11px",
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 500,
  color: "var(--ink)",
  whiteSpace: "nowrap",
};

export default function PerusahaanScreen({
  companies,
  user,
  lastLogin,
}: {
  companies: CompanyOption[];
  user: { name: string; email: string; roleName: string; initials: string };
  lastLogin: string;
}) {
  const router = useRouter();
  const t = useT();
  const [companyQuery, setCompanyQuery] = useState("");
  const [unitQuery, setUnitQuery] = useState("");
  const [picked, setPicked] = useState<CompanyOption | null>(null);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    if (!userMenu) return;
    const close = () => setUserMenu(false);
    const onDown = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest("[data-menu-root]")) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenu]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const visibleCompanies = useMemo(() => {
    const query = companyQuery.trim().toLowerCase();
    if (!query) return companies;
    return companies.filter((company) => company.name.toLowerCase().includes(query));
  }, [companies, companyQuery]);

  const visibleUnits = useMemo(() => {
    const query = unitQuery.trim().toLowerCase();
    if (!query) return units;
    return units.filter((unit) => `${unit.code} ${unit.name}`.toLowerCase().includes(query));
  }, [units, unitQuery]);

  async function pickCompany(company: CompanyOption) {
    setPicked(company);
    setUnitQuery("");
    const res = await fetch(`/api/companies/${company.id}/units`);
    setUnits(res.ok ? ((await res.json()) as UnitOption[]) : []);
  }

  async function pickUnit(unit: UnitOption) {
    if (!picked || busy) return;
    setBusy(true);
    const res = await fetch("/api/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: picked.id, unitId: unit.id }),
    });
    if (res.ok) {
      router.replace("/beranda");
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  const todo = units.filter((unit) => unit.needsWork).length;
  const diff = units.filter((unit) => unit.hasVariance).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(180deg,#FDFDFD 0%,#F1F4F9 55%,#DEE3EC 100%)",
        padding: 22,
        overflowY: "auto",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <BackdropWaves />

      <div style={{ flex: "0.7 1 360px", maxWidth: 469, minWidth: 0, margin: "auto", display: "flex", flexDirection: "column", gap: 14, justifySelf: "center" }}>
        <div
          style={{
            background: "var(--card)",
            borderRadius: 14,
            boxShadow: "0 6px 20px rgba(22,32,27,.12)",
            position: "relative",
            zIndex: 2,
            width: "57.5%",
            minWidth: 391,
            marginRight: 22,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "12px 20px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, order: 1, alignSelf: "flex-end" }}>
              <button aria-label={t("Bantuan")} style={{ color: "var(--ink3)", display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8 }}>
                <IconHelp />
              </button>
              <button aria-label={t("Notifikasi")} style={{ color: "var(--ink3)", display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8 }}>
                <IconBell />
              </button>
              <span style={{ display: "block", width: 1, height: 24, background: "var(--rule)" }} />
              <div data-menu-root style={{ position: "relative" }}>
                <button
                  onClick={() => setUserMenu((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={userMenu}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "4px 6px 4px 4px",
                    width: 136,
                    flex: "none",
                    borderRadius: 9,
                    color: "var(--ink)",
                    background: userMenu ? "var(--sunk)" : undefined,
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "var(--ledger)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11.5,
                      fontWeight: 600,
                      flex: "none",
                    }}
                  >
                    {user.initials}
                  </span>
                  <span style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {titleCase(user.name)}
                    </span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t(user.roleName)}
                    </span>
                  </span>
                  <IconChevronDown size={14} stroke="var(--ink3)" />
                </button>

                {userMenu && (
                  <div
                    role="menu"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 8px)",
                      minWidth: "100%",
                      width: "max-content",
                      background: "rgba(244,246,242,.94)",
                      backdropFilter: "blur(10px)",
                      WebkitBackdropFilter: "blur(10px)",
                      border: "1px solid var(--rule)",
                      borderRadius: 12,
                      boxShadow: "0 14px 34px rgba(22,32,27,.16)",
                      padding: 5,
                      zIndex: 44,
                    }}
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setUserMenu(false);
                        setSettings(true);
                      }}
                      style={userMenuItem}
                    >
                      <IconGear />
                      {t("Pengaturan")}
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => void logout()}
                      style={{ ...userMenuItem, color: "var(--brick)", borderTop: "1px solid var(--rule)", marginTop: 3 }}
                    >
                      <IconLogout />
                      {t("Keluar")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none", order: 2 }}>
              <Image src="/assets/logo-chl.png" alt="Logo PT. Cipta Harmoni Lestari" width={34} height={32} style={{ height: 32, width: "auto", display: "block" }} priority />
              <span style={{ display: "block", width: 1, height: 26, background: "var(--rule)" }} />
              <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: ".03em", textTransform: "uppercase", color: "var(--ledger-dk)" }}>
                ACCOUNTING DEPARTMENT
              </span>
            </div>

            <div style={{ width: "100%", position: "relative", display: "flex", alignItems: "center", order: 3 }}>
              <span style={{ position: "absolute", left: 11, zIndex: 1, display: "flex" }}>
                <IconSearch size={15} />
              </span>
              <input
                type="text"
                autoComplete="off"
                placeholder={t("Cari Perusahaan…")}
                value={companyQuery}
                onChange={(event) => setCompanyQuery(event.target.value)}
                style={{ paddingLeft: 32, borderRadius: 9, background: "var(--paper)" }}
              />
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--rule)", padding: "0 10px", display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            {MEGA_TABS.map((label) => (
              <span
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "10px 14px",
                  borderRadius: "9px 9px 0 0",
                  color: "var(--ink4)",
                  opacity: 0.5,
                  cursor: "not-allowed",
                  whiteSpace: "nowrap",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                {t(label)}
                <IconChevronDown size={13} stroke="currentColor" />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "var(--card)",
          borderRadius: 14,
          boxShadow: "0 6px 20px rgba(22,32,27,.12)",
          padding: "26px 24px",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 296px",
            gap: 26,
            alignItems: "start",
            transform: picked ? "none" : "translateX(-30%)",
            transition: "transform .18s",
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Selamat Datang Kembali :")}</div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "-.02em",
                lineHeight: 1.2,
                marginTop: 6,
                textTransform: "uppercase",
                color: "var(--ink)",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                maxWidth: "25ch",
              }}
            >
              {user.name}
            </div>
            <div className="num" style={{ fontSize: 13, color: "var(--ledger-dk)", marginTop: 5, textTransform: "uppercase" }}>
              {t(user.roleName)}
            </div>
            <div style={{ width: 52, height: 3, background: "var(--ledger)", borderRadius: 2, marginTop: 14 }} />
            <p style={{ fontSize: 13.5, color: "var(--ink2)", marginTop: 14, maxWidth: 420, textWrap: "pretty" }}>
              {t("Pilih perusahaan untuk mulai membukukan, atau lanjutkan dari pekerjaan yang belum selesai di perusahaan ini.")}
            </p>
            <div className="num" style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 14 }}>
              {lastLogin}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
              borderRadius: 12,
              overflow: "hidden",
              background: "linear-gradient(180deg,rgba(207,224,236,.10) 0%,rgba(207,224,236,.30) 55%,rgba(207,224,236,.44) 100%)",
            }}
          >
            <div style={{ background: "transparent", padding: "13px 14px", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "-.01em", textTransform: "uppercase", paddingBottom: 8, borderBottom: "1px solid rgba(22,32,27,.10)" }}>
                {t("DAFTAR PERUSAHAAN")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: 288, overflowY: "auto", paddingRight: 2 }}>
                {visibleCompanies.map((company) => {
                  const active = picked?.id === company.id;
                  return (
                    <button
                      key={company.id}
                      onClick={() => void pickCompany(company)}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        textAlign: "left",
                        width: "100%",
                        border: `1px solid ${active ? "var(--ledger)" : "var(--rule)"}`,
                        borderRadius: 10,
                        padding: "8px 11px",
                        background: active ? "var(--paper)" : "var(--card)",
                        transition: "border-color .12s,background .12s",
                      }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: company.colorTag ?? "#2E86AB", flex: "none", marginTop: 3 }} />
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--ink)",
                          minWidth: 0,
                          lineHeight: 1.3,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {company.name}
                      </span>
                      <span className="num" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink3)", flex: "none", lineHeight: 1.48 }}>
                        {company.unitCount} {t("unit")}
                      </span>
                    </button>
                  );
                })}
                {visibleCompanies.length === 0 && (
                  <div className="sm muted" style={{ padding: "14px 4px" }}>
                    {t("Tidak ada perusahaan yang cocok.")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {picked && (
          <div
            style={{
              background: "var(--card)",
              borderRadius: 14,
              boxShadow: "0 6px 20px rgba(22,32,27,.12)",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              flex: "0 1 352px",
              minWidth: 286,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em", textTransform: "uppercase" }}>{picked.name}</div>
            <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3, lineHeight: 1.5 }}>{t("Pilih buku unit bisnis yang ingin Anda kerjakan.")}</p>
            <div style={{ position: "relative", display: "flex", alignItems: "center", marginTop: 11 }}>
              <span style={{ position: "absolute", left: 11, display: "flex" }}>
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder={t("Cari unit bisnis…")}
                value={unitQuery}
                onChange={(event) => setUnitQuery(event.target.value)}
                style={{ paddingLeft: 31, borderRadius: 9, background: "var(--paper)", fontSize: 12.5 }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                gap: 7,
                marginTop: 9,
                maxHeight: 458.75,
                overflowY: "auto",
                paddingRight: 2,
                alignContent: "start",
              }}
            >
              {visibleUnits.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => void pickUnit(unit)}
                  disabled={busy}
                  className="unit-card"
                  style={{
                    textAlign: "left",
                    border: "1px solid var(--rule)",
                    borderRadius: 10,
                    padding: "9px 11px",
                    background: "var(--card)",
                    display: "block",
                    width: "100%",
                    transition: "border-color .12s,background .12s",
                  }}
                >
                  <span
                    className="num"
                    style={{
                      display: "inline-block",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: ".06em",
                      background: "var(--sunk)",
                      color: "var(--ink2)",
                      borderRadius: 5,
                      padding: "1px 6px",
                    }}
                  >
                    {unit.code}
                  </span>
                  <span
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                      marginTop: 5,
                      lineHeight: 1.3,
                    }}
                  >
                    {unit.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink3)", marginTop: 1 }}>{unit.city ?? "—"}</span>
                </button>
              ))}
            </div>

            <div
              style={{
                borderTop: "1px solid var(--rule)",
                marginTop: 14,
                paddingTop: 12,
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "center",
                fontSize: 11.5,
                color: "var(--ink3)",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8A317", display: "inline-block", flex: "none" }} />
                <span>
                  {todo} {t("Modul Perlu Dikerjakan")}
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#C0392B", display: "inline-block", flex: "none", boxShadow: "0 0 0 3px rgba(192,57,43,.18)" }} />
                <span style={{ fontWeight: 600, color: "#A32E22" }}>
                  {diff} {t("Modul Masih Selisih")}
                </span>
              </span>
              <span style={{ marginLeft: "auto" }}>{t("Versi Beta")}</span>
            </div>
          </div>
        )}

      <SettingsDialog
        open={settings}
        onClose={() => setSettings(false)}
        user={{ name: user.name, email: user.email, initials: user.initials }}
      />

      <style>{`.unit-card:hover{border-color:var(--ledger)!important;background:var(--paper)!important}`}</style>
    </div>
  );
}
