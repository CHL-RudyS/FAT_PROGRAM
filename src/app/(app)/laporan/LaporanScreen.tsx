"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import PageHead from "@/components/ui/PageHead";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/i18n/LocaleProvider";
import { formatAmount } from "@/lib/format";
import {
  amountCell,
  contraCell,
  ledgerCell,
  type BalanceSheet,
  type CashFlow,
  type IncomeStatement,
} from "@/app/api/reports/_lib/types";

export type StatementSet = {
  key: string;
  label: string;
  balanceSheet: BalanceSheet;
  income: IncomeStatement;
  cashFlow: CashFlow;
};

type Option = { value: string; label: string };

const TABS: Array<{ key: "neraca" | "lr" | "ak"; label: string }> = [
  { key: "neraca", label: "Neraca" },
  { key: "lr", label: "Laba rugi" },
  { key: "ak", label: "Arus kas" },
];

export default function LaporanScreen({
  statements,
  scopeOptions,
  scopeValue,
  periodOptions,
  periodValue,
  scopeHeading,
  rangeText,
  yearRangeText,
}: {
  statements: StatementSet[];
  scopeOptions: Option[];
  scopeValue: string;
  periodOptions: Option[];
  periodValue: string;
  scopeHeading: string;
  rangeText: string;
  yearRangeText: string;
}) {
  const router = useRouter();
  const t = useT();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"neraca" | "lr" | "ak">("neraca");

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams({ lingkup: scopeValue, periode: periodValue, ...patch });
    startTransition(() => router.replace(`/laporan?${params.toString()}`));
  }

  const totalDifference = statements.reduce((sum, item) => sum + item.balanceSheet.difference, 0);

  return (
    <>
      <PageHead
        title={t("Laporan Keuangan")}
        subtitle={t("Laporan per periode berjalan")}
        actions={
          <>
            <select
              style={{ width: "auto" }}
              value={scopeValue}
              disabled={pending}
              onChange={(event) => apply({ lingkup: event.target.value })}
            >
              {scopeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              style={{ width: "auto" }}
              value={periodValue}
              disabled={pending}
              onChange={(event) => apply({ periode: event.target.value })}
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button className="btn" onClick={() => toast(t("Laporan diekspor ke Excel"))}>
              {t("Ekspor Excel")}
            </button>
            <button className="btn" onClick={() => toast(t("Laporan dikirim ke pratinjau cetak"))}>
              {t("Cetak PDF")}
            </button>
          </>
        }
      />

      <div className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.key}
            className={tab === item.key ? "tab on" : "tab"}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {tab === "neraca" && (
        <div>
          {statements.map((statement) => (
            <div className="grid2" key={statement.key} style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="card-h">
                  <h2>{t("Aset")}</h2>
                  <span className="sub">{statements.length > 1 ? statement.label : t(scopeHeading)}</span>
                </div>
                <table>
                  <tbody>
                    {statement.balanceSheet.assetSections.map((section) => (
                      <SectionRows key={section.key} title={t(section.title)} rows={section.rows} total={section.total} totalLabel={t(section.totalLabel)} />
                    ))}
                    <tr className="tot">
                      <td>
                        <b>{t("Total aset")}</b>
                      </td>
                      <td className="r num">
                        <b>{ledgerCell(statement.balanceSheet.totalAssets)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card">
                <div className="card-h">
                  <h2>{t("Liabilitas & ekuitas")}</h2>
                  {statements.length > 1 && <span className="sub">{statement.label}</span>}
                </div>
                <table>
                  <tbody>
                    <SectionRows
                      title={t(statement.balanceSheet.liabilitySection.title)}
                      rows={statement.balanceSheet.liabilitySection.rows}
                      total={statement.balanceSheet.liabilitySection.total}
                      totalLabel={t(statement.balanceSheet.liabilitySection.totalLabel)}
                    />
                    <SectionRows
                      title={t(statement.balanceSheet.equitySection.title)}
                      rows={statement.balanceSheet.equitySection.rows}
                      total={statement.balanceSheet.equitySection.total}
                      totalLabel={t(statement.balanceSheet.equitySection.totalLabel)}
                    />
                    <tr className="tot">
                      <td>
                        <b>{t("Total liabilitas & ekuitas")}</b>
                      </td>
                      <td className="r num">
                        <b>{ledgerCell(statement.balanceSheet.totalLiabilitiesEquity)}</b>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className={totalDifference === 0 ? "note" : "note note-warn"} style={{ marginTop: 14 }}>
            {totalDifference === 0
              ? `${t("Neraca seimbang. Selisih")} Rp 0 ${t("antara total aset dan total liabilitas & ekuitas. Akun RAK antar-unit sudah tereliminasi")} — `
              : `${t("Neraca belum seimbang. Selisih")} Rp ${formatAmount(Math.abs(totalDifference))} ${t("antara total aset dan total liabilitas & ekuitas. Periksa jurnal yang belum seimbang")} — `}
            <Link href="/konsolidasi">{t("lihat kertas kerja")}</Link>.
          </div>
        </div>
      )}

      {tab === "lr" &&
        statements.map((statement) => (
          <div className="card" key={statement.key} style={{ marginBottom: 16 }}>
            <div className="card-h">
              <h2>{t("Laporan laba rugi")}</h2>
              <span className="sub">
                {yearRangeText} · {statements.length > 1 ? statement.label : t(scopeHeading).toLowerCase()}
              </span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>{t("Uraian")}</th>
                  <th className="r" style={{ width: 170 }}>
                    {t("Periode berjalan")}
                  </th>
                  <th className="r" style={{ width: 170 }}>
                    {t("Periode sebelumnya")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {statement.income.rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="sm muted" style={{ padding: "18px 12px" }}>
                      {t("Belum ada data")}
                    </td>
                  </tr>
                )}
                {statement.income.rows.map((row) => (
                  <tr key={row.key} className={row.strong ? "tot" : undefined}>
                    <td>
                      {row.code && (
                        <span className="num sm" style={{ marginRight: 6 }}>
                          {row.code}
                        </span>
                      )}
                      {row.strong ? <b>{t(row.label)}</b> : t(row.label)}
                    </td>
                    <td className="r num">{row.strong ? <b>{ledgerCell(row.current)}</b> : ledgerCell(row.current)}</td>
                    <td className="r num">{row.strong ? <b>{ledgerCell(row.previous)}</b> : ledgerCell(row.previous)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "ak" &&
        statements.map((statement) => (
          <div className="card" key={statement.key} style={{ marginBottom: 16 }}>
            <div className="card-h">
              <h2>{t("Laporan arus kas")}</h2>
              <span className="sub">
                {t("Metode tidak langsung")} · {rangeText}
                {statements.length > 1 ? ` · ${statement.label}` : ""}
              </span>
            </div>
            <table>
              <tbody>
                {statement.cashFlow.sections.map((section) => (
                  <Fragment key={section.key}>
                    <tr>
                      <td colSpan={2} className="sm muted" style={{ background: "var(--sunk)" }}>
                        {t(section.title)}
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row.key} className={row.total ? "tot" : undefined}>
                        <td>{t(row.label)}</td>
                        <td className="r num">{amountCell(row.value, row.contra)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="tot">
                  <td>
                    <b>{t("Kenaikan kas bersih")}</b>
                  </td>
                  <td className="r num">
                    <b>{ledgerCell(statement.cashFlow.netChange)}</b>
                  </td>
                </tr>
                <tr>
                  <td>{t("Kas & setara kas awal periode")}</td>
                  <td className="r num">{ledgerCell(statement.cashFlow.openingCash)}</td>
                </tr>
                <tr className="tot">
                  <td>
                    <b>{t("Kas & setara kas akhir periode")}</b>
                  </td>
                  <td className="r num">
                    <b>{ledgerCell(statement.cashFlow.closingCash)}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}

/** Section band + its rows + the section total, as a flat run of `<tr>`s. */
function SectionRows({
  title,
  rows,
  total,
  totalLabel,
}: {
  title: string;
  rows: BalanceSheet["liabilitySection"]["rows"];
  total: number;
  totalLabel: string;
}) {
  return (
    <>
      <tr>
        <td colSpan={2} className="sm muted" style={{ background: "var(--sunk)" }}>
          {title}
        </td>
      </tr>
      {rows.length === 0 && (
        <tr>
          <td colSpan={2} className="sm muted" style={{ padding: "18px 12px" }}>
            Belum ada data
          </td>
        </tr>
      )}
      {rows.map((row) => (
        <tr key={row.key}>
          <td>{row.label}</td>
          <td className="r num">{row.contra ? contraCell(row.value) : ledgerCell(row.value)}</td>
        </tr>
      ))}
      <tr className="tot">
        <td>{totalLabel}</td>
        <td className="r num">{ledgerCell(total)}</td>
      </tr>
    </>
  );
}
