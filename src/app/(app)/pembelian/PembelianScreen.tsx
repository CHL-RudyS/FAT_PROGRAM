"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { dash, formatDate, parseAmountInput } from "@/lib/format";

export type VendorOption = { id: string; code: string; name: string };
export type LedgerAccountOption = { id: string; code: string; name: string };
export type UnitOption = { id: string; code: string; name: string };

export type PurchaseOrderRow = {
  id: string;
  number: string;
  orderDate: string;
  deliveryDate: string | null;
  amount: number;
  receivedAmount: number;
  billedAmount: number;
  status: "DRAF" | "MENUNGGU_PERSETUJUAN" | "DISETUJUI" | "DITOLAK" | "DIKIRIM" | "DITERIMA" | "DITUTUP" | "BATAL";
  stage: string | null;
  unitId: string;
  unitCode: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
  approvalStatus: "MENUNGGU" | "DISETUJUI" | "DITOLAK" | "DIBATALKAN" | null;
};

const STATUS_LABEL: Record<PurchaseOrderRow["status"], string> = {
  DRAF: "Draf",
  MENUNGGU_PERSETUJUAN: "Menunggu persetujuan",
  DISETUJUI: "Terbuka",
  DITOLAK: "Ditolak",
  DIKIRIM: "Dikirim",
  DITERIMA: "Diterima",
  DITUTUP: "Selesai",
  BATAL: "Batal",
};

const STATUS_CHIP: Record<PurchaseOrderRow["status"], string> = {
  DRAF: "chip chip-lock",
  MENUNGGU_PERSETUJUAN: "chip chip-warn",
  DISETUJUI: "chip chip-open",
  DITOLAK: "chip chip-bad",
  DIKIRIM: "chip chip-open",
  DITERIMA: "chip chip-info",
  DITUTUP: "chip chip-ok",
  BATAL: "chip chip-bad",
};

const APPROVAL_LABEL: Record<NonNullable<PurchaseOrderRow["approvalStatus"]>, string> = {
  MENUNGGU: "Menunggu",
  DISETUJUI: "Disetujui",
  DITOLAK: "Ditolak",
  DIBATALKAN: "Dibatalkan",
};

const APPROVAL_CHIP: Record<NonNullable<PurchaseOrderRow["approvalStatus"]>, string> = {
  MENUNGGU: "chip chip-warn",
  DISETUJUI: "chip chip-ok",
  DITOLAK: "chip chip-bad",
  DIBATALKAN: "chip chip-lock",
};

/** Tab "Terbuka" menampung PO yang sudah disetujui tapi belum ditutup. */
const TAB_STATUS: Record<string, PurchaseOrderRow["status"][]> = {
  draf: ["DRAF"],
  approval: ["MENUNGGU_PERSETUJUAN"],
  terbuka: ["DISETUJUI", "DIKIRIM", "DITERIMA"],
  selesai: ["DITUTUP"],
};

const OPEN_STATUS: PurchaseOrderRow["status"][] = ["DISETUJUI", "DIKIRIM", "DITERIMA"];

const DAY = 86_400_000;

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Date(date.getTime() + days * DAY).toISOString().slice(0, 10);
}

