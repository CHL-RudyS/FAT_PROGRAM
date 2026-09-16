"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { MONTHS_ID, dash, formatDate, formatRupiah, parseAmountInput } from "@/lib/format";

export type LedgerAccountOption = { id: string; code: string; name: string };
export type UnitOption = { id: string; code: string; name: string };

export type ClaimRow = {
  id: string;
  number: string;
  claimDate: string;
  category: string;
  amount: number;
  description: string | null;
  receiptName: string | null;
  status: "DRAF" | "DIAJUKAN" | "DISETUJUI" | "DITOLAK" | "DIBAYAR";
  createdAt: string;
  updatedAt: string;
  unitId: string;
  unitCode: string;
  requesterId: string;
  requesterName: string;
};

const STATUS_LABEL: Record<ClaimRow["status"], string> = {
  DRAF: "Draf",
  DIAJUKAN: "Menunggu",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
  DIBAYAR: "Dibayar",
};

const STATUS_CHIP: Record<ClaimRow["status"], string> = {
  DRAF: "chip chip-lock",
  DIAJUKAN: "chip chip-warn",
  DISETUJUI: "chip chip-open",
  DITOLAK: "chip chip-bad",
  DIBAYAR: "chip chip-ok",
};

const TAB_STATUS: Record<string, ClaimRow["status"][]> = {
  menunggu: ["DIAJUKAN"],
  disetujui: ["DISETUJUI"],
  dibayar: ["DIBAYAR"],
  ditolak: ["DITOLAK"],
};

/** Kategori dan kebijakan bukti — kartu "Batas dan kebijakan" di prototipe. */
const CATEGORIES: Array<{ name: string; proof: string }> = [
  { name: "Transportasi", proof: "Wajib" },
  { name: "Entertain klien", proof: "Wajib + daftar hadir" },
  { name: "Perlengkapan kantor", proof: "Wajib" },
  { name: "Perjalanan dinas", proof: "Wajib + surat tugas" },
];

const REJECT_REASONS = [
  "Bukti tidak lengkap",
  "Melewati batas anggaran",
  "Akun tujuan salah",
  "Perlu penawaran pembanding",
  "Lainnya",
];

const DAY = 86_400_000;

