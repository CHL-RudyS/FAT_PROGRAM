import { db } from "@/lib/db";
import { rule } from "@/lib/api";
import { MONTHS_ID } from "@/lib/format";

/** Shared by the journal routes. Route files may only export HTTP handlers, so
 *  anything imported across them has to live outside a route module. */

export function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

/** Pembulatan rupiah dua desimal supaya perbandingan debit/kredit tidak terganggu float. */
export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function periodNameOf(date: Date) {
  return `${MONTHS_ID[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Periode tujuan posting. Menolak periode yang sudah DITUTUP atau DIKUNCI —
 * koreksi hanya lewat jurnal penyesuaian di periode berjalan.
 */
export async function requirePostablePeriod(companyId: string, date: Date) {
  const period = await db.fiscalPeriod.findUnique({
    where: { companyId_year_month: { companyId, year: date.getFullYear(), month: date.getMonth() + 1 } },
    select: { id: true, status: true },
  });
  if (period && period.status !== "TERBUKA") {
    rule(
      `Periode ${periodNameOf(date)} sudah ${period.status === "DITUTUP" ? "ditutup" : "dikunci"}. Jurnal tidak bisa diposting ke periode ini.`,
    );
  }
  return period;
}
