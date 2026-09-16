"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";

export type MailRow = {
  id: string;
  folder: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  dayGroup: string;
  timeLabel: string;
  fullLabel: string;
};

type Tab = "beranda" | "kirim" | "folder" | "tampilan" | "pengaturan";

const TABS: { key: Tab; label: string }[] = [
  { key: "beranda", label: "Beranda" },
  { key: "kirim", label: "Kirim / Terima" },
  { key: "folder", label: "Folder" },
  { key: "tampilan", label: "Tampilan" },
  { key: "pengaturan", label: "Pengaturan" },
];

/** Day-group headers of the message list, in the prototype's order. */
const DAY_GROUPS = ["Hari ini", "Kemarin", "Minggu lalu", "Lebih lama"];

const emptyCompose = {
  to: "",
  cc: "",
  priority: "Normal",
  subject: "",
  body: "",
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ------------------------------------------------------------------ ribbon */

function RibbonGroup({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 12px",
        borderRight: last ? undefined : "1px solid var(--rule)",
      }}
    >
      {children}
      <div style={{ fontSize: 10, color: "var(--ink4)", padding: "4px 0 6px" }}>{label}</div>
    </div>
  );
}

function RibbonBig({
  icon,
  label,
  width,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  width: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 5,
        width,
        padding: "6px 4px",
        borderRadius: 8,
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "var(--ink4)" : "var(--ink)",
      }}
    >
      {icon}
      <span style={{ fontSize: 11, lineHeight: 1.25, textAlign: "center" }}>{label}</span>
    </button>
  );
}

