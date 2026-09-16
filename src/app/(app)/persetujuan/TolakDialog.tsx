"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import { useT } from "@/i18n/LocaleProvider";

/** The prototype's reject-reason dialog `m-tolak` (lines 5871–5894). */
export const REJECT_REASONS = [
  "Bukti tidak lengkap",
  "Melewati batas anggaran",
  "Akun tujuan salah",
  "Perlu penawaran pembanding",
  "Lainnya",
];

export type RejectPayload = { reason: string; note: string; notifyRequester: boolean };

export default function TolakDialog({
  open,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: RejectPayload) => void;
}) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [localError, setLocalError] = useState("");

  function close() {
    setReason("");
    setNote("");
    setNotify(true);
    setLocalError("");
    onClose();
  }

  function submit() {
    if (!reason) {
      setLocalError(t("Alasan penolakan harus dipilih."));
      return;
    }
    if (!note.trim()) {
      setLocalError(t("Catatan untuk pengaju harus diisi."));
      return;
    }
    setLocalError("");
    onSubmit({ reason, note: note.trim(), notifyRequester: notify });
  }

  const shown = localError || error;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("Tolak permintaan")}
      maxWidth={480}
      footer={
        <>
          <button className="btn" onClick={close}>
            {t("Batal")}
          </button>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={busy} onClick={submit}>
            {busy ? t("Memproses…") : t("Tolak permintaan")}
          </button>
        </>
      }
    >
      <div className="row">
        <div>
          <label className="f" data-req="1">
            {t("Alasan penolakan")}
          </label>
          <select
            className={localError && !reason ? "field-error" : undefined}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setLocalError("");
            }}
          >
            <option value="">{t("— Pilih alasan —")}</option>
            {REJECT_REASONS.map((item) => (
              <option key={item} value={item}>
                {t(item)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="row">
        <div>
          <label className="f" data-req="1">
            {t("Catatan untuk pengaju")}
          </label>
          <textarea
            rows={4}
            placeholder={t("Jelaskan apa yang perlu diperbaiki…")}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setLocalError("");
            }}
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
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          fontSize: 12.5,
          color: "var(--ink2)",
          cursor: "pointer",
          marginBottom: 12,
        }}
      >
        <input
          type="checkbox"
          checked={notify}
          onChange={(event) => setNotify(event.target.checked)}
          style={{ width: "auto" }}
        />
        <span>{t("Kirim salinan catatan ke email pengaju")}</span>
      </label>
      <div className="note note-warn">
        {t("Penolakan mengembalikan dokumen ke status draf. Pengaju bisa memperbaiki dan mengajukan ulang.")}
      </div>

      {shown && (
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
          {shown}
        </div>
      )}
    </Dialog>
  );
}
