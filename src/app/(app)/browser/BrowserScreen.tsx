"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";

type Tab = {
  id: number;
  title: string;
  badge: string;
  badgeColor: string;
  url: string;
  /** The e-Faktur tab renders the mock portal page; every other tab renders the placeholder pane. */
  kind: "efaktur" | "lain";
};

const INITIAL_TABS: Tab[] = [
  {
    id: 1,
    title: "e-Faktur — DJP Online",
    badge: "DJ",
    badgeColor: "var(--ledger)",
    url: "https://efaktur.pajak.go.id/dashboard",
    kind: "efaktur",
  },
  {
    id: 2,
    title: "Internet Banking",
    badge: "BC",
    badgeColor: "var(--moss)",
    url: "https://ibank.klikbca.com",
    kind: "lain",
  },
  {
    id: 3,
    title: "Referensi PSAK",
    badge: "IA",
    badgeColor: "var(--plum)",
    url: "https://www.iaiglobal.or.id/psak",
    kind: "lain",
  },
];

const BOOKMARKS = [
  { label: "e-Faktur", color: "var(--ledger)", url: "https://efaktur.pajak.go.id" },
  { label: "e-Bupot", color: "var(--moss)", url: "https://ebupot.pajak.go.id" },
  { label: "Kurs Pajak", color: "var(--amber)", url: "https://fiskal.kemenkeu.go.id/informasi-publik/kurs-pajak" },
  { label: "BI Rate", color: "var(--plum)", url: "https://www.bi.go.id/id/statistik/indikator/bi-rate.aspx" },
  { label: "Portal Bank", color: "var(--brick)", url: "https://ibank.klikbca.com" },
];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const roundBtn: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

