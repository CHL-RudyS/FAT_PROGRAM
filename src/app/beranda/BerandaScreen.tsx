"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { BackdropWaves, IconChevronDown, IconSearch } from "@/components/shell/icons";
import { useT } from "@/i18n/LocaleProvider";
import { MODULE_GROUPS, ALL_MODULES } from "@/lib/navigation";
import { MONTHS_ID } from "@/lib/format";

export type BerandaTodo = { key: string; href: string; count: number; label: string; tone: "bad" | "warn" };

export default function BerandaScreen({
  company,
  unit,
  todos,
  shortcuts,
  companies,
}: {
  company: { id: string; name: string };
  unit: { id: string; code: string; name: string };
  todos: BerandaTodo[];
  shortcuts: string[];
  companies: Array<{ id: string; name: string; colorTag: string | null; unitCount: number }>;
}) {
  const router = useRouter();
  const t = useT();

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
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const tiles = useMemo(
    () => selected.map((key) => ALL_MODULES.find((entry) => entry.key === key)).filter((entry) => entry !== undefined),
    [selected],
  );

  const searchHits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return companies.filter((item) => item.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [companies, query]);

  async function saveShortcuts(keys: string[]) {
    setSelected(keys);
    await fetch("/api/shortcuts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    });
  }

  async function loadUnits(companyId: string) {
    setPickedCompany(companyId);
    const res = await fetch(`/api/companies/${companyId}/units`);
    if (res.ok) setUnits((await res.json()) as Array<{ id: string; code: string; name: string }>);
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

      <div style={{ width: "100%", maxWidth: 1180, margin: "auto", display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-end" }}>
        <div
          style={{
            background: "var(--card)",
            borderRadius: 14,
            boxShadow: "0 6px 20px rgba(22,32,27,.12)",
            position: "relative",
            width: "57.5%",
            minWidth: 391,
            marginRight: 22,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "12px 20px 16px" }}>
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
                        onClick={() => void loadUnits(item.id)}
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

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 420px", gap: 26, width: "100%", background: "var(--card)", borderRadius: 14, boxShadow: "0 6px 20px rgba(22,32,27,.12)", padding: "26px 24px", alignItems: "start" }}>
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

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ border: "1px solid var(--rule)", borderRadius: 12, padding: "14px 16px", background: "var(--paper)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "-.01em" }}>{t("Perlu Dikerjakan Di Buku Ini")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                {todos.length === 0 && <span className="sm muted">{t("Tidak ada pekerjaan tertunda di buku ini.")}</span>}
                {todos.map((todo) => (
                  <Link
                    key={todo.key}
                    href={todo.href}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 8px", borderRadius: 8, fontSize: 12.5, color: "var(--ink)", textDecoration: "none" }}
                  >
                    <span className={`chip ${todo.tone === "bad" ? "chip-bad" : "chip-warn"}`}>{todo.count}</span>
                    <span>{t(todo.label)}</span>
                  </Link>
                ))}
              </div>
              <Link href="/rekonsiliasi" style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, fontWeight: 500, color: "var(--ledger-dk)", textDecoration: "none" }}>
                {t("Buka Rekonsiliasi")} →
              </Link>
            </div>

            <div style={{ border: "1px solid var(--rule)", borderRadius: 12, padding: "14px 16px", background: "var(--paper)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "-.01em" }}>{t("Laporan Untuk Bank & Investor")}</div>
              <p style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6, lineHeight: 1.5 }}>
                {t("Susun paket laporan dari angka buku yang sudah terkunci, lalu ajukan ke Administrator untuk disetujui sebelum diekspor.")}
              </p>
              <Link href="/laporan-khusus" style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, fontWeight: 500, color: "var(--ledger-dk)", textDecoration: "none" }}>
                {t("Buka Laporan Khusus")} →
              </Link>
            </div>
          </div>
        </div>

        <div style={{ width: "100%", background: "var(--card)", borderRadius: 14, boxShadow: "0 6px 20px rgba(22,32,27,.12)", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "-.01em", textTransform: "uppercase" }}>{t("Daftar Modul")}</span>
            <button
              onClick={() => setEditing(true)}
              style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 500, color: "var(--ledger-dk)", padding: "3px 8px", borderRadius: 7 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4l10-10-4-4L4 16z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
              {t("Edit")}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
            {tiles.map((entry) => (
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
                <span style={{ color: "var(--ledger)", flex: "none", marginTop: 1 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="16" rx="1" />
                    <path d="M7 9h10M7 13h6M7 17h8" />
                  </svg>
                </span>
                <span>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{t(entry.label)}</span>
                  {entry.hint && <span style={{ display: "block", fontSize: 11.5, color: "var(--ink3)", marginTop: 2, lineHeight: 1.45 }}>{t(entry.hint)}</span>}
                </span>
              </Link>
            ))}
            {tiles.length === 0 && <span className="sm muted">{t("Belum ada pintasan. Klik Edit untuk memilih modul.")}</span>}
          </div>
        </div>

        <div className="legend" style={{ width: "100%" }}>
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
      </div>

      <Dialog
        open={editing}
        onClose={() => setEditing(false)}
        title={t("Atur Pintasan Modul")}
        maxWidth={620}
        footer={
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setEditing(false)}>
            {t("Selesai")}
          </button>
        }
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
          {ALL_MODULES.filter((entry) => entry.hint).map((entry) => {
            const on = selected.includes(entry.key);
            return (
              <label key={entry.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, padding: "6px 8px", borderRadius: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    void saveShortcuts(on ? selected.filter((key) => key !== entry.key) : [...selected, entry.key])
                  }
                  style={{ width: "auto" }}
                />
                <span>{t(entry.label)}</span>
              </label>
            );
          })}
        </div>
      </Dialog>

      <style>{`.qtile:hover{border-color:var(--ledger)!important;background:var(--ledger-bg)!important}.tile:hover{background:var(--sunk)}`}</style>
    </div>
  );
}
