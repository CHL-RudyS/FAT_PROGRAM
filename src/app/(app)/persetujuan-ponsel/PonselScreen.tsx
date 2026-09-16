"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount } from "@/lib/format";
import TolakDialog, { type RejectPayload } from "../persetujuan/TolakDialog";
import { KIND_CHIP, KIND_LABEL } from "../persetujuan/kinds";

export type PonselRow = {
  id: string;
  kind: string;
  referenceNo: string;
  requester: string;
  unitCode: string;
  amount: number;
  status: string;
  escalateNote: string | null;
  waitingDays: number;
};

type TabKey = "menunggu" | "terlambat" | "riwayat";

const TABS: { key: TabKey; label: string }[] = [
  { key: "menunggu", label: "Menunggu" },
  { key: "terlambat", label: "Terlambat" },
  { key: "riwayat", label: "Riwayat" },
];

export default function PonselScreen({
  rows,
  unitCount,
  companyName,
  canDecide,
}: {
  rows: PonselRow[];
  unitCount: number;
  companyName: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [tab, setTab] = useState<TabKey>("menunggu");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pending = useMemo(() => rows.filter((row) => row.status === "MENUNGGU"), [rows]);

  const listed = useMemo(() => {
    if (tab === "menunggu") return pending;
    if (tab === "terlambat") return pending.filter((row) => row.waitingDays > 3);
    return rows.filter((row) => row.status !== "MENUNGGU");
  }, [tab, pending, rows]);

  async function decide(ids: string[], decision: "DISETUJUI" | "DITOLAK", payload?: RejectPayload) {
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
    const data = (await res.json()) as { error?: string };
    setBusy(false);

    if (!res.ok) {
      const message = data.error ?? t("Keputusan gagal disimpan.");
      if (decision === "DITOLAK") setError(message);
      toast(message);
      return;
    }

    setRejectId(null);
    toast(decision === "DISETUJUI" ? t("Permintaan disetujui dari ponsel") : t("Permintaan ditolak dari ponsel"));
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Persetujuan di Ponsel")}
        subtitle={t("Tampilan ringkas untuk penyetuju yang sedang tidak di depan komputer")}
        actions={
          <button className="btn" onClick={() => toast(t("Tautan unduh aplikasi dikirim ke email Anda"))}>
            {t("Kirim tautan aplikasi")}
          </button>
        }
      />

      <div className="grid-32">
        <div className="card">
          <div className="card-b" style={{ display: "flex", justifyContent: "center", padding: "26px 18px", background: "var(--sunk)" }}>
            <div
              style={{
                width: 328,
                flex: "none",
                border: "9px solid var(--ink)",
                borderRadius: 34,
                overflow: "hidden",
                background: "var(--paper)",
                boxShadow: "0 18px 44px rgba(22,32,27,.22)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 16px 5px",
                  background: "var(--ink)",
                  color: "#F4F6F2",
                  fontSize: 10.5,
                  fontFamily: "var(--mono)",
                }}
              >
                <span>08.27</span>
                <span>WIB · 4G</span>
              </div>

              <div style={{ padding: "13px 15px 11px", background: "var(--ledger)", color: "#fff" }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: ".09em",
                    textTransform: "uppercase",
                    opacity: 0.82,
                  }}
                >
                  {t("Persetujuan")}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.015em", marginTop: 3 }}>
                  {pending.length === 0 ? "—" : pending.length} {t("menunggu Anda")}
                </div>
                <div style={{ fontSize: 11.5, opacity: 0.88, marginTop: 2 }}>
                  {unitCount} {t("buku unit")} · {companyName}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 2,
                  padding: "0 12px",
                  background: "var(--card)",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                {TABS.map((item, index) => {
                  const on = tab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTab(item.key)}
                      style={{
                        padding: "9px 2px",
                        marginRight: index === TABS.length - 1 ? undefined : 16,
                        fontSize: 12,
                        fontWeight: on ? 500 : undefined,
                        color: on ? "var(--ledger-dk)" : "var(--ink3)",
                        borderBottom: on ? "2px solid var(--ledger)" : undefined,
                        marginBottom: on ? -1 : undefined,
                        cursor: "pointer",
                      }}
                    >
                      {t(item.label)}
                    </button>
                  );
                })}
              </div>

              <div style={{ maxHeight: 396, overflowY: "auto", background: "var(--card)" }}>
                {listed.length === 0 && (
                  <div className="sm muted" style={{ padding: "22px 15px", textAlign: "center" }}>
                    {t("Belum ada permintaan yang menunggu")}
                  </div>
                )}
                {listed.map((row, index) => (
                  <div
                    key={row.id}
                    style={{
                      padding: "12px 15px",
                      borderBottom: index === listed.length - 1 ? undefined : "1px solid var(--rule)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className={KIND_CHIP[row.kind] ?? "chip chip-open"}>
                        {t(KIND_LABEL[row.kind] ?? row.kind)}
                      </span>
                      <span className="num sm muted" style={{ marginLeft: "auto" }}>
                        {row.referenceNo}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 7 }}>
                      {row.escalateNote ?? t(KIND_LABEL[row.kind] ?? row.kind)}
                    </div>
                    <div className="sm muted" style={{ marginTop: 1 }}>
                      {t("Diajukan")} {row.requester} · {t("buku")} {row.unitCode} · {t("menunggu")} {row.waitingDays}{" "}
                      {t("hari")}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 8 }}>
                      <span className="num" style={{ fontSize: 18, fontWeight: 500, letterSpacing: "-.03em" }}>
                        {row.amount === 0 ? "—" : formatAmount(row.amount)}
                      </span>
                      <span className="sm muted">{t("nilai pengajuan")}</span>
                    </div>
                    {row.status !== "MENUNGGU" ? (
                      <div style={{ marginTop: 11 }}>
                        <span className={row.status === "DISETUJUI" ? "chip chip-ok" : "chip chip-bad"}>
                          {t(row.status === "DISETUJUI" ? "Disetujui" : "Ditolak")}
                        </span>
                      </div>
                    ) : canDecide ? (
                      <div style={{ display: "flex", gap: 7, marginTop: 11 }}>
                        <button
                          className="btn btn-sm"
                          style={{ flex: 1, minHeight: 36 }}
                          disabled={busy}
                          onClick={() => {
                            setError("");
                            setRejectId(row.id);
                          }}
                        >
                          {t("Tolak")}
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ flex: 1, minHeight: 36 }}
                          disabled={busy}
                          onClick={() => void decide([row.id], "DISETUJUI")}
                        >
                          {t("Setujui")}
                        </button>
                      </div>
                    ) : (
                      <div className="sm muted" style={{ marginTop: 11 }}>
                        {t("Anda tidak berwenang memutuskan persetujuan.")}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-around",
                  padding: "9px 0 12px",
                  background: "var(--card)",
                  borderTop: "1px solid var(--rule)",
                  fontSize: 10.5,
                  color: "var(--ink3)",
                }}
              >
                <span style={{ color: "var(--ledger-dk)", fontWeight: 600 }}>{t("Persetujuan")}</span>
                <span>{t("Buku")}</span>
                <span>{t("Notifikasi")}</span>
                <span>{t("Profil")}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Yang bisa dilakukan di ponsel")}</h2>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>{t("Menyetujui & menolak")}</td>
                  <td className="r" style={{ color: "var(--ledger)" }}>
                    ✓
                  </td>
                </tr>
                <tr>
                  <td>{t("Melihat bukti dan lampiran")}</td>
                  <td className="r" style={{ color: "var(--ledger)" }}>
                    ✓
                  </td>
                </tr>
                <tr>
                  <td>{t("Melihat saldo dan ringkasan buku")}</td>
                  <td className="r" style={{ color: "var(--ledger)" }}>
                    ✓
                  </td>
                </tr>
                <tr>
                  <td>{t("Membuat atau mengubah jurnal")}</td>
                  <td className="r muted">—</td>
                </tr>
                <tr>
                  <td>{t("Tutup dan kunci periode")}</td>
                  <td className="r muted">—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Keamanan perangkat")}</h2>
            </div>
            <ul className="timeline" style={{ padding: "6px 18px 12px" }}>
              <li>
                <span className="tm">{t("Masuk")}</span>
                <span>{t("Wajib verifikasi dua langkah pada perangkat baru")}</span>
              </li>
              <li>
                <span className="tm">{t("Sesi")}</span>
                <span>{t("Berakhir otomatis setelah 30 menit tidak aktif")}</span>
              </li>
              <li>
                <span className="tm">{t("Jejak")}</span>
                <span>{t("Setiap keputusan dicatat dengan perangkat dan lokasi")}</span>
              </li>
            </ul>
          </div>

          <div className="note">
            {t("Keputusan dari ponsel dan dari komputer masuk ke jejak audit yang sama, jadi tidak ada jalur persetujuan terpisah.")}
          </div>
        </div>
      </div>

      <TolakDialog
        open={rejectId !== null}
        busy={busy}
        error={error}
        onClose={() => {
          setRejectId(null);
          setError("");
        }}
        onSubmit={(payload) => {
          if (rejectId) void decide([rejectId], "DITOLAK", payload);
        }}
      />
    </>
  );
}
