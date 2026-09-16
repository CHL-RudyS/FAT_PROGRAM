"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";

export type EntitasRow = {
  id: string;
  initial: string;
  name: string;
  kind: "PERUSAHAAN" | "ENTITAS";
  npwp: string | null;
  industry: string | null;
  standard: string | null;
  colorTag: string | null;
  unitCount: number;
  fiscalLabel: string;
  accessCount: number;
  isActive: boolean;
};

export default function KlienScreen({ rows, canEdit }: { rows: EntitasRow[]; canEdit: boolean }) {
  const t = useT();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [standard, setStandard] = useState("");
  const [structure, setStructure] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (standard && row.standard !== standard) return false;
      if (structure === "multi" && row.unitCount <= 1) return false;
      if (structure === "tunggal" && row.unitCount > 1) return false;
      if (!needle) return true;
      return `${row.name} ${row.npwp ?? ""}`.toLowerCase().includes(needle);
    });
  }, [rows, query, standard, structure]);

  return (
    <>
      <PageHead
        title={t("Perusahaan & Entitas")}
        subtitle={t("Setiap entitas punya bagan akun dan buku yang terpisah penuh")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari nama atau NPWP")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 220 }}
            />
            <select
              value={standard}
              onChange={(event) => setStandard(event.target.value)}
              style={{ width: "auto", minWidth: 112, paddingRight: 44 }}
            >
              <option value="">{t("Semua standar")}</option>
              <option value="PSAK">{t("PSAK")}</option>
              <option value="SAK EMKM">{t("SAK EMKM")}</option>
            </select>
            <select
              value={structure}
              onChange={(event) => setStructure(event.target.value)}
              style={{ width: "auto", minWidth: 118, paddingRight: 44 }}
            >
              <option value="">{t("Semua struktur")}</option>
              <option value="multi">{t("Multi unit")}</option>
              <option value="tunggal">{t("Tunggal")}</option>
            </select>
            <button className="btn" onClick={() => toast(t("Daftar entitas diekspor ke Excel"))}>
              {t("Ekspor")}
            </button>
            {canEdit && (
              <Link className="btn btn-primary" href="/klien/baru">
                {t("Tambah entitas")}
              </Link>
            )}
          </>
        }
      />

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 62 }}>{t("Inisial")}</th>
                <th style={{ width: "24%" }}>{t("Entitas")}</th>
                <th>{t("NPWP")}</th>
                <th>{t("KLU / KBLI")}</th>
                <th>{t("Standar")}</th>
                <th>{t("Unit bisnis")}</th>
                <th>{t("Periode fiskal")}</th>
                <th>{t("Akses")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data entitas")}
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span
                      className="num"
                      style={{
                        display: "inline-block",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: ".06em",
                        background: row.colorTag ?? "var(--sunk)",
                        color: row.colorTag ? "#fff" : "var(--ink2)",
                        borderRadius: 5,
                        padding: "1px 6px",
                      }}
                    >
                      {row.initial}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: "block", fontWeight: 500 }}>{row.name}</span>
                    <span className="sm muted">
                      {row.kind === "ENTITAS" ? t("Entitas") : t("Perusahaan")}
                    </span>
                  </td>
                  <td className="num">{row.npwp ?? "—"}</td>
                  <td>{row.industry ?? "—"}</td>
                  <td>{row.standard ?? "—"}</td>
                  <td className="num">
                    {row.unitCount === 0 ? "—" : `${row.unitCount} ${t("unit")}`}
                  </td>
                  <td className="num">{row.fiscalLabel}</td>
                  <td className="num">
                    {row.accessCount === 0 ? "—" : `${row.accessCount} ${t("pengguna")}`}
                  </td>
                  <td className="r">
                    <span className={row.isActive ? "chip chip-ok" : "chip chip-lock"}>
                      {row.isActive ? t("aktif") : t("nonaktif")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bal">
          <span className="k">
            {`${filtered.length} ${t("entitas ditampilkan")}`}
          </span>
          <span style={{ marginLeft: "auto" }}>
            <Link className="btn btn-sm" href="/unit-bisnis">
              {t("Lihat unit bisnis")}
            </Link>
          </span>
        </div>
      </div>
    </>
  );
}
