"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import SettingsDialog from "@/components/ui/SettingsDialog";
import {
  BackdropWaves,
  GROUP_ICONS,
  IconBell,
  IconChevronDown,
  IconGear,
  IconHelp,
  IconLogout,
  IconManajemen,
  IconSearch,
} from "@/components/shell/icons";
import { useT } from "@/i18n/LocaleProvider";
import {
  MODULE_GROUPS,
  ALL_MODULES,
  SHORTCUT_GROUPS,
  SHORTCUT_DEFAULTS,
  MAX_SHORTCUTS,
  type ModuleEntry,
  type ModuleGroup,
} from "@/lib/navigation";
import { MONTHS_ID, titleCase } from "@/lib/format";

export type BerandaTodo = { key: string; href: string; count: number; label: string; tone: "bad" | "warn" };

/** One selectable module inside the shortcut picker. */
function ModuleCheck({
  entry,
  draft,
  toggle,
  t,
}: {
  entry: ModuleEntry;
  draft: string[];
  toggle: (key: string) => void;
  t: (text: string) => string;
}) {
  return (
    <label
      className="tile"
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12.5 }}
    >
      <input
        type="checkbox"
        checked={draft.includes(entry.key)}
        onChange={() => toggle(entry.key)}
        style={{ width: 15, height: 15, flex: "none" }}
      />
      {t(entry.label)}
    </label>
  );
}

/** Each shortcut tile takes the icon of the menu group the module sits under. */
const groupOfModule = new Map(
  MODULE_GROUPS.flatMap((group) => group.items.map((item) => [item.key, group.key] as const)),
);

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

