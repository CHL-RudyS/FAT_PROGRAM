"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatDateTime, humanizeEnum } from "@/lib/format";

export type AuditRow = {
  id: string;
  createdAt: string;
  userName: string | null;
  roleName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  changes: string | null;
};

export type AuditFilters = { userId: string; entityType: string; from: string; to: string };

export default function JejakAuditScreen({
  rows,
  users,
  entityTypes,
  filters,
}: {
  rows: AuditRow[];
  users: Array<{ id: string; name: string }>;
  entityTypes: string[];
  filters: AuditFilters;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [pending, setPending] = useState<AuditFilters>(filters);

  function apply(next: AuditFilters) {
    setPending(next);
    const query = new URLSearchParams();
    if (next.userId) query.set("userId", next.userId);
    if (next.entityType) query.set("entityType", next.entityType);
    if (next.from) query.set("from", next.from);
    if (next.to) query.set("to", next.to);
    const search = query.toString();
    router.push(search ? `/jejak-audit?${search}` : "/jejak-audit");
  }

  return (
    <>
      <PageHead
        title={t("Jejak Audit")}
        subtitle={t("Setiap perubahan data tercatat dengan pengguna dan waktu, tidak bisa dihapus")}
        actions={
          <>
            <select
              style={{ width: "auto" }}
              value={pending.userId}
              onChange={(event) => apply({ ...pending, userId: event.target.value })}
            >
              <option value="">{t("Semua pengguna")}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select
              style={{ width: "auto" }}
              value={pending.entityType}
              onChange={(event) => apply({ ...pending, entityType: event.target.value })}
            >
              <option value="">{t("Semua objek")}</option>
              {entityTypes.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
            <input
              type="date"
              style={{ width: "auto" }}
              value={pending.from}
              onChange={(event) => apply({ ...pending, from: event.target.value })}
            />
            <input
              type="date"
              style={{ width: "auto" }}
              value={pending.to}
              onChange={(event) => apply({ ...pending, to: event.target.value })}
            />
            <button className="btn" onClick={() => toast(t("Jejak audit diekspor ke Excel"))}>
              {t("Ekspor")}
            </button>
          </>
        }
      />

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 150 }}>{t("Waktu")}</th>
                <th style={{ width: 120 }}>{t("Pengguna")}</th>
                <th style={{ width: 110 }}>{t("Aksi")}</th>
                <th style={{ width: 60 }}>{t("Buku")}</th>
                <th style={{ width: 140 }}>{t("Objek")}</th>
                <th>{t("Perubahan")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="num sm">{formatDateTime(row.createdAt)}</td>
                  <td>
                    <span style={{ display: "block" }}>{row.userName ?? "—"}</span>
                    {row.roleName && <span className="sm muted">{row.roleName}</span>}
                  </td>
                  <td>
                    <span className="chip chip-open">{humanizeEnum(row.action)}</span>
                  </td>
                  <td className="num muted">—</td>
                  <td>
                    <span style={{ display: "block" }}>{row.entityType}</span>
                    {row.entityId && <span className="sm muted num">{row.entityId.slice(0, 8)}</span>}
                  </td>
                  <td className="sm">
                    <span style={{ display: "block" }}>{row.summary ?? "—"}</span>
                    {row.changes && (
                      <span className="sm muted num" style={{ display: "block", wordBreak: "break-all" }}>
                        {row.changes.length > 160 ? `${row.changes.slice(0, 160)}…` : row.changes}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bal">
          <span className="k">
            {rows.length === 0 ? t("Belum ada data") : `${rows.length} ${t("catatan ditampilkan")}`}
          </span>
          <span className="chip chip-info" style={{ marginLeft: "auto" }}>
            {t("Jejak audit tidak bisa diubah atau dihapus")}
          </span>
        </div>
      </div>
    </>
  );
}