export default function PembelianScreen({
  orders,
  vendors,
  targetAccounts,
  units,
  activeUnit,
  unitCount,
  todayIso,
  nextNumber,
  approvalThreshold,
  canEdit,
}: {
  orders: PurchaseOrderRow[];
  vendors: VendorOption[];
  targetAccounts: LedgerAccountOption[];
  units: UnitOption[];
  activeUnit: UnitOption;
  unitCount: number;
  todayIso: string;
  nextNumber: string;
  approvalThreshold: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const todayInput = todayIso.slice(0, 10);
  const todayTime = useMemo(() => new Date(todayInput).getTime(), [todayInput]);

  const [query, setQuery] = useState("");
  const [buku, setBuku] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [tab, setTab] = useState("all");

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    vendorId: "",
    number: nextNumber,
    orderDate: todayInput,
    deliveryDate: addDays(todayInput, 14),
    unitId: activeUnit.id,
    description: "",
    quantity: "1",
    unitPrice: "",
    targetAccountId: "",
    ppnMode: "11",
  });

  // Nilai PO dihitung langsung dari baris barang: kuantitas × harga satuan.
  const subtotal = useMemo(
    () => Math.round(parseAmountInput(form.quantity) * parseAmountInput(form.unitPrice) * 100) / 100,
    [form.quantity, form.unitPrice],
  );
  const ppnRate = Number(form.ppnMode);
  const ppn = useMemo(() => Math.round(((subtotal * ppnRate) / 100) * 100) / 100, [subtotal, ppnRate]);
  const total = subtotal + ppn;

  const scoped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (buku && order.unitId !== buku) return false;
      if (vendorFilter && order.vendorId !== vendorFilter) return false;
      if (!needle) return true;
      return `${order.number} ${order.vendorCode} ${order.vendorName}`.toLowerCase().includes(needle);
    });
  }, [orders, query, buku, vendorFilter]);

  const counts = useMemo(
    () => ({
      all: scoped.length,
      draf: scoped.filter((order) => TAB_STATUS.draf.includes(order.status)).length,
      approval: scoped.filter((order) => TAB_STATUS.approval.includes(order.status)).length,
      terbuka: scoped.filter((order) => TAB_STATUS.terbuka.includes(order.status)).length,
      selesai: scoped.filter((order) => TAB_STATUS.selesai.includes(order.status)).length,
    }),
    [scoped],
  );

  const filtered = useMemo(
    () => (tab === "all" ? scoped : scoped.filter((order) => TAB_STATUS[tab]?.includes(order.status))),
    [scoped, tab],
  );

  const shownValue = filtered.reduce((sum, order) => sum + order.amount, 0);

  const metrics = useMemo(() => {
    const openOrders = orders.filter((order) => OPEN_STATUS.includes(order.status));
    return {
      openCount: openOrders.length,
      openBooks: new Set(openOrders.map((order) => order.unitId)).size,
      openValue: openOrders.reduce((sum, order) => sum + order.amount - order.billedAmount, 0),
      waiting: orders.filter((order) => order.status === "MENUNGGU_PERSETUJUAN").length,
      receivedNotBilled: openOrders.reduce(
        (sum, order) => sum + Math.max(order.receivedAmount - order.billedAmount, 0),
        0,
      ),
      late: openOrders.filter(
        (order) =>
          order.deliveryDate !== null &&
          new Date(order.deliveryDate).getTime() < todayTime &&
          order.receivedAmount < order.amount,
      ).length,
    };
  }, [orders, todayTime]);

  /** Pencocokan tiga arah — pesan, terima, tagih di seluruh PO yang belum ditutup. */
  const match = useMemo(() => {
    const live = orders.filter((order) => !["DRAF", "DITOLAK", "BATAL"].includes(order.status));
    const ordered = live.reduce((sum, order) => sum + order.amount, 0);
    const received = live.reduce((sum, order) => sum + order.receivedAmount, 0);
    const billed = live.reduce((sum, order) => sum + order.billedAmount, 0);
    return { ordered, received, billed, variance: received - billed };
  }, [orders]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setError("");
  }

  function openDialog() {
    setForm({
      vendorId: "",
      number: nextNumber,
      orderDate: todayInput,
      deliveryDate: addDays(todayInput, 14),
      unitId: activeUnit.id,
      description: "",
      quantity: "1",
      unitPrice: "",
      targetAccountId: "",
      ppnMode: "11",
    });
    setErrors({});
    setError("");
    setOpen(true);
  }

  async function submit(submitForApproval: boolean) {
    const nextErrors: Record<string, string> = {};
    if (!form.vendorId) nextErrors.vendorId = t("Vendor harus dipilih.");
    if (!form.number.trim()) nextErrors.number = t("No. PO harus diisi.");
    if (!form.orderDate) nextErrors.orderDate = t("Tanggal PO harus diisi.");
    if (!form.deliveryDate) nextErrors.deliveryDate = t("Tanggal kirim diminta harus diisi.");
    if (!form.description.trim()) nextErrors.description = t("Barang / jasa harus diisi.");
    if (parseAmountInput(form.quantity) <= 0) nextErrors.quantity = t("Kuantitas harus lebih dari nol.");
    if (parseAmountInput(form.unitPrice) <= 0) nextErrors.unitPrice = t("Harga satuan harus diisi.");
    if (!form.targetAccountId) nextErrors.targetAccountId = t("Akun tujuan harus dipilih.");

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setError(t("Lengkapi dulu kolom yang ditandai."));
      return;
    }

    setBusy(true);
    const res = await fetch("/api/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vendorId: form.vendorId,
        unitId: form.unitId,
        // Nomor preview dibiarkan kosong supaya urutan dokumen naik di server.
        number: form.number.trim() === nextNumber ? undefined : form.number.trim(),
        orderDate: form.orderDate,
        deliveryDate: form.deliveryDate || undefined,
        targetAccountId: form.targetAccountId,
        ppnRate,
        lines: [
          {
            description: form.description.trim(),
            quantity: parseAmountInput(form.quantity),
            unitPrice: parseAmountInput(form.unitPrice),
          },
        ],
        submit: submitForApproval,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      setError(data.error ?? t("PO gagal disimpan."));
      return;
    }

    setOpen(false);
    toast(submitForApproval ? t("PO diajukan untuk persetujuan") : t("PO disimpan sebagai draf"));
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Pembelian & Purchase Order")}
        subtitle={t("Pesanan pembelian, penerimaan barang, dan pencocokan tiga arah")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari no. PO atau vendor")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 232 }}
            />
            <button className="btn" onClick={() => toast(t("Daftar PO diekspor ke Excel"))}>
              {t("Ekspor daftar")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openDialog}>
                {t("Buat PO")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("PO terbuka")}</div>
          <div className="v">{metrics.openCount === 0 ? "—" : String(metrics.openCount)}</div>
          <div className="d muted">{`${t("di")} ${metrics.openBooks || unitCount} ${t("buku unit")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Nilai PO terbuka")}</div>
          <div className="v">{dash(metrics.openValue)}</div>
          <div className="d muted">{t("belum jadi tagihan")}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Menunggu persetujuan")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>
            {metrics.waiting === 0 ? "—" : String(metrics.waiting)}
          </div>
          <div className="d" style={{ color: "var(--amber)" }}>
            {t("di atas batas unit")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Diterima belum ditagih")}</div>
          <div className="v">{dash(metrics.receivedNotBilled)}</div>
          <div className="d muted">{t("akun 2-1900")}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Lewat tanggal kirim")}</div>
          <div className="v" style={{ color: "var(--brick)" }}>
            {metrics.late === 0 ? "—" : String(metrics.late)}
          </div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {t("perlu ditagih ke vendor")}
          </div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Purchase order")}</h2>
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
                value={vendorFilter}
                onChange={(event) => setVendorFilter(event.target.value)}
              >
                <option value="">{t("Semua vendor")}</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
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
              <button className={tab === "draf" ? "tab on" : "tab"} onClick={() => setTab("draf")}>
                {t("Draf")} <span className="muted">{counts.draf}</span>
              </button>
              <button className={tab === "approval" ? "tab on" : "tab"} onClick={() => setTab("approval")}>
                {t("Menunggu persetujuan")} <span style={{ color: "var(--amber)" }}>{counts.approval}</span>
              </button>
              <button className={tab === "terbuka" ? "tab on" : "tab"} onClick={() => setTab("terbuka")}>
                {t("Terbuka")} <span className="muted">{counts.terbuka}</span>
              </button>
              <button className={tab === "selesai" ? "tab on" : "tab"} onClick={() => setTab("selesai")}>
                {t("Selesai")} <span className="muted">{counts.selesai}</span>
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 1000, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 118, whiteSpace: "nowrap" }}>{t("No. PO")}</th>
                  <th style={{ width: "22%" }}>{t("Vendor")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Tanggal")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Tgl kirim")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Nilai PO")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Diterima")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Ditagih")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Persetujuan")}</th>
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
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {order.number}
                    </td>
                    <td>
                      <span style={{ display: "block", fontWeight: 500 }}>{order.vendorName}</span>
                      <span className="sm muted num">
                        {order.vendorCode} · {order.unitCode}
                      </span>
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {formatDate(order.orderDate)}
                    </td>
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      {formatDate(order.deliveryDate)}
                    </td>
                    <td className="r num">{dash(order.amount)}</td>
                    <td className="r num">{dash(order.receivedAmount)}</td>
                    <td className="r num">{dash(order.billedAmount)}</td>
                    <td>
                      {order.approvalStatus ? (
                        <span className={APPROVAL_CHIP[order.approvalStatus]}>
                          {t(APPROVAL_LABEL[order.approvalStatus])}
                        </span>
                      ) : order.status === "DRAF" ? (
                        <span className="sm muted">—</span>
                      ) : (
                        <span className="chip chip-open">{t("Di bawah batas")}</span>
                      )}
                    </td>
                    <td>
                      <span className={STATUS_CHIP[order.status]}>{t(STATUS_LABEL[order.status])}</span>
                      {order.stage && (
                        <span className="sm muted" style={{ display: "block" }}>
                          {t(order.stage)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{`${filtered.length} ${t("dari")} ${scoped.length} ${t("PO ditampilkan")}`}</span>
            <span className="k">{t("Nilai yang ditampilkan")}</span>
            <span className="v num">{dash(shownValue)}</span>
            <span style={{ marginLeft: "auto" }}>
              <a className="btn btn-sm" href="/hutang">
                {t("Buka hutang usaha")}
              </a>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Pencocokan tiga arah")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Tahap")}</th>
                  <th>{t("Dokumen")}</th>
                  <th className="r">{t("Jumlah")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{`1 · ${t("Pesan")}`}</td>
                  <td>{t("Purchase order")}</td>
                  <td className="r num">{dash(match.ordered)}</td>
                </tr>
                <tr>
                  <td>{`2 · ${t("Terima")}`}</td>
                  <td>{t("Bukti penerimaan barang")}</td>
                  <td className="r num">{dash(match.received)}</td>
                </tr>
                <tr>
                  <td>{`3 · ${t("Tagih")}`}</td>
                  <td>{t("Tagihan vendor")}</td>
                  <td className="r num">{dash(match.billed)}</td>
                </tr>
                <tr className="tot">
                  <td colSpan={2}>{t("Selisih perlu ditinjau")}</td>
                  <td className="r num">{dash(match.variance)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Batas persetujuan")}</h2>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Nilai PO")}</th>
                  <th className="r">{t("Penyetuju")}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{t("Sampai 10 juta")}</td>
                  <td className="r">{t("Kepala unit")}</td>
                </tr>
                <tr>
                  <td>{t("10 – 100 juta")}</td>
                  <td className="r">{t("Manajer keuangan")}</td>
                </tr>
                <tr>
                  <td>{t("Di atas 100 juta")}</td>
                  <td className="r">{t("Direksi")}</td>
                </tr>
              </tbody>
            </table>
            <div className="bal">
              <span style={{ marginLeft: "auto" }}>
                <a className="btn btn-sm" href="/persetujuan">
                  {t("Buka kotak persetujuan")}
                </a>
              </span>
            </div>
          </div>

          <div className="note">
            {t(
              "PO tidak menjurnal. Jurnal terbentuk pada penerimaan barang (persediaan dan utang belum ditagih) lalu bergeser saat tagihan vendor dicatat.",
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Buat purchase order")}
        maxWidth={600}
        badge={`${t("buku")} ${activeUnit.code} · ${activeUnit.name}`}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void submit(false)}>
              {t("Simpan draf")}
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submit(true)}>
              {busy ? t("Menyimpan…") : t("Ajukan persetujuan")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Vendor")}</label>
            <select
              className={errors.vendorId ? "field-error" : undefined}
              value={form.vendorId}
              onChange={(event) => update("vendorId", event.target.value)}
            >
              <option value="">{t("— Pilih vendor —")}</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.code} · {vendor.name}
                </option>
              ))}
            </select>
            {vendors.length === 0 && (
              <span className="sm muted">{t("Belum ada vendor — tambahkan di layar Vendor dulu.")}</span>
            )}
          </div>
          <div>
            <label className="f" data-req="1">{t("No. PO")}</label>
            <input
              type="text"
              className={errors.number ? "num field-error" : "num"}
              value={form.number}
              onChange={(event) => update("number", event.target.value)}
              placeholder={nextNumber}
            />
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f" data-req="1">{t("Tanggal PO")}</label>
            <input
              type="date"
              className={errors.orderDate ? "field-error" : undefined}
              value={form.orderDate}
              onChange={(event) => update("orderDate", event.target.value)}
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("Tanggal kirim diminta")}</label>
            <input
              type="date"
              className={errors.deliveryDate ? "field-error" : undefined}
              value={form.deliveryDate}
              onChange={(event) => update("deliveryDate", event.target.value)}
            />
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
            <label className="f" data-req="1">{t("Barang / jasa")}</label>
            <input
              type="text"
              className={errors.description ? "field-error" : undefined}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              placeholder={t("Misal: Kemasan karton 30x20")}
            />
          </div>
          <div>
            <label className="f">{t("Kuantitas")}</label>
            <input
              type="text"
              className={errors.quantity ? "num field-error" : "num"}
              value={form.quantity}
              onChange={(event) => update("quantity", event.target.value)}
            />
          </div>
          <div>
            <label className="f" data-req="1">{t("Harga satuan")}</label>
            <input
              type="text"
              className={errors.unitPrice ? "num field-error" : "num"}
              value={form.unitPrice}
              onChange={(event) => update("unitPrice", event.target.value)}
              placeholder="0"
            />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Akun tujuan")}</label>
            <select
              className={errors.targetAccountId ? "field-error" : undefined}
              value={form.targetAccountId}
              onChange={(event) => update("targetAccountId", event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {targetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Perlakuan PPN")}</label>
            <select value={form.ppnMode} onChange={(event) => update("ppnMode", event.target.value)}>
              <option value="11">{t("PPN masukan 11%")}</option>
              <option value="0">{t("Tanpa PPN")}</option>
            </select>
          </div>
        </div>
        <div className="bal" style={{ borderRadius: 9, borderTop: "none", marginBottom: 12 }}>
          <span className="k">{t("Subtotal")}</span>
          <span className="v num">{dash(subtotal)}</span>
          <span className="k">{t("PPN")}</span>
          <span className="v num">{dash(ppn)}</span>
          <span className="k">{t("Nilai PO")}</span>
          <span className="v num">{dash(total)}</span>
        </div>
        <div className="note">
          {t("PO di atas batas unit otomatis masuk kotak persetujuan sebelum bisa dikirim ke vendor.")}
          {total > approvalThreshold && (
            <span style={{ display: "block", marginTop: 4, color: "var(--amber)" }}>
              {`${t("Nilai PO di atas batas")} ${dash(approvalThreshold)} — ${t("perlu persetujuan")}`}
            </span>
          )}
        </div>

        {error && (
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
            {error}
          </div>
        )}
      </Dialog>
    </>
  );
}
