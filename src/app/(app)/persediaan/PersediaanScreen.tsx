"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { dash, formatAmount, formatDate, formatQuantity } from "@/lib/format";

export type ItemRow = {
  id: string;
  code: string;
  name: string;
  warehouse: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  stock: number;
  minimum: number;
  averageCost: number;
  value: number;
  status: "AKTIF" | "NONAKTIF";
  lastMovement: string | null;
  idleDays: number | null;
};

export type OpnameEvent = {
  date: string;
  warehouse: string;
  items: number;
  variance: number;
  reference: string | null;
};

/** Kategori barang belum ada di `InventoryItem`, jadi daftarnya mengikuti prototipe. */
const CATEGORIES = ["Barang dagang", "Bahan pembantu", "Kemasan"];

const SCOPES = ["Seluruh SKU", "Per kategori", "Sampel acak 20%"];

const IDLE_DAYS = 90;

export default function PersediaanScreen({
  items,
  opnames,
  warehouses,
  unitLabel,
  todayIso,
  turnover,
  accountCodes,
  canEdit,
}: {
  items: ItemRow[];
  opnames: OpnameEvent[];
  warehouses: string[];
  unitLabel: string;
  todayIso: string;
  turnover: number;
  accountCodes: { inventory: string; cogs: string; variance: string };
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState("all");

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    warehouse: warehouses[0] ?? "",
    cutoffDate: todayIso,
    scope: SCOPES[0],
    counter: "",
    varianceAccount: accountCodes.variance,
    freeze: true,
  });
  const [counts, setCounts] = useState<Record<string, string>>({});

  const scoped = useMemo(
    () => items.filter((item) => (warehouse ? item.warehouse === warehouse : true)),
    [items, warehouse],
  );

  const belowMinimum = (item: ItemRow) => item.stock < item.minimum;

  const tabCounts = useMemo(
    () => ({
      all: scoped.length,
      minimum: scoped.filter((item) => belowMinimum(item) && item.stock > 0).length,
      kosong: scoped.filter((item) => item.stock <= 0).length,
      mati: scoped.filter((item) => item.idleDays === null || item.idleDays >= IDLE_DAYS).length,
    }),
    [scoped],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter((item) => {
      // Belum ada kolom kategori di basis data — lihat catatan di atas.
      if (category) return false;
      if (tab === "minimum" && !(belowMinimum(item) && item.stock > 0)) return false;
      if (tab === "kosong" && item.stock > 0) return false;
      if (tab === "mati" && item.idleDays !== null && item.idleDays < IDLE_DAYS) return false;
      if (!needle) return true;
      return `${item.code} ${item.name}`.toLowerCase().includes(needle);
    });
  }, [scoped, query, category, tab]);

  const metrics = useMemo(() => {
    const value = scoped.reduce((sum, item) => sum + item.value, 0);
    const active = scoped.filter((item) => item.status === "AKTIF").length;
    const below = scoped.filter((item) => belowMinimum(item)).length;
    const lastOpname = opnames[0] ?? null;
    return { value, active, below, lastOpname };
  }, [scoped, opnames]);

  const shownValue = filtered.reduce((sum, item) => sum + item.value, 0);
  const warehouseCount = warehouses.length;

  const countable = useMemo(
    () => items.filter((item) => item.warehouse === form.warehouse),
    [items, form.warehouse],
  );

  const opnameLines = useMemo(
    () =>
      countable.map((item) => {
        const raw = counts[item.id];
        const counted = raw === undefined || raw === "" ? null : Number(raw.replace(",", "."));
        const difference = counted === null || Number.isNaN(counted) ? 0 : counted - item.stock;
        return { item, counted, difference, value: difference * item.averageCost };
      }),
    [countable, counts],
  );

  const varianceValue = opnameLines.reduce((sum, line) => sum + line.value, 0);
  const varianceCount = opnameLines.filter((line) => line.counted !== null && line.difference !== 0).length;

  function statusChip(item: ItemRow) {
    if (item.status === "NONAKTIF") return { className: "chip chip-lock", label: "Non-aktif" };
    if (item.stock <= 0) return { className: "chip chip-bad", label: "Stok kosong" };
    if (belowMinimum(item)) return { className: "chip chip-warn", label: "Di bawah minimum" };
    return { className: "chip chip-ok", label: "Aman" };
  }

  function openOpname() {
    setForm({
      warehouse: warehouse || warehouses[0] || "",
      cutoffDate: todayIso,
      scope: SCOPES[0],
      counter: "",
      varianceAccount: accountCodes.variance,
      freeze: true,
    });
    setCounts({});
    setErrors({});
    setOpen(true);
  }

  async function submit() {
    const nextErrors: Record<string, string> = {};
    if (!form.warehouse) nextErrors.warehouse = t("Gudang harus dipilih.");
    if (!form.cutoffDate) nextErrors.cutoffDate = t("Tanggal cut-off harus diisi.");
    if (!form.counter.trim()) nextErrors.counter = t("Petugas hitung harus diisi.");

    const payload = opnameLines
      .filter((line) => line.counted !== null && !Number.isNaN(line.counted))
      .map((line) => ({ itemId: line.item.id, counted: line.counted as number }));
    if (payload.length === 0) nextErrors.counts = t("Isi hasil hitung minimal satu barang.");
    if (payload.some((line) => line.counted < 0)) nextErrors.counts = t("Hasil hitung tidak boleh negatif.");

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/inventory/opname", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouse: form.warehouse,
        cutoffDate: form.cutoffDate,
        scope: form.scope,
        counter: form.counter.trim(),
        varianceAccount: form.varianceAccount,
        freeze: form.freeze,
        counts: payload,
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string; adjusted?: number; varianceValue?: number };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setErrors({ [data.field]: data.error ?? "" });
      toast(data.error ?? t("Gagal menyimpan hasil opname."));
      return;
    }

    setOpen(false);
    toast(
      data.adjusted
        ? `${t("Lembar opname dibuat")} · ${data.adjusted} ${t("barang disesuaikan")} · ${formatAmount(Math.abs(data.varianceValue ?? 0))}`
        : t("Lembar opname dibuat dan mutasi gudang dibekukan"),
    );
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Persediaan")}
        subtitle={t("Kartu stok dan penilaian persediaan per gudang unit")}
        actions={
          <>
            <input
              type="text"
              placeholder={t("Cari kode atau nama barang")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={{ width: 230 }}
            />
            <button className="btn" onClick={() => toast(t("Kartu stok diekspor ke Excel"))}>
              {t("Ekspor kartu stok")}
            </button>
            {canEdit && (
              <button className="btn btn-primary" onClick={openOpname}>
                {t("Mulai stock opname")}
              </button>
            )}
          </>
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">{t("Nilai persediaan")}</div>
          <div className="v">{dash(metrics.value)}</div>
          <div className="d muted">{`${t("akun")} ${accountCodes.inventory}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Jumlah SKU aktif")}</div>
          <div className="v">{metrics.active === 0 ? "—" : String(metrics.active)}</div>
          <div className="d muted">{`${t("di")} ${warehouseCount} ${t("gudang unit")}`}</div>
        </div>
        <div className="metric">
          <div className="l">{t("Di bawah stok minimum")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>
            {metrics.below === 0 ? "—" : String(metrics.below)}
          </div>
          <div className="d" style={{ color: "var(--amber)" }}>
            {t("perlu pemesanan")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Selisih opname terakhir")}</div>
          <div className="v" style={{ color: "var(--brick)" }}>
            {metrics.lastOpname ? dash(Math.abs(metrics.lastOpname.variance)) : "—"}
          </div>
          <div className="d" style={{ color: "var(--brick)" }}>
            {t("belum dijurnal")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Perputaran persediaan")}</div>
          <div className="v">{turnover === 0 ? "—" : formatQuantity(turnover)}</div>
          <div className="d muted">{t("kali per tahun")}</div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Kartu stok")}</h2>
            <div className="rt">
              <select style={{ width: "auto" }} value={warehouse} onChange={(event) => setWarehouse(event.target.value)}>
                <option value="">{t("Semua gudang")}</option>
                {warehouses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select style={{ width: "auto" }} value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">{t("Semua kategori")}</option>
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {t(item)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ padding: "12px 18px 0" }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button className={tab === "all" ? "tab on" : "tab"} onClick={() => setTab("all")}>
                {t("Semua")} <span className="muted">{tabCounts.all}</span>
              </button>
              <button className={tab === "minimum" ? "tab on" : "tab"} onClick={() => setTab("minimum")}>
                {t("Di bawah minimum")} <span style={{ color: "var(--amber)" }}>{tabCounts.minimum}</span>
              </button>
              <button className={tab === "kosong" ? "tab on" : "tab"} onClick={() => setTab("kosong")}>
                {t("Stok kosong")} <span style={{ color: "var(--brick)" }}>{tabCounts.kosong}</span>
              </button>
              <button className={tab === "mati" ? "tab on" : "tab"} onClick={() => setTab("mati")}>
                {t("Tidak bergerak 90 hari")} <span className="muted">{tabCounts.mati}</span>
              </button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 960, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 104, whiteSpace: "nowrap" }}>{t("Kode")}</th>
                  <th style={{ width: "24%" }}>{t("Nama barang")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Gudang")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Satuan")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Stok")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Minimum")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("HPP rata-rata")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>{t("Nilai")}</th>
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
                {filtered.map((item) => {
                  const chip = statusChip(item);
                  return (
                    <tr key={item.id}>
                      <td className="num" style={{ whiteSpace: "nowrap" }}>{item.code}</td>
                      <td>{item.name}</td>
                      <td>{item.warehouse}</td>
                      <td>{item.unitName}</td>
                      <td
                        className="r num"
                        style={belowMinimum(item) ? { color: "var(--amber)", fontWeight: 500 } : undefined}
                      >
                        {item.stock === 0 ? "—" : formatQuantity(item.stock)}
                      </td>
                      <td className="r num">{item.minimum === 0 ? "—" : formatQuantity(item.minimum)}</td>
                      <td className="r num">{dash(item.averageCost)}</td>
                      <td className="r num">{dash(item.value)}</td>
                      <td>
                        <span className={chip.className}>{t(chip.label)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">{`${filtered.length} ${t("dari")} ${scoped.length} ${t("barang ditampilkan")}`}</span>
            <span className="k">{t("Nilai yang ditampilkan")}</span>
            <span className="v num">{dash(shownValue)}</span>
            <span style={{ marginLeft: "auto" }}>
              <button className="btn btn-sm" onClick={() => toast(t("Mutasi barang terpilih dibuka"))}>
                {t("Lihat mutasi")}
              </button>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Stock opname")}</h2>
              <span className="sub">{t("tiga periode terakhir")}</span>
            </div>
            {opnames.length === 0 ? (
              <div className="card-b sm muted">{t("Belum ada opname")}</div>
            ) : (
              <ul className="timeline" style={{ padding: "6px 18px 12px" }}>
                {opnames.map((event) => (
                  <li key={`${event.date}-${event.warehouse}`}>
                    <span className="tm">{formatDate(event.date)}</span>
                    <span>
                      {`${t("Opname gudang")} ${event.warehouse} — `}
                      {event.variance === 0
                        ? t("tanpa selisih")
                        : `${t("selisih")} ${formatAmount(Math.abs(event.variance))} ${t("belum dijurnal")}`}
                      {event.variance !== 0 && (
                        <span className="chip chip-warn" style={{ marginLeft: 6 }}>
                          {t("menunggu")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Dasar penilaian")}</h2>
            </div>
            <table>
              <tbody>
                <tr>
                  <td>{t("Metode")}</td>
                  <td className="r">{t("Rata-rata bergerak")}</td>
                </tr>
                <tr>
                  <td>{t("Pencatatan")}</td>
                  <td className="r">{t("Perpetual")}</td>
                </tr>
                <tr>
                  <td>{t("Akun persediaan")}</td>
                  <td className="r num">{accountCodes.inventory}</td>
                </tr>
                <tr>
                  <td>{t("Akun HPP")}</td>
                  <td className="r num">{accountCodes.cogs}</td>
                </tr>
                <tr>
                  <td>{t("Akun selisih opname")}</td>
                  <td className="r num">{accountCodes.variance}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="note">
            {t(
              "Setiap penerimaan barang memperbarui HPP rata-rata pada gudang unit yang bersangkutan, bukan pada tingkat entitas.",
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("Mulai stock opname")}
        badge={`${t("buku")} ${unitLabel}`}
        maxWidth={520}
        footer={
          <>
            <button className="btn" onClick={() => setOpen(false)}>
              {t("Batal")}
            </button>
            <button
              className="btn btn-primary"
              style={{ marginLeft: "auto" }}
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? t("Menyimpan…") : t("Buat lembar opname")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">{t("Gudang")}</label>
            <select
              className={errors.warehouse ? "field-error" : undefined}
              value={form.warehouse}
              onChange={(event) => {
                setForm({ ...form, warehouse: event.target.value });
                setCounts({});
                setErrors({});
              }}
            >
              <option value="">{t("— Pilih gudang —")}</option>
              {warehouses.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {errors.warehouse && <span className="sm" style={{ color: "#C8382F" }}>{errors.warehouse}</span>}
          </div>
          <div>
            <label className="f" data-req="1">{t("Tanggal cut-off")}</label>
            <input
              type="date"
              className={errors.cutoffDate ? "field-error" : undefined}
              value={form.cutoffDate}
              onChange={(event) => setForm({ ...form, cutoffDate: event.target.value })}
            />
            {errors.cutoffDate && <span className="sm" style={{ color: "#C8382F" }}>{errors.cutoffDate}</span>}
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f">{t("Cakupan")}</label>
            <select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })}>
              {SCOPES.map((item) => (
                <option key={item} value={item}>
                  {t(item)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f" data-req="1">{t("Petugas hitung")}</label>
            <input
              type="text"
              className={errors.counter ? "field-error" : undefined}
              value={form.counter}
              onChange={(event) => setForm({ ...form, counter: event.target.value })}
              placeholder={t("Nama petugas")}
            />
            {errors.counter && <span className="sm" style={{ color: "#C8382F" }}>{errors.counter}</span>}
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f">{t("Akun selisih")}</label>
            <select
              value={form.varianceAccount}
              onChange={(event) => setForm({ ...form, varianceAccount: event.target.value })}
            >
              <option value={accountCodes.variance}>{`${accountCodes.variance} · ${t("Selisih persediaan")}`}</option>
              <option value={accountCodes.cogs}>{`${accountCodes.cogs} · ${t("Harga pokok penjualan")}`}</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="f">{t("Hasil hitung fisik")}</label>
          <div style={{ border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
            <table style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 11 }}>{t("Barang")}</th>
                  <th className="r">{t("Stok sistem")}</th>
                  <th className="r" style={{ width: 96 }}>{t("Hasil hitung")}</th>
                  <th className="r" style={{ paddingRight: 11 }}>{t("Selisih")}</th>
                </tr>
              </thead>
              <tbody>
                {opnameLines.length === 0 && (
                  <tr>
                    <td colSpan={4} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada barang di gudang ini")}
                    </td>
                  </tr>
                )}
                {opnameLines.map((line) => (
                  <tr key={line.item.id}>
                    <td style={{ paddingLeft: 11 }}>
                      <span className="num sm" style={{ color: "var(--ledger-dk)" }}>{line.item.code}</span>
                      <span style={{ display: "block" }}>{line.item.name}</span>
                    </td>
                    <td className="r num">{formatQuantity(line.item.stock)}</td>
                    <td className="r">
                      <input
                        type="text"
                        className="num"
                        value={counts[line.item.id] ?? ""}
                        onChange={(event) => setCounts({ ...counts, [line.item.id]: event.target.value })}
                        placeholder="0"
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td
                      className="r num"
                      style={{
                        paddingRight: 11,
                        color: line.counted === null || line.difference === 0 ? undefined : "var(--brick)",
                      }}
                    >
                      {line.counted === null || line.difference === 0 ? "—" : formatQuantity(line.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.counts && <span className="sm" style={{ color: "#C8382F" }}>{errors.counts}</span>}
        </div>

        <div className="bal" style={{ borderRadius: 9, borderTop: "none", marginBottom: 12 }}>
          <span className="k">{t("Barang selisih")}</span>
          <span className="v num">{varianceCount === 0 ? "—" : String(varianceCount)}</span>
          <span className="k">{t("Nilai selisih")}</span>
          <span className="v num">{dash(Math.abs(varianceValue))}</span>
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
            checked={form.freeze}
            onChange={(event) => setForm({ ...form, freeze: event.target.checked })}
            style={{ width: "auto" }}
          />
          <span>{t("Bekukan mutasi gudang selama penghitungan")}</span>
        </label>
        <div className="note note-warn">
          {t("Selisih hasil opname tidak langsung menjurnal. Selisih perlu disetujui lebih dulu di kotak persetujuan.")}
        </div>
      </Dialog>
    </>
  );
}
