"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { MODULE_GROUPS, ALL_MODULES, findModuleByPath } from "@/lib/navigation";
import { useT } from "@/i18n/LocaleProvider";
import {
  GROUP_ICONS,
  IconAssistant,
  IconBell,
  IconChevronDown,
  IconGear,
  IconGlobe,
  IconHelp,
  IconHome,
  IconLogout,
  IconMail,
  IconSearch,
  IconUser,
} from "./icons";

export type ShellCompany = { id: string; name: string; colorTag: string | null; unitCount: number };
export type ShellUnit = { id: string; code: string; name: string };

export type ShellContext = {
  user: { name: string; roleName: string; initials: string };
  company: { id: string; name: string } | null;
  unit: { id: string; code: string; name: string } | null;
  companies: ShellCompany[];
};

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  left: "calc(100% + 8px)",
  top: 0,
  minWidth: 236,
  background: "rgba(253,252,253,.55)",
  backdropFilter: "blur(14px)",
  WebkitBackdropFilter: "blur(14px)",
  border: "1px solid rgba(226,230,222,.7)",
  borderRadius: 11,
  boxShadow: "0 14px 32px rgba(22,32,27,.12)",
  padding: 6,
  zIndex: 41,
};

function PanelArrow() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: -6,
        top: 14,
        width: 11,
        height: 11,
        background: "rgba(253,252,253,.9)",
        borderLeft: "1px solid rgba(226,230,222,.7)",
        borderBottom: "1px solid rgba(226,230,222,.7)",
        borderRadius: "0 0 0 2px",
        transform: "rotate(45deg)",
      }}
    />
  );
}

