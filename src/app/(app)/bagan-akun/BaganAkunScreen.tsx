"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount } from "@/lib/format";

export type AccountTypeValue = "ASET" | "KEWAJIBAN" | "EKUITAS" | "PENDAPATAN" | "BEBAN";

export type AccountNode = {
  id: string;
  code: string;
  name: string;
  type: AccountTypeValue;
  normalBalance: "DEBIT" | "KREDIT";
  parentId: string | null;
  isPostable: boolean;
  isActive: boolean;
  depth: number;
  rootId: string;
  hasChildren: boolean;
  balance: number;
};

type Category = "ANAK" | "SUB" | "PARENT_SUB" | "MAIN";

const TYPE_CHIP: Record<AccountTypeValue, { label: string; background: string; color: string }> = {
  ASET: { label: "Aset", background: "#DCE9F1", color: "#1F5E80" },
  KEWAJIBAN: { label: "Liabilitas", background: "#F6E7C9", color: "#8A5D14" },
  EKUITAS: { label: "Ekuitas", background: "#E6E3EE", color: "#5B4B7A" },
  PENDAPATAN: { label: "Pendapatan", background: "#DDEBDC", color: "#3D6B3C" },
  BEBAN: { label: "Beban", background: "#F3DCD8", color: "#8C3A2B" },
};

const TYPE_FILTERS: Array<[AccountTypeValue, string]> = [
  ["ASET", "Aset"],
  ["KEWAJIBAN", "Kewajiban"],
  ["EKUITAS", "Ekuitas"],
  ["PENDAPATAN", "Pendapatan"],
  ["BEBAN", "Beban"],
];

const TYPE_REPORT: Record<AccountTypeValue, string> = {
  ASET: "Neraca",
  KEWAJIBAN: "Neraca",
  EKUITAS: "Neraca",
  PENDAPATAN: "Laba rugi",
  BEBAN: "Laba rugi",
};

const CATEGORY_LABELS: Array<[Category, string]> = [
  ["ANAK", "Akun Anak"],
  ["SUB", "Sub Akun"],
  ["PARENT_SUB", "Parent Sub Akun"],
  ["MAIN", "Main Akun"],
];

function normalBalanceFor(type: AccountTypeValue) {
  return type === "ASET" || type === "BEBAN" ? "DEBIT" : "KREDIT";
}

function TypeChip({ type }: { type: AccountTypeValue }) {
  const t = useT();
  const chip = TYPE_CHIP[type];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 9px",
        borderRadius: 999,
        background: chip.background,
        color: chip.color,
      }}
    >
      {t(chip.label)}
    </span>
  );
}

const emptyForm = {
  id: "",
  code: "",
  name: "",
  groupId: "",
  category: "ANAK" as Category,
  parentId: "",
  isActive: true,
};

