"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import {
  MONTHS_ID,
  MONTHS_SHORT_ID,
  chipClassFor,
  dash,
  formatAmount,
  formatDate,
  formatDateLong,
  parseAmountInput,
} from "@/lib/format";

export type AssetRow = {
  id: string;
  code: string;
  name: string;
  group: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  method: string;
  status: "AKTIF" | "DIJUAL" | "DIHAPUS" | "HABIS_SUSUT";
  accumulated: number;
  bookValue: number;
  periodExpense: number;
  postedPeriods: number;
};

export type UnitOption = { id: string; code: string; name: string };
export type AccountOption = { id: string; code: string; name: string };

/**
 * Kelompok harta dan masa manfaat komersial yang dipakai prototipe.
 * Dipakai dua kali: tabel "Kelompok & masa manfaat" dan usulan masa manfaat
 * saat kelompok dipilih di dialog tambah aset.
 */
const GROUPS: Array<{ name: string; months: number }> = [
  { name: "Kendaraan", months: 48 },
  { name: "Mesin & peralatan", months: 96 },
  { name: "Inventaris kantor", months: 48 },
  { name: "Bangunan", months: 240 },
];

const STATUS_LABEL: Record<AssetRow["status"], string> = {
  AKTIF: "Digunakan",
  DIJUAL: "Dijual",
  DIHAPUS: "Dihapus",
  HABIS_SUSUT: "Habis susut",
};

type ScheduleRow = { label: string; expense: number; accumulated: number; bookValue: number };

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Penyusutan garis lurus — persis rumus di `src/app/api/fixed-assets/schedule.ts`:
 * beban per bulan = (nilai perolehan − nilai residu) / masa manfaat.
 * Periode pertama adalah bulan perolehan, periode terakhir menyerap pembulatan.
 */
function straightLine(input: {
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  acquisitionDate: string;
}): ScheduleRow[] {
  const life = Math.min(Math.max(0, Math.trunc(input.usefulLifeMonths)), 600);
  const depreciable = round2(Math.max(0, input.acquisitionCost - input.residualValue));
  if (life === 0 || depreciable === 0) return [];

  const start = new Date(input.acquisitionDate);
  if (Number.isNaN(start.getTime())) return [];
  const startIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();

  const monthly = round2(depreciable / life);
  const rows: ScheduleRow[] = [];
  let accumulated = 0;

  for (let offset = 0; offset < life; offset += 1) {
    const remaining = round2(depreciable - accumulated);
    if (remaining <= 0) break;
    const expense = offset === life - 1 ? remaining : Math.min(monthly, remaining);
    accumulated = round2(accumulated + expense);
    const index = startIndex + offset;
    rows.push({
      label: `${MONTHS_SHORT_ID[index % 12]} ${Math.floor(index / 12)}`,
      expense,
      accumulated,
      bookValue: round2(input.acquisitionCost - accumulated),
    });
  }
  return rows;
}

const emptyForm = {
  name: "",
  code: "",
  group: "",
  acquisitionDate: "",
  unitId: "",
  acquisitionCost: "",
  usefulLifeMonths: "48",
  residualValue: "",
  assetAccountId: "",
  depreciationAccountId: "",
};