export default function AppShell({ context, children }: { context: ShellContext; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [userMenu, setUserMenu] = useState(false);
  const [unitMenu, setUnitMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pickedCompany, setPickedCompany] = useState<string | null>(null);
  const [units, setUnits] = useState<ShellUnit[]>([]);
  const shellRef = useRef<HTMLDivElement>(null);

  const activeModule = useMemo(() => findModuleByPath(pathname), [pathname]);
  const activeGroup = useMemo(
    () => MODULE_GROUPS.find((group) => group.items.some((item) => item.key === activeModule?.key))?.key ?? null,
    [activeModule],
  );

  const fullbleed = pathname.startsWith("/email") || pathname.startsWith("/browser");

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) return;
      const target = event.target as HTMLElement;
      if (!target.closest("[data-menu-root]")) {
        setOpenGroup(null);
        setUserMenu(false);
        setUnitMenu(false);
        setSearchOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenGroup(null);
      setUserMenu(false);
      setUnitMenu(false);
      setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Close every popover when the route changes, adjusting state during render
  // rather than in an effect so no extra pass is scheduled.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenGroup(null);
    setUserMenu(false);
    setUnitMenu(false);
    setSearchOpen(false);
  }

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return ALL_MODULES.filter(
      (entry) => entry.label.toLowerCase().includes(query) || entry.screen.toLowerCase().includes(query),
    ).slice(0, 12);
  }, [search]);

  async function loadUnits(companyId: string) {
    setPickedCompany(companyId);
    const res = await fetch(`/api/companies/${companyId}/units`);
    if (res.ok) setUnits((await res.json()) as ShellUnit[]);
  }

  async function chooseUnit(companyId: string, unitId: string) {
    await fetch("/api/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, unitId }),
    });
    setUnitMenu(false);
    setPickedCompany(null);
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={shellRef} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", minHeight: "100vh" }}>
      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", paddingLeft: 44, position: "relative" }}>
        {/* Left system rail */}
        <div
          aria-label={t("Pintasan sistem")}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            width: 44,
            zIndex: 44,
            background: "var(--paper)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "10px 0",
          }}
        >
          <button
            title={t("Asisten AI")}
            aria-label={t("Asisten AI")}
            style={railButton}
            onClick={() => window.alert(t("Asisten AI segera hadir"))}
          >
            <IconAssistant />
          </button>
          <Link href="/dashboard" title={t("Beranda")} aria-label={t("Beranda")} style={railButton}>
            <IconHome />
          </Link>
          <Link href="/browser" title={t("Browser")} aria-label={t("Browser")} style={railButton}>
            <IconGlobe />
          </Link>
          <Link href="/email" title={t("Email")} aria-label={t("Email")} style={railButton}>
            <IconMail />
          </Link>
        </div>

        <div aria-hidden="true" style={{ position: "fixed", left: 44, top: 0, width: 14, height: 14, zIndex: 45, background: "var(--paper)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "fixed", left: 44, top: 0, width: 14, height: 14, zIndex: 45, background: "var(--card)", borderTopLeftRadius: 14, pointerEvents: "none" }} />

        {/* Header */}
        <header
          style={{
            background: "var(--card)",
            borderBottom: "1px solid var(--rule)",
            borderTopLeftRadius: 14,
            padding: "9px 22px 9px 8px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "nowrap",
            position: "sticky",
            top: 0,
            zIndex: 42,
          }}
        >
          <Link
            href="/beranda"
            style={{ display: "flex", alignItems: "center", gap: 6, flex: "none", textDecoration: "none" }}
            aria-label={t("Ke beranda modul")}
          >
            <Image src="/assets/logo-chl.png" alt="Logo CHL Group" width={30} height={28} style={{ height: 28, width: "auto", display: "block" }} />
            <span style={{ display: "block", width: 1, height: 22, background: "var(--rule)" }} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: ".035em",
                textTransform: "uppercase",
                color: "var(--ledger-dk)",
                whiteSpace: "nowrap",
                display: "block",
                maxWidth: 240,
                overflow: "hidden",
                textOverflow: "ellipsis",
                textAlign: "left",
              }}
            >
              {context.company?.name ?? ""}
            </span>
          </Link>

          <div data-menu-root style={{ flex: "1 1 120px", maxWidth: 368, minWidth: 0, marginLeft: -7, position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 11, display: "flex" }}>
              <IconSearch />
            </span>
            <input
              type="text"
              autoComplete="off"
              placeholder={t("Cari layar atau modul…")}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              style={{ width: "100%", paddingLeft: 32, borderRadius: 9, background: "var(--sunk)", fontSize: 12.5 }}
            />
            {searchOpen && searchResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "calc(100% + 8px)",
                  zIndex: 46,
                  background: "rgba(253,252,253,.96)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  border: "1px solid var(--rule)",
                  borderRadius: 11,
                  boxShadow: "0 14px 34px rgba(22,32,27,.16)",
                  padding: 6,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {searchResults.map((entry) => (
                  <button
                    key={`${entry.key}-${entry.href}`}
                    onClick={() => {
                      setSearch("");
                      setSearchOpen(false);
                      router.push(entry.href);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 11px",
                      borderRadius: 7,
                      fontSize: 12.5,
                      color: "var(--ink)",
                    }}
                  >
                    <span className="num" style={{ fontSize: 11, color: "var(--ink4)", minWidth: 26 }}>
                      {entry.screen}
                    </span>
                    <span style={{ fontWeight: 500 }}>{t(entry.label)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
            <button aria-label={t("Bantuan")} style={roundButton}>
              <IconHelp />
            </button>
            <Link href="/persetujuan" aria-label={t("Notifikasi")} style={{ ...roundButton, position: "relative" }}>
              <IconBell />
              <span style={{ position: "absolute", top: 5, right: 6, width: 6, height: 6, borderRadius: "50%", background: "var(--brick)" }} />
            </Link>
            <div style={{ width: 1, height: 22, background: "var(--rule)", margin: "0 3px" }} />

            <div data-menu-root style={{ position: "relative" }}>
              <button
                onClick={() => setUnitMenu((open) => !open)}
                aria-label={t("Perusahaan dan unit aktif")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 10px",
                  width: 160,
                  flex: "none",
                  border: "1px solid var(--rule2)",
                  borderRadius: 9,
                  background: "var(--card)",
                }}
              >
                <span style={{ textAlign: "left", minWidth: 0, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", height: 28 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--ink)",
                      lineHeight: 1.3,
                      textTransform: "uppercase",
                      minWidth: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {context.unit ? context.unit.name : "—"}
                  </span>
                </span>
                <IconChevronDown />
              </button>
              {unitMenu && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "calc(100% + 8px)",
                    display: "grid",
                    gridTemplateColumns: pickedCompany ? "260px 200px" : "260px",
                    gap: 6,
                    background: "rgba(244,246,242,.96)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    border: "1px solid var(--rule)",
                    borderRadius: 12,
                    boxShadow: "0 14px 34px rgba(22,32,27,.16)",
                    padding: 6,
                    zIndex: 44,
                    maxHeight: 360,
                    overflow: "auto",
                  }}
                >
                  <div>
                    <div style={popoverHeading}>{t("Perusahaan")}</div>
                    {context.companies.map((company) => (
                      <button
                        key={company.id}
                        onClick={() => void loadUnits(company.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          textAlign: "left",
                          padding: "7px 10px",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--ink)",
                          background: pickedCompany === company.id ? "var(--ledger-bg)" : "transparent",
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: company.colorTag ?? "var(--ledger)", flex: "none" }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name}</span>
                      </button>
                    ))}
                  </div>
                  {pickedCompany && (
                    <div>
                      <div style={popoverHeading}>{t("Unit Bisnis")}</div>
                      {units.map((unit) => (
                        <button
                          key={unit.id}
                          onClick={() => void chooseUnit(pickedCompany, unit.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            textAlign: "left",
                            padding: "7px 10px",
                            borderRadius: 8,
                            fontSize: 12,
                            color: "var(--ink)",
                          }}
                        >
                          <span className="num" style={{ fontSize: 11, color: "var(--ledger-dk)", fontWeight: 600 }}>
                            {unit.code}
                          </span>
                          <span>{unit.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div data-menu-root style={{ position: "relative" }}>
              <button
                onClick={() => setUserMenu((open) => !open)}
                aria-haspopup="true"
                aria-expanded={userMenu}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 8px 3px 3px", width: 140, flex: "none", borderRadius: 9 }}
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
                  {context.user.initials}
                </span>
                <span style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {context.user.name}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", lineHeight: 1.3, whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t(context.user.roleName)}
                  </span>
                </span>
                <IconChevronDown />
              </button>
              {userMenu && (
                <div
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
                  <Link href="/profil" style={menuItem}>
                    <IconUser />
                    {t("Profil saya")}
                  </Link>
                  <Link href="/setelan" style={menuItem}>
                    <IconGear />
                    {t("Pengaturan")}
                  </Link>
                  <button onClick={() => void logout()} style={{ ...menuItem, color: "var(--brick)", borderTop: "1px solid var(--rule)", marginTop: 3, width: "100%" }}>
                    <IconLogout />
                    {t("Keluar")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "stretch" }}>
          {!fullbleed && (
            <div
              style={{
                background: "#EAF3F8",
                borderRight: "1px solid transparent",
                borderLeft: "2px solid transparent",
                padding: "8px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                position: "sticky",
                top: 49,
                alignSelf: "stretch",
                zIndex: 41,
                width: "max-content",
                minWidth: 0,
                flex: "none",
                minHeight: "calc(100vh - 49px)",
              }}
            >
              {MODULE_GROUPS.map((group) => {
                const Icon = GROUP_ICONS[group.key];
                const isActive = activeGroup === group.key;
                return (
                  <div key={group.key} data-menu-root style={{ position: "relative", flex: "none" }}>
                    <button
                      title={t(group.label)}
                      aria-label={t(group.label)}
                      aria-expanded={openGroup === group.key}
                      onClick={() => setOpenGroup((current) => (current === group.key ? null : group.key))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0,
                        padding: "9px 10px",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink2)",
                        borderLeft: `2px solid ${isActive ? "var(--ledger)" : "transparent"}`,
                        background: isActive ? "rgba(255,255,255,.62)" : "transparent",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Icon
                        style={{
                          flex: "none",
                          strokeWidth: 1.6,
                          filter: "drop-shadow(0 1px 0 rgba(255,255,255,.7)) drop-shadow(0 1px 1.5px rgba(22,32,27,.14))",
                          transition: "transform .18s cubic-bezier(.2,.8,.3,1),filter .18s",
                        }}
                      />
                    </button>
                    {openGroup === group.key && (
                      <div style={PANEL_STYLE}>
                        <PanelArrow />
                        {group.items.map((item) => (
                          <Link
                            key={item.key}
                            href={item.href}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 11px",
                              borderRadius: 7,
                              fontSize: 12.5,
                              fontWeight: 500,
                              color: "var(--ink)",
                              background: activeModule?.key === item.key ? "var(--sunk)" : "transparent",
                              textDecoration: "none",
                            }}
                          >
                            {t(item.label)}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <main
            className={fullbleed ? "fullbleed" : undefined}
            style={
              fullbleed
                ? { flex: 1, minWidth: 0, position: "relative" }
                : {
                    flex: 1,
                    minWidth: 0,
                    position: "relative",
                    padding: "22px 26px 60px",
                    overflowX: "auto",
                    background: "linear-gradient(180deg,#FDFDFD 0%,#F1F4F9 55%,#DEE3EC 100%)",
                  }
            }
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

const railButton: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "grid",
  placeItems: "center",
  borderRadius: 7,
  color: "#8C99A6",
  background: "transparent",
  textDecoration: "none",
};

const roundButton: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  color: "var(--ink3)",
  textDecoration: "none",
};

const menuItem: React.CSSProperties = {
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
  textDecoration: "none",
};

const popoverHeading: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: ".07em",
  textTransform: "uppercase",
  color: "var(--ink4)",
  padding: "4px 10px 6px",
};