function RibbonSm({
  icon,
  label,
  disabled,
  onClick,
  radius = 7,
  size = 11.5,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  radius?: number;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: size > 11.5 ? 8 : 7,
        padding: size > 11.5 ? "5px 9px" : "4px 8px",
        borderRadius: radius,
        fontSize: size,
        color: disabled ? "var(--ink4)" : "var(--ink)",
        cursor: disabled ? "default" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

const svg = (
  props: { w?: number; stroke?: string; sw?: number; cap?: "round"; join?: "round" },
  paths: React.ReactNode,
) => (
  <svg
    width={props.w ?? 14}
    height={props.w ?? 14}
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.stroke ?? "currentColor"}
    strokeWidth={props.sw ?? 1.7}
    strokeLinecap={props.cap}
    strokeLinejoin={props.join}
    aria-hidden="true"
  >
    {paths}
  </svg>
);

/* ------------------------------------------------------------------- screen */

export default function EmailScreen({
  messages,
  accountName,
  accountEmail,
  companyName,
}: {
  messages: MailRow[];
  accountName: string;
  accountEmail: string;
  companyName: string;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("beranda");
  const [folder, setFolder] = useState("masuk");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [form, setForm] = useState(emptyCompose);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const unreadByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const message of messages) {
      if (message.isRead) continue;
      counts[message.folder] = (counts[message.folder] ?? 0) + 1;
    }
    return counts;
  }, [messages]);

  const inFolder = useMemo(
    () => messages.filter((message) => message.folder === folder),
    [messages, folder],
  );

  const listed = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inFolder.filter((message) => {
      if (unreadOnly && message.isRead) return false;
      if (!needle) return true;
      return `${message.fromName} ${message.subject} ${message.body}`.toLowerCase().includes(needle);
    });
  }, [inFolder, unreadOnly, search]);

  const grouped = useMemo(() => {
    const buckets = DAY_GROUPS.map((name) => ({
      name,
      items: listed.filter((message) => message.dayGroup === name),
    }));
    return buckets.filter((bucket) => bucket.items.length > 0);
  }, [listed]);

  const selected = useMemo(
    () => listed.find((message) => message.id === selectedId) ?? listed[0] ?? null,
    [listed, selectedId],
  );

  async function patch(id: string, data: { isRead?: boolean; isStarred?: boolean; folder?: string }) {
    const res = await fetch("/api/mail", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    if (res.ok) router.refresh();
    return res.ok;
  }

  function openMessage(message: MailRow) {
    setSelectedId(message.id);
    if (!message.isRead) void patch(message.id, { isRead: true });
  }

  function requireSelection() {
    if (!selected) {
      toast(t("Pilih pesan terlebih dahulu"));
      return null;
    }
    return selected;
  }

  async function moveSelected(target: string, message: string) {
    const current = requireSelection();
    if (!current) return;
    if (await patch(current.id, { folder: target })) toast(t(message));
  }

  async function toggleStar() {
    const current = requireSelection();
    if (!current) return;
    if (await patch(current.id, { isStarred: !current.isStarred })) {
      toast(current.isStarred ? t("Tanda dilepas") : t("Tandai pesan dengan label"));
    }
  }

  async function markFolderRead() {
    const unread = inFolder.filter((message) => !message.isRead);
    if (unread.length === 0) {
      toast(t("Tidak ada pesan belum dibaca"));
      return;
    }
    await Promise.all(unread.map((message) => patch(message.id, { isRead: true })));
    toast(t("Semua pesan ditandai sudah dibaca"));
  }

  function updateForm(field: keyof typeof emptyCompose, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  }

  async function send(draft: boolean) {
    if (!form.to.trim()) {
      setError(t("Alamat tujuan harus diisi."));
      return;
    }
    if (!form.subject.trim()) {
      setError(t("Subjek harus diisi."));
      return;
    }
    if (!form.body.trim()) {
      setError(t("Isi pesan harus diisi."));
      return;
    }

    setBusy(true);
    const res = await fetch("/api/mail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, draft }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? t("Pesan gagal disimpan."));
      return;
    }

    setCompose(false);
    setForm(emptyCompose);
    setFolder(draft ? "draf" : "terkirim");
    setSelectedId(null);
    toast(draft ? t("Pesan disimpan di folder Draf") : t("Pesan terkirim"));
    router.refresh();
  }

  /** One folder row of the left pane. Rendered inline so the pane keeps the prototype's order. */
  function folderButton(id: string, label: string, indent: number, countColor?: string) {
    const on = folder === id;
    const count = unreadByFolder[id] ?? 0;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          setFolder(id);
          setSelectedId(null);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          textAlign: "left",
          padding: `6px 14px 6px ${indent}px`,
          fontSize: 12.5,
          fontWeight: on ? 600 : undefined,
          color: on ? "var(--ledger-dk)" : "var(--ink2)",
          background: on ? "#DCE9F1" : undefined,
          cursor: "pointer",
        }}
      >
        {t(label)}
        {count > 0 && (
          <span
            className="num"
            style={{ marginLeft: "auto", fontSize: 11, color: on ? undefined : countColor ?? "var(--ink4)" }}
          >
            {count}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: 12,
        overflow: "hidden",
        background: "var(--paper)",
        boxShadow: "0 2px 10px rgba(22,32,27,.06)",
      }}
    >
      {/* ---------------------------------------------------------- tab strip */}
      <div
        style={{
          overflowX: "auto",
          display: "flex",
          gap: 2,
          padding: "0 10px",
          background: "var(--paper)",
          borderBottom: "1px solid var(--rule)",
          flex: "none",
        }}
      >
        {TABS.map((item) => {
          const on = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                padding: "9px 14px",
                fontSize: 12.5,
                fontWeight: on ? 600 : undefined,
                color: on ? "var(--ledger-dk)" : "var(--ink2)",
                borderBottom: `2px solid ${on ? "var(--ledger)" : "transparent"}`,
                cursor: "pointer",
              }}
            >
              {t(item.label)}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------ ribbon beranda */}
      {tab === "beranda" && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            padding: "8px 4px 0",
            background: "var(--card)",
            borderBottom: "1px solid var(--rule)",
            overflowX: "auto",
            flex: "none",
          }}
        >
          <RibbonGroup label={t("Baru")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={62}
                onClick={() => setCompose(true)}
                label={
                  <>
                    {t("Email")}
                    <br />
                    {t("Baru")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.6, join: "round" }, <>
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <path d="M3 6l9 7 9-7" />
                </>)}
              />
              <RibbonBig
                width={62}
                onClick={() => toast(t("Pilih jenis item baru"))}
                label={
                  <>
                    {t("Item")}
                    <br />
                    {t("Baru")} ⌄
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.6, join: "round" }, <>
                  <rect x="2" y="6" width="14" height="11" rx="1" />
                  <path d="M8 6V4h14v11h-2" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Hapus")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                <RibbonSm
                  disabled
                  label={t("Abaikan")}
                  icon={svg({ sw: 1.6, join: "round" }, <>
                    <rect x="4" y="5" width="16" height="14" rx="1" />
                    <path d="M8 9l8 6M16 9l-8 6" />
                  </>)}
                />
                <RibbonSm
                  disabled
                  label={`${t("Bersihkan")} ⌄`}
                  icon={svg({ sw: 1.6, join: "round" }, <>
                    <rect x="3" y="6" width="18" height="12" rx="1" />
                    <path d="M3 7l9 6 9-6" />
                  </>)}
                />
                <RibbonSm
                  onClick={() => toast(t("Pengirim dimasukkan ke daftar sampah"))}
                  label={`${t("Sampah")} ⌄`}
                  icon={svg({ stroke: "var(--brick)", sw: 1.6, cap: "round" }, <>
                    <circle cx="10" cy="8" r="3.2" />
                    <path d="M3 19c0-3 3-5 7-5M16 15l5 5M21 15l-5 5" />
                  </>)}
                />
              </div>
              <RibbonBig
                width={58}
                onClick={() => void moveSelected("sampah", "Pesan dipindahkan ke Sampah")}
                label={t("Hapus")}
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.6, cap: "round", join: "round" },
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
                )}
              />
              <RibbonBig
                width={58}
                onClick={() => void moveSelected("audit", "Pesan diarsipkan")}
                label={t("Arsip")}
                icon={svg({ w: 26, stroke: "var(--moss)", sw: 1.6, join: "round" }, <>
                  <rect x="3" y="4" width="18" height="4" rx="1" />
                  <path d="M5 8v12h14V8M10 12h4" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Tanggapi")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
              <RibbonSm
                onClick={() => setCompose(true)}
                label={t("Balas")}
                icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                  <path d="M9 7L4 12l5 5" />
                  <path d="M4 12h9a7 7 0 017 7v1" />
                </>)}
              />
              <RibbonSm
                onClick={() => setCompose(true)}
                label={t("Balas Semua")}
                icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                  <path d="M8 6L3 11l5 5M13 6l-5 5 5 5" />
                  <path d="M8 11h7a6 6 0 016 6v1" />
                </>)}
              />
              <RibbonSm
                onClick={() => setCompose(true)}
                label={t("Teruskan")}
                icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                  <path d="M15 7l5 5-5 5" />
                  <path d="M20 12h-9a7 7 0 00-7 7v1" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Langkah Cepat")}>
            <div
              style={{
                border: "1px solid var(--rule)",
                borderRadius: 7,
                background: "var(--paper)",
                padding: 3,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                minWidth: 180,
              }}
            >
              <RibbonSm
                radius={5}
                onClick={() => void moveSelected("bank", "Pesan dipindahkan ke folder BANK")}
                label={t("Arsip ke BANK")}
                icon={svg({ w: 13, stroke: "var(--ledger)", join: "round" }, <>
                  <path d="M3 7h6l2 2h10v9H3z" />
                  <path d="M12 12v4M10 14h4" />
                </>)}
              />
              <RibbonSm
                radius={5}
                disabled
                label={t("Ke Administrator")}
                icon={svg({ w: 13, cap: "round" }, <path d="M3 12l18-8-8 18-2-7z" />)}
              />
              <RibbonSm
                radius={5}
                onClick={() => toast(t("Pesan diteruskan ke tim akuntansi"))}
                label={t("Email Tim")}
                icon={svg({ w: 13, stroke: "var(--ledger)", join: "round" }, <>
                  <rect x="3" y="6" width="18" height="12" rx="1" />
                  <path d="M3 7l9 6 9-6" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Pindahkan")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
              <RibbonSm
                onClick={() => toast(t("Pilih folder tujuan"))}
                label={`${t("Pindahkan")} ⌄`}
                icon={svg({ stroke: "var(--ledger)", join: "round" }, <>
                  <path d="M3 7h6l2 2h10v9H3z" />
                  <path d="M12 17l4-3-4-3" />
                </>)}
              />
              <RibbonSm
                onClick={() => toast(t("Kelola aturan kotak masuk"))}
                label={`${t("Aturan")} ⌄`}
                icon={svg({ stroke: "var(--ledger)", cap: "round" }, <>
                  <path d="M4 7h10M4 12h16M4 17h7" />
                  <circle cx="18" cy="7" r="2" />
                  <circle cx="15" cy="17" r="2" />
                </>)}
              />
              <RibbonSm
                disabled
                label={t("Simpan ke Catatan")}
                icon={svg({ join: "round" }, <>
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <path d="M9 15V9l6 6V9" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Tanda")}>
            <RibbonBig
              width={58}
              onClick={() => void toggleStar()}
              label={`${t("Tanda")} ⌄`}
              icon={svg({ w: 26, stroke: "var(--brick)", sw: 1.6, cap: "round", join: "round" },
                <path d="M6 21V4h12l-2.5 4.5L18 13H6" />,
              )}
            />
          </RibbonGroup>

          <RibbonGroup label={t("Cari")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 2 }}>
              <input
                type="text"
                placeholder={t("Cari email")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: 150, height: "auto", padding: "4px 9px", fontSize: 11.5, borderRadius: 6 }}
              />
              <RibbonSm
                onClick={() => toast(t("Buku alamat dibuka"))}
                label={t("Buku Alamat")}
                icon={svg({ stroke: "var(--ledger)", join: "round" }, <>
                  <rect x="5" y="3" width="14" height="18" rx="1" />
                  <circle cx="12" cy="10" r="2.4" />
                  <path d="M8.5 17c.6-1.8 2-2.6 3.5-2.6s2.9.8 3.5 2.6" />
                </>)}
              />
              <RibbonSm
                onClick={() => {
                  setUnreadOnly((current) => !current);
                  toast(t("Saringan email diterapkan"));
                }}
                label={`${t("Saring Email")} ⌄`}
                icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" },
                  <path d="M4 5h16l-6 7v6l-4 2v-8z" />,
                )}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Suara")}>
            <RibbonBig
              width={62}
              onClick={() => toast(t("Pesan dibacakan"))}
              label={
                <>
                  {t("Baca")}
                  <br />
                  {t("Nyaring")}
                </>
              }
              icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.6, cap: "round", join: "round" }, <>
                <path d="M4 18L9 6l5 12M6 14h6" />
                <path d="M17 9a4 4 0 010 6M19.5 6.5a7 7 0 010 11" />
              </>)}
            />
          </RibbonGroup>

          <RibbonGroup label={t("Aplikasi")}>
            <RibbonBig
              width={62}
              onClick={() => toast(t("Daftar aplikasi dibuka"))}
              label={
                <>
                  {t("Semua")}
                  <br />
                  {t("Aplikasi")}
                </>
              }
              icon={svg({ w: 26, stroke: "var(--ledger)", sw: 1.6, join: "round" }, <>
                <rect x="4" y="4" width="7" height="7" rx="1" />
                <rect x="13" y="4" width="7" height="7" rx="1" />
                <rect x="4" y="13" width="7" height="7" rx="1" />
                <rect x="13" y="13" width="7" height="7" rx="1" />
              </>)}
            />
          </RibbonGroup>

          <RibbonGroup label={t("Kirim & Terima")} last>
            <RibbonBig
              width={74}
              onClick={() => {
                router.refresh();
                toast(t("Sinkronisasi semua folder dimulai"));
              }}
              label={
                <>
                  {t("Kirim/Terima")}
                  <br />
                  {t("Semua Folder")}
                </>
              }
              icon={svg({ w: 26, stroke: "var(--moss)", cap: "round", join: "round" }, <>
                <path d="M20 11a8 8 0 10-2.3 6.3" />
                <path d="M20 5v6h-6" />
              </>)}
            />
          </RibbonGroup>
        </div>
      )}

      {/* -------------------------------------------------------- ribbon kirim */}
      {tab === "kirim" && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            padding: "8px 4px 0",
            background: "var(--card)",
            borderBottom: "1px solid var(--rule)",
            overflowX: "auto",
            flex: "none",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 14px", borderRight: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <RibbonBig
                width={74}
                onClick={() => {
                  router.refresh();
                  toast(t("Sinkronisasi semua folder dimulai"));
                }}
                label={
                  <>
                    {t("Kirim/Terima")}
                    <br />
                    {t("Semua Folder")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                  <path d="M20 11a8 8 0 10-2.3 6.3" />
                  <path d="M20 5v6h-6" />
                </>)}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 3 }}>
                <RibbonSm
                  size={12}
                  onClick={() => {
                    router.refresh();
                    toast(t("Folder diperbarui"));
                  }}
                  label={t("Perbarui Folder")}
                  icon={svg({ w: 15, stroke: "var(--ledger)", cap: "round", join: "round" },
                    <path d="M3 7h6l2 2h10v9a1 1 0 01-1 1H4a1 1 0 01-1-1z" />,
                  )}
                />
                <RibbonSm
                  size={12}
                  onClick={() => toast(`${unreadByFolder.outbox ?? 0} ${t("pesan di Outbox dikirim")}`)}
                  label={t("Kirim Semua")}
                  icon={svg({ w: 15, stroke: "var(--ledger)", cap: "round", join: "round" },
                    <path d="M3 12l18-8-8 18-2-7z" />,
                  )}
                />
                <RibbonSm
                  size={12}
                  onClick={() => toast(t("Grup kirim/terima dibuka"))}
                  label={
                    <>
                      {t("Grup Kirim/Terima")} <span style={{ color: "var(--ink4)" }}>⌄</span>
                    </>
                  }
                  icon={svg({ w: 15, stroke: "var(--ledger)", cap: "round", join: "round" },
                    <path d="M3 7h6l2 2h10v9a1 1 0 01-1 1H4a1 1 0 01-1-1z" />,
                  )}
                />
              </div>
            </div>
            <div style={{ fontSize: 10, color: "var(--ink4)", padding: "4px 0 6px" }}>{t("Kirim & Terima")}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 14px", borderRight: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <RibbonBig
                width={70}
                onClick={() => toast(t("Jendela progres unduhan dibuka"))}
                label={
                  <>
                    {t("Tampilkan")}
                    <br />
                    {t("Progres")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--moss)", join: "round" }, <>
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <path d="M6 10h12M6 14h7" />
                </>)}
              />
              <RibbonBig
                width={70}
                onClick={() => toast(t("Semua proses unduhan dibatalkan"))}
                label={
                  <>
                    {t("Batalkan")}
                    <br />
                    {t("Semua")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--brick)", cap: "round", join: "round" }, <>
                  <path d="M20 11a8 8 0 10-2.3 6.3" />
                  <path d="M20 5v6h-6" />
                  <path d="M9 9l6 6M15 9l-6 6" />
                </>)}
              />
            </div>
            <div style={{ fontSize: 10, color: "var(--ink4)", padding: "4px 0 6px" }}>{t("Unduhan")}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 14px", borderRight: "1px solid var(--rule)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <RibbonBig
                width={72}
                onClick={() => toast(t("Header pesan diunduh dari server"))}
                label={
                  <>
                    {t("Unduh")}
                    <br />
                    {t("Header")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                  <path d="M6 3h8l4 4v8H6z" />
                  <path d="M12 15v6M9 18l3 3 3-3" />
                </>)}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 3 }}>
                <RibbonSm
                  size={12}
                  onClick={() => toast(t("Pesan ditandai untuk diunduh"))}
                  label={
                    <>
                      {t("Tandai untuk Diunduh")} <span style={{ color: "var(--ink4)" }}>⌄</span>
                    </>
                  }
                  icon={svg({ w: 15, stroke: "var(--ledger)", join: "round" }, <>
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M12 9v6M9 12h6" />
                  </>)}
                />
                <RibbonSm
                  size={12}
                  onClick={() => toast(t("Tanda unduhan dilepas"))}
                  label={
                    <>
                      {t("Batal Tandai")} <span style={{ color: "var(--ink4)" }}>⌄</span>
                    </>
                  }
                  icon={svg({ w: 15, stroke: "var(--brick)", join: "round" }, <>
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M9 9l6 6M15 9l-6 6" />
                  </>)}
                />
                <RibbonSm
                  size={12}
                  onClick={() => toast(t("Header bertanda diproses"))}
                  label={
                    <>
                      {t("Proses Header Bertanda")} <span style={{ color: "var(--ink4)" }}>⌄</span>
                    </>
                  }
                  icon={svg({ w: 15, stroke: "var(--moss)", sw: 2, cap: "round", join: "round" },
                    <path d="M4 13l5 5L20 6" />,
                  )}
                />
              </div>
            </div>
            <div style={{ fontSize: 10, color: "var(--ink4)", padding: "4px 0 6px" }}>{t("Server")}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 14px" }}>
            <RibbonBig
              width={72}
              onClick={() => toast(t("Mode kerja luring aktif — pesan disimpan di Outbox"))}
              label={
                <>
                  {t("Kerja")}
                  <br />
                  {t("Luring")}
                </>
              }
              icon={svg({ w: 26, stroke: "var(--ink2)", cap: "round" }, <>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
              </>)}
            />
            <div style={{ fontSize: 10, color: "var(--ink4)", padding: "4px 0 6px" }}>{t("Preferensi")}</div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- ribbon folder */}
      {tab === "folder" && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            padding: "8px 4px 0",
            background: "var(--card)",
            borderBottom: "1px solid var(--rule)",
            overflowX: "auto",
            flex: "none",
          }}
        >
          <RibbonGroup label={t("Baru")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={62}
                onClick={() => toast(t("Folder baru dibuat"))}
                label={
                  <>
                    {t("Folder")}
                    <br />
                    {t("Baru")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.55, cap: "round", join: "round" },
                  <path d="M3 7h6l2 2h10v9H3z" />,
                )}
              />
              <RibbonBig
                width={66}
                onClick={() => toast(t("Folder pencarian baru dibuat"))}
                label={
                  <>
                    {t("Folder")}
                    <br />
                    {t("Pencarian")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.55, cap: "round", join: "round" }, <>
                  <path d="M3 7h6l2 2h10v9H3z" />
                  <circle cx="14" cy="14" r="2.6" stroke="var(--ledger)" />
                  <path d="M16 16l2.2 2.2" stroke="var(--ledger)" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Tindakan")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={60}
                disabled
                label={
                  <>
                    {t("Ganti Nama")}
                    <br />
                    {t("Folder")}
                  </>
                }
                icon={svg({ w: 26, sw: 1.55, cap: "round", join: "round" }, <path d="M3 7h6l2 2h10v9H3z" />)}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                <RibbonSm
                  onClick={() => toast(t("Folder disalin"))}
                  label={t("Salin Folder")}
                  icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                    <rect x="8" y="8" width="12" height="12" rx="1" />
                    <path d="M4 16V4h12" />
                  </>)}
                />
                <RibbonSm
                  disabled
                  label={t("Pindahkan Folder")}
                  icon={svg({ cap: "round", join: "round" }, <>
                    <path d="M3 7h6l2 2h10v9H3z" />
                    <path d="M12 17l4-3-4-3" />
                  </>)}
                />
                <RibbonSm
                  disabled
                  label={t("Hapus Folder")}
                  icon={svg({ cap: "round", join: "round" },
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
                  )}
                />
              </div>
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Bersih-bersih")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={62}
                onClick={() => void markFolderRead()}
                label={
                  <>
                    {t("Tandai Semua")}
                    <br />
                    {t("Dibaca")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.55, cap: "round", join: "round" }, <>
                  <rect x="3" y="6" width="18" height="12" rx="1" />
                  <path d="M3 7l9 6 9-6" />
                </>)}
              />
              <RibbonBig
                width={66}
                onClick={() => toast(t("Folder diurutkan A ke Z"))}
                label={
                  <>
                    {t("Semua Folder")}
                    <br />
                    {t("A ke Z")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ledger)", sw: 1.55, cap: "round", join: "round" },
                  <path d="M6 4l3 7H3zM4.5 9h6M17 4v16M14 17l3 3 3-3" />,
                )}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                <RibbonSm
                  onClick={() => toast(t("Folder dibersihkan"))}
                  label={`${t("Bersihkan Folder")} ⌄`}
                  icon={svg({ stroke: "var(--ink2)", cap: "round", join: "round" }, <>
                    <path d="M3 7h6l2 2h10v9H3z" />
                    <path d="M9 12l6 5M15 12l-6 5" stroke="var(--brick)" />
                  </>)}
                />
                <RibbonSm
                  onClick={() => toast(t("Semua pesan folder ini dihapus"))}
                  label={t("Hapus Semua")}
                  icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" },
                    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
                  )}
                />
                <RibbonSm
                  onClick={() => toast(t("Pesan terhapus dimusnahkan permanen"))}
                  label={`${t("Musnahkan")} ⌄`}
                  icon={svg({ stroke: "var(--plum)", cap: "round", join: "round" }, <>
                    <rect x="3" y="6" width="18" height="12" rx="1" />
                    <path d="M3 7l9 6 9-6" />
                  </>)}
                />
              </div>
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Favorit")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={64}
                onClick={() => toast(t("Folder ditambahkan ke Favorit"))}
                label={
                  <>
                    {t("Tambah ke")}
                    <br />
                    {t("Favorit")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--amber)", sw: 1.55, cap: "round", join: "round" },
                  <path d="M12 5l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4L7.5 18.7l.9-5L4.8 10.2l5-.7z" />,
                )}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("IMAP")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={62}
                onClick={() => toast(t("Daftar folder IMAP dibuka"))}
                label={
                  <>
                    {t("Folder")}
                    <br />
                    IMAP
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.55, cap: "round", join: "round" }, <>
                  <path d="M3 7h6l2 2h10v9H3z" />
                  <circle cx="15" cy="14" r="2.4" stroke="var(--ledger)" />
                  <path d="M15 10.6v-1M15 18.4v-1M18.4 14h1M10.6 14h1" stroke="var(--ledger)" />
                </>)}
              />
              <RibbonBig
                width={66}
                onClick={() => {
                  router.refresh();
                  toast(t("Daftar folder diperbarui dari server"));
                }}
                label={
                  <>
                    {t("Perbarui")}
                    <br />
                    {t("Daftar Folder")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.55, cap: "round", join: "round" }, <>
                  <path d="M3 7h6l2 2h10v9H3z" />
                  <path d="M13 17a3 3 0 104-2.8" stroke="var(--ledger)" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Properti")} last>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={66}
                onClick={() => toast(t("Pengaturan arsip otomatis dibuka"))}
                label={
                  <>
                    {t("Pengaturan")}
                    <br />
                    {t("Arsip Otomatis")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.55, cap: "round", join: "round" }, <>
                  <rect x="3" y="4" width="18" height="4" rx="1" />
                  <path d="M5 8v12h14V8" />
                  <path d="M9 13h6" stroke="var(--ledger)" />
                </>)}
              />
              <RibbonBig
                width={58}
                disabled
                label={
                  <>
                    {t("Izin")}
                    <br />
                    {t("Folder")}
                  </>
                }
                icon={svg({ w: 26, sw: 1.55, cap: "round", join: "round" }, <>
                  <path d="M3 7h6l2 2h10v9H3z" />
                  <circle cx="13" cy="14" r="2.4" />
                </>)}
              />
              <RibbonBig
                width={58}
                onClick={() => toast(t("Properti folder dibuka"))}
                label={
                  <>
                    {t("Properti")}
                    <br />
                    {t("Folder")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.55, cap: "round", join: "round" }, <>
                  <rect x="4" y="4" width="16" height="16" rx="1" />
                  <path d="M8 9h8M8 12h8M8 15h5" />
                </>)}
              />
            </div>
          </RibbonGroup>
        </div>
      )}

      {/* ----------------------------------------------------- ribbon tampilan */}
      {tab === "tampilan" && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            padding: "8px 4px 0",
            background: "var(--card)",
            borderBottom: "1px solid var(--rule)",
            overflowX: "auto",
            flex: "none",
          }}
        >
          <RibbonGroup label={t("Tampilan Saat Ini")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={62}
                onClick={() => toast(t("Tampilan daftar diubah"))}
                label={
                  <>
                    {t("Ubah")}
                    <br />
                    {t("Tampilan")} ⌄
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ledger)", sw: 1.55, cap: "round", join: "round" }, <>
                  <path d="M4 12a8 8 0 0114-5" />
                  <path d="M18 4v3h-3" />
                </>)}
              />
              <RibbonBig
                width={62}
                onClick={() => toast(t("Pengaturan tampilan dibuka"))}
                label={
                  <>
                    {t("Pengaturan")}
                    <br />
                    {t("Tampilan")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ink2)", sw: 1.55, cap: "round", join: "round" }, <>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4" />
                </>)}
              />
              <RibbonBig
                width={62}
                onClick={() => {
                  setUnreadOnly(false);
                  setSearch("");
                  toast(t("Tampilan dikembalikan ke bawaan"));
                }}
                label={
                  <>
                    {t("Atur Ulang")}
                    <br />
                    {t("Tampilan")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ledger)", sw: 1.55, cap: "round", join: "round" }, <>
                  <path d="M20 12a8 8 0 10-3 6.2" />
                  <path d="M6 4v3h3" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Pesan")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, paddingTop: 6, minWidth: 190 }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  borderRadius: 7,
                  fontSize: 11.5,
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" style={{ width: 13, height: 13, flex: "none" }} readOnly checked={false} />
                {t("Tampilkan sebagai Percakapan")}
              </label>
              <RibbonSm
                disabled
                label={`${t("Pengaturan Percakapan")} ⌄`}
                icon={svg({ cap: "round", join: "round" }, <>
                  <rect x="3" y="6" width="18" height="12" rx="1" />
                  <path d="M3 7l9 6 9-6" />
                </>)}
              />
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Penyusunan")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={64}
                onClick={() => toast(t("Pratinjau pesan diatur"))}
                label={
                  <>
                    {t("Pratinjau")}
                    <br />
                    {t("Pesan")} ⌄
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ledger)", sw: 1.55, cap: "round", join: "round" }, <>
                  <rect x="3" y="5" width="18" height="14" rx="1" />
                  <path d="M3 9h18M7 13h10M7 16h6" />
                </>)}
              />
              <RibbonBig
                width={58}
                onClick={() => toast(t("Pengelompokan daftar diubah"))}
                label={
                  <>
                    {t("Susun")}
                    <br />
                    {t("Menurut")} ⌄
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ledger)", sw: 1.55, cap: "round", join: "round" }, <>
                  <rect x="3" y="4" width="18" height="16" rx="1" />
                  <path d="M12 4v16M3 10h9" />
                </>)}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                <RibbonSm
                  onClick={() => toast(t("Urutan pesan dibalik"))}
                  label={t("Balik Urutan")}
                  icon={svg({ stroke: "var(--ink2)", cap: "round", join: "round" },
                    <path d="M7 20V4M4 7l3-3 3 3M17 4v16M14 17l3 3 3-3" />,
                  )}
                />
                <RibbonSm
                  onClick={() => toast(t("Pilih kolom yang ditampilkan"))}
                  label={t("Tambah Kolom")}
                  icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <path d="M9 5v14M15 5v14" />
                  </>)}
                />
                <RibbonSm
                  onClick={() => toast(t("Semua grup dibentangkan"))}
                  label={`${t("Bentang/Ciutkan")} ⌄`}
                  icon={svg({ stroke: "var(--brick)", cap: "round", join: "round" },
                    <path d="M5 9h6M8 6v6M14 15h6" />,
                  )}
                />
              </div>
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Tata Letak")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={58}
                onClick={() => toast(t("Jarak baris dirapatkan"))}
                label={
                  <>
                    {t("Jarak")}
                    <br />
                    {t("Rapat")}
                  </>
                }
                icon={svg({ w: 26, stroke: "var(--ledger)", sw: 1.55, cap: "round", join: "round" },
                  <path d="M4 5h16M4 10h16M4 14h16M4 19h16" />,
                )}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                <RibbonSm
                  onClick={() => toast(t("Panel folder diatur"))}
                  label={`${t("Panel Folder")} ⌄`}
                  icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <path d="M9 5v14" />
                    <path d="M4 7h4M4 10h4" stroke="var(--ledger)" />
                  </>)}
                />
                <RibbonSm
                  onClick={() => toast(t("Panel baca diatur"))}
                  label={`${t("Panel Baca")} ⌄`}
                  icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <path d="M13 5v14" />
                  </>)}
                />
                <RibbonSm
                  onClick={() => toast(t("Bilah tugas diatur"))}
                  label={`${t("Bilah Tugas")} ⌄`}
                  icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <path d="M16 5v14M6 9h6M6 12h6" />
                  </>)}
                />
              </div>
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Jendela")}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 2 }}>
                <RibbonSm
                  onClick={() => toast(t("Jendela pengingat dibuka"))}
                  label={t("Jendela Pengingat")}
                  icon={svg({ stroke: "var(--ink2)", cap: "round", join: "round" }, <>
                    <path d="M18 8a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
                    <path d="M10.5 20a2 2 0 003 0" />
                  </>)}
                />
                <RibbonSm
                  onClick={() => toast(t("Pesan dibuka di jendela baru"))}
                  label={t("Buka di Jendela Baru")}
                  icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <path d="M3 9h18M8 13h5" />
                  </>)}
                />
                <RibbonSm
                  onClick={() => {
                    setSelectedId(null);
                    toast(t("Semua item ditutup"));
                  }}
                  label={t("Tutup Semua Item")}
                  icon={svg({ stroke: "var(--ledger)", cap: "round", join: "round" }, <>
                    <rect x="3" y="5" width="18" height="14" rx="1" />
                    <path d="M9 11l6 5M15 11l-6 5" stroke="var(--brick)" />
                  </>)}
                />
              </div>
            </div>
          </RibbonGroup>

          <RibbonGroup label={t("Pembaca Imersif")} last>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RibbonBig
                width={64}
                disabled
                label={
                  <>
                    {t("Pembaca")}
                    <br />
                    {t("Imersif")}
                  </>
                }
                icon={svg({ w: 26, sw: 1.55, cap: "round", join: "round" }, <path d="M4 6h7v13H4zM13 6h7v13h-7z" />)}
              />
            </div>
          </RibbonGroup>
        </div>
      )}

      {/* --------------------------------------------------- ribbon pengaturan */}
      {tab === "pengaturan" && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            padding: "8px 4px 0",
            background: "var(--card)",
            borderBottom: "1px solid var(--rule)",
            overflowX: "auto",
            flex: "none",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 12px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "nowrap" }}>
              <button
                type="button"
                onClick={() => toast(t("Pengaturan akun dibuka"))}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 9,
                  cursor: "pointer",
                  maxWidth: 520,
                }}
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink3)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flex: "none", marginTop: 2 }}
                >
                  <circle cx="10" cy="7" r="3.4" />
                  <path d="M3.5 19c0-3.3 2.9-5.6 6.5-5.6" />
                  <circle cx="17" cy="16" r="3.6" stroke="var(--ledger)" />
                  <path d="M17 12.6v-1.2M17 20.6v-1.2M20.4 16h1.2M12.4 16h1.2" stroke="var(--ledger)" />
                </svg>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                    <u>P</u>
                    {t("engaturan Akun…")}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink3)", lineHeight: 1.5, marginTop: 2 }}>
                    {t("Tambah dan hapus akun, atau ubah pengaturan koneksi yang ada.")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => toast(t("Pengaturan nama akun dan sinkronisasi dibuka"))}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 9,
                  cursor: "pointer",
                  maxWidth: 520,
                }}
              >
                <svg
                  width="34"
                  height="34"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--ink3)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flex: "none", marginTop: 2 }}
                >
                  <circle cx="10" cy="7" r="3.4" />
                  <path d="M3.5 19c0-3.3 2.9-5.6 6.5-5.6" />
                  <circle cx="17" cy="16" r="3.6" stroke="var(--ledger)" />
                  <path d="M17 12.6v-1.2M17 20.6v-1.2M20.4 16h1.2M12.4 16h1.2" stroke="var(--ledger)" />
                </svg>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                    {t("Nama Akun dan Pengaturan Si")}
                    <u>n</u>
                    {t("kronisasi")}
                  </span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--ink3)", lineHeight: 1.5, marginTop: 2 }}>
                    {t("Perbarui pengaturan dasar akun seperti nama akun dan sinkronisasi folder.")}
                  </span>
                </span>
              </button>
            </div>
            <div style={{ height: 10 }} />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ 3 panes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "216px 340px minmax(0,1fr)",
          overflow: "hidden",
          marginTop: 10,
          border: "1px solid var(--rule)",
          borderRadius: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* folder pane */}
        <div
          style={{
            borderLeft: "1px solid var(--rule)",
            borderRight: "1px solid var(--rule)",
            background: "#F4F8FC",
            overflowY: "auto",
            padding: "10px 0",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "var(--ink4)",
              padding: "4px 14px 10px",
              borderBottom: "1px dashed var(--rule)",
              marginBottom: 8,
            }}
          >
            {t("Tarik folder favorit ke sini")}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "var(--ink4)" }}>⌄</span>
            {accountName}
          </div>
          {folderButton("masuk", "Kotak Masuk", 22)}
          {folderButton("bank", "BANK", 34)}
          {folderButton("pajak", "PAJAK", 34)}
          {folderButton("vendor", "VENDOR", 34)}
          {folderButton("hrd", "HRD", 34)}
          {folderButton("audit", "AUDIT", 34)}
          <div
            style={{
              fontSize: 12.5,
              padding: "10px 14px 4px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--ink2)",
            }}
          >
            <span style={{ color: "var(--ink4)" }}>⌄</span>
            {t("Folder sistem")}
          </div>
          {folderButton("draf", "Draf", 34)}
          {folderButton("terkirim", "Terkirim", 34)}
          {folderButton("outbox", "Outbox", 34, "var(--amber)")}
          {folderButton("sampah", "Sampah", 34)}
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              padding: "12px 14px 6px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              borderTop: "1px solid var(--rule)",
              marginTop: 8,
            }}
          >
            <span style={{ color: "var(--ink4)" }}>⌄</span>
            {t("Email")} {companyName}
          </div>
          {folderButton("chl", "Kotak Masuk", 22)}
          {folderButton("chlbukti", "Bukti Transfer", 34)}
        </div>

        {/* message list */}
        <div
          style={{
            background: "var(--card)",
            borderRight: "1px solid var(--rule)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "9px 14px",
              borderBottom: "1px solid var(--rule)",
              flex: "none",
            }}
          >
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              style={{
                fontSize: 12.5,
                fontWeight: unreadOnly ? undefined : 600,
                color: unreadOnly ? "var(--ink2)" : "var(--ledger-dk)",
                borderBottom: `2px solid ${unreadOnly ? "transparent" : "var(--ledger)"}`,
                paddingBottom: 3,
                cursor: "pointer",
              }}
            >
              {t("Semua")}
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              style={{
                fontSize: 12.5,
                fontWeight: unreadOnly ? 600 : undefined,
                color: unreadOnly ? "var(--ledger-dk)" : "var(--ink2)",
                borderBottom: `2px solid ${unreadOnly ? "var(--ledger)" : "transparent"}`,
                paddingBottom: 3,
                cursor: "pointer",
              }}
            >
              {t("Belum dibaca")}
            </button>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11.5,
                color: "var(--ink3)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {t("Berdasarkan tanggal")}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </span>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {grouped.length === 0 && (
              <div className="sm muted" style={{ padding: "18px 14px" }}>
                {t("Belum ada pesan di folder ini")}
              </div>
            )}
            {grouped.map((bucket) => (
              <div key={bucket.name}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--ink2)",
                    background: "var(--sunk)",
                    padding: "5px 14px",
                    borderBottom: "1px solid var(--rule)",
                  }}
                >
                  {t(bucket.name)}
                </div>
                {bucket.items.map((message) => {
                  const on = selected?.id === message.id;
                  const unread = !message.isRead;
                  return (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => openMessage(message)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 14px",
                        borderBottom: "1px solid var(--rule)",
                        borderLeft: `3px solid ${on ? "var(--ledger)" : "transparent"}`,
                        background: on ? "#EAF3F8" : undefined,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: unread ? 600 : undefined,
                            color: unread ? "var(--ink)" : "var(--ink2)",
                          }}
                        >
                          {message.fromName}
                        </span>
                        {message.isStarred && <span style={{ color: "var(--amber)", fontSize: 11 }}>★</span>}
                        <span className="num" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink3)" }}>
                          {message.timeLabel}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: unread ? 600 : undefined,
                          color: unread ? "var(--ledger-dk)" : "var(--ink)",
                          marginTop: 2,
                        }}
                      >
                        {message.subject}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--ink3)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {message.body}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* reading pane */}
        <div style={{ background: "var(--card)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
          {!selected && (
            <div
              className="sm muted"
              style={{ padding: "40px 24px", textAlign: "center", lineHeight: 1.7 }}
            >
              {t("Belum ada pesan yang dipilih")}
            </div>
          )}
          {selected && (
            <>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--rule)" }}>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{selected.subject}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: "var(--ledger)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      flex: "none",
                    }}
                  >
                    {initialsOf(selected.fromName)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{selected.fromName}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>
                      {selected.fromEmail} · {t("kepada")} {selected.toEmail}
                    </div>
                  </div>
                  <span className="num" style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink3)", flex: "none" }}>
                    {selected.fullLabel}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn btn-sm" onClick={() => setCompose(true)}>
                    {t("Balas")}
                  </button>
                  <button className="btn btn-sm" onClick={() => setCompose(true)}>
                    {t("Balas semua")}
                  </button>
                  <button className="btn btn-sm" onClick={() => setCompose(true)}>
                    {t("Teruskan")}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      toast(t("Lampiran dikirim ke layar Import Mutasi"));
                      router.push("/import-mutasi");
                    }}
                  >
                    {t("Kirim ke Import Mutasi")}
                  </button>
                </div>
              </div>
              <div
                style={{
                  padding: "16px 20px",
                  fontSize: 12.5,
                  lineHeight: 1.65,
                  color: "var(--ink)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {selected.body.split(/\n{1,}/).map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* --------------------------------------------------- dialog "m-tulis" */}
      <Dialog
        open={compose}
        onClose={() => setCompose(false)}
        title={t("Pesan baru")}
        badge={accountEmail}
        maxWidth={620}
        footer={
          <>
            <button className="btn" onClick={() => setCompose(false)}>
              {t("Batal")}
            </button>
            <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void send(true)}>
              {t("Simpan draf")}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void send(false)}>
              {busy ? t("Mengirim…") : t("Kirim")}
            </button>
          </>
        }
      >
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Kepada")}
            </label>
            <input
              type="text"
              placeholder="nama@perusahaan.co.id"
              value={form.to}
              onChange={(event) => updateForm("to", event.target.value)}
            />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f">Cc</label>
            <input
              type="text"
              placeholder={t("Opsional")}
              value={form.cc}
              onChange={(event) => updateForm("cc", event.target.value)}
            />
          </div>
          <div>
            <label className="f">{t("Prioritas")}</label>
            <select value={form.priority} onChange={(event) => updateForm("priority", event.target.value)}>
              <option value="Normal">{t("Normal")}</option>
              <option value="Tinggi">{t("Tinggi")}</option>
              <option value="Rendah">{t("Rendah")}</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Subjek")}
            </label>
            <input
              type="text"
              placeholder={t("Misal: Konfirmasi pembayaran TG-2026-0802")}
              value={form.subject}
              onChange={(event) => updateForm("subject", event.target.value)}
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Isi pesan")}
            </label>
            <textarea
              rows={7}
              placeholder={t("Tulis pesan…")}
              value={form.body}
              onChange={(event) => updateForm("body", event.target.value)}
              style={{
                width: "100%",
                fontFamily: "inherit",
                fontSize: 12.5,
                lineHeight: 1.6,
                padding: "9px 11px",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                background: "var(--paper)",
                color: "var(--ink)",
                resize: "vertical",
              }}
            />
          </div>
        </div>
        <div className="dz" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t("Lampirkan berkas")}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
            {t("Tarik file ke sini · bukti transfer, faktur, atau rekap")}
          </div>
        </div>
        {error && (
          <div
            style={{
              marginTop: 4,
              padding: "9px 11px",
              borderRadius: 8,
              fontSize: 12,
              background: "var(--brick-bg)",
              color: "var(--brick)",
            }}
          >
            {error}
          </div>
        )}
      </Dialog>
    </div>
  );
}