export default function BrowserScreen({
  companyName,
  npwp,
  userName,
  periodLabel,
}: {
  companyName: string;
  npwp: string;
  userName: string;
  periodLabel: string;
}) {
  const t = useT();
  const toast = useToast();

  const [tabs, setTabs] = useState<Tab[]>(INITIAL_TABS);
  const [activeId, setActiveId] = useState(1);
  const [nextId, setNextId] = useState(4);

  const active = useMemo(() => tabs.find((tab) => tab.id === activeId) ?? tabs[0], [tabs, activeId]);

  function setUrl(url: string) {
    setTabs((current) => current.map((tab) => (tab.id === active?.id ? { ...tab, url } : tab)));
  }

  function navigate(url: string, label: string) {
    setTabs((current) =>
      current.map((tab) => (tab.id === active?.id ? { ...tab, url, title: label, kind: "lain" } : tab)),
    );
    toast(`${t("Membuka")} ${label} — ${t("pratinjau tiruan, tanpa sambungan ke situs asli")}`);
  }

  function closeTab(id: number) {
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== id);
      if (next.length > 0 && id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  function newTab() {
    const tab: Tab = {
      id: nextId,
      title: t("Tab baru"),
      badge: "··",
      badgeColor: "var(--ink3)",
      url: "",
      kind: "lain",
    };
    setTabs((current) => [...current, tab]);
    setActiveId(nextId);
    setNextId((current) => current + 1);
  }

  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: 12,
        overflow: "hidden",
        background: "#DEE4EA",
        boxShadow: "0 2px 10px rgba(22,32,27,.08)",
      }}
    >
      {/* ------------------------------------------------------------ tab bar */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, padding: "8px 10px 0", flex: "none" }}>
        <div style={{ display: "flex", gap: 5, marginRight: 6, paddingBottom: 9, flex: "none" }}>
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#E06C5A" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#E3B341" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#5FA85F" }} />
        </div>

        {tabs.map((tab) => {
          const on = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                maxWidth: 230,
                padding: "8px 12px",
                borderRadius: "9px 9px 0 0",
                background: on ? "var(--card)" : "rgba(255,255,255,.45)",
                fontSize: 12,
                color: on ? "var(--ink)" : "var(--ink2)",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: tab.badgeColor,
                  color: "#fff",
                  fontSize: 8,
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                }}
              >
                {tab.badge}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab.title}</span>
              <span
                role="button"
                aria-label={t("Tutup tab")}
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                style={{ color: "var(--ink4)", flex: "none", padding: "0 3px", borderRadius: 5, cursor: "pointer" }}
              >
                ✕
              </span>
            </button>
          );
        })}

        <button
          type="button"
          aria-label={t("Tab baru")}
          onClick={newTab}
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            display: "grid",
            placeItems: "center",
            color: "var(--ink3)",
            fontSize: 15,
            cursor: "pointer",
            marginBottom: 5,
            flex: "none",
          }}
        >
          +
        </button>
      </div>

      {/* -------------------------------------------------------- address bar */}
      <div
        style={{
          background: "var(--card)",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--rule)",
          flex: "none",
        }}
      >
        <div style={{ display: "flex", gap: 2, flex: "none" }}>
          <button
            type="button"
            aria-label={t("Kembali")}
            onClick={() => toast(t("Tidak ada halaman sebelumnya"))}
            style={{ ...roundBtn, color: "var(--ink2)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button type="button" aria-label={t("Maju")} style={{ ...roundBtn, color: "var(--ink4)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={t("Muat ulang")}
            onClick={() => toast(t("Halaman dimuat ulang"))}
            style={{ ...roundBtn, color: "var(--ink2)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 10-2.3 6.3" />
              <path d="M20 5v6h-6" />
            </svg>
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: "var(--paper)",
            border: "1px solid var(--rule)",
            borderRadius: 999,
            padding: "6px 14px",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
            <rect x="5" y="11" width="14" height="9" rx="1.5" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
          <input
            type="text"
            className="num"
            aria-label={t("Alamat")}
            value={active?.url ?? ""}
            onChange={(event) => setUrl(event.target.value)}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              fontSize: 12,
              height: "auto",
              textAlign: "left",
              flex: 1,
              minWidth: 0,
            }}
          />
          <button
            type="button"
            aria-label={t("Markah")}
            onClick={() => toast(t("Halaman ditambahkan ke markah"))}
            style={{ color: "var(--ink4)", flex: "none", fontSize: 13, cursor: "pointer", padding: "0 2px" }}
          >
            ☆
          </button>
        </div>

        <div style={{ display: "flex", gap: 4, alignItems: "center", flex: "none" }}>
          <button
            type="button"
            aria-label={t("Unduhan")}
            onClick={() => toast(t("Daftar unduhan dibuka"))}
            style={{ ...roundBtn, color: "var(--ink2)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11M8 12l4 4 4-4M5 20h14" />
            </svg>
          </button>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--ledger)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 10.5,
              fontWeight: 600,
            }}
          >
            {initialsOf(userName)}
          </span>
          <button
            type="button"
            aria-label={t("Menu")}
            onClick={() => toast(t("Menu peramban dibuka"))}
            style={{ ...roundBtn, color: "var(--ink2)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5h.01M12 12h.01M12 19h.01" />
            </svg>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------- bookmarks */}
      <div
        style={{
          background: "var(--card)",
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          borderBottom: "1px solid var(--rule)",
          overflowX: "auto",
          flex: "none",
        }}
      >
        {BOOKMARKS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.url, t(item.label))}
            style={{
              fontSize: 11.5,
              color: "var(--ink2)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              cursor: "pointer",
              padding: "3px 6px",
              borderRadius: 6,
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color, flex: "none" }} />
            {t(item.label)}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------- viewport */}
      <div style={{ position: "relative", background: "#fff", flex: 1, minHeight: 460, overflowY: "auto" }}>
        {!active && (
          <div style={{ padding: "56px 30px", textAlign: "center", color: "var(--ink3)", fontSize: 12.5, lineHeight: 1.7 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
              {t("Tidak ada tab terbuka")}
            </div>
            <div>{t("Buka tab baru untuk menampilkan pratinjau portal.")}</div>
          </div>
        )}

        {active && active.kind !== "efaktur" && (
          <div style={{ padding: "56px 30px", textAlign: "center", color: "var(--ink3)", fontSize: 12.5, lineHeight: 1.7 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
              {t("Pratinjau portal tidak ditampilkan di dalam bingkai")}
            </div>
            <div>{t("Banyak portal perbankan dan pajak memblokir penyematan demi keamanan.")}</div>
            <div className="sm muted" style={{ marginTop: 6 }}>
              {t("Layar ini adalah tiruan — tidak ada sambungan ke situs asli.")}
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
              {active.url.startsWith("https://") && (
                <a
                  className="btn btn-primary"
                  href={active.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}
                >
                  {t("Buka Di Tab Peramban Asli")}
                </a>
              )}
              <button
                className="btn"
                onClick={() =>
                  setTabs((current) =>
                    current.map((tab) =>
                      tab.id === active.id
                        ? {
                            ...tab,
                            kind: "efaktur",
                            title: "e-Faktur — DJP Online",
                            badge: "DJ",
                            badgeColor: "var(--ledger)",
                            url: "https://efaktur.pajak.go.id/dashboard",
                          }
                        : tab,
                    ),
                  )
                }
              >
                {t("Kembali Ke Beranda")}
              </button>
            </div>
          </div>
        )}

        {active && active.kind === "efaktur" && (
          <div style={{ minHeight: 460, padding: "26px 30px" }}>
            <div style={{ maxWidth: 940, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  paddingBottom: 14,
                  borderBottom: "2px solid var(--ledger)",
                }}
              >
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    background: "var(--ledger)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    flex: "none",
                  }}
                >
                  DJ
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                    {t("Aplikasi e-Faktur Web")}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                    {companyName} · {npwp}
                  </div>
                </div>
                <span className="chip chip-open" style={{ marginLeft: "auto", flex: "none" }}>
                  {t("Masa")} {periodLabel}
                </span>
              </div>

              <div className="metrics" style={{ margin: 0 }}>
                <div className="metric">
                  <div className="l">{t("Faktur keluaran")}</div>
                  <div className="v">—</div>
                  <div className="d muted">{t("sudah disetujui")}</div>
                </div>
                <div className="metric">
                  <div className="l">{t("Faktur masukan")}</div>
                  <div className="v">—</div>
                  <div className="d muted">{t("siap dikreditkan")}</div>
                </div>
                <div className="metric">
                  <div className="l">{t("PPN kurang bayar")}</div>
                  <div className="v" style={{ color: "var(--amber)" }}>
                    —
                  </div>
                  <div className="d" style={{ color: "var(--amber)" }}>
                    {t("setor sebelum tanggal 15")}
                  </div>
                </div>
                <div className="metric">
                  <div className="l">{t("Status SPT Masa")}</div>
                  <div className="v" style={{ fontSize: 17 }}>
                    —
                  </div>
                  <div className="d muted">{t("belum dilaporkan")}</div>
                </div>
              </div>

              <div style={{ border: "1px solid var(--rule)", borderRadius: 10, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "var(--paper)",
                    borderBottom: "1px solid var(--rule)",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t("Faktur keluaran terakhir")}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink3)" }}>
                    {t("Pratinjau tiruan")}
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ fontSize: 12, minWidth: 720 }}>
                    <thead>
                      <tr>
                        <th style={{ whiteSpace: "nowrap" }}>{t("No. faktur pajak")}</th>
                        <th>{t("Lawan transaksi")}</th>
                        <th style={{ whiteSpace: "nowrap" }}>{t("Tanggal")}</th>
                        <th className="r" style={{ whiteSpace: "nowrap" }}>
                          DPP
                        </th>
                        <th className="r" style={{ whiteSpace: "nowrap" }}>
                          PPN
                        </th>
                        <th style={{ whiteSpace: "nowrap" }}>{t("Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={6} className="sm muted" style={{ padding: "18px 12px" }}>
                          {t("Belum ada data faktur")}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="bal">
                  <span className="k">{t("0 dari 0 faktur ditampilkan")}</span>
                  <span className="k">{t("Total PPN keluaran")}</span>
                  <span className="v num">—</span>
                  <span style={{ marginLeft: "auto" }}>
                    <button className="btn btn-sm" onClick={() => toast(t("Berkas CSV faktur keluaran diunduh"))}>
                      {t("Unduh CSV")}
                    </button>
                  </span>
                </div>
              </div>

              <div className="note">
                {t("Berkas CSV yang diunduh dari portal ini bisa langsung dipakai di layar Import Mutasi untuk mencocokkan PPN keluaran dengan jurnal penjualan.")}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bal" style={{ borderTop: "1px solid var(--rule)", background: "var(--paper)", flex: "none" }}>
        <span className="k">{t("Tersambung · sertifikat sah")}</span>
        <span className="k" style={{ marginLeft: "auto" }}>
          {tabs.length} {t("tab terbuka")}
        </span>
      </div>
    </div>
  );
}
