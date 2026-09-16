import "server-only";
import { db } from "@/lib/db";

/** Longest schedule we will materialise (50 years of monthly rows). */
export const MAX_SCHEDULE_MONTHS = 600;

export type ScheduleRow = {
  periodYear: number;
  periodMonth: number;
  expense: number;
  accumulated: number;
  bookValue: number;
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function periodIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

export function periodAt(index: number): { year: number; month: number } {
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/**
 * Straight-line depreciation, the prototype's only method:
 * monthly expense = (acquisitionCost - residualValue) / usefulLifeMonths.
 * The first period is the month of acquisition; the last period absorbs rounding.
 */
export function straightLineSchedule(input: {
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  acquisitionDate: Date;
}): ScheduleRow[] {
  const life = Math.min(Math.max(0, Math.trunc(input.usefulLifeMonths)), MAX_SCHEDULE_MONTHS);
  const depreciable = round2(Math.max(0, input.acquisitionCost - input.residualValue));
  if (life === 0 || depreciable === 0) return [];

  const monthly = round2(depreciable / life);
  const start = periodIndex(input.acquisitionDate.getUTCFullYear(), input.acquisitionDate.getUTCMonth() + 1);

  const rows: ScheduleRow[] = [];
  let accumulated = 0;
  for (let offset = 0; offset < life; offset += 1) {
    const remaining = round2(depreciable - accumulated);
    if (remaining <= 0) break;
    const expense = offset === life - 1 ? remaining : Math.min(monthly, remaining);
    accumulated = round2(accumulated + expense);
    const { year, month } = periodAt(start + offset);
    rows.push({
      periodYear: year,
      periodMonth: month,
      expense,
      accumulated,
      bookValue: round2(input.acquisitionCost - accumulated),
    });
  }
  return rows;
}

type AssetShape = {
  id: string;
  acquisitionDate: Date;
  acquisitionCost: unknown;
  residualValue: unknown;
  usefulLifeMonths: number;
};

function decimal(value: unknown): number {
  const parsed = Number(value === null || value === undefined ? 0 : String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function scheduleOf(asset: AssetShape): ScheduleRow[] {
  return straightLineSchedule({
    acquisitionCost: decimal(asset.acquisitionCost),
    residualValue: decimal(asset.residualValue),
    usefulLifeMonths: asset.usefulLifeMonths,
    acquisitionDate: asset.acquisitionDate,
  });
}

/** Materialises every period of the straight-line schedule as an unposted entry. */
export async function generateSchedule(asset: AssetShape): Promise<number> {
  const rows = scheduleOf(asset);
  if (rows.length === 0) return 0;
  const result = await db.depreciationEntry.createMany({
    data: rows.map((row) => ({
      assetId: asset.id,
      periodYear: row.periodYear,
      periodMonth: row.periodMonth,
      expense: row.expense,
      accumulated: row.accumulated,
      bookValue: row.bookValue,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

/**
 * Runs depreciation for one period across the active assets of a book.
 * Idempotent: the unique constraint on (assetId, periodYear, periodMonth) means a
 * second run neither duplicates rows nor moves the accumulated figures again.
 */
export async function runDepreciation(input: {
  companyId: string;
  unitId: string;
  year: number;
  month: number;
}): Promise<{ assets: number; entries: number; expense: number }> {
  const assets = await db.fixedAsset.findMany({
    where: { companyId: input.companyId, unitId: input.unitId, status: "AKTIF" },
    include: { depreciations: { select: { id: true, periodYear: true, periodMonth: true, postedAt: true } } },
  });

  const postedAt = new Date();
  let entries = 0;
  let expense = 0;
  let touched = 0;

  for (const asset of assets) {
    const rows = scheduleOf(asset);
    const row = rows.find((item) => item.periodYear === input.year && item.periodMonth === input.month);
    if (!row) continue;

    touched += 1;
    const existing = asset.depreciations.find(
      (item) => item.periodYear === input.year && item.periodMonth === input.month,
    );

    if (!existing) {
      await db.depreciationEntry.create({
        data: {
          assetId: asset.id,
          periodYear: input.year,
          periodMonth: input.month,
          expense: row.expense,
          accumulated: row.accumulated,
          bookValue: row.bookValue,
          postedAt,
        },
      });
      entries += 1;
      expense += row.expense;
    } else if (!existing.postedAt) {
      await db.depreciationEntry.update({
        where: { id: existing.id },
        data: {
          expense: row.expense,
          accumulated: row.accumulated,
          bookValue: row.bookValue,
          postedAt,
        },
      });
      entries += 1;
      expense += row.expense;
    }

    const last = rows[rows.length - 1];
    if (last && last.periodYear === input.year && last.periodMonth === input.month) {
      await db.fixedAsset.update({ where: { id: asset.id }, data: { status: "HABIS_SUSUT" } });
    }
  }

  return { assets: touched, entries, expense: round2(expense) };
}