export default function BerandaScreen({
  company,
  unit,
  user,
  todos,
  shortcuts,
  companies,
  unitsByCompany,
}: {
  company: { id: string; name: string };
  unit: { id: string; code: string; name: string };
  user: { name: string; email: string; roleName: string; initials: string };
  todos: BerandaTodo[];
  shortcuts: string[];
  companies: Array<{ id: string; name: string; colorTag: string | null; unitCount: number }>;
  unitsByCompany: Record<string, Array<{ id: string; code: string; name: string }>>;
}) {
  const router = useRouter();
  const t = useT();

  const [userMenu, setUserMenu] = useState(false);
  const [settings, setSettings] = useState(false);
  /** The picker edits a copy, so Batal can leave the saved list untouched. */
  const [draft, setDraft] = useState<string[]>(shortcuts);
  const [openPickerGroup, setOpenPickerGroup] = useState<ModuleGroup | null>(null);
  const [moduleQuery, setModuleQuery] = useState("");
  const [pickerError, setPickerError] = useState("");
  const [openTab, setOpenTab] = useState<string | null>(null);
  const [stamp, setStamp] = useState("");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(shortcuts);
  const [query, setQuery] = useState("");
  const [switchOpen, setSwitchOpen] = useState(false);
  const [pickedCompany, setPickedCompany] = useState<string | null>(null);
  const [units, setUnits] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setStamp(`Login ${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()} · ${hh}:${mm} WIB`);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-menu-root]")) {
        setOpenTab(null);
        setSwitchOpen(false);
        setUserMenu(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const tiles = useMemo(
    () => selected.map((key) => ALL_MODULES.find((entry) => entry.key === key)).filter((entry) => entry !== undefined),
    [selected],
  );

  const moduleHits = useMemo(() => {
    const needle = moduleQuery.trim().toLowerCase();
    if (!needle) return [];
    return SHORTCUT_GROUPS.flatMap((group) => group.items).filter((entry) =>
      `${entry.label} ${entry.hint ?? ""}`.toLowerCase().includes(needle),
    );
  }, [moduleQuery]);

  const searchHits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return companies.filter((item) => item.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [companies, query]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function openPicker() {
    setDraft(selected);
    setOpenPickerGroup(null);
    setModuleQuery("");
    setPickerError("");
    setEditing(true);
  }

  function closePicker() {
    setEditing(false);
  }

  function toggleModule(key: string) {
    setPickerError("");
    setDraft((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      if (current.length >= MAX_SHORTCUTS) {
        setPickerError(`Pintasan maksimal ${MAX_SHORTCUTS} modul — lepas salah satu dulu.`);
        return current;
      }
      return [...current, key];
    });
  }

  async function saveShortcuts(keys: string[]) {
    setSelected(keys);
    setEditing(false);
    await fetch("/api/shortcuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    });
  }

  function loadUnits(companyId: string) {
    setPickedCompany(companyId);
    setUnits(unitsByCompany[companyId] ?? []);
  }

  async function switchTo(companyId: string, unitId: string) {
    await fetch("/api/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, unitId }),
    });
    setSwitchOpen(false);
    setPickedCompany(null);
    setQuery("");
    router.refresh();
  }

  return (
    <div
      ref={rootRef}
      className="noscrollbar"
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

      {/* Three columns: the menu card sits low on the left, the book sits in
          the middle, and the shortcut list runs down the right. */}
      <div className="beranda-row" style={{ width: "100%", maxWidth: 1400, margin: "auto", display: "flex", gap: 16, alignItems: "stretch" }}>
        <div className="beranda-nav" style={{ flex: "0 0 424px", minWidth: 0, display: "flex", alignItems: "flex-end" }}>
        <div
          style={{
            background: "var(--card)",
            borderRadius: 14,
            boxShadow: "0 6px 20px rgba(22,32,27,.12)",
            position: "relative",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "12px 20px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, order: 1, alignSelf: "flex-end" }}>
              <button aria-label={t("Bantuan")} style={{ color: "var(--ink3)", display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8 }}>
                <IconHelp />
              </button>
              <Link
                href="/persetujuan"
                aria-label={t("Notifikasi")}
                style={{ color: "var(--ink3)", display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 8 }}
              >
                <IconBell />
              </Link>
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
                      zIndex: 46,
                    }}
                  >
                    <Link href="/perusahaan" role="menuitem" style={{ ...userMenuItem, textDecoration: "none" }}>
                      {t("Perusahaan")}
                    </Link>
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

            <div data-menu-root style={{ width: "100%", position: "relative", display: "flex", alignItems: "center", order: 3 }}>
              <span style={{ position: "absolute", left: 11, zIndex: 1, display: "flex" }}>
                <IconSearch size={15} />
              </span>
              <input
                type="text"
                autoComplete="off"
                placeholder={t("Cari Perusahaan…")}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSwitchOpen(true);
                  setPickedCompany(null);
                }}
                onFocus={() => setSwitchOpen(true)}
                style={{ paddingLeft: 32, borderRadius: 9, background: "var(--paper)" }}
              />
              {switchOpen && searchHits.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "calc(100% + 8px)",
                    zIndex: 45,
                    background: "rgba(253,252,253,.96)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid rgba(226,230,222,.9)",
                    borderRadius: 12,
                    boxShadow: "0 16px 38px rgba(22,32,27,.20)",
                    width: pickedCompany ? "min(620px,86vw)" : "100%",
                    display: "grid",
                    gridTemplateColumns: pickedCompany ? "minmax(0,1fr) minmax(0,1fr)" : "minmax(0,1fr)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ borderRight: pickedCompany ? "1px solid rgba(226,230,222,.9)" : "none", padding: 6 }}>
                    {searchHits.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadUnits(item.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 11px",
                          borderRadius: 8,
                          fontSize: 12.5,
                          background: pickedCompany === item.id ? "var(--ledger-bg)" : "transparent",
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: item.colorTag ?? "var(--ledger)", flex: "none" }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</span>
                        <span className="num" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink3)" }}>
                          {item.unitCount} {t("unit")}
                        </span>
                      </button>
                    ))}
                  </div>
                  {pickedCompany && (
                    <div style={{ padding: 6 }}>
                      {units.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => void switchTo(pickedCompany, item.id)}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 11px", borderRadius: 8, fontSize: 12.5 }}
                        >
                          <span className="num" style={{ fontSize: 11, fontWeight: 600, color: "var(--ledger-dk)" }}>
                            {item.code}
                          </span>
                          <span>{item.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--rule)", padding: "0 10px", display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
            {MODULE_GROUPS.map((group) => (
              <div key={group.key} data-menu-root style={{ position: "relative" }}>
                <button
                  onClick={() => setOpenTab((current) => (current === group.key ? null : group.key))}
                  aria-expanded={openTab === group.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "10px 14px",
                    borderRadius: "9px 9px 0 0",
                    color: openTab === group.key ? "var(--ink)" : "var(--ink2)",
                    background: openTab === group.key ? "var(--paper)" : "transparent",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {t(group.label)}
                  <IconChevronDown size={13} stroke="currentColor" />
                </button>
              </div>
            ))}
          </div>

          {openTab && (
            <div style={{ borderTop: "1px solid var(--rule)", background: "var(--paper)", padding: "16px 18px", borderRadius: "0 0 14px 14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 18 }}>
                {MODULE_GROUPS.filter((group) => group.key === openTab).map((group) => (
                  <div key={group.key}>
                    <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ink4)", padding: "0 10px 7px" }}>
                      {t(group.label)}
                    </div>
                    {group.items.map((item) => (
                      <Link key={item.key} href={item.href} className="tile" style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 7, textDecoration: "none" }}>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>{t(item.label)}</span>
                        {item.hint && <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", marginTop: 1 }}>{t(item.hint)}</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>

        <div className="beranda-main" style={{ flex: "1 1 0", minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,1fr)", gap: 26, background: "var(--card)", borderRadius: 14, boxShadow: "0 6px 20px rgba(22,32,27,.12)", padding: "26px 24px", alignItems: "start", alignContent: "start" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Selamat Datang Kembali :")}</div>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1.2, marginTop: 6, textTransform: "uppercase", color: "var(--ink)" }}>
              {company.name}
            </div>
            <div className="num" style={{ fontSize: 13, color: "var(--ledger-dk)", marginTop: 5, textTransform: "uppercase" }}>
              {unit.code} · {unit.name}
            </div>
            <div style={{ width: 52, height: 3, background: "var(--ledger)", borderRadius: 2, marginTop: 14 }} />
            <p style={{ fontSize: 13.5, color: "var(--ink2)", marginTop: 14, maxWidth: 420, textWrap: "pretty" }}>
              {t("Pilih modul di baris menu untuk mulai membukukan, atau lanjutkan dari pekerjaan yang belum selesai di buku ini.")}
            </p>
            <div className="num" style={{ fontSize: 11.5, color: "var(--ink4)", marginTop: 14 }}>
              {stamp}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ borderRadius: 12, padding: "16px 18px", background: "var(--paper)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em" }}>{t("Perlu Dikerjakan Di Buku Ini")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
                {todos.length === 0 && <span className="sm muted">{t("Tidak ada pekerjaan tertunda di buku ini.")}</span>}
                {todos.map((todo) => (
                  <Link
                    key={todo.key}
                    href={todo.href}
                    className="tile"
                    style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "3px 4px", borderRadius: 7, fontSize: 12.5, color: "var(--ink2)", textDecoration: "none" }}
                  >
                    <span className={`chip ${todo.tone === "bad" ? "chip-bad" : "chip-warn"}`} style={{ flex: "none" }}>
                      {todo.count}
                    </span>
                    <span>{t(todo.label)}</span>
                  </Link>
                ))}
              </div>
              <Link href="/rekonsiliasi" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 13, fontSize: 12.5, fontWeight: 600, color: "var(--ledger-dk)", textDecoration: "none" }}>
                {t("Buka Rekonsiliasi")} →
              </Link>
            </div>

            <div style={{ borderRadius: 12, padding: "16px 18px", background: "var(--amber-bg)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.01em", color: "var(--amber)" }}>
                {t("Laporan Untuk Bank & Investor")}
              </div>
              <p style={{ fontSize: 12.5, color: "var(--amber)", marginTop: 6, lineHeight: 1.5, textWrap: "pretty" }}>
                {t("Susun paket laporan dari angka buku yang sudah terkunci, lalu ajukan ke Administrator untuk disetujui sebelum diekspor.")}
              </p>
              <Link href="/laporan-khusus" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 11, fontSize: 12.5, fontWeight: 600, color: "var(--amber)", textDecoration: "none" }}>
                {t("Buka Laporan Khusus")} →
              </Link>
            </div>
          </div>
        </div>

        <aside className="beranda-side" style={{ flex: "0 0 336px", minWidth: 0, alignSelf: "start", background: "var(--card)", borderRadius: 14, boxShadow: "0 6px 20px rgba(22,32,27,.12)", padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink4)" }}>
              {t("Daftar Modul")}
            </span>
            <button
              onClick={openPicker}
              style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 500, color: "var(--ledger-dk)", padding: "3px 8px", borderRadius: 7 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4l10-10-4-4L4 16z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
              {t("Edit")}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 10 }}>
            {tiles.map((entry) => {
              const Icon = GROUP_ICONS[groupOfModule.get(entry.key) ?? ""] ?? IconManajemen;
              return (
                <Link
                  key={entry.key}
                  href={entry.href}
                  className="qtile"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    padding: "13px 14px",
                    borderRadius: 11,
                    textAlign: "left",
                    border: "1px solid var(--rule)",
                    background: "var(--card)",
                    textDecoration: "none",
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "var(--sunk)",
                      display: "grid",
                      placeItems: "center",
                      flex: "none",
                    }}
                  >
                    <Icon size={16} stroke="var(--ledger-dk)" />
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t(entry.label)}</span>
                    {entry.hint && <span style={{ display: "block", fontSize: 11.5, color: "var(--ink3)", marginTop: 2, lineHeight: 1.45 }}>{t(entry.hint)}</span>}
                  </span>
                </Link>
              );
            })}
            {tiles.length === 0 && <span className="sm muted">{t("Belum ada pintasan. Klik Edit untuk memilih modul.")}</span>}
          </div>

          <div
            className="legend"
            style={{ borderTop: "1px solid var(--rule)", marginTop: 14, paddingTop: 12, gap: 16, alignItems: "center" }}
          >
            <span style={{ flexBasis: "100%", lineHeight: 1.5, display: "block" }}>
              {t("Modul Akuntansi - Internal")}
              <br />
              <span style={{ display: "inline-block", marginTop: 1 }}>
                {t("Pilih Jalan Pintas sesuai dengan Modul yang mau di tampilkan")}
              </span>
            </span>
            <span>
              <i style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8A317" }} />
              <span>
                {todos.filter((todo) => todo.tone === "warn").reduce((sum, todo) => sum + todo.count, 0)} {t("Modul Perlu Dikerjakan")}
              </span>
            </span>
            <span>
              <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#C0392B", boxShadow: "0 0 0 3px rgba(192,57,43,.18)" }} />
              <span style={{ fontWeight: 600, color: "#A32E22" }}>
                {todos.filter((todo) => todo.tone === "bad").reduce((sum, todo) => sum + todo.count, 0)} {t("Modul Masih Selisih")}
              </span>
            </span>
            <span style={{ marginLeft: "auto" }}>{t("Versi Beta")}</span>
          </div>
        </aside>
      </div>

      <Dialog
        open={editing}
        onClose={closePicker}
        title={t("Pilih Modul")}
        badge={`${draft.length} ${t("dari")} ${MAX_SHORTCUTS} ${t("dipilih")}`}
        maxWidth={460}
        footer={
          <>
            <button className="btn" style={{ marginRight: "auto" }} onClick={() => setDraft(SHORTCUT_DEFAULTS)}>
              {t("Default")}
            </button>
            <button className="btn" onClick={closePicker}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" onClick={() => void saveShortcuts(draft)}>
              {t("Simpan")}
            </button>
          </>
        }
      >
        {draft.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {draft.map((key) => {
              const entry = ALL_MODULES.find((module) => module.key === key);
              if (!entry) return null;
              return (
                <span key={key} className="chip chip-open" style={{ gap: 7 }}>
                  {t(entry.label)}
                  <button
                    onClick={() => setDraft((current) => current.filter((item) => item !== key))}
                    aria-label={`${t("Hapus")} ${t(entry.label)}`}
                    style={{ color: "inherit", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
            <IconSearch size={14} />
          </span>
          <input
            type="text"
            autoComplete="off"
            placeholder={t("Cari modul…")}
            value={moduleQuery}
            onChange={(event) => setModuleQuery(event.target.value)}
            style={{ paddingLeft: 33, width: "100%", borderRadius: 9, background: "var(--paper)", fontSize: 12.5 }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          {moduleQuery.trim() ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {moduleHits.length === 0 && <span className="sm muted">{t("Modul tidak ditemukan.")}</span>}
              {moduleHits.map((entry) => (
                <ModuleCheck key={entry.key} entry={entry} draft={draft} toggle={toggleModule} t={t} />
              ))}
            </div>
          ) : openPickerGroup ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <button
                  onClick={() => setOpenPickerGroup(null)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--ledger-dk)", padding: "4px 9px", borderRadius: 7 }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                  {t("Kembali")}
                </button>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{t(openPickerGroup.label)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {openPickerGroup.items.map((entry) => (
                  <ModuleCheck key={entry.key} entry={entry} draft={draft} toggle={toggleModule} t={t} />
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {SHORTCUT_GROUPS.map((group) => {
                const picked = group.items.filter((entry) => draft.includes(entry.key)).length;
                return (
                  <button
                    key={group.key}
                    onClick={() => setOpenPickerGroup(group)}
                    className="qtile"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      width: "100%",
                      textAlign: "left",
                      padding: "11px 12px",
                      borderRadius: 9,
                      border: "1px solid var(--rule)",
                      background: "var(--card)",
                    }}
                  >
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{t(group.label)}</span>
                      <span style={{ display: "block", fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>{t(group.summary)}</span>
                    </span>
                    {picked > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, background: "#DCE9F1", color: "#1F5E80", flex: "none" }}>
                        {picked}
                      </span>
                    )}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="note" style={{ marginTop: 12 }}>
          {t("Pilih maksimal 5 modul dari kelompok mana pun — boleh kurang atau tidak sama sekali. Tombol Default mengembalikan ke Dashboard, Email, dan Browser.")}
        </div>

        {pickerError && (
          <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 8, fontSize: 12, background: "var(--brick-bg)", color: "var(--brick)" }}>
            {pickerError}
          </div>
        )}
      </Dialog>

      <SettingsDialog
        open={settings}
        onClose={() => setSettings(false)}
        user={{ name: user.name, email: user.email, initials: user.initials }}
      />

      <style>{`
        .qtile:hover{border-color:var(--ledger)!important;background:var(--ledger-bg)!important}
        .tile:hover{background:var(--sunk)}
        @media(max-width:1280px){
          .beranda-row{flex-wrap:wrap}
          .beranda-nav{flex:1 1 380px}
          .beranda-side{flex:1 1 320px}
          .beranda-main{flex:1 1 100%;order:-1}
        }
        @media(max-width:820px){
          .beranda-main{grid-template-columns:minmax(0,1fr)}
        }
      `}</style>
    </div>
  );
}