export default function AsetTetapScreen({
  assets,
  units,
  assetAccounts,
  expenseAccounts,
  unitId,
  unitLabel,
  currentYear,
  currentMonth,
  accountCodes,
  canEdit,
}: {
  assets: AssetRow[];
  units: UnitOption[];
  assetAccounts: AccountOption[];
  expenseAccounts: AccountOption[];
  unitId: string;
  unitLabel: string;
  currentYear: number;
  currentMonth: number;
  accountCodes: { asset: string; accumulated: string; expense: string };
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [buku, setBuku] = useState("");
  const [group, setGroup] = useState("");
  const [tab, setTab] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(assets[0]?.id ?? null);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [runOpen, setRunOpen] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [run, setRun] = useState({
    year: String(currentYear),
    month: String(currentMonth),
    unitId,
  });

  const scoped = useMemo(
    () => assets.filter((asset) => (buku ? asset.unitId === buku : true)),
    [assets, buku],
  );

  const counts = useMemo(
    () => ({
      all: scoped.length,
      digunakan: scoped.filter((asset) => asset.status === "AKTIF").length,
      // Status "dalam perbaikan" belum ada di `AssetStatus`, jadi hitungannya selalu nol.
      perbaikan: 0,
      lepas: scoped.filter((asset) => asset.status === "DIJUAL" || asset.status === "DIHAPUS").length,
    }),
    [scoped],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter((asset) => {
      if (group && asset.group !== group) return false;
      if (tab === "digunakan" && asset.status !== "AKTIF") return false;
      if (tab === "perbaikan") return false;
      if (tab === "lepas" && asset.status !== "DIJUAL" && asset.status !== "DIHAPUS") return false;
      if (!needle) return true;
      return `${asset.code} ${asset.name}`.toLowerCase().includes(needle);
    });
  }, [scoped, query, group, tab]);

  const metrics = useMemo(() => {
    const acquisition = scoped.reduce((sum, asset) => sum + asset.acquisitionCost, 0);
    const accumulated = scoped.reduce((sum, asset) => sum + asset.accumulated, 0);
    const periodExpense = scoped.reduce((sum, asset) => sum + asset.periodExpense, 0);
    const endingSoon = scoped.filter(
      (asset) => asset.status === "AKTIF" && asset.usefulLifeMonths - asset.postedPeriods <= 6,
    ).length;
    return { acquisition, accumulated, bookValue: acquisition - accumulated, periodExpense, endingSoon };
  }, [scoped]);

  const shownBookValue = filtered.reduce((sum, asset) => sum + asset.bookValue, 0);

  const selected = useMemo(
    () => filtered.find((asset) => asset.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const schedule = useMemo(() => (selected ? straightLine(selected) : []), [selected]);
  const scheduleHead = schedule.slice(0, 3);
  const scheduleTail = schedule.slice(3);
  const tailExpense = scheduleTail.reduce((sum, row) => sum + row.expense, 0);
  const lastRow = schedule[schedule.length - 1];

  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of scoped) map.set(asset.group, (map.get(asset.group) ?? 0) + 1);
    return map;
  }, [scoped]);

  const bukuLabel = buku ? units.find((unit) => unit.id === buku)?.code ?? unitLabel : unitLabel;
  const asOf = formatDateLong(new Date(Date.UTC(currentYear, currentMonth, 0)));

  // Beban per bulan dihitung sambil mengetik, seperti prototipe.
  const formCost = parseAmountInput(form.acquisitionCost);
  const formResidual = parseAmountInput(form.residualValue);
  const formLife = Number(form.usefulLifeMonths.replace(/[^\d]/g, "")) || 0;
  const monthlyExpense = formLife > 0 ? round2(Math.max(0, formCost - formResidual) / formLife) : 0;
  const yearlyExpense = round2(monthlyExpense * Math.min(12, formLife || 12));

  function update(field: keyof typeof emptyForm, value: string) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      // Memilih kelompok mengisi usulan masa manfaat sesuai kebijakan perusahaan.
      if (field === "group") {
        const preset = GROUPS.find((item) => item.name === value);
        if (preset) next.usefulLifeMonths = String(preset.months);
      }
      return next;
    });
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function openCreate() {
    setForm({
      ...emptyForm,
      unitId,
      acquisitionDate: new Date().toISOString().slice(0, 10),
      assetAccountId: assetAccounts[0]?.id ?? "",
      depreciationAccountId: expenseAccounts[0]?.id ?? "",
    });
    setErrors({});
    setOpen(true);
  }

  async function submit(withSchedule: boolean) {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = t("Nama aset harus diisi.");
    if (!form.code.trim()) nextErrors.code = t("Kode aset harus diisi.");
    if (!form.group) nextErrors.group = t("Kelompok harus dipilih.");
    if (!form.acquisitionDate) nextErrors.acquisitionDate = t("Tanggal perolehan harus diisi.");
    if (formCost <= 0) nextErrors.acquisitionCost = t("Nilai perolehan harus diisi.");
    if (formLife <= 0) nextErrors.usefulLifeMonths = t("Masa manfaat harus diisi.");
    if (formResidual >= formCost && formCost > 0) {
      nextErrors.residualValue = t("Nilai residu harus lebih kecil dari nilai perolehan.");
    }
    if (!form.assetAccountId) nextErrors.assetAccountId = t("Akun aset harus dipilih.");
    if (!form.depreciationAccountId) nextErrors.depreciationAccountId = t("Akun beban penyusutan harus dipilih.");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/fixed-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code.trim(),
        name: form.name.trim(),
        group: form.group,
        acquisitionDate: form.acquisitionDate,
        acquisitionCost: formCost,
        residualValue: formResidual,
        usefulLifeMonths: formLife,
        unitId: form.unitId || unitId,
        assetAccountId: form.assetAccountId,
        depreciationAccountId: form.depreciationAccountId,
        withSchedule,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan aset."));
      return;
    }

    setOpen(false);
    setForm(emptyForm);
    toast(withSchedule ? t("Aset tercatat di register dan jadwal penyusutan dibuat") : t("Aset disimpan sebagai draf"));
    router.refresh();
  }

  async function submitRun() {
    setRunBusy(true);
    const res = await fetch("/api/fixed-assets/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: Number(run.year),
        month: Number(run.month),
        unitId: run.unitId || unitId,
      }),
    });
    const data = (await res.json()) as { error?: string; assets?: number; entries?: number; expense?: number };
    setRunBusy(false);

    if (!res.ok) {
      toast(data.error ?? t("Gagal menjalankan penyusutan."));
      return;
    }

    setRunOpen(false);
    toast(
      data.entries
        ? `${t("Penyusutan")} ${MONTHS_ID[Number(run.month) - 1]} ${run.year} ${t("dijalankan")} · ${data.entries} ${t("periode")} · ${formatAmount(data.expense ?? 0)}`
        : t("Tidak ada aset yang perlu disusutkan pada periode ini"),
    );
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Aset Tetap")}
        subtitle={t("Register aset dan jadwal penyusutan per buku unit")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari kode atau nama aset")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 230 }}
            />
            <button className="btn" onClick={() => toast(t("Register aset diekspor ke Excel"))}>
              {t("Ekspor register")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openCreate}>
                {t("Tambah aset")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Nilai perolehan")}</div>
          <div className="v">{dash(metrics.acquisition)}</div>
          <div className="d muted">{`${t("akun")} ${accountCodes.asset} · ${t("buku")} ${bukuLabel}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Akumulasi penyusutan")}</div>
          <div className="v">{metrics.accumulated === 0 ? "(—)" : `(${formatAmount(metrics.accumulated)})`}</div>
          <div className="d muted">{`${t("akun")} ${accountCodes.accumulated}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Nilai buku")}</div>
          <div className="v">{dash(metrics.bookValue)}</div>
          <div className="d muted">{`${t("per")} ${asOf}`}</div>
        </div>
        <div className="metric">
          <div className="l">{`${t("Beban penyusutan")} ${t(MONTHS_ID[currentMonth - 1])}`}</div>
          <div className="v">{dash(metrics.periodExpense)}</div>
          <div className="d muted">{`${t("akun")} ${accountCodes.expense}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Masa manfaat habis ≤ 6 bulan")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>
            {metrics.endingSoon === 0 ? "—" : String(metrics.endingSoon)}
          </div>
          <div className="d" style={{ color: "var(--amber)" }}>
            {t("perlu ditinjau")}
          </div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Register aset")}</h2>
            <div className="rt">
              <select style={{ width: "auto" }} value={buku} onChange={(event) => setBuku(event.target.value)}>
                <option value="">{t("Semua buku")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
              <select style={{ width: "auto" }} value={group} onChange={(event) => setGroup(event.target.value)}>
                <option value="">{t("Semua kelompok")}</option>
                {GROUPS.map((item) => (
                  <option key={item.name} value={item.name}>
                    {t(item.name)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ padding: "12px 18px 0" }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={tab === "all" ? "tab on" : "tab"} onClick={() => setTab("all")}>
                {t("Semua")} <span className="muted">{counts.all}</span>
              </button>
              <button className={tab === "digunakan" ? "tab on" : "tab"} onClick={() => setTab("digunakan")}>
                {t("Digunakan")} <span className="muted">{counts.digunakan}</span>
              </button>
              <button className={tab === "perbaikan" ? "tab on" : "tab"} onClick={() => setTab("perbaikan")}>
                {t("Dalam perbaikan")} <span style={{ color: "var(--amber)" }}>{counts.perbaikan}</span>
              </button>
              <button className={tab === "lepas" ? "tab on" : "tab"} onClick={() => setTab("lepas")}>
                {t("Dilepas")} <span className="muted">{counts.lepas}</span>
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 980, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 104, whiteSpace: "nowrap" }}>{t("Kode aset")}</th>
                  <th style={{ width: "22%" }}>{t("Nama aset")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Kelompok")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Buku")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Tgl perolehan")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Perolehan")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Akm. peny.")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Nilai buku")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {filtered.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => setSelectedId(asset.id)}
                    style={{
                      cursor: "pointer",
                      background: selected?.id === asset.id ? "var(--sunk)" : undefined,
                    }}
                  >
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{asset.code}</td>
                    <td>{asset.name}</td>
                    <td>{t(asset.group)}</td>
                    <td>
                      <span className="num sm">{asset.unitCode}</span>
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>{formatDate(asset.acquisitionDate)}</td>
                    <td className="r num">{dash(asset.acquisitionCost)}</td>
                    <td className="r num">{dash(asset.accumulated)}</td>
                    <td className="r num">{dash(asset.bookValue)}</td>
                    <td>
                      <span className={chipClassFor(asset.status)}>{t(STATUS_LABEL[asset.status])}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{`${filtered.length} ${t("dari")} ${scoped.length} ${t("aset ditampilkan")}`}</span>
            <span className="k">{t("Nilai buku yang ditampilkan")}</span>
            <span className="v num">{dash(shownBookValue)}</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
              {canEdit && (
                <button className="btn btn-sm" onClick={() => setRunOpen(true)}>
                  {t("Jalankan penyusutan")}
                </button>
              )}
              <a className="btn btn-sm" href="/jurnal">
                {t("Buka jurnal penyusutan")}
              </a>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Jadwal penyusutan")}</h2>
              <span className="sub">
                {selected ? `${t("garis lurus")} · ${selected.code}` : `${t("garis lurus")} · ${t("contoh satu aset")}`}
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Periode")}</th>
                  <th className="r">{t("Beban")}</th>
                  <th className="r">{t("Akumulasi")}</th>
                  <th className="r">{t("Nilai buku")}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.length === 0 && (
                  <tr>
                    <td colSpan={4} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {scheduleHead.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="r num">{dash(row.expense)}</td>
                    <td className="r num">{dash(row.accumulated)}</td>
                    <td className="r num">{dash(row.bookValue)}</td>
                  </tr>
                ))}
                {scheduleTail.length > 0 && lastRow && (
                  <tr className="tot">
                    <td>{`${t("Sisa")} ${scheduleTail.length} ${t("periode")}`}</td>
                    <td className="r num">{dash(tailExpense)}</td>
                    <td className="r num">{dash(lastRow.accumulated)}</td>
                    <td className="r num">{dash(lastRow.bookValue)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="bal">
              <span className="k">{t("Jurnal penyusutan dibuat otomatis saat tutup bulan")}</span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Kelompok & masa manfaat")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Kelompok")}</th>
                  <th>{t("Masa manfaat")}</th>
                  <th>{t("Metode")}</th>
                  <th className="r">{t("Aset")}</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map((item) => (
                  <tr key={item.name}>
                    <td>{t(item.name)}</td>
                    <td className="num">{`${item.months / 12} ${t("tahun")}`}</td>
                    <td>{t("Garis lurus")}</td>
                    <td className="r num">{dash(groupCounts.get(item.name) ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note">
            {t(
              "Masa manfaat komersial mengikuti kebijakan perusahaan; masa manfaat fiskal mengikuti kelompok harta PMK. Selisihnya dicatat sebagai beda waktu di rekonsiliasi fiskal.",
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Tambah aset tetap")}
        badge={`${t("buku")} ${unitLabel}`}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              {t("Batal")}
            </button>
            <button
              className="btn"
              style={{ marginLeft: "auto" }}
              disabled={busy}
              onClick={() => void submit(false)}
            >
              {t("Simpan draf")}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submit(true)}>
              {busy ? t("Menyimpan…") : t("Simpan & buat jadwal")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Nama aset")}</label>
            <input
              type="text"
              className={errors.name ? "field-error" : undefined}
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder={t("Misal: Mobil box Suzuki Carry")}
            />
            {errors.name && <span className="sm" style={{ color: "#C8382F" }}>{errors.name}</span>}
          </div>
          <div>
            <label className="f" data-req="1">{t("Kode aset")}</label>
            <input
              type="text"
              className={errors.code ? "num field-error" : "num"}
              value={form.code}
              onChange={(event) => update("code", event.target.value)}
              placeholder="AT-2026-…"
            />
            {errors.code && <span className="sm" style={{ color: "#C8382F" }}>{errors.code}</span>}
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Kelompok")}</label>
            <select
              className={errors.group ? "field-error" : undefined}
              value={form.group}
              onChange={(event) => update("group", event.target.value)}
            >
              <option value="">{t("— Pilih kelompok —")}</option>
              {GROUPS.map((item) => (
                <option key={item.name} value={item.name}>
                  {t(item.name)}
                </option>
              ))}
            </select>
            {errors.group && <span className="sm" style={{ color: "#C8382F" }}>{errors.group}</span>}
          </div>
          <div>
            <label className="f" data-req="1">{t("Tanggal perolehan")}</label>
            <input
              type="date"
              className={errors.acquisitionDate ? "field-error" : undefined}
              value={form.acquisitionDate}
              onChange={(event) => update("acquisitionDate", event.target.value)}
            />
            {errors.acquisitionDate && (
              <span className="sm" style={{ color: "#C8382F" }}>{errors.acquisitionDate}</span>
            )}
          </div>
          <div>
            <label className="f">{t("Buku unit")}</label>
            <select value={form.unitId} onChange={(event) => update("unitId", event.target.value)}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Nilai perolehan")}</label>
            <input
              type="text"
              className={errors.acquisitionCost ? "num field-error" : "num"}
              value={form.acquisitionCost}
              onChange={(event) => update("acquisitionCost", event.target.value)}
              placeholder="0"
            />
            {errors.acquisitionCost && (
              <span className="sm" style={{ color: "#C8382F" }}>{errors.acquisitionCost}</span>
            )}
          </div>
          <div>
            <label className="f" data-req="1">{t("Masa manfaat (bulan)")}</label>
            <input
              type="text"
              className={errors.usefulLifeMonths ? "num field-error" : "num"}
              value={form.usefulLifeMonths}
              onChange={(event) => update("usefulLifeMonths", event.target.value)}
            />
            {errors.usefulLifeMonths && (
              <span className="sm" style={{ color: "#C8382F" }}>{errors.usefulLifeMonths}</span>
            )}
          </div>
          <div>
            <label className="f">{t("Nilai residu")}</label>
            <input
              type="text"
              className={errors.residualValue ? "num field-error" : "num"}
              value={form.residualValue}
              onChange={(event) => update("residualValue", event.target.value)}
              placeholder="0"
            />
            {errors.residualValue && (
              <span className="sm" style={{ color: "#C8382F" }}>{errors.residualValue}</span>
            )}
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Akun aset")}</label>
            <select
              className={errors.assetAccountId ? "field-error" : undefined}
              value={form.assetAccountId}
              onChange={(event) => update("assetAccountId", event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {assetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
            {errors.assetAccountId && (
              <span className="sm" style={{ color: "#C8382F" }}>{errors.assetAccountId}</span>
            )}
          </div>
          <div>
            <label className="f" data-req="1">{t("Akun beban penyusutan")}</label>
            <select
              className={errors.depreciationAccountId ? "field-error" : undefined}
              value={form.depreciationAccountId}
              onChange={(event) => update("depreciationAccountId", event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {expenseAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
            {errors.depreciationAccountId && (
              <span className="sm" style={{ color: "#C8382F" }}>{errors.depreciationAccountId}</span>
            )}
          </div>
        </div>
        <div className="bal" style={{ borderRadius: 9, borderTop: "none", marginBottom: 12 }}>
          <span className="k">{t("Metode")}</span>
          <span className="v">{t("Garis lurus")}</span>
          <span className="k">{t("Beban per bulan")}</span>
          <span className="v num">{dash(monthlyExpense)}</span>
          <span className="k">{t("Penyusutan setahun")}</span>
          <span className="v num">{dash(yearlyExpense)}</span>
        </div>
        <div className="note">{t("Jurnal penyusutan pertama terbentuk saat tutup bulan periode perolehan.")}</div>
      </Dialog>

      <Dialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        title={t("Jalankan penyusutan")}
        badge={`${t("buku")} ${unitLabel}`}
        maxWidth={460}
        footer={
          <>
            <button className="btn" onClick={() => setRunOpen(false)}>
              {t("Batal")}
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
              disabled={runBusy}
              onClick={() => void submitRun()}
            >
              {runBusy ? t("Memproses…") : t("Jalankan")}
            </button>
          </>
        }
      >
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Bulan")}</label>
            <select value={run.month} onChange={(event) => setRun({ ...run, month: event.target.value })}>
              {MONTHS_ID.map((month, index) => (
                <option key={month} value={String(index + 1)}>
                  {t(month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f" data-req="1">{t("Tahun")}</label>
            <select value={run.year} onChange={(event) => setRun({ ...run, year: event.target.value })}>
              {[currentYear - 1, currentYear, currentYear + 1].map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Buku unit")}</label>
            <select value={run.unitId} onChange={(event) => setRun({ ...run, unitId: event.target.value })}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="note">
          {t(
            "Menjalankan ulang periode yang sama tidak menggandakan baris penyusutan maupun menggeser akumulasi.",
          )}
        </div>
      </Dialog>
    </>
  );
}
