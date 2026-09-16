"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { MONTHS_ID, dash, formatAmount, formatDateLong, parseAmountInput } from "@/lib/format";

export type BudgetRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  group: string;
  unitId: string;
  unitCode: string;
  budget: number;
  monthly: number[];
};

export type AccountRow = { id: string; code: string; name: string; type: string; group: string };
export type UnitOption = { id: string; code: string; name: string };
export type RevisionEvent = { date: string; text: string; muted: boolean };

/** Urutan kelompok akun seperti di prototipe. */
const GROUP_ORDER = ["Pendapatan", "Beban pokok", "Beban operasi", "Lainnya"];

const BASIS_OPTIONS = [
  "Realisasi tahun lalu + persentase",
  "Dari nol",
  "Salin anggaran berjalan",
];

const DETAIL_OPTIONS = ["Per akun", "Per kelompok akun"];

const ROMAN = ["I", "II", "III", "IV"];

export default function AnggaranScreen({
  rows,
  accounts,
  units,
  currentBudget,
  previousRealisation,
  year,
  currentYear,
  periodsClosed,
  throughMonth,
  approvedAt,
  revisions,
  unitId,
  canEdit,
}: {
  rows: BudgetRow[];
  accounts: AccountRow[];
  units: UnitOption[];
  currentBudget: Array<{ accountId: string; unitId: string; budget: number }>;
  previousRealisation: Array<{ accountId: string; unitId: string; amount: number }>;
  year: number;
  currentYear: number;
  periodsClosed: number;
  throughMonth: number;
  approvedAt: string | null;
  revisions: RevisionEvent[];
  unitId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [scope, setScope] = useState("ytd");
  const [buku, setBuku] = useState("");
  const [group, setGroup] = useState("");

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    year: String(year),
    basis: BASIS_OPTIONS[0],
    increasePercent: "8",
    unitId,
    detail: DETAIL_OPTIONS[0],
    note: "",
  });
  const [budgets, setBudgets] = useState<Record<string, string>>({});

  const quarter = Math.ceil(throughMonth / 3);

  /** Bulan yang ikut dihitung sesuai pilihan periode di kepala layar. */
  const monthsInScope = useMemo(() => {
    if (scope === "full") return Array.from({ length: 12 }, (_, index) => index);
    if (scope === "quarter") {
      const start = (quarter - 1) * 3;
      return [start, start + 1, start + 2];
    }
    return Array.from({ length: throughMonth }, (_, index) => index);
  }, [scope, quarter, throughMonth]);

  const enriched = useMemo(
    () =>
      rows.map((row) => {
        const actual = monthsInScope.reduce((sum, index) => sum + (row.monthly[index] ?? 0), 0);
        return {
          ...row,
          actual,
          variance: row.budget - actual,
          absorption: row.budget > 0 ? (actual / row.budget) * 100 : 0,
        };
      }),
    [rows, monthsInScope],
  );

  const scoped = useMemo(
    () => enriched.filter((row) => (buku ? row.unitId === buku : true)),
    [enriched, buku],
  );

  const filtered = useMemo(
    () => scoped.filter((row) => (group ? row.group === group : true)),
    [scoped, group],
  );

  /** Baris dikelompokkan seperti prototipe: satu baris judul kelompok lalu totalnya. */
  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const row of filtered) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return GROUP_ORDER.filter((name) => map.has(name)).map((name) => {
      const items = map.get(name) ?? [];
      const budget = items.reduce((sum, row) => sum + row.budget, 0);
      const actual = items.reduce((sum, row) => sum + row.actual, 0);
      return {
        name,
        items,
        budget,
        actual,
        variance: budget - actual,
        absorption: budget > 0 ? (actual / budget) * 100 : 0,
      };
    });
  }, [filtered]);

  const metrics = useMemo(() => {
    const budget = scoped.reduce((sum, row) => sum + row.budget, 0);
    const actual = scoped.reduce((sum, row) => sum + row.actual, 0);
    const over = scoped.filter((row) => row.budget > 0 && row.actual > row.budget).length;
    return {
      budget,
      actual,
      remaining: budget - actual,
      absorption: budget > 0 ? (actual / budget) * 100 : 0,
      over,
    };
  }, [scoped]);

  const perUnit = useMemo(
    () =>
      units.map((unit) => {
        const items = enriched.filter((row) => row.unitId === unit.id);
        const budget = items.reduce((sum, row) => sum + row.budget, 0);
        const actual = items.reduce((sum, row) => sum + row.actual, 0);
        return {
          unit,
          absorption: budget > 0 ? (actual / budget) * 100 : 0,
        };
      }),
    [enriched, units],
  );

  const elapsed = periodsClosed > 0 ? periodsClosed : throughMonth;
  const fairTarget = Math.round((elapsed / 12) * 100);
  const scopeLabel =
    scope === "full"
      ? `${t("Tahun penuh")} ${year}`
      : scope === "quarter"
        ? `${t("Kuartal")} ${ROMAN[quarter - 1]} ${year}`
        : `${t("s.d.")} ${t(MONTHS_ID[throughMonth - 1])} ${year}`;

  function percent(value: number) {
    return value === 0 ? "—%" : `${Math.round(value)}%`;
  }

  function changeYear(next: string) {
    router.push(next === String(currentYear) ? "/anggaran" : `/anggaran?tahun=${next}`);
  }

  // Akun yang bisa dianggarkan di dialog, dibatasi ke tingkat rincian "Per akun".
  const budgetAccounts = useMemo(
    () => (group ? accounts.filter((account) => account.group === group) : accounts),
    [accounts, group],
  );

  function prefill(basis: string, increasePercent: string, targetUnit: string) {
    const factor = 1 + (Number(increasePercent.replace(",", ".")) || 0) / 100;
    const next: Record<string, string> = {};
    for (const account of budgetAccounts) {
      if (basis === "Dari nol") {
        next[account.id] = "";
        continue;
      }
      if (basis === "Salin anggaran berjalan") {
        const existing = currentBudget.find(
          (line) => line.accountId === account.id && line.unitId === targetUnit,
        );
        next[account.id] = existing && existing.budget > 0 ? String(Math.round(existing.budget)) : "";
        continue;
      }
      const previous = previousRealisation.find(
        (line) => line.accountId === account.id && line.unitId === targetUnit,
      );
      next[account.id] = previous && previous.amount > 0 ? String(Math.round(previous.amount * factor)) : "";
    }
    setBudgets(next);
  }

  function openCompose() {
    const next = {
      year: String(year),
      basis: BASIS_OPTIONS[0],
      increasePercent: "8",
      unitId: buku || unitId,
      detail: DETAIL_OPTIONS[0],
      note: "",
    };
    setForm(next);
    setErrors({});
    prefill(next.basis, next.increasePercent, next.unitId);
    setOpen(true);
  }

  function updateForm(field: keyof typeof form, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    setErrors((current) => ({ ...current, [field]: "" }));
    if (field === "basis" || field === "increasePercent" || field === "unitId") {
      prefill(next.basis, next.increasePercent, next.unitId);
    }
  }

  const composedLines = useMemo(
    () =>
      budgetAccounts
        .map((account) => ({ account, budget: parseAmountInput(budgets[account.id] ?? "") }))
        .filter((line) => line.budget > 0),
    [budgetAccounts, budgets],
  );

  const composedTotal = composedLines.reduce((sum, line) => sum + line.budget, 0);

  async function submit(doSubmit: boolean) {
    const nextErrors: Record<string, string> = {};
    if (!form.unitId) nextErrors.unitId = t("Cakupan buku harus dipilih.");
    if (composedLines.length === 0) nextErrors.lines = t("Isi anggaran minimal satu akun.");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: Number(form.year),
        unitId: form.unitId,
        basis: form.basis,
        increasePercent: Number(form.increasePercent.replace(",", ".")) || 0,
        detail: form.detail,
        note: form.note.trim() || undefined,
        submit: doSubmit,
        lines: composedLines.map((line) => ({ accountId: line.account.id, budget: line.budget })),
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan anggaran."));
      return;
    }

    setOpen(false);
    toast(doSubmit ? t("Anggaran diajukan ke direksi untuk persetujuan") : t("Anggaran disimpan sebagai draf"));
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Anggaran & Realisasi")}
        subtitle={t("Anggaran tahunan dibandingkan angka buku yang sudah terkunci")}
        actions={
          <>
            <select style={{ width: "auto" }} value={String(year)} onChange={(event) => changeYear(event.target.value)}>
              {[currentYear, currentYear - 1].map((option) => (
                <option key={option} value={String(option)}>
                  {`${t("Tahun anggaran")} ${option}`}
                </option>
              ))}
            </select>
            <select style={{ width: "auto" }} value={scope} onChange={(event) => setScope(event.target.value)}>
              <option value="ytd">{`${t("s.d.")} ${t(MONTHS_ID[throughMonth - 1])} ${year}`}</option>
              <option value="quarter">{`${t("Kuartal")} ${ROMAN[quarter - 1]} ${year}`}</option>
              <option value="full">{t("Tahun penuh")}</option>
            </select>
            <button className="btn" onClick={() => toast(t("Laporan anggaran versus realisasi diekspor"))}>
              {t("Ekspor")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openCompose}>
                {t("Susun anggaran")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Anggaran setahun")}</div>
          <div className="v">{dash(metrics.budget)}</div>
          <div className="d muted">
            {approvedAt ? `${t("disusun")} ${formatDateLong(approvedAt)}` : t("belum disusun")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{`${t("Realisasi")} ${scopeLabel}`}</div>
          <div className="v">{dash(metrics.actual)}</div>
          <div className="d muted">{`${elapsed} ${t("dari")} 12 ${t("periode")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Sisa anggaran")}</div>
          <div className="v">{dash(metrics.remaining)}</div>
          <div className="d muted">{`${Math.max(0, 12 - elapsed)} ${t("periode tersisa")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Serapan")}</div>
          <div className="v">{percent(metrics.absorption)}</div>
          <div className="d muted">{`${t("target wajar")} ${fairTarget}%`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Akun melewati anggaran")}</div>
          <div className="v" style={{ color: "var(--brick)" }}>
            {metrics.over === 0 ? "—" : String(metrics.over)}
          </div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {t("perlu revisi")}
          </div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Anggaran versus realisasi")}</h2>
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
                <option value="">{t("Semua kelompok akun")}</option>
                {GROUP_ORDER.slice(0, 3).map((item) => (
                  <option key={item} value={item}>
                    {t(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 880, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 96 }}>{t("Akun")}</th>
                  <th style={{ width: "26%" }}>{t("Nama akun")}</th>
                  <th className="r">{t("Anggaran")}</th>
                  <th className="r">{t("Realisasi")}</th>
                  <th className="r">{t("Selisih")}</th>
                  <th className="r">{t("Serapan")}</th>
                  <th style={{ width: "20%" }}></th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {groups.map((item) => (
                  <Fragment key={item.name}>
                    <tr>
                      <td colSpan={7} className="sm muted" style={{ background: "var(--sunk)" }}>
                        {t(item.name)}
                      </td>
                    </tr>
                    {item.items.map((row) => (
                      <tr key={`${row.accountId}-${row.unitId}`}>
                        <td className="num">{row.code}</td>
                        <td>
                          {row.name}
                          {!buku && <span className="sm muted num"> · {row.unitCode}</span>}
                        </td>
                        <td className="r num">{dash(row.budget)}</td>
                        <td className="r num">{dash(row.actual)}</td>
                        <td
                          className="r num"
                          style={row.variance < 0 ? { color: "var(--brick)" } : undefined}
                        >
                          {dash(row.variance)}
                        </td>
                        <td className="r num">{percent(row.absorption)}</td>
                        <td>
                          <div className="bar">
                            <i
                              style={{
                                width: `${Math.min(100, Math.max(0, Math.round(row.absorption)))}%`,
                                background: row.absorption > 100 ? "var(--brick)" : undefined,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="tot">
                      <td colSpan={2}>{`${t("Jumlah")} ${t(item.name).toLowerCase()}`}</td>
                      <td className="r num">{dash(item.budget)}</td>
                      <td className="r num">{dash(item.actual)}</td>
                      <td className="r num">{dash(item.variance)}</td>
                      <td className="r num">{percent(item.absorption)}</td>
                      <td></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">
              {`${t("Realisasi diambil dari buku yang sudah dikunci")} · ${t(MONTHS_ID[throughMonth - 1])} ${year}`}
            </span>
            <span style={{ marginLeft: "auto" }}>
              <a className="btn btn-sm" href="/laporan">
                {t("Buka laba rugi")}
              </a>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Serapan per unit bisnis")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Buku")}</th>
                  <th className="r">{t("Serapan")}</th>
                  <th style={{ width: "38%" }}></th>
                </tr>
              </thead>
              <tbody>
                {perUnit.length === 0 && (
                  <tr>
                    <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {perUnit.map((entry) => (
                  <tr key={entry.unit.id}>
                    <td>
                      <span className="num sm">{entry.unit.code}</span> {entry.unit.name}
                    </td>
                    <td className="r num">{percent(entry.absorption)}</td>
                    <td>
                      <div className="bar">
                        <i style={{ width: `${Math.min(100, Math.max(0, Math.round(entry.absorption)))}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Riwayat revisi")}</h2>
            </div>
            <ul className="timeline" style={{ padding: "6px 18px 12px" }}>
              {revisions.map((revision) => (
                <li key={`${revision.date}-${revision.text}`}>
                  <span className="tm">{formatDateLong(revision.date)}</span>
                  <span className={revision.muted ? "muted" : undefined}>{t(revision.text)}</span>
                </li>
              ))}
              <li>
                <span className="tm">—</span>
                <span className="muted">{t("Revisi berikutnya belum diajukan")}</span>
              </li>
            </ul>
          </div>

          <div className="note note-warn">
            {t(
              "Anggaran tidak memblokir pencatatan jurnal. Akun yang melewati anggaran hanya ditandai dan masuk daftar perhatian direksi.",
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Susun anggaran")}
        badge={`${t("tahun anggaran")} ${form.year}`}
        maxWidth={560}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void submit(false)}>
              {t("Simpan draf")}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submit(true)}>
              {busy ? t("Menyimpan…") : t("Ajukan ke direksi")}
            </button>
          </>
        }
      >
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Tahun anggaran")}</label>
            <select value={form.year} onChange={(event) => updateForm("year", event.target.value)}>
              {[currentYear + 1, currentYear].map((option) => (
                <option key={option} value={String(option)}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Dasar penyusunan")}</label>
            <select value={form.basis} onChange={(event) => updateForm("basis", event.target.value)}>
              {BASIS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Kenaikan (%)")}</label>
            <input
              type="text"
              className="num"
              value={form.increasePercent}
              onChange={(event) => updateForm("increasePercent", event.target.value)}
              placeholder="0"
              disabled={form.basis !== BASIS_OPTIONS[0]}
            />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Cakupan buku")}</label>
            <select
              className={errors.unitId ? "field-error" : undefined}
              value={form.unitId}
              onChange={(event) => updateForm("unitId", event.target.value)}
            >
              <option value="">{t("— Pilih cakupan —")}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
            {errors.unitId && <span className="sm" style={{ color: "#C8382F" }}>{errors.unitId}</span>}
          </div>
          <div>
            <label className="f">{t("Tingkat rincian")}</label>
            <select value={form.detail} onChange={(event) => updateForm("detail", event.target.value)}>
              {DETAIL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="f" data-req="1">{t("Anggaran per akun")}</label>
          <div style={{ border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 11 }}>{t("Akun")}</th>
                  <th className="r" style={{ width: 140, paddingRight: 11 }}>{t("Anggaran setahun")}</th>
                </tr>
              </thead>
              <tbody>
                {budgetAccounts.length === 0 && (
                  <tr>
                    <td colSpan={2} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada akun pendapatan atau beban di bagan akun")}
                    </td>
                  </tr>
                )}
                {budgetAccounts.map((account) => (
                  <tr key={account.id}>
                    <td style={{ paddingLeft: 11 }}>
                      <span className="num sm" style={{ color: "var(--ledger-dk)" }}>{account.code}</span>
                      <span style={{ display: "block" }}>{account.name}</span>
                    </td>
                    <td className="r" style={{ paddingRight: 11 }}>
                      <input
                        type="text"
                        className="num"
                        value={budgets[account.id] ?? ""}
                        onChange={(event) => setBudgets({ ...budgets, [account.id]: event.target.value })}
                        placeholder="0"
                        style={{ textAlign: "right" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.lines && <span className="sm" style={{ color: "#C8382F" }}>{errors.lines}</span>}
        </div>

        <div className="bal" style={{ borderRadius: 9, borderTop: "none", marginBottom: 12 }}>
          <span className="k">{t("Akun dianggarkan")}</span>
          <span className="v num">{composedLines.length === 0 ? "—" : String(composedLines.length)}</span>
          <span className="k">{t("Jumlah anggaran")}</span>
          <span className="v num">{composedTotal === 0 ? "—" : formatAmount(composedTotal)}</span>
        </div>

        <div className="row">
          <div>
            <label className="f">{t("Catatan untuk penyetuju")}</label>
            <textarea
              rows={3}
              value={form.note}
              onChange={(event) => updateForm("note", event.target.value)}
              placeholder={t("Asumsi yang dipakai…")}
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
        <div className="note">
          {t(
            "Anggaran berlaku setelah disetujui direksi. Sebelum itu statusnya draf dan tidak muncul di laporan serapan.",
          )}
        </div>
      </Dialog>
    </>
  );
}
