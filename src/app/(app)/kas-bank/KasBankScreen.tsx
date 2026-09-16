"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import Dialog from "@/components/ui/Dialog";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { dash, formatAmount, formatDate, parseAmountInput } from "@/lib/format";

export type CashBook = {
  id: string;
  label: string;
  plainName: string;
  accountCode: string | null;
  accountNumber: string | null;
  bankName: string | null;
  kind: "KAS" | "BANK";
  unitId: string;
  unitCode: string;
  unitName: string;
  balance: number;
  hasLedgerAccount: boolean;
  lastMovement: string | null;
};

export type CashMovement = {
  id: string;
  time: string;
  reference: string;
  accountCode: string;
  accountName: string;
  bankAccountId: string;
  description: string;
  unitCode: string;
  debit: number;
  credit: number;
  balance: number;
};

export type PettyUnit = {
  id: string;
  code: string;
  name: string;
  balance: number;
  limit: number;
  hasBook: boolean;
};

export type TransferRow = {
  id: string;
  number: string;
  date: string;
  description: string;
  status: string;
  unitCode: string;
};

type AccountOption = { id: string; code: string; name: string };

function moneyText(digits: string) {
  return digits ? formatAmount(parseAmountInput(digits)) : "";
}

export default function KasBankScreen({
  books,
  movements,
  units,
  pettyPerUnit,
  expenseAccounts,
  assetAccounts,
  unreconciled,
  transfers,
  pendingTransfers,
  activeUnitName,
  activeUnitId,
  today,
  canEdit,
}: {
  books: CashBook[];
  movements: CashMovement[];
  units: { id: string; code: string; name: string }[];
  pettyPerUnit: PettyUnit[];
  expenseAccounts: AccountOption[];
  assetAccounts: AccountOption[];
  unreconciled: number;
  transfers: TransferRow[];
  pendingTransfers: number;
  activeUnitName: string;
  activeUnitId: string;
  today: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const receiptInput = useRef<HTMLInputElement>(null);

  const [accountFilter, setAccountFilter] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const [outOpen, setOutOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const bankBooks = books.filter((book) => book.kind === "BANK");
  const activeKas = books.filter((book) => book.kind === "KAS" && book.unitId === activeUnitId);
  const kasBalance = activeKas.reduce((total, book) => total + book.balance, 0);
  const kasLimit = pettyPerUnit.find((unit) => unit.id === activeUnitId)?.limit ?? 0;

  // ── Kas keluar ───────────────────────────────────────────
  const [outForm, setOutForm] = useState({
    date: today,
    bankAccountId: books[0]?.id ?? "",
    payee: "",
    amount: "",
    expenseAccountId: "",
    unitId: books[0]?.unitId ?? activeUnitId,
    purpose: "",
  });
  const [receipt, setReceipt] = useState<string | null>(null);
  const [outErrors, setOutErrors] = useState<Record<string, string>>({});
  const [outError, setOutError] = useState<string | null>(null);

  const outBook = books.find((book) => book.id === outForm.bankAccountId) ?? null;

  // ── Transfer antar buku ──────────────────────────────────
  const [transferForm, setTransferForm] = useState({
    fromUnitId: books[0]?.unitId ?? activeUnitId,
    fromBankAccountId: books[0]?.id ?? "",
    toUnitId: "",
    toBankAccountId: "",
    date: today,
    amount: "",
    purpose: "",
  });
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({});
  const [transferError, setTransferError] = useState<string | null>(null);

  const sourceBook = books.find((book) => book.id === transferForm.fromBankAccountId) ?? null;

  // ── Tambah rekening ──────────────────────────────────────
  const [accountForm, setAccountForm] = useState({
    name: "",
    accountCode: "",
    kind: "BANK",
    unitId: activeUnitId,
    bankName: "",
    accountNumber: "",
    openingBalance: "",
  });
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});
  const [accountError, setAccountError] = useState<string | null>(null);

  /** Kas keluar selalu diposting di buku unit pemilik rekening. */
  function changeOutAccount(bankAccountId: string) {
    const book = books.find((item) => item.id === bankAccountId) ?? null;
    setOutForm((current) => ({ ...current, bankAccountId, unitId: book?.unitId ?? current.unitId }));
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return movements.filter((row) => {
      if (accountFilter && row.bankAccountId !== accountFilter) return false;
      if (!needle) return true;
      return `${row.description} ${row.reference} ${row.accountName}`.toLowerCase().includes(needle);
    });
  }, [movements, accountFilter, search]);

  const totals = useMemo(
    () => ({
      masuk: filtered.reduce((sum, row) => sum + row.debit, 0),
      keluar: filtered.reduce((sum, row) => sum + row.credit, 0),
    }),
    [filtered],
  );

  function openTransfer(toUnitId?: string) {
    setTransferError(null);
    setTransferErrors({});
    setTransferForm((current) => ({
      ...current,
      date: today,
      toUnitId: toUnitId ?? current.toUnitId,
      toBankAccountId:
        toUnitId && books.find((book) => book.unitId === toUnitId)
          ? (books.find((book) => book.unitId === toUnitId)?.id ?? "")
          : current.toBankAccountId,
    }));
    setTransferOpen(true);
  }

  async function submitOut() {
    const errors: Record<string, string> = {};
    const amount = parseAmountInput(outForm.amount);
    if (!outForm.date) errors.date = t("Tanggal harus diisi.");
    if (!outForm.bankAccountId) errors.bankAccountId = t("Akun kas / bank harus dipilih.");
    if (!outForm.payee.trim()) errors.payee = t("Penerima harus diisi.");
    if (amount <= 0) errors.amount = t("Nilai harus lebih dari nol.");
    if (!outForm.expenseAccountId) errors.expenseAccountId = t("Akun beban harus dipilih.");
    if (!outForm.purpose.trim()) errors.purpose = t("Keperluan harus diisi.");
    if (outBook && amount > outBook.balance) {
      errors.amount = `${t("Nilai melebihi saldo")} ${outBook.plainName} ${formatAmount(outBook.balance)}.`;
    }
    if (amount > 1_000_000 && !receipt) {
      errors.amount = t("Lampiran struk wajib untuk pengeluaran di atas 1.000.000.");
    }
    if (Object.keys(errors).length > 0) {
      setOutErrors(errors);
      setOutError(Object.values(errors)[0]);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/cash/out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: outForm.date,
        bankAccountId: outForm.bankAccountId,
        payee: outForm.payee,
        amount,
        expenseAccountId: outForm.expenseAccountId,
        unitId: outForm.unitId,
        purpose: outForm.purpose,
        hasAttachment: Boolean(receipt),
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string; number?: string; unitCode?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setOutErrors({ [data.field]: data.error ?? "" });
      setOutError(data.error ?? t("Gagal menyimpan kas keluar."));
      return;
    }

    setOutOpen(false);
    setOutErrors({});
    setOutError(null);
    setReceipt(null);
    setOutForm((current) => ({ ...current, payee: "", amount: "", purpose: "" }));
    toast(`${t("Kas keluar")} ${data.number} ${t("dicatat di buku")} ${data.unitCode}`);
    router.refresh();
  }

  async function submitTransfer() {
    const errors: Record<string, string> = {};
    const amount = parseAmountInput(transferForm.amount);
    if (!transferForm.fromUnitId) errors.fromUnitId = t("Buku pengirim harus dipilih.");
    if (!transferForm.fromBankAccountId) errors.fromBankAccountId = t("Akun sumber harus dipilih.");
    if (!transferForm.toUnitId) errors.toUnitId = t("Buku penerima harus dipilih.");
    if (!transferForm.toBankAccountId) errors.toBankAccountId = t("Akun tujuan harus dipilih.");
    if (!transferForm.date) errors.date = t("Tanggal harus diisi.");
    if (amount <= 0) errors.amount = t("Nilai transfer harus lebih dari nol.");
    if (!transferForm.purpose.trim()) errors.purpose = t("Keperluan harus diisi.");
    if (sourceBook && amount > sourceBook.balance) {
      errors.amount = `${t("Nilai melebihi saldo")} ${sourceBook.plainName} ${formatAmount(sourceBook.balance)}.`;
    }
    if (Object.keys(errors).length > 0) {
      setTransferErrors(errors);
      setTransferError(Object.values(errors)[0]);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/cash/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...transferForm, amount }),
    });
    const data = (await res.json()) as { error?: string; field?: string; numbers?: string[] };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setTransferErrors({ [data.field]: data.error ?? "" });
      setTransferError(data.error ?? t("Gagal memproses transfer."));
      return;
    }

    setTransferOpen(false);
    setTransferErrors({});
    setTransferError(null);
    setTransferForm((current) => ({ ...current, amount: "", purpose: "" }));
    toast(`${t("Transfer antar buku tercatat")} · ${(data.numbers ?? []).join(" / ")}`);
    router.refresh();
  }

  async function submitAccount() {
    const errors: Record<string, string> = {};
    if (!accountForm.name.trim()) errors.name = t("Nama rekening harus diisi.");
    if (!accountForm.accountCode) errors.accountCode = t("Akun buku besar harus dipilih.");
    if (!accountForm.unitId) errors.unitId = t("Buku unit harus dipilih.");
    if (Object.keys(errors).length > 0) {
      setAccountErrors(errors);
      setAccountError(Object.values(errors)[0]);
      return;
    }

    setBusy(true);
    const res = await fetch("/api/cash/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: accountForm.name,
        accountCode: accountForm.accountCode,
        kind: accountForm.kind,
        unitId: accountForm.unitId,
        bankName: accountForm.bankName,
        accountNumber: accountForm.accountNumber,
        openingBalance: parseAmountInput(accountForm.openingBalance),
      }),
    });
    const data = (await res.json()) as { error?: string; field?: string };
    setBusy(false);

    if (!res.ok) {
      if (data.field) setAccountErrors({ [data.field]: data.error ?? "" });
      setAccountError(data.error ?? t("Gagal menyimpan rekening."));
      return;
    }

    setAccountOpen(false);
    setAccountErrors({});
    setAccountError(null);
    setAccountForm({ name: "", accountCode: "", kind: "BANK", unitId: activeUnitId, bankName: "", accountNumber: "", openingBalance: "" });
    toast(t("Rekening kas/bank tersimpan"));
    router.refresh();
  }

  return (
    <>
      <PageHead
        title={t("Kas & Bank Harian")}
        subtitle={t("Kas kecil per unit dan transfer antar buku")}
        actions={
          canEdit ? (
            <>
              <button className="btn" onClick={() => setAccountOpen(true)}>
                {t("Tambah rekening")}
              </button>
              <button className="btn" disabled={books.length === 0} onClick={() => openTransfer()}>
                {t("Transfer antar buku")}
              </button>
              <button className="btn btn-primary" disabled={books.length === 0} onClick={() => setOutOpen(true)}>
                {t("Kas keluar")}
              </button>
            </>
          ) : null
        }
      />

      <div className="metrics">
        <div className="metric">
          <div className="l">
            {t("Kas kecil")} {activeUnitName}
          </div>
          <div className="v">{dash(kasBalance)}</div>
          <div className="d muted">
            {t("batas")} {dash(kasLimit)}
          </div>
        </div>
        {(bankBooks.length > 0 ? bankBooks.slice(0, 2) : [null]).map((book, index) => (
          <div className="metric" key={book?.id ?? `bank-${index}`}>
            <div className="l">{book ? `${book.bankName ?? book.plainName} ${book.accountNumber ?? ""}`.trim() : t("Bank")}</div>
            <div className="v">{book ? dash(book.balance) : "—"}</div>
            <div className="d muted">
              {t("per mutasi")} {book?.lastMovement ? formatDate(book.lastMovement) : "—"}
            </div>
          </div>
        ))}
        <div className="metric">
          <div className="l">{t("Belum direkonsiliasi")}</div>
          <div className="v" style={{ color: "var(--amber)" }}>
            {unreconciled === 0 ? "—" : unreconciled}
          </div>
          <div className="d" style={{ color: "var(--amber)" }}>
            {t("mutasi menunggu")}
          </div>
        </div>
        <div className="metric">
          <div className="l">{t("Transfer menunggu")}</div>
          <div className="v" style={{ color: "var(--plum)" }}>
            {pendingTransfers === 0 ? "—" : pendingTransfers}
          </div>
          <div className="d muted">
            {transfers.length === 0 ? "—" : transfers.length} {t("antar buku")}
          </div>
        </div>
      </div>

      <div className="grid-32">
        <div className="card">
          <div className="card-h">
            <h2>{t("Mutasi kas & bank hari ini")}</h2>
            <div className="rt">
              <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} style={{ width: "auto" }}>
                <option value="">{t("Semua akun kas/bank")}</option>
                {books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t("Cari keterangan")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ width: 170 }}
              />
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: 980, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ width: 62, whiteSpace: "nowrap" }}>{t("Waktu")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Ref")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Akun")}</th>
                  <th style={{ width: "26%" }}>{t("Keterangan")}</th>
                  <th style={{ whiteSpace: "nowrap" }}>{t("Buku")}</th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>
                    {t("Masuk")}
                  </th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>
                    {t("Keluar")}
                  </th>
                  <th className="r" style={{ whiteSpace: "nowrap" }}>
                    {t("Saldo")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="num">{row.time}</td>
                    <td className="num">{row.reference}</td>
                    <td>
                      <span className="num">{row.accountCode}</span> {row.accountName}
                    </td>
                    <td>{row.description}</td>
                    <td className="num">{row.unitCode}</td>
                    <td className="r num">{dash(row.debit)}</td>
                    <td className="r num">{dash(row.credit)}</td>
                    <td className="r num">{formatAmount(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bal">
            <span className="k">
              {filtered.length} {t("dari")} {movements.length} {t("mutasi hari ini")}
            </span>
            <span className="k">{t("Masuk")}</span>
            <span className="v num">{dash(totals.masuk)}</span>
            <span className="k">{t("Keluar")}</span>
            <span className="v num">{dash(totals.keluar)}</span>
            <span style={{ marginLeft: "auto" }}>
              <button className="btn btn-sm" onClick={() => router.push("/rekonsiliasi")}>
                {t("Ke rekonsiliasi")}
              </button>
            </span>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h2>{t("Kas kecil per unit")}</h2>
              <span className="sub">
                {units.length} {t("unit bisnis")}
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Unit")}</th>
                  <th className="r">{t("Saldo")}</th>
                  <th className="r">{t("Batas")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pettyPerUnit.length === 0 && (
                  <tr>
                    <td colSpan={4} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {pettyPerUnit.map((unit) => (
                  <tr key={unit.id}>
                    <td>
                      <span className="num">{unit.code}</span> {unit.name}
                    </td>
                    <td className="r num">{unit.hasBook ? dash(unit.balance) : "—"}</td>
                    <td className="r num">{dash(unit.limit)}</td>
                    <td className="r">
                      {canEdit && books.length > 0 && (
                        <button className="btn btn-sm" onClick={() => openTransfer(unit.id)}>
                          {t("Isi ulang")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bal">
              <span className="k">{t("Isi ulang memakai akun RAK antar-unit 2-1900")}</span>
              <span style={{ marginLeft: "auto" }}>
                <button className="btn btn-sm" disabled={books.length === 0} onClick={() => openTransfer()}>
                  {t("Isi ulang")}
                </button>
              </span>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <h2>{t("Transfer antar buku")}</h2>
            </div>
            <div className="card-b" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {transfers.length === 0 && <div className="sm muted">{t("Belum ada transfer antar buku")}</div>}
              {transfers.map((row) => (
                <div key={row.id} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 12.5 }}>
                  <span className="num" style={{ flex: "none", color: "var(--ledger-dk)", fontWeight: 500 }}>
                    {row.number}
                  </span>
                  <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.description}
                  </span>
                  <span className="num sm muted" style={{ flex: "none" }}>
                    {formatDate(row.date)}
                  </span>
                </div>
              ))}
              <div className="note">
                {t(
                  "Setiap transfer antar buku membentuk dua jurnal: kas keluar di buku pengirim dan kas masuk di buku penerima, keduanya lewat akun RAK 2-1900 yang dieliminasi saat konsolidasi.",
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* m-kaskeluar */}
      <Dialog
        open={outOpen}
        onClose={() => setOutOpen(false)}
        title={t("Kas keluar")}
        maxWidth={540}
        badge={outBook ? `${outBook.plainName} ${formatAmount(outBook.balance)}` : t("pilih akun")}
        footer={
          <>
            <button className="btn" onClick={() => setOutOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void submitOut()}>
              {busy ? t("Menyimpan…") : t("Simpan & posting")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Tanggal")}
            </label>
            <input
              type="date"
              className={outErrors.date ? "field-error" : undefined}
              value={outForm.date}
              onChange={(event) => setOutForm({ ...outForm, date: event.target.value })}
            />
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Akun kas / bank")}
            </label>
            <select
              className={outErrors.bankAccountId ? "field-error" : undefined}
              value={outForm.bankAccountId}
              onChange={(event) => changeOutAccount(event.target.value)}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Penerima")}
            </label>
            <input
              type="text"
              className={outErrors.payee ? "field-error" : undefined}
              value={outForm.payee}
              onChange={(event) => setOutForm({ ...outForm, payee: event.target.value })}
              placeholder={t("Nama orang atau vendor")}
            />
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Nilai")}
            </label>
            <input
              type="text"
              className={outErrors.amount ? "num field-error" : "num"}
              value={moneyText(outForm.amount)}
              onChange={(event) => setOutForm({ ...outForm, amount: event.target.value })}
              placeholder="0"
            />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Akun beban")}
            </label>
            <select
              className={outErrors.expenseAccountId ? "field-error" : undefined}
              value={outForm.expenseAccountId}
              onChange={(event) => setOutForm({ ...outForm, expenseAccountId: event.target.value })}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {expenseAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Buku unit")}</label>
            <select value={outForm.unitId} onChange={(event) => setOutForm({ ...outForm, unitId: event.target.value })}>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Keperluan")}
            </label>
            <input
              type="text"
              className={outErrors.purpose ? "field-error" : undefined}
              value={outForm.purpose}
              onChange={(event) => setOutForm({ ...outForm, purpose: event.target.value })}
              placeholder={t("Misal: bensin kurir pengiriman Serpong")}
            />
          </div>
        </div>
        <div className="dz" style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => receiptInput.current?.click()}>
          <input
            ref={receiptInput}
            type="file"
            style={{ display: "none" }}
            onChange={(event) => setReceipt(event.target.files?.[0]?.name ?? null)}
          />
          <div style={{ fontSize: 12.5, fontWeight: 500 }}>{receipt ?? t("Lampirkan struk atau nota")}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 3 }}>
            {t("Wajib untuk pengeluaran di atas 1.000.000")}
          </div>
        </div>
        {outError && (
          <div style={{ marginTop: 4, padding: "9px 11px", borderRadius: 8, fontSize: 12, background: "var(--brick-bg)", color: "var(--brick)" }}>
            {outError}
          </div>
        )}
      </Dialog>

      {/* m-transfer */}
      <Dialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title={t("Transfer antar buku unit")}
        maxWidth={540}
        badge={t("lewat RAK 2-1900")}
        footer={
          <>
            <button className="btn" onClick={() => setTransferOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void submitTransfer()}>
              {busy ? t("Memproses…") : t("Ajukan transfer")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Dari buku")}
            </label>
            <select
              className={transferErrors.fromUnitId ? "field-error" : undefined}
              value={transferForm.fromUnitId}
              onChange={(event) =>
                setTransferForm({
                  ...transferForm,
                  fromUnitId: event.target.value,
                  fromBankAccountId: books.find((book) => book.unitId === event.target.value)?.id ?? "",
                })
              }
            >
              <option value="">{t("— Pilih buku —")}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Akun sumber")}
            </label>
            <select
              className={transferErrors.fromBankAccountId ? "field-error" : undefined}
              value={transferForm.fromBankAccountId}
              onChange={(event) => setTransferForm({ ...transferForm, fromBankAccountId: event.target.value })}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {books
                .filter((book) => !transferForm.fromUnitId || book.unitId === transferForm.fromUnitId)
                .map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.label}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Ke buku")}
            </label>
            <select
              className={transferErrors.toUnitId ? "field-error" : undefined}
              value={transferForm.toUnitId}
              onChange={(event) =>
                setTransferForm({
                  ...transferForm,
                  toUnitId: event.target.value,
                  toBankAccountId: books.find((book) => book.unitId === event.target.value)?.id ?? "",
                })
              }
            >
              <option value="">{t("— Pilih buku —")}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Akun tujuan")}
            </label>
            <select
              className={transferErrors.toBankAccountId ? "field-error" : undefined}
              value={transferForm.toBankAccountId}
              onChange={(event) => setTransferForm({ ...transferForm, toBankAccountId: event.target.value })}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {books
                .filter((book) => !transferForm.toUnitId || book.unitId === transferForm.toUnitId)
                .map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.label}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Tanggal")}
            </label>
            <input
              type="date"
              className={transferErrors.date ? "field-error" : undefined}
              value={transferForm.date}
              onChange={(event) => setTransferForm({ ...transferForm, date: event.target.value })}
            />
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Nilai transfer")}
            </label>
            <input
              type="text"
              className={transferErrors.amount ? "num field-error" : "num"}
              value={moneyText(transferForm.amount)}
              onChange={(event) => setTransferForm({ ...transferForm, amount: event.target.value })}
              placeholder="0"
            />
          </div>
        </div>
        <div className="row">
          <div>
            <label className="f" data-req="1">
              {t("Keperluan")}
            </label>
            <input
              type="text"
              className={transferErrors.purpose ? "field-error" : undefined}
              value={transferForm.purpose}
              onChange={(event) => setTransferForm({ ...transferForm, purpose: event.target.value })}
              placeholder={t("Misal: isi ulang kas kecil Serpong")}
            />
          </div>
        </div>
        <div className="note">
          {t(
            "Dua jurnal terbentuk sekaligus: kas keluar di buku pengirim dan kas masuk di buku penerima, keduanya lewat RAK antar-unit yang saling hapus saat konsolidasi.",
          )}
        </div>
        {transferError && (
          <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 8, fontSize: 12, background: "var(--brick-bg)", color: "var(--brick)" }}>
            {transferError}
          </div>
        )}
      </Dialog>

      {/* Tambah rekening kas/bank */}
      <Dialog
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title={t("Tambah rekening kas/bank")}
        maxWidth={540}
        footer={
          <>
            <button className="btn" onClick={() => setAccountOpen(false)}>
              {t("Batal")}
            </button>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void submitAccount()}>
              {busy ? t("Menyimpan…") : t("Simpan")}
            </button>
          </>
        }
      >
        <div className="row row-2">
          <div>
            <label className="f" data-req="1">
              {t("Nama rekening")}
            </label>
            <input
              type="text"
              className={accountErrors.name ? "field-error" : undefined}
              value={accountForm.name}
              onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })}
              placeholder={t("Bank BCA")}
            />
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Akun buku besar")}
            </label>
            <select
              className={accountErrors.accountCode ? "field-error" : undefined}
              value={accountForm.accountCode}
              onChange={(event) => setAccountForm({ ...accountForm, accountCode: event.target.value })}
            >
              <option value="">{t("— Pilih akun —")}</option>
              {assetAccounts.map((account) => (
                <option key={account.id} value={account.code}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row row-3">
          <div>
            <label className="f">{t("Jenis")}</label>
            <select value={accountForm.kind} onChange={(event) => setAccountForm({ ...accountForm, kind: event.target.value })}>
              <option value="BANK">{t("Bank")}</option>
              <option value="KAS">{t("Kas")}</option>
            </select>
          </div>
          <div>
            <label className="f" data-req="1">
              {t("Buku unit")}
            </label>
            <select
              className={accountErrors.unitId ? "field-error" : undefined}
              value={accountForm.unitId}
              onChange={(event) => setAccountForm({ ...accountForm, unitId: event.target.value })}
            >
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="f">{t("Saldo awal")}</label>
            <input
              type="text"
              className="num"
              value={moneyText(accountForm.openingBalance)}
              onChange={(event) => setAccountForm({ ...accountForm, openingBalance: event.target.value })}
              placeholder="0"
            />
          </div>
        </div>
        <div className="row row-2">
          <div>
            <label className="f">{t("Nama bank")}</label>
            <input
              type="text"
              value={accountForm.bankName}
              onChange={(event) => setAccountForm({ ...accountForm, bankName: event.target.value })}
            />
          </div>
          <div>
            <label className="f">{t("Nomor rekening")}</label>
            <input
              type="text"
              className="num"
              value={accountForm.accountNumber}
              onChange={(event) => setAccountForm({ ...accountForm, accountNumber: event.target.value })}
            />
          </div>
        </div>
        <div className="note">
          {t("Saldo rekening dihitung dari saldo awal ditambah mutasi jurnal pada akun buku besar yang dipilih.")}
        </div>
        {accountError && (
          <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 8, fontSize: 12, background: "var(--brick-bg)", color: "var(--brick)" }}>
            {accountError}
          </div>
        )}
      </Dialog>
    </>
  );
}
