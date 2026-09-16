"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { chipClassFor, formatDateTime, humanizeEnum } from "@/lib/format";

export type NumberingRow = { id: string; docType: string; pattern: string; nextNumber: number };
export type IntegrationRow = {
  id: string;
  name: string;
  status: "TERHUBUNG" | "TERPUTUS" | "BELUM_DIATUR";
  lastSyncAt: string | null;
};

const INTEGRATION_STATUS: Array<IntegrationRow["status"]> = ["TERHUBUNG", "TERPUTUS", "BELUM_DIATUR"];

export default function SetelanScreen({
  numbering,
  integrations,
  periods,
  activePeriodId,
  unitLabel,
  canEdit,
}: {
  numbering: NumberingRow[];
  integrations: IntegrationRow[];
  periods: Array<{ id: string; label: string }>;
  activePeriodId: string;
  unitLabel: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [numberingDraft, setNumberingDraft] = useState(numbering);
  const [integrationDraft, setIntegrationDraft] = useState(integrations);
  const [busy, setBusy] = useState(false);

  function reset() {
    setNumberingDraft(numbering);
    setIntegrationDraft(integrations);
    toast(t("Perubahan setelan dibatalkan"));
  }

  async function save() {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numbering: numberingDraft.map((entry) => ({
          id: entry.id,
          pattern: entry.pattern,
          nextNumber: entry.nextNumber,
        })),
        integrations: integrationDraft.map((entry) => ({ id: entry.id, status: entry.status })),
      }),
    });
    const data = (await res.json()) as { error?: string };
    setBusy(false);

    if (!res.ok) {
      toast(data.error ?? t("Gagal menyimpan setelan."));
      return;
    }

    toast(t("Setelan sistem tersimpan dan dicatat di jejak audit"));
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Setelan Sistem")}
        subtitle={t("Kebijakan pembukuan yang berlaku untuk seluruh entitas dan buku unit")}
        actions={
          <>
            <button className="btn" onClick={reset}>
              {t("Batalkan perubahan")}
            </button>
            <button className="btn btn-primary" disabled={!canEdit || busy} onClick={() => void save()}>
              {busy ? t("Menyimpan…") : t("Simpan setelan")}
            </button>
          </>
        }
      />

      <div className="grid2">
        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Periode & mata uang")}</h2>
            </div>
            <div className="card-b">
              <div className="row row-2">
                <div>
                  <label className="f">{t("Awal tahun buku")}</label>
                  <select defaultValue="Januari" disabled={!canEdit}>
                    <option>Januari</option>
                    <option>April</option>
                    <option>Juli</option>
                  </select>
                </div>
                <div>
                  <label className="f">{t("Periode aktif")}</label>
                  <select defaultValue={activePeriodId} disabled={!canEdit}>
                    {periods.length === 0 && <option value="">—</option>}
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label className="f">{t("Mata uang pelaporan")}</label>
                  <select defaultValue="IDR · Rupiah" disabled={!canEdit}>
                    <option>IDR · Rupiah</option>
                    <option>USD · Dolar Amerika</option>
                  </select>
                </div>
                <div>
                  <label className="f">{t("Format angka")}</label>
                  <select defaultValue="1.234.567,89" disabled={!canEdit}>
                    <option>1.234.567,89</option>
                    <option>1,234,567.89</option>
                  </select>
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label className="f">{t("Standar akuntansi")}</label>
                  <select defaultValue="PSAK" disabled={!canEdit}>
                    <option>PSAK</option>
                    <option>SAK EMKM</option>
                    <option>SAK ETAP</option>
                  </select>
                </div>
                <div>
                  <label className="f">{t("Zona waktu")}</label>
                  <select defaultValue="WIB · GMT+7" disabled={!canEdit}>
                    <option>WIB · GMT+7</option>
                    <option>WITA · GMT+8</option>
                    <option>WIT · GMT+9</option>
                  </select>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--ink2)", cursor: "pointer" }}>
                <input type="checkbox" defaultChecked style={{ width: "auto" }} disabled={!canEdit} />
                <span>{t("Kunci otomatis periode 10 hari setelah tutup bulan")}</span>
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Penomoran dokumen")}</h2>
              <span className="sub">{`${t("berlaku per buku unit")} · ${unitLabel}`}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Dokumen")}</th>
                  <th>{t("Pola")}</th>
                  <th className="r">{t("Nomor berikut")}</th>
                </tr>
              </thead>
              <tbody>
                {numberingDraft.length === 0 && (
                  <tr>
                    <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {numberingDraft.map((entry) => (
                  <tr key={entry.id}>
                    <td>{humanizeEnum(entry.docType)}</td>
                    <td>
                      <input
                        type="text"
                        className="num sm"
                        disabled={!canEdit}
                        value={entry.pattern}
                        onChange={(event) =>
                          setNumberingDraft((current) =>
                            current.map((row) => (row.id === entry.id ? { ...row, pattern: event.target.value } : row)),
                          )
                        }
                        style={{ textAlign: "left" }}
                      />
                    </td>
                    <td className="r">
                      <input
                        type="number"
                        className="num"
                        min={1}
                        disabled={!canEdit}
                        value={entry.nextNumber}
                        onChange={(event) =>
                          setNumberingDraft((current) =>
                            current.map((row) =>
                              row.id === entry.id ? { ...row, nextNumber: Number(event.target.value) || 1 } : row,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bal">
              <span className="k">{t("Pola nomor tidak bisa diubah untuk periode yang sudah dikunci")}</span>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Kebijakan pembukuan")}</h2>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>{t("Penilaian persediaan")}</td>
                  <td className="r">{t("Rata-rata bergerak")}</td>
                </tr>
                <tr>
                  <td>{t("Metode penyusutan")}</td>
                  <td className="r">{t("Garis lurus")}</td>
                </tr>
                <tr>
                  <td>{t("Tarif PPN")}</td>
                  <td className="r num">11%</td>
                </tr>
                <tr>
                  <td>{t("Pembulatan pajak")}</td>
                  <td className="r">{t("Ke bawah, rupiah penuh")}</td>
                </tr>
                <tr>
                  <td>{t("Jurnal balik otomatis")}</td>
                  <td className="r">{t("Aktif untuk akrual bulanan")}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Integrasi")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Layanan")}</th>
                  <th>{t("Status")}</th>
                  <th className="r">{t("Terakhir sinkron")}</th>
                </tr>
              </thead>
              <tbody>
                {integrationDraft.length === 0 && (
                  <tr>
                    <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {integrationDraft.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.name}</td>
                    <td>
                      {canEdit ? (
                        <select
                          value={entry.status}
                          onChange={(event) =>
                            setIntegrationDraft((current) =>
                              current.map((row) =>
                                row.id === entry.id
                                  ? { ...row, status: event.target.value as IntegrationRow["status"] }
                                  : row,
                              ),
                            )
                          }
                          style={{ width: "auto" }}
                        >
                          {INTEGRATION_STATUS.map((status) => (
                            <option key={status} value={status}>
                              {humanizeEnum(status)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={chipClassFor(entry.status)}>{humanizeEnum(entry.status)}</span>
                      )}
                    </td>
                    <td className="r num">{entry.lastSyncAt ? formatDateTime(entry.lastSyncAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bal">
              <span style={{ marginLeft: "auto" }}>
                <button className="btn btn-sm" onClick={() => toast(t("Halaman izin integrasi dibuka"))}>
                  {t("Kelola izin")}
                </button>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Cadangan & retensi")}</h2>
            </div>
            <div className="card-b">
              <div className="row row-2">
                <div>
                  <label className="f">{t("Cadangan otomatis")}</label>
                  <select defaultValue="Harian, 01.00 WIB" disabled={!canEdit}>
                    <option>Harian, 01.00 WIB</option>
                    <option>Mingguan</option>
                  </select>
                </div>
                <div>
                  <label className="f">{t("Retensi arsip")}</label>
                  <select defaultValue="10 tahun" disabled={!canEdit}>
                    <option>10 tahun</option>
                    <option>5 tahun</option>
                  </select>
                </div>
              </div>
              <div className="dz">
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t("Cadangan terakhir")}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
                  {t("— · unduh berkas cadangan untuk disimpan di luar sistem")}
                </div>
              </div>
            </div>
            <div className="bal">
              <span style={{ marginLeft: "auto" }}>
                <button className="btn btn-sm" onClick={() => toast(t("Cadangan sedang dibuat"))}>
                  {t("Buat cadangan sekarang")}
                </button>
              </span>
            </div>
          </div>

          <div className="note">
            {t("Setiap perubahan setelan dicatat di Jejak Audit dengan pengguna dan waktu, dan tidak bisa dihapus.")}
          </div>
        </div>
      </div>
    </>
  );
}