export default function BaganAkunScreen({
  nodes,
  unitLabel,
  unitCode,
  canEdit,
}: {
  nodes: AccountNode[];
  unitLabel: string;
  unitCode: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const groups = useMemo(() => nodes.filter((node) => node.depth === 0), [nodes]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = nodes.filter((node) => {
      if (typeFilter && node.type !== typeFilter) return false;
      if (statusFilter === "aktif" && !node.isActive) return false;
      if (statusFilter === "nonaktif" && node.isActive) return false;
      if (!needle) return true;
      return `${node.code} ${node.name}`.toLowerCase().includes(needle);
    });

    // Induk tetap tampil supaya struktur pohon tidak terputus.
    const keep = new Set<string>();
    for (const node of matches) {
      keep.add(node.id);
      let walker = node;
      while (walker.depth > 0) {
        const parent = nodes.find((candidate) => candidate.id === walker.parentId) ?? byId.get(walker.rootId);
        if (!parent || keep.has(parent.id)) break;
        keep.add(parent.id);
        walker = parent;
      }
    }

    return nodes.filter((node) => {
      if (!keep.has(node.id)) return false;
      if (node.depth > 0 && collapsed.includes(node.rootId)) return false;
      return true;
    });
  }, [nodes, byId, query, typeFilter, statusFilter, collapsed]);

  const activeCount = useMemo(() => nodes.filter((node) => node.isActive).length, [nodes]);

  const typeCounts = useMemo(() => {
    const counts: Record<AccountTypeValue, number> = { ASET: 0, KEWAJIBAN: 0, EKUITAS: 0, PENDAPATAN: 0, BEBAN: 0 };
    for (const node of nodes) counts[node.type] += 1;
    return counts;
  }, [nodes]);

  const formType: AccountTypeValue = useMemo(() => {
    const group = byId.get(form.groupId);
    return group?.type ?? groups[0]?.type ?? "ASET";
  }, [byId, form.groupId, groups]);

  function toggleGroup(id: string) {
    setCollapsed((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function openCreate() {
    setForm({ ...emptyForm, groupId: groups[0]?.id ?? "", parentId: groups[0]?.id ?? "" });
    setErrors({});
    setFormError("");
    setEditorOpen(true);
  }

  function openEdit(id: string) {
    const node = byId.get(id);
    if (!node) return;
    setForm({
      id: node.id,
      code: node.code,
      name: node.name,
      groupId: node.rootId,
      category: node.isPostable ? "ANAK" : node.depth === 0 ? "MAIN" : "SUB",
      parentId: node.parentId ?? (node.depth === 0 ? "" : node.rootId),
      isActive: node.isActive,
    });
    setErrors({});
    setFormError("");
    setMenu(null);
    setEditorOpen(true);
  }

  function update<K extends keyof typeof emptyForm>(field: K, value: (typeof emptyForm)[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field as string]: "" }));
    setFormError("");
  }

  async function save(nextActive?: boolean) {
    const nextErrors: Record<string, string> = {};
    if (!form.code.trim()) nextErrors.code = t("Kode akun harus diisi.");
    else if (!/^[1-9]-\d{4}$/.test(form.code.trim())) nextErrors.code = t("Format kode akun harus seperti 7-1200.");
    if (!form.name.trim()) nextErrors.name = t("Nama akun harus diisi.");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const isActive = nextActive ?? form.isActive;
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: formType,
      category: form.category,
      parentId: form.parentId || null,
      isActive,
    };

    setBusy(true);
    const res = await fetch(form.id ? `/api/accounts/${form.id}` : "/api/accounts", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      setFormError(data.error ?? t("Gagal menyimpan akun."));
      return;
    }

    setEditorOpen(false);
    toast(
      isActive
        ? `${t("Akun tersimpan di bagan akun buku")} ${unitCode}`
        : t("Akun dinonaktifkan — tidak muncul di pilihan jurnal baru"),
    );
    router.refresh();
  }

  async function setActive(id: string, isActive: boolean) {
    setMenu(null);
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast(data.error ?? t("Gagal mengubah status akun."));
      return;
    }
    toast(
      isActive
        ? t("Akun diaktifkan kembali dan bisa dipakai di jurnal baru")
        : t("Akun dinonaktifkan — tidak muncul di pilihan jurnal baru"),
    );
    router.refresh();
  }

  const menuNode = menu ? byId.get(menu.id) : null;

  return (
    <>
      <PageHead
        title={t("Bagan Akun")}
        subtitle={t("Daftar Akun")}
        actions={
          <>
            <button
              className="btn"
              onClick={() => router.push("/bagan-akun/import")}
              style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 15V4M8 8l4-4 4 4" />
                <path d="M4 16v3h16v-3" />
              </svg>
              {t("Import")}
            </button>
            <button className="btn" onClick={() => setTypesOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="6" rx="1" />
                <rect x="3" y="14" width="18" height="6" rx="1" />
              </svg>
              {t("Tipe Akun")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openCreate} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t("Tambah Akun")}
              </button>
            )}
          </>
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220, maxWidth: 400 }}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--ink4)"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4 4" />
          </svg>
          <input
            type="text"
            placeholder={t("Cari kode atau nama akun…")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            style={{ paddingLeft: 33, width: "100%" }}
          />
        </div>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={{ width: "auto", minWidth: 108 }}>
          <option value="">{t("Semua Tipe")}</option>
          {TYPE_FILTERS.map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ width: "auto", minWidth: 94 }}>
          <option value="">{t("Semua")}</option>
          <option value="aktif">{t("Aktif")}</option>
          <option value="nonaktif">{t("Non Aktif")}</option>
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setCollapsed([])}>
            {t("Expand Semua")}
          </button>
          <button className="btn btn-sm" onClick={() => setCollapsed(groups.map((group) => group.id))}>
            {t("Collapse Semua")}
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 900, fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "linear-gradient(180deg,#DCE8F5 0%,#C4D8EC 100%)" }}>
                <th style={{ width: 180, paddingLeft: 14, background: "transparent", color: "#2C4257", fontWeight: 700 }}>{t("Kode Akun")}</th>
                <th style={{ background: "transparent", color: "#2C4257", fontWeight: 700 }}>{t("Nama Akun")}</th>
                <th style={{ width: 120, background: "transparent", color: "#2C4257", fontWeight: 700 }}>{t("Tipe")}</th>
                <th style={{ width: 120, background: "transparent", color: "#2C4257", fontWeight: 700 }}>{t("Posisi Normal")}</th>
                <th className="r" style={{ width: 170, background: "transparent", color: "#2C4257", fontWeight: 700 }}>{t("Saldo")} </th>
                <th className="r" style={{ width: 70, background: "transparent", color: "#2C4257", fontWeight: 700 }}>{t("Aksi")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data akun")}
                  </td>
                </tr>
              )}
              {visible.map((node) => {
                const isGroup = node.depth === 0;
                const isBranch = node.depth === 1;
                const codePad = isGroup ? 14 : isBranch ? 40 : 66 + (node.depth - 2) * 26;
                const namePad = isGroup ? 0 : isBranch ? 21 : 45 + (node.depth - 2) * 26;
                const open = !collapsed.includes(node.rootId);

                return (
                  <tr
                    key={node.id}
                    onClick={isGroup ? () => toggleGroup(node.id) : undefined}
                    style={
                      isGroup
                        ? { cursor: "pointer", background: "#E8F0F9" }
                        : isBranch
                          ? { background: "#F4F8FC", fontWeight: 600, fontStyle: "italic" }
                          : undefined
                    }
                  >
                    <td
                      className="num"
                      style={{
                        paddingLeft: codePad,
                        fontWeight: isGroup ? 700 : undefined,
                        color: isGroup ? "#2C4257" : isBranch ? "#4E6A80" : "var(--ledger-dk)",
                        whiteSpace: "nowrap",
                        opacity: node.isActive ? 1 : 0.55,
                      }}
                    >
                      {node.code}
                    </td>
                    <td style={{ fontSize: 12.5, color: isGroup ? "#2C4257" : isBranch ? "#31485C" : undefined, opacity: node.isActive ? 1 : 0.55 }}>
                      {isGroup ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, letterSpacing: ".02em" }}>
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                            style={{ flex: "none", transition: "transform .15s", transform: open ? "rotate(90deg)" : undefined }}
                          >
                            <path d="M9 5l7 7-7 7" />
                          </svg>
                          {node.name}
                        </span>
                      ) : (
                        <span style={{ paddingLeft: namePad, display: "block" }}>{node.name}</span>
                      )}
                    </td>
                    <td>
                      <TypeChip type={node.type} />
                    </td>
                    <td style={{ color: isGroup ? "#3C5266" : "var(--ink2)" }}>
                      {node.normalBalance === "DEBIT" ? t("Debit") : t("Kredit")}
                    </td>
                    <td className="r num" style={{ fontWeight: isGroup ? 700 : undefined, color: isGroup ? "#2C4257" : undefined, whiteSpace: "nowrap" }}>
                      {formatAmount(node.balance)}
                    </td>
                    <td className="r">
                      <button
                        aria-label={t("Aksi")}
                        onClick={(event) => {
                          event.stopPropagation();
                          const rect = event.currentTarget.getBoundingClientRect();
                          setMenu((current) =>
                            current?.id === node.id ? null : { id: node.id, x: Math.max(12, rect.right - 150), y: rect.bottom + 4 },
                          );
                        }}
                        style={{ color: "var(--ink4)", padding: "2px 8px", borderRadius: 6, cursor: "pointer", fontSize: 14, lineHeight: 1 }}
                      >
                        ···
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {menu && menuNode && (
          <>
            <div onClick={() => setMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 87 }} />
            <div
              style={{
                display: "block",
                position: "fixed",
                left: menu.x,
                top: menu.y,
                zIndex: 88,
                width: "max-content",
                background: "var(--card)",
                border: "1px solid var(--rule)",
                borderRadius: 10,
                boxShadow: "0 14px 32px rgba(22,32,27,.18)",
                padding: 5,
              }}
            >
              <button
                onClick={() => openEdit(menu.id)}
                style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 7, fontSize: 12.5, color: "var(--ink)", cursor: "pointer" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ledger)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20h4l10-10-4-4L4 16z" />
                  <path d="M13.5 6.5l4 4" />
                </svg>
                {t("Edit Akun")}
              </button>
              {menuNode.isActive ? (
                <button
                  onClick={() => void setActive(menu.id, false)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 7, fontSize: 12.5, color: "var(--brick)", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M6 6l12 12" />
                  </svg>
                  {t("Non Aktif")}
                </button>
              ) : (
                <button
                  onClick={() => void setActive(menu.id, true)}
                  style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 7, fontSize: 12.5, color: "var(--moss)", cursor: "pointer", whiteSpace: "nowrap" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M8.5 12.3l2.4 2.4 4.6-5" />
                  </svg>
                  {t("Aktif")}
                </button>
              )}
            </div>
          </>
        )}

        <div className="bal">
          <span className="k">
            {groups.length} {t("kelompok")} · {activeCount} {t("akun aktif")}
          </span>
          <span className="k" style={{ marginLeft: "auto" }}>
            {t("Kode akun tidak dapat diubah setelah dipakai di jurnal")}
          </span>
        </div>
      </div>

      <Dialog
        open={typesOpen}
        onClose={() => setTypesOpen(false)}
        title={t("Tipe Akun")}
        badge={`5 ${t("tipe")} · ${nodes.length} ${t("akun")}`}
        footer={
          <>
            <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setTypesOpen(false)}>
              {t("Tutup")}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setTypesOpen(false);
                toast(t("Pengaturan tipe akun tersimpan"));
              }}
            >
              {t("Simpan")}
            </button>
          </>
        }
      >
        <div style={{ margin: "-16px -18px 0", overflowX: "auto" }}>
          <table style={{ fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 18 }}>{t("Tipe")}</th>
                <th>{t("Posisi Normal")}</th>
                <th>{t("Muncul di")}</th>
                <th className="r" style={{ paddingRight: 18 }}>
                  {t("Akun")}
                </th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(TYPE_CHIP) as AccountTypeValue[]).map((type) => (
                <tr key={type}>
                  <td style={{ paddingLeft: 18 }}>
                    <TypeChip type={type} />
                  </td>
                  <td>{normalBalanceFor(type) === "DEBIT" ? t("Debit") : t("Kredit")}</td>
                  <td className="muted">{t(TYPE_REPORT[type])}</td>
                  <td className="r num" style={{ paddingRight: 18 }}>
                    {typeCounts[type]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "14px 0 4px" }}>
          <div className="note">
            {t(
              "Tipe akun menentukan posisi normal dan laporan tempat akun muncul. Mengubah tipe akun yang sudah dipakai di jurnal akan mengubah penyajian laporan periode berjalan.",
            )}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={form.id ? t("Detail Akun") : t("Tambah Akun")}
        maxWidth={540}
        badge={`${t("buku")} ${unitLabel}`}
        footer={
          <>
            <button className="btn" onClick={() => setEditorOpen(false)}>
              {t("Batal")}
            </button>
            <button
              className="btn"
              style={{ marginLeft: "auto" }}
              disabled={busy || !form.id}
              onClick={() => void save(!form.isActive)}
            >
              {form.isActive ? t("Non Aktif") : t("Aktif")}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void save()}>
              {busy ? t("Menyimpan…") : t("Simpan")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Kode akun")}
            </label>
            <input
              type="text"
              className={errors.code ? "num field-error" : "num"}
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              placeholder="7-1200"
            />
            {errors.code && <span className="sm" style={{ color: "#C8382F" }}>{errors.code}</span>}
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Nama akun")}
            </label>
            <input
              type="text"
              className={errors.name ? "field-error" : undefined}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
            />
            {errors.name && <span className="sm" style={{ color: "#C8382F" }}>{errors.name}</span>}
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Kelompok")}
            </label>
            <select
              value={form.groupId}
              onChange={(event) => {
                update("groupId", event.target.value);
                setForm((current) => ({ ...current, parentId: event.target.value }));
              }}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {`${group.code.charAt(0)} · ${group.name}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Posisi normal")}</label>
            <select value={normalBalanceFor(formType)} disabled>
              <option value="DEBIT">{t("Debit")}</option>
              <option value="KREDIT">{t("Kredit")}</option>
            </select>
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f">{t("Kategori akun")}</label>
            <select value={form.category} onChange={(event) => update("category", event.target.value as Category)}>
              {CATEGORY_LABELS.map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Akun induk")}</label>
            <select value={form.parentId} onChange={(event) => update("parentId", event.target.value)}>
              {nodes
                .filter((node) => node.id !== form.id)
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {`${node.code} · ${node.name}`}
                  </option>
                ))}
              <option value="">{t("Tidak ada — akun tingkat kelompok")}</option>
            </select>
          </div>
        </div>
        <div className="note" style={{ marginBottom: 12 }}>
          {t(
            "Akun Anak hanya punya induk dan bisa menerima jurnal. Akun berkategori Sub, Parent Sub, dan Main hanya menampung saldo turunannya.",
          )}
        </div>
        <div className="row row-2">
          <div>
            <label className="f">{t("Berlaku di buku")}</label>
            <select disabled defaultValue="semua">
              <option value="semua">{t("Semua unit")}</option>
            </select>
          </div>
          <div>
            <label className="f">{t("Status")}</label>
            <select value={form.isActive ? "AKTIF" : "NONAKTIF"} onChange={(event) => update("isActive", event.target.value === "AKTIF")}>
              <option value="AKTIF">{t("Aktif")}</option>
              <option value="NONAKTIF">{t("Non Aktif")}</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Saldo awal")}</label>
            <input type="text" className="num" defaultValue="0" disabled />
          </div>
        </div>
        <div className="note">
          {form.id
            ? `${t("Akun ini sudah tercatat di bagan akun buku")} ${unitCode}. ${t("Kode akun tidak bisa diubah setelah ada transaksi — buat akun baru dan nonaktifkan yang lama.")}`
            : t("Kode akun tidak bisa diubah setelah ada transaksi — buat akun baru dan nonaktifkan yang lama.")}
        </div>
        {formError && (
          <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 8, fontSize: 12, background: "var(--brick-bg)", color: "var(--brick)" }}>
            {formError}
          </div>
        )}
      </Dialog>
    </>
  );
}
