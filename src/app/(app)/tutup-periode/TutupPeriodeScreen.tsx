"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";

export type ChecklistItem = { label: string; detail: string; done: boolean };
export type TimelineStep = { state: string; color: string; title: string; detail: string };
export type UnitStatusRow = { id: string; label: string; status: string; tone: "ok" | "warn" | "lock" | "open" };

const TONE_CLASS: Record<UnitStatusRow["tone"], string> = {
  ok: "chip chip-ok",
  warn: "chip chip-warn",
  lock: "chip chip-lock",
  open: "chip chip-open",
};

function IconDone() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="10" fill="#3D6B3C" />
      <path d="M7.6 12.4l3 3 5.8-6.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPending() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="12" cy="12" r="10" fill="var(--amber)" />
      <path d="M12 7v5.4l3.2 2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TutupPeriodeScreen({
  periodId,
  periodName,
  periodStatus,
  unitLabel,
  checklist,
  timeline,
  units,
  canClose,
}: {
  periodId: string;
  periodName: string;
  periodStatus: "TERBUKA" | "DITUTUP" | "DIKUNCI";
  unitLabel: string;
  checklist: ChecklistItem[];
  timeline: TimelineStep[];
  units: UnitStatusRow[];
  canClose: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const met = checklist.filter((item) => item.done).length;
  const unmet = checklist.length - met;
  const lockedUnits = periodStatus === "DIKUNCI" ? units.length : 0;

  async function act(action: "ajukan" | "tutup" | "kunci", message: string) {
    if (!periodId) return;
    setBusy(true);
    const res = await fetch(`/api/periods/${periodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);

    if (!res.ok) {
      toast(data.error ?? t("Periode gagal diproses."));
      return;
    }
    toast(message);
    router.refresh();
  }

  return (
    <>
      <PageHead title={t("Tutup & Kunci Periode")} subtitle={t("Penguncian per buku unit, lalu konsolidasi")} />

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Daftar periksa sebelum penguncian")}</h2>
            <span className="sub">
              {t("buku")} {unitLabel} · {met} {t("dari")} {checklist.length} {t("terpenuhi")}
            </span>
          </div>
          <table>
            <tbody>
              {checklist.length === 0 && (
                <tr>
                  <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {checklist.map((item) => (
                <tr key={item.label}>
                  <td style={{ width: 40, paddingLeft: 18 }}>{item.done ? <IconDone /> : <IconPending />}</td>
                  <td>
                    <span style={{ display: "block" }}>{t(item.label)}</span>
                    <span className="sm muted">{t(item.detail)}</span>
                  </td>
                  <td className="r" style={{ width: 130, paddingRight: 18 }}>
                    <span className={item.done ? "chip chip-ok" : "chip chip-warn"}>
                      {item.done ? t("Terpenuhi") : t("Belum")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bal">
            {unmet > 0 ? (
              <span className="chip chip-warn">
                {unmet} {t("syarat belum terpenuhi")}
              </span>
            ) : (
              <span className="chip chip-ok">{t("Semua syarat terpenuhi")}</span>
            )}
            <span className="k">{t("Penguncian tetap bisa diajukan dengan catatan pengecualian")}</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-sm" onClick={() => router.push("/rekonsiliasi")}>
                {t("Ke rekonsiliasi")}
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={busy || !periodId || periodStatus !== "TERBUKA"}
                onClick={() => void act("ajukan", `${t("Pengajuan penguncian periode")} ${periodName} ${t("dikirim ke administrator")}`)}
              >
                {t("Ajukan penguncian")}
              </button>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Alur persetujuan")}</h2>
            </div>
            <div className="card-b">
              {timeline.length === 0 ? (
                <span className="sm muted">{t("Belum ada pengajuan penguncian untuk periode ini")}</span>
              ) : (
                <ul className="timeline">
                  {timeline.map((step, index) => (
                    <li key={`${step.title}-${index}`}>
                      <span className="tm" style={{ color: step.color }}>
                        {t(step.state)}
                      </span>
                      <span>
                        <b>{t(step.title)}</b>
                        <br />
                        <span className="muted sm">{step.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="note" style={{ marginTop: 12 }}>
                {t(
                  "Admin tidak masuk alur ini. Setelah disetujui dan dikunci, jurnal periode ini tidak bisa diubah — koreksi hanya lewat jurnal penyesuaian di periode berjalan.",
                )}
              </div>
              {canClose && (
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    className="btn btn-sm"
                    disabled={busy || !periodId || periodStatus !== "TERBUKA"}
                    onClick={() => void act("tutup", `${t("Periode")} ${periodName} ${t("ditutup")}`)}
                  >
                    {t("Tutup periode")}
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busy || !periodId || periodStatus === "DIKUNCI"}
                    onClick={() => void act("kunci", `${t("Periode")} ${periodName} ${t("dikunci")}`)}
                  >
                    {t("Kunci periode")}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>
                {t("Status buku")} {periodName}
              </h2>
            </div>
            <table>
              <tbody>
                {units.length === 0 && (
                  <tr>
                    <td colSpan={2} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {units.map((unit) => (
                  <tr key={unit.id}>
                    <td style={{ paddingLeft: 18 }}>{unit.label}</td>
                    <td className="r" style={{ paddingRight: 18 }}>
                      <span className={TONE_CLASS[unit.tone]}>{t(unit.status)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bal">
              <span className="k">
                {t("Konsolidasi hanya bisa difinalkan setelah")} {units.length} {t("buku terkunci")}
                {lockedUnits === units.length && units.length > 0 ? ` · ${t("semua buku terkunci")}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