export default function KasKecilScreen({
  claims,
  expenseAccounts,
  sourceAccounts,
  units,
  activeUnit,
  requesterName,
  todayIso,
  nextNumber,
  perClaimLimit,
  categoryLimits,
  fixedFund,
  minTopUp,
  holderName,
  cashAccountCode,
  cashBalance,
  canDecide,
}: {
  claims: ClaimRow[];
  expenseAccounts: LedgerAccountOption[];
  sourceAccounts: LedgerAccountOption[];
  units: UnitOption[];
  activeUnit: UnitOption;
  requesterName: string;
  todayIso: string;
  nextNumber: string;
  perClaimLimit: number;
  categoryLimits: Record<string, number>;
  fixedFund: number;
  minTopUp: number;
  holderName: string;
  cashAccountCode: string;
  cashBalance: number;
  canDecide: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const today = useMemo(() => new Date(todayIso), [todayIso]);
  const todayInput = todayIso.slice(0, 10);
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const monthName = MONTHS_ID[today.getMonth()];

  const limitMessage = `${t("Nilai klaim melebihi batas kas kecil")} ${formatRupiah(perClaimLimit)}. ${t(
    "Ajukan lewat pengajuan biaya.",
  )}`;

  const [query, setQuery] = useState("");
  const [buku, setBuku] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tab, setTab] = useState("all");

  const [claimOpen, setClaimOpen] = useState(false);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState("");
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});
  const [claim, setClaim] = useState({
    requester: requesterName,
    number: nextNumber,
    claimDate: todayInput,
    category: "",
    unitId: activeUnit.id,
    amount: "",
    expenseAccountId: "",
    description: "",
  });

  const [topupOpen, setTopupOpen] = useState(false);
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupError, setTopupError] = useState("");
  const [topupErrors, setTopupErrors] = useState<Record<string, string>>({});
  const [topup, setTopup] = useState({
    unitId: activeUnit.id,
    date: todayInput,
    amount: "",
    sourceAccountId: "",
    holderName: holderName,
  });

  const [rejectFor, setRejectFor] = useState<ClaimRow | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [rejectError, setRejectError] = useState("");
  const [rejectErrors, setRejectErrors] = useState<Record<string, string>>({});
  const [reject, setReject] = useState({ reason: "", note: "", notify: true });

  const claimAmount = parseAmountInput(claim.amount);
  const overLimit = claimAmount > perClaimLimit;

  const scoped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return claims.filter((row) => {
      if (buku && row.unitId !== buku) return false;
      if (categoryFilter && row.category !== categoryFilter) return false;
      if (!needle) return true;
      return `${row.number} ${row.requesterName}`.toLowerCase().includes(needle);
    });
  }, [claims, query, buku, categoryFilter]);

  const counts = useMemo(
    () => ({
      all: scoped.length,
      menunggu: scoped.filter((row) => TAB_STATUS.menunggu.includes(row.status)).length,
      disetujui: scoped.filter((row) => TAB_STATUS.disetujui.includes(row.status)).length,
      dibayar: scoped.filter((row) => TAB_STATUS.dibayar.includes(row.status)).length,
      ditolak: scoped.filter((row) => TAB_STATUS.ditolak.includes(row.status)).length,
    }),
    [scoped],
  );

  const filtered = useMemo(
    () => (tab === "all" ? scoped : scoped.filter((row) => TAB_STATUS[tab]?.includes(row.status))),
    [scoped, tab],
  );

  const shownValue = filtered.reduce((sum, row) => sum + row.amount, 0);

  const metrics = useMemo(() => {
    const waiting = claims.filter((row) => row.status === "DIAJUKAN");
    const approved = claims.filter((row) => row.status === "DISETUJUI");
    const paidThisMonth = claims.filter((row) => {
      if (row.status !== "DIBAYAR") return false;
      const date = new Date(row.claimDate);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });
    const decided = claims.filter((row) => row.status !== "DRAF" && row.status !== "DIAJUKAN");
    const days = decided.map(
      (row) => (new Date(row.updatedAt).getTime() - new Date(row.createdAt).getTime()) / DAY,
    );
    return {
      waiting: waiting.length,
      approvedValue: approved.reduce((sum, row) => sum + row.amount, 0),
      paidValue: paidThisMonth.reduce((sum, row) => sum + row.amount, 0),
      paidCount: paidThisMonth.length,
      averageDays: days.length === 0 ? 0 : Math.round((days.reduce((sum, day) => sum + day, 0) / days.length) * 10) / 10,
    };
  }, [claims, year, month]);

  /** Terpakai periode ini — klaim disetujui atau dibayar di buku aktif pada bulan berjalan. */
  const usedThisPeriod = useMemo(
    () =>
      claims
        .filter((row) => {
          if (row.unitId !== activeUnit.id) return false;
          if (row.status !== "DISETUJUI" && row.status !== "DIBAYAR") return false;
          const date = new Date(row.claimDate);
          return date.getFullYear() === year && date.getMonth() + 1 === month;
        })
        .reduce((sum, row) => sum + row.amount, 0),
    [claims, activeUnit.id, year, month],
  );

  function updateClaim(field: keyof typeof claim, value: string) {
    setClaim((current) => ({ ...current, [field]: value }));
    setClaimErrors((current) => ({ ...current, [field]: "" }));
    setClaimError("");
  }

  function updateTopup(field: keyof typeof topup, value: string) {
    setTopup((current) => ({ ...current, [field]: value }));
    setTopupErrors((current) => ({ ...current, [field]: "" }));
    setTopupError("");
  }

  function openClaimDialog() {
    setClaim({
      requester: requesterName,
      number: nextNumber,
      claimDate: todayInput,
      category: "",
      unitId: activeUnit.id,
      amount: "",
      expenseAccountId: "",
      description: "",
    });
    setClaimErrors({});
    setClaimError("");
    setClaimOpen(true);
  }

  function openTopupDialog() {
    setTopup({ unitId: activeUnit.id, date: todayInput, amount: "", sourceAccountId: "", holderName });
    setTopupErrors({});
    setTopupError("");
    setTopupOpen(true);
  }

  async function submitClaim(submit: boolean) {
    const nextErrors: Record<string, string> = {};
    if (!claim.requester.trim()) nextErrors.requester = t("Pengaju harus diisi.");
    if (!claim.number.trim()) nextErrors.number = t("No. klaim harus diisi.");
    if (!claim.claimDate) nextErrors.claimDate = t("Tanggal pengeluaran harus diisi.");
    if (!claim.category) nextErrors.category = t("Kategori harus dipilih.");
    if (claimAmount <= 0) nextErrors.amount = t("Nilai klaim harus diisi.");
    if (!claim.expenseAccountId) nextErrors.expenseAccountId = t("Akun beban harus dipilih.");
    if (!claim.description.trim()) nextErrors.description = t("Keterangan harus diisi.");

    // Batas kas kecil per klaim — divalidasi di dialog dan sekali lagi di server.
    if (claimAmount > perClaimLimit) {
      setClaimErrors({ ...nextErrors, amount: limitMessage });
      setClaimError(limitMessage);
      return;
    }

    if (Object.keys(nextErrors).length > 0) {
      setClaimErrors(nextErrors);
      setClaimError(t("Lengkapi dulu kolom yang ditandai."));
      return;
    }

    setClaimBusy(true);
    const res = await fetch("/api/petty-cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId: claim.unitId,
        // Nomor preview dibiarkan kosong supaya urutan dokumen naik di server.
        number: claim.number.trim() === nextNumber ? undefined : claim.number.trim(),
        claimDate: claim.claimDate,
        category: claim.category,
        amount: claimAmount,
        expenseAccountId: claim.expenseAccountId,
        description: claim.description.trim(),
        submit,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setClaimBusy(false);

    if (!res.ok) {
      if (data.field) setClaimErrors({ [data.field]: data.error ?? "" });
      setClaimError(data.error ?? t("Klaim gagal disimpan."));
      return;
    }

    setClaimOpen(false);
    toast(submit ? t("Klaim diajukan dan menunggu persetujuan kepala unit") : t("Klaim disimpan sebagai draf"));
    router.refresh();
  }

  async function submitTopup() {
    const nextErrors: Record<string, string> = {};
    if (!topup.unitId) nextErrors.unitId = t("Buku unit harus dipilih.");
    if (!topup.date) nextErrors.date = t("Tanggal harus diisi.");
    if (parseAmountInput(topup.amount) <= 0) nextErrors.amount = t("Nilai isi ulang harus diisi.");
    if (!topup.sourceAccountId) nextErrors.sourceAccountId = t("Sumber dana harus dipilih.");
    if (!topup.holderName.trim()) nextErrors.holderName = t("Pemegang kas harus diisi.");

    if (Object.keys(nextErrors).length > 0) {
      setTopupErrors(nextErrors);
      setTopupError(t("Lengkapi dulu kolom yang ditandai."));
      return;
    }

    setTopupBusy(true);
    const res = await fetch("/api/petty-cash/topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId: topup.unitId,
        date: topup.date,
        amount: parseAmountInput(topup.amount),
        sourceAccountId: topup.sourceAccountId,
        holderName: topup.holderName.trim(),
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setTopupBusy(false);

    if (!res.ok) {
      if (data.field) setTopupErrors({ [data.field]: data.error ?? "" });
      setTopupError(data.error ?? t("Pengisian kas kecil gagal dicatat."));
      return;
    }

    setTopupOpen(false);
    toast(t("Pengisian kas kecil dijurnal ke buku unit"));
    router.refresh();
  }

  async function approve(row: ClaimRow) {
    const res = await fetch(`/api/petty-cash/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SETUJUI" }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast(data.error ?? t("Klaim gagal disetujui."));
      return;
    }
    toast(t("Permintaan terpilih disetujui dan pengaju diberi tahu"));
    router.refresh();
  }

  async function submitReject() {
    if (!rejectFor) return;
    const nextErrors: Record<string, string> = {};
    if (!reject.reason) nextErrors.reason = t("Alasan penolakan harus dipilih.");
    if (!reject.note.trim()) nextErrors.note = t("Catatan untuk pengaju harus diisi.");

    if (Object.keys(nextErrors).length > 0) {
      setRejectErrors(nextErrors);
      setRejectError(t("Lengkapi dulu kolom yang ditandai."));
      return;
    }

    setRejectBusy(true);
    const res = await fetch(`/api/petty-cash/${rejectFor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "TOLAK",
        reason: reject.reason,
        note: reject.note.trim(),
        notifyRequester: reject.notify,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setRejectBusy(false);

    if (!res.ok) {
      if (data.field) setRejectErrors({ [data.field]: data.error ?? "" });
      setRejectError(data.error ?? t("Klaim gagal ditolak."));
      return;
    }

    setRejectFor(null);
    toast(t("Permintaan ditolak dan catatan dikirim ke pengaju"));
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Kas Kecil & Reimbursement")}
        subtitle={t("Klaim penggantian biaya pegawai dan dana kas kecil per unit")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari no. klaim atau pengaju")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 236 }}
            />
            <button className="btn" onClick={() => toast(t("Rekap klaim diekspor ke Excel"))}>
              {t("Ekspor rekap")}
            </button>
            <button className="btn btn-primary" onClick={openClaimDialog}>
              {t("Ajukan klaim")}
            </button>
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Saldo kas kecil")}</div>
          <div className="v">{dash(cashBalance)}</div>
          <div className="d muted">{`${t("akun")} ${cashAccountCode} · ${t("buku")} ${activeUnit.code}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Klaim menunggu")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>
            {metrics.waiting === 0 ? "—" : String(metrics.waiting)}
          </div>
          <div className="d" style={{ color: "var(--amber)" }}>
            {t("perlu persetujuan")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Disetujui belum dibayar")}</div>
          <div className="v">{dash(metrics.approvedValue)}</div>
          <div className="d muted">{t("siap transfer")}</div>
        </div>
        <div className="metric">
          <div className="l">{`${t("Dibayar")} ${t(monthName)}`}</div>
          <div className="v">{dash(metrics.paidValue)}</div>
          <div className="d muted">{`${metrics.paidCount === 0 ? "—" : metrics.paidCount} ${t("klaim")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Rata-rata waktu proses")}</div>
          <div className="v">{metrics.averageDays === 0 ? "—" : metrics.averageDays.toLocaleString("id-ID")}</div>
          <div className="d muted">{t("hari kerja")}</div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Klaim penggantian")}</h2>
            <div className="rt">
              <select style={{ width: "auto" }} value={buku} onChange={(event) => setBuku(event.target.value)}>
                <option value="">{t("Semua buku")}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} · {unit.name}
                  </option>
                ))}
              </select>
              <select
                style={{ width: "auto" }}
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="">{t("Semua kategori")}</option>
                {CATEGORIES.map((category) => (
                  <option key={category.name} value={category.name}>
                    {t(category.name)}
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
              <button className={tab === "menunggu" ? "tab on" : "tab"} onClick={() => setTab("menunggu")}>
                {t("Menunggu")} <span style={{ color: "var(--amber)" }}>{counts.menunggu}</span>
              </button>
              <button className={tab === "disetujui" ? "tab on" : "tab"} onClick={() => setTab("disetujui")}>
                {t("Disetujui")} <span className="muted">{counts.disetujui}</span>
              </button>
              <button className={tab === "dibayar" ? "tab on" : "tab"} onClick={() => setTab("dibayar")}>
                {t("Dibayar")} <span className="muted">{counts.dibayar}</span>
              </button>
              <button className={tab === "ditolak" ? "tab on" : "tab"} onClick={() => setTab("ditolak")}>
                {t("Ditolak")} <span style={{ color: "var(--brick)" }}>{counts.ditolak}</span>
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 980, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 114, whiteSpace: "nowrap" }}>{t("No. klaim")}</th>
                  <th style={{ width: "20%" }}>{t("Pengaju")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Buku")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Tanggal")}</th>
                  <th>{t("Kategori")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Nilai")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Bukti")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Status")}</th>
                  <th />
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
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {row.number}
                    </td>
                    <td>
                      <span style={{ display: "block", fontWeight: 500 }}>{row.requesterName}</span>
                      {row.description && <span className="sm muted">{row.description}</span>}
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {row.unitCode}
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {formatDate(row.claimDate)}
                    </td>
                    <td>{t(row.category)}</td>
                    <td className="r num">{dash(row.amount)}</td>
                    <td>
                      {row.receiptName ? (
                        <span className="chip chip-ok">{t("Ada")}</span>
                      ) : (
                        <span className="chip chip-warn">{t("Belum")}</span>
                      )}
                    </td>
                    <td>
                      <span className={STATUS_CHIP[row.status]}>{t(STATUS_LABEL[row.status])}</span>
                    </td>
                    <td className="r" style={{ whiteSpace: "nowrap" }}>
                      {canDecide && row.status === "DIAJUKAN" && (
                        <>
                          <button className="btn btn-sm" onClick={() => void approve(row)}>
                            {t("Setujui")}
                          </button>{" "}
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              setReject({ reason: "", note: "", notify: true });
                              setRejectErrors({});
                              setRejectError("");
                              setRejectFor(row);
                            }}
                          >
                            {t("Tolak")}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{`${filtered.length} ${t("dari")} ${scoped.length} ${t("klaim ditampilkan")}`}</span>
            <span className="k">{t("Nilai yang ditampilkan")}</span>
            <span className="v num">{dash(shownValue)}</span>
            <span style={{ marginLeft: "auto" }}>
              <button className="btn btn-sm" onClick={openTopupDialog}>
                {t("Isi ulang kas kecil")}
              </button>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Batas dan kebijakan")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Kategori")}</th>
                  <th className="r">{t("Batas per klaim")}</th>
                  <th className="r">{t("Bukti")}</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORIES.map((category) => (
                  <tr key={category.name}>
                    <td>{t(category.name)}</td>
                    <td className="r num">{dash(categoryLimits[category.name] ?? 0)}</td>
                    <td className="r">{t(category.proof)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Dana kas kecil")}</h2>
              <span className="sub">{t("sistem dana tetap")}</span>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>{t("Dana tetap per unit")}</td>
                  <td className="r num">{dash(fixedFund)}</td>
                </tr>
                <tr>
                  <td>{t("Terpakai periode ini")}</td>
                  <td className="r num">{dash(usedThisPeriod)}</td>
                </tr>
                <tr>
                  <td>{t("Batas minimum isi ulang")}</td>
                  <td className="r num">{dash(minTopUp)}</td>
                </tr>
                <tr>
                  <td>{t("Pemegang kas")}</td>
                  <td className="r">{holderName || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="note">
            {t(
              "Klaim yang disetujui masuk daftar transfer, bukan langsung menjurnal kas. Jurnal kas keluar terbentuk saat pembayaran dikonfirmasi di modul Kas & Bank.",
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        title={t("Ajukan klaim reimbursement")}
        maxWidth={560}
        badge={`${t("buku")} ${activeUnit.code} · ${activeUnit.name}`}
        footer={
          <>
            <button className="btn" onClick={() => setClaimOpen(false)}>
              {t("Batal")}
            </button>
            <button
              className="btn"
              style={{ marginLeft: "auto" }}
              disabled={claimBusy}
              onClick={() => void submitClaim(false)}
            >
              {t("Simpan draf")}
            </button>
            <button className="btn btn-primary" disabled={claimBusy} onClick={() => void submitClaim(true)}>
              {claimBusy ? t("Menyimpan…") : t("Ajukan klaim")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Pengaju")}</label>
            <input
              type="text"
              className={claimErrors.requester ? "field-error" : undefined}
              value={claim.requester}
              onChange={(event) => updateClaim("requester", event.target.value)}
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("No. klaim")}</label>
            <input
              type="text"
              className={claimErrors.number ? "num field-error" : "num"}
              value={claim.number}
              onChange={(event) => updateClaim("number", event.target.value)}
              placeholder={nextNumber}
            />
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Tanggal pengeluaran")}</label>
            <input
              type="date"
              className={claimErrors.claimDate ? "field-error" : undefined}
              value={claim.claimDate}
              onChange={(event) => updateClaim("claimDate", event.target.value)}
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("Kategori")}</label>
            <select
              className={claimErrors.category ? "field-error" : undefined}
              value={claim.category}
              onChange={(event) => updateClaim("category", event.target.value)}
            >
              <option value="">{t("— Pilih kategori —")}</option>
              {CATEGORIES.map((category) => (
                <option key={category.name} value={category.name}>
                  {t(category.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Buku unit")}</label>
            <select value={claim.unitId} onChange={(event) => updateClaim("unitId", event.target.value)}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Nilai klaim")}</label>
            <input
              type="text"
              className={claimErrors.amount || overLimit ? "num field-error" : "num"}
              value={claim.amount}
              onChange={(event) => updateClaim("amount", event.target.value)}
              placeholder="0"
            />
            {overLimit && (
              <span className="sm" style={{ color: "var(--brick)" }}>
                {limitMessage}
              </span>
            )}
          </div>
          <div>
            <label className="f" data-req="1">{t("Akun beban")}</label>
            <select
              className={claimErrors.expenseAccountId ? "field-error" : undefined}
              value={claim.expenseAccountId}
              onChange={(event) => updateClaim("expenseAccountId", event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {expenseAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
            {expenseAccounts.length === 0 && (
              <span className="sm muted">{t("Belum ada akun beban di bagan akun.")}</span>
            )}
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">{t("Keterangan")}</label>
            <input
              type="text"
              className={claimErrors.description ? "field-error" : undefined}
              value={claim.description}
              onChange={(event) => updateClaim("description", event.target.value)}
              placeholder={t("Misal: Taksi ke kantor pajak Serpong")}
            />
          </div>
        </div>
        <div className="dz" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{t("Lampirkan bukti")}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
            {t("Tarik foto struk atau kuitansi ke sini · wajib untuk semua kategori")}
          </div>
        </div>
        <div className="note">
          {`${t("Batas kas kecil per klaim")} ${formatRupiah(perClaimLimit)}. ${t(
            "Di atas itu diproses sebagai pengajuan biaya biasa.",
          )}`}
        </div>

        {claimError && (
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
            {claimError}
          </div>
        )}
      </Dialog>

      <Dialog
        open={topupOpen}
        onClose={() => setTopupOpen(false)}
        title={t("Isi ulang kas kecil")}
        maxWidth={480}
        badge={t("sistem dana tetap")}
        footer={
          <>
            <button className="btn" onClick={() => setTopupOpen(false)}>
              {t("Batal")}
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
              disabled={topupBusy}
              onClick={() => void submitTopup()}
            >
              {topupBusy ? t("Menyimpan…") : t("Catat pengisian")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Buku unit")}</label>
            <select
              className={topupErrors.unitId ? "field-error" : undefined}
              value={topup.unitId}
              onChange={(event) => updateTopup("unitId", event.target.value)}
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f" data-req="1">{t("Tanggal")}</label>
            <input
              type="date"
              className={topupErrors.date ? "field-error" : undefined}
              value={topup.date}
              onChange={(event) => updateTopup("date", event.target.value)}
            />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Nilai isi ulang")}</label>
            <input
              type="text"
              className={topupErrors.amount ? "num field-error" : "num"}
              value={topup.amount}
              onChange={(event) => updateTopup("amount", event.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="f">{t("Sumber dana")}</label>
            <select
              className={topupErrors.sourceAccountId ? "field-error" : undefined}
              value={topup.sourceAccountId}
              onChange={(event) => updateTopup("sourceAccountId", event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {sourceAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">{t("Pemegang kas")}</label>
            <input
              type="text"
              className={topupErrors.holderName ? "field-error" : undefined}
              value={topup.holderName}
              onChange={(event) => updateTopup("holderName", event.target.value)}
            />
          </div>
        </div>
        <div className="note">{t("Isi ulang dijurnal sebagai pemindahan dari bank ke kas kecil, bukan sebagai beban.")}</div>

        {topupError && (
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
            {topupError}
          </div>
        )}
      </Dialog>

      <Dialog
        open={rejectFor !== null}
        onClose={() => setRejectFor(null)}
        title={t("Tolak permintaan")}
        maxWidth={480}
        footer={
          <>
            <button className="btn" onClick={() => setRejectFor(null)}>
              {t("Batal")}
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
              disabled={rejectBusy}
              onClick={() => void submitReject()}
            >
              {rejectBusy ? t("Menyimpan…") : t("Tolak permintaan")}
            </button>
          </>
        }
      >
        <div className="row">
          <div>
            <label className="f" data-req="1">{t("Alasan penolakan")}</label>
            <select
              className={rejectErrors.reason ? "field-error" : undefined}
              value={reject.reason}
              onChange={(event) => {
                setReject((current) => ({ ...current, reason: event.target.value }));
                setRejectErrors((current) => ({ ...current, reason: "" }));
                setRejectError("");
              }}
            >
              <option value="">{t("— Pilih alasan —")}</option>
              {REJECT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {t(reason)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">{t("Catatan untuk pengaju")}</label>
            <textarea
              rows={4}
              className={rejectErrors.note ? "field-error" : undefined}
              value={reject.note}
              onChange={(event) => {
                setReject((current) => ({ ...current, note: event.target.value }));
                setRejectErrors((current) => ({ ...current, note: "" }));
                setRejectError("");
              }}
              placeholder={t("Jelaskan apa yang perlu diperbaiki…")}
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
            checked={reject.notify}
            onChange={(event) => setReject((current) => ({ ...current, notify: event.target.checked }))}
            style={{ width: "auto" }}
          />
          <span>{t("Kirim salinan catatan ke email pengaju")}</span>
        </label>
        <div className="note note-warn">
          {t("Penolakan mengembalikan dokumen ke status draf. Pengaju bisa memperbaiki dan mengajukan ulang.")}
        </div>

        {rejectError && (
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
            {rejectError}
          </div>
        )}
      </Dialog>
    </>
  );
}
