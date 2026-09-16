import { db } from "@/lib/db";
import { rule } from "@/lib/api";
import { toNumber } from "@/lib/format";

/** Shared by the period routes. Route files may only export HTTP handlers, so
 *  anything imported across them has to live outside a route module. */

/** Awal dan akhir bulan periode fiskal. */
export function periodBounds(year: number, month: number) {
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export type PeriodJournalState = {
  draft: number;
  unbalanced: number;
  posted: number;
};

/**
 * Jurnal yang menahan penutupan: masih berstatus draf, atau total debitnya
 * tidak sama dengan total kreditnya.
 */
export async function journalStateFor(
  companyId: string,
  year: number,
  month: number,
  unitId?: string,
): Promise<PeriodJournalState> {
  const { start, end } = periodBounds(year, month);
  const entries = await db.journalEntry.findMany({
    where: {
      companyId,
      ...(unitId ? { unitId } : {}),
      date: { gte: start, lte: end },
      status: { in: ["DRAF", "DIPOSTING"] },
    },
    select: { id: true, status: true, lines: { select: { debit: true, credit: true } } },
  });

  let draft = 0;
  let unbalanced = 0;
  let posted = 0;
  for (const entry of entries) {
    if (entry.status === "DRAF") draft += 1;
    else posted += 1;
    const debit = Math.round(entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0) * 100);
    const credit = Math.round(entry.lines.reduce((sum, line) => sum + toNumber(line.credit), 0) * 100);
    if (debit !== credit) unbalanced += 1;
  }

  return { draft, unbalanced, posted };
}

/** Menolak penutupan selama masih ada jurnal draf atau jurnal tidak seimbang. */
export function assertClosable(state: PeriodJournalState) {
  if (state.draft > 0) {
    rule(`Masih ada ${state.draft} jurnal berstatus draf di periode ini — posting atau batalkan dulu sebelum menutup.`);
  }
  if (state.unbalanced > 0) {
    rule(`Masih ada ${state.unbalanced} jurnal yang belum seimbang di periode ini — perbaiki dulu sebelum menutup.`);
  }
}
