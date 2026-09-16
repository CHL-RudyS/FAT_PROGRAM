"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount, formatDate } from "@/lib/format";

export type LedgerAccount = { id: string; code: string; name: string };
export type LedgerUnit = { id: string; code: string; name: string };

export type LedgerRow = {
  id: string;
  date: string;
  number: string;
  unitCode: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export default function BukuBesarScreen({
  accounts,
  units,
  rows,
  opening,
  closing,
  accountId,
  accountLabel,
  unitValue,
  unitLabel,
  from,
  to,
  subtitle,
}: {
  accounts: LedgerAccount[];
  units: LedgerUnit[];
  rows: LedgerRow[];
  opening: number;
  closing: number;
  accountId: string;
  accountLabel: string;
  unitValue: string;
  unitLabel: string;
  from: string;
  to: string;
  subtitle: string;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams({ akun: accountId, buku: unitValue, dari: from, sampai: to, ...patch });
    startTransition(() => router.replace(`/buku-besar?${params.toString()}`));
  }

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);

  return (
    <>
      <PageHead
        title={t("Buku Besar")}
        subtitle={subtitle}
        actions={
          <>
            <button className="btn" onClick={() => toast(t("Buku besar diekspor ke Excel"))}>
              {t("Ekspor Excel")}
            </button>
            <button className="btn" onClick={() => toast(t("Buku besar dikirim ke pratinjau cetak"))}>
              {t("Cetak PDF")}
            </button>
          </>
        }
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-b">
          <div className="row row-4" style={{ marginBottom: 0 }}>
            <div>
              <label className="f">{t("Akun")}</label>
              <select value={accountId} disabled={pending} onChange={(event) => apply({ akun: event.target.value })}>
                {accounts.length === 0 && <option value="">{t("Belum ada akun")}</option>}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {`${account.code} · ${account.name}`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="f">{t("Buku unit")}</label>
              <select value={unitValue} disabled={pending} onChange={(event) => apply({ buku: event.target.value })}>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {`${unit.code} · ${unit.name}`}
                  </option>
                ))}
                <option value="gabungan">{t("Semua buku (gabungan)")}</option>
              </select>
            </div>
            <div>
              <label className="f">{t("Dari tanggal")}</label>
              <input type="date" value={from} disabled={pending} onChange={(event) => apply({ dari: event.target.value })} />
            </div>
            <div>
              <label className="f">{t("Sampai tanggal")}</label>
              <input type="date" value={to} disabled={pending} onChange={(event) => apply({ sampai: event.target.value })} />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 90 }}>{t("Tanggal")}</th>
                <th style={{ width: 170 }}>{t("No. jurnal")}</th>
                <th style={{ width: 60 }}>{t("Buku")}</th>
                <th>{t("Keterangan")}</th>
                <th className="r">{t("Debit")}</th>
                <th className="r">{t("Kredit")}</th>
                <th className="r">{t("Saldo")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="tot">
                <td className="num" colSpan={3}>
                  {t("Saldo awal")}
                </td>
                <td className="muted">{accountLabel || "—"}</td>
                <td className="r num">—</td>
                <td className="r num">—</td>
                <td className="r num">{formatAmount(opening)}</td>
              </tr>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="sm muted" style={{ padding: "18px 12px" }}>
                    {t("Belum ada data")}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="num">{formatDate(row.date)}</td>
                  <td className="num" style={{ color: "var(--ledger-dk)" }}>
                    {row.number}
                  </td>
                  <td className="num">{row.unitCode}</td>
                  <td>{row.description}</td>
                  <td className="r num">{row.debit === 0 ? "—" : formatAmount(row.debit)}</td>
                  <td className="r num">{row.credit === 0 ? "—" : formatAmount(row.credit)}</td>
                  <td className="r num">{formatAmount(row.balance)}</td>
                </tr>
              ))}
              <tr className="tot">
                <td className="num" colSpan={3}>
                  {t("Saldo akhir")}
                </td>
                <td className="muted">{unitLabel || t("Semua buku (gabungan)")}</td>
                <td className="r num">{totalDebit === 0 ? "—" : formatAmount(totalDebit)}</td>
                <td className="r num">{totalCredit === 0 ? "—" : formatAmount(totalCredit)}</td>
                <td className="r num">{formatAmount(closing)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="bal">
          <span className="k">
            {rows.length} {t("mutasi")}
          </span>
          <span className="k" style={{ marginLeft: "auto" }}>
            {t("Saldo berjalan mengikuti posisi normal akun")}
          </span>
        </div>
      </div>
    </>
  );
}
