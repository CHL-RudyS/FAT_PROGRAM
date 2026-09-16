"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { dash, formatAmount } from "@/lib/format";
import TolakDialog, { type RejectPayload } from "./TolakDialog";
import { KIND_CHIP, KIND_FILTERS, KIND_LABEL } from "./kinds";

export type ApprovalRow = {
  id: string;
  kind: string;
  referenceNo: string;
  requester: string;
  unitCode: string;
  unitName: string;
  amount: number;
  status: string;
  escalateNote: string | null;
  waitingDays: number;
};

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  when: string;
};

type TabKey = "all" | "terlambat" | "delegasi" | "riwayat";

export default function PersetujuanScreen({
  rows,
  units,
  notifications,
  unitCount,
  approvedThisWeek,
  rejectedThisWeek,
  averageHours,
  canDecide,
}: {
  rows: ApprovalRow[];
  units: { id: string; code: string; name: string }[];
  notifications: NotificationRow[];
  unitCount: number;
  approvedThisWeek: number;
  rejectedThisWeek: number;
  averageHours: number;
  canDecide: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [kindFilter, setKindFilter] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [tab, setTab] = useState<TabKey>("all");
  const [checked, setChecked] = useState<string[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectIds, setRejectIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pending = useMemo(() => rows.filter((row) => row.status === "MENUNGGU"), [rows]);
  const late = useMemo(() => pending.filter((row) => row.waitingDays > 3), [pending]);
  const delegated = useMemo(() => pending.filter((row) => row.escalateNote), [pending]);
  const history = useMemo(() => rows.filter((row) => row.status !== "MENUNGGU"), [rows]);

  const scoped = useMemo(() => {
    const base =
      tab === "all" ? pending : tab === "terlambat" ? late : tab === "delegasi" ? delegated : history;
    return base.filter((row) => {
      if (kindFilter && (KIND_LABEL[row.kind] ?? row.kind) !== kindFilter) return false;
      if (unitFilter && row.unitCode !== unitFilter) return false;
      return true;
    });
  }, [tab, pending, late, delegated, history, kindFilter, unitFilter]);

  const selected = useMemo(
    () => checked.filter((id) => scoped.some((row) => row.id === id && row.status === "MENUNGGU")),
    [checked, scoped],
  );

  function toggle(id: string) {
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function decide(ids: string[], decision: "DISETUJUI" | "DITOLAK", payload?: RejectPayload) {
    if (ids.length === 0) {
      toast(t("Pilih permintaan yang akan diputuskan."));
      return;
    }

    setBusy(true);
    setError("");
    const res = await fetch("/api/approvals/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids,
        decision,
        reason: payload?.reason,
        note: payload?.note,
        notifyRequester: payload?.notifyRequester ?? true,
      }),
    });
    const data = (await res.json()) as { error?: string; decided?: number };
    setBusy(false);

    if (!res.ok) {
      const message = data.error ?? t("Keputusan gagal disimpan.");
      if (decision === "DITOLAK") setError(message);
      toast(message);
      return;
    }

    setChecked([]);
    setRejectOpen(false);
    setRejectIds([]);
    toast(
      decision === "DISETUJUI"
        ? t("Permintaan terpilih disetujui dan pengaju diberi tahu")
        : t("Permintaan ditolak dan catatan dikirim ke pengaju"),
    );
    router.refresh();
  }

  function openReject(ids: string[]) {
    if (ids.length === 0) {
      toast(t("Pilih permintaan yang akan diputuskan."));
      return;
    }
    setRejectIds(ids);
    setError("");
    setRejectOpen(true);
  }

  const allChecked = scoped.length > 0 && scoped.every((row) => checked.includes(row.id));

  return (
    <>
      <PageHead
        title={t("Notifikasi & Persetujuan")}
        subtitle={t("Satu kotak untuk semua permintaan yang menunggu keputusan Anda")}
        actions={
          <>
            <select style={{ width: "auto" }} value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
              <option value="">{t("Semua jenis")}</option>
              {KIND_FILTERS.map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => toast(t("Pengaturan notifikasi dibuka"))}>
              {t("Atur notifikasi")}
            </button>
            {canDecide && (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void decide(scoped.filter((row) => row.status === "MENUNGGU").map((row) => row.id), "DISETUJUI")}
              >
                {t("Setujui terpilih")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Menunggu keputusan saya")}</div>
          <div className="v">{dash(pending.length)}</div>
          <div className="d muted">
            {t("di")} {unitCount} {t("buku unit")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Terlambat > 3 hari")}</div>
          <div className="v" style={{ color: "var(--brick)" }}>
            {dash(late.length)}
          </div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {t("dieskalasi otomatis")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Disetujui minggu ini")}</div>
          <div className="v">{dash(approvedThisWeek)}</div>
          <div className="d muted">{t("oleh saya")}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Ditolak minggu ini")}</div>
          <div className="v">{dash(rejectedThisWeek)}</div>
          <div className="d muted">{t("dengan catatan")}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Rata-rata waktu putusan")}</div>
          <div className="v">{averageHours === 0 ? "—" : averageHours.toFixed(1)}</div>
          <div className="d muted">{t("jam kerja")}</div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Kotak persetujuan")}</h2>
            <div className="rt">
              <select style={{ width: "auto" }} value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                <option value="">{t("Semua buku")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.code}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ padding: "12px 18px 0" }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={tab === "all" ? "tab on" : "tab"} onClick={() => setTab("all")}>
                {t("Menunggu")} <span className="muted">{pending.length}</span>
              </button>
              <button className={tab === "terlambat" ? "tab on" : "tab"} onClick={() => setTab("terlambat")}>
                {t("Terlambat")} <span style={{ color: "var(--brick)" }}>{late.length}</span>
              </button>
              <button className={tab === "delegasi" ? "tab on" : "tab"} onClick={() => setTab("delegasi")}>
                {t("Didelegasikan")} <span className="muted">{delegated.length}</span>
              </button>
              <button className={tab === "riwayat" ? "tab on" : "tab"} onClick={() => setTab("riwayat")}>
                {t("Riwayat")} <span className="muted">{history.length}</span>
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 1000, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      aria-label={t("Pilih semua")}
                      style={{ width: "auto" }}
                      checked={allChecked}
                      onChange={(event) => setChecked(event.target.checked ? scoped.map((row) => row.id) : [])}
                    />
                  </th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Jenis")}</th>
                  <th style={{ width: "20%" }}>{t("Referensi")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Pengaju")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Buku")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>
                    {t("Nilai")}
                  </th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Menunggu")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scoped.length === 0 && (
                  <tr>
                    <td colSpan={8} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada permintaan yang menunggu")}
                    </td>
                  </tr>
                )}
                {scoped.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={row.referenceNo}
                        style={{ width: "auto" }}
                        checked={checked.includes(row.id)}
                        onChange={() => toggle(row.id)}
                      />
                    </td>
                    <td>
                      <span className={KIND_CHIP[row.kind] ?? "chip chip-open"}>
                        {t(KIND_LABEL[row.kind] ?? row.kind)}
                      </span>
                    </td>
                    <td className="num">{row.referenceNo}</td>
                    <td>{row.requester}</td>
                    <td className="num">{row.unitCode}</td>
                    <td className="r num">{row.amount === 0 ? "—" : formatAmount(row.amount)}</td>
                    <td className="num" style={{ color: row.waitingDays > 3 ? "var(--brick)" : undefined }}>
                      {row.waitingDays} {t("hari")}
                    </td>
                    <td className="r">
                      {row.status !== "MENUNGGU" ? (
                        <span className={row.status === "DISETUJUI" ? "chip chip-ok" : "chip chip-bad"}>
                          {t(row.status === "DISETUJUI" ? "Disetujui" : "Ditolak")}
                        </span>
                      ) : canDecide ? (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button className="btn btn-sm" disabled={busy} onClick={() => openReject([row.id])}>
                            {t("Tolak")}
                          </button>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={busy}
                            onClick={() => void decide([row.id], "DISETUJUI")}
                          >
                            {t("Setujui")}
                          </button>
                        </span>
                      ) : (
                        <span className="sm muted">{t("Menunggu")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">
              {scoped.length} {t("dari")} {rows.length} {t("permintaan ditampilkan")}
            </span>
            {canDecide && (
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn btn-sm" disabled={busy} onClick={() => openReject(selected)}>
                  {t("Tolak dengan catatan")}
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={busy}
                  onClick={() => void decide(selected, "DISETUJUI")}
                >
                  {t("Setujui")}
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Notifikasi terbaru")}</h2>
            </div>
            <ul className="timeline" style={{ padding: "6px 18px 12px" }}>
              {notifications.length === 0 && (
                <li className="sm muted">{t("Belum ada notifikasi")}</li>
              )}
              {notifications.map((item) => (
                <li key={item.id}>
                  <span className="tm">{t(item.when)}</span>
                  <span>
                    {item.title}
                    {item.body && <span className="sm muted" style={{ display: "block" }}>{item.body}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Aturan eskalasi")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Jika menunggu")}</th>
                  <th className="r">{t("Tindakan")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t("1 hari kerja")}</td>
                  <td className="r">{t("Pengingat ke penyetuju")}</td>
                </tr>
                <tr>
                  <td>{t("3 hari kerja")}</td>
                  <td className="r">{t("Naik ke atasan penyetuju")}</td>
                </tr>
                <tr>
                  <td>{t("5 hari kerja")}</td>
                  <td className="r">{t("Masuk daftar perhatian direksi")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="note">
            {t("Persetujuan tidak mengubah angka buku. Dokumen baru menjurnal setelah disetujui dan dicatat di modul terkait.")}
          </div>
        </div>
      </div>

      <TolakDialog
        open={rejectOpen}
        busy={busy}
        error={error}
        onClose={() => {
          setRejectOpen(false);
          setRejectIds([]);
          setError("");
        }}
        onSubmit={(payload) => void decide(rejectIds, "DITOLAK", payload)}
      />
    </>
  );
}
