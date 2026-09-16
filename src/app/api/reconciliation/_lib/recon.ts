import "server-only";
import { db } from "@/lib/db";
import { rule } from "@/lib/api";
import { toNumber } from "@/lib/format";
import { bookBalance, periodRange, requireBook, type Book } from "@/app/api/cash/_lib/books";

/**
 * Screen 18 "Rekonsiliasi Bank".
 *
 * Both sides of the match are read from Postgres and both balances are derived — the
 * statement side from `BankAccount.openingBalance` plus the imported mutations, the book
 * side from posted `JournalLine` rows on the book's ledger account. Nothing is stored.
 *
 * A statement line's `debit` is money *into* the account, the same direction as a debit on
 * the ledger account, so the two sides can be compared cell for cell.
 */

export type ReconStatementLine = {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  debit: number;
  credit: number;
  matchStatus: "BELUM_COCOK" | "COCOK" | "DIABAIKAN";
  journalLineId: string | null;
};

export type ReconJournalLine = {
  id: string;
  entryId: string;
  number: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  matched: boolean;
};

export type ReconciliationData = {
  book: Book;
  year: number;
  month: number;
  periodTo: string;
  statementLines: ReconStatementLine[];
  journalLines: ReconJournalLine[];
  bookBalance: number;
  statementBalance: number;
  difference: number;
  matchedCount: number;
  unmatchedCount: number;
  totalCount: number;
  status: "BERJALAN" | "SELESAI";
  closedAt: string | null;
};

/** Money compares at two decimals — Prisma Decimal(18,2). */
export function money(value: number) {
  return Math.round(value * 100) / 100;
}

export async function loadReconciliation(
  companyId: string,
  bankAccountId: string,
  year: number,
  month: number,
): Promise<ReconciliationData> {
  const book = await requireBook(companyId, bankAccountId);
  const { from, to } = periodRange(year, month);

  const [lines, entries, movement, balance, reconciliation] = await Promise.all([
    db.bankStatementLine.findMany({
      where: { bankAccountId: book.id, date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    }),
    db.journalLine.findMany({
      where: {
        accountId: book.ledgerAccountId as string,
        entry: { unitId: book.unitId, status: "DIPOSTING", date: { gte: from, lte: to } },
      },
      include: {
        entry: { select: { id: true, number: true, date: true, description: true } },
        statementLine: { select: { id: true } },
      },
    }),
    db.bankStatementLine.aggregate({
      where: { bankAccountId: book.id, date: { lte: to } },
      _sum: { debit: true, credit: true },
    }),
    bookBalance(book, to),
    db.reconciliation.findUnique({
      where: { bankAccountId_periodYear_periodMonth: { bankAccountId: book.id, periodYear: year, periodMonth: month } },
      select: { status: true, closedAt: true },
    }),
  ]);

  const statementBalance = money(
    book.openingBalance + toNumber(movement._sum.debit) - toNumber(movement._sum.credit),
  );
  const bookSide = money(balance);

  const statementLines: ReconStatementLine[] = lines.map((line) => ({
    id: line.id,
    date: line.date.toISOString(),
    description: line.description,
    reference: line.reference,
    debit: toNumber(line.debit),
    credit: toNumber(line.credit),
    matchStatus: line.matchStatus as ReconStatementLine["matchStatus"],
    journalLineId: line.journalLineId,
  }));

  const journalLines: ReconJournalLine[] = entries
    .map((line) => ({
      id: line.id,
      entryId: line.entry.id,
      number: line.entry.number,
      date: line.entry.date.toISOString(),
      description: line.description ?? line.entry.description,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      matched: line.statementLine !== null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));

  const matchedCount = statementLines.filter((line) => line.matchStatus === "COCOK").length;

  return {
    book,
    year,
    month,
    periodTo: to.toISOString(),
    statementLines,
    journalLines,
    bookBalance: bookSide,
    statementBalance,
    difference: money(statementBalance - bookSide),
    matchedCount,
    unmatchedCount: statementLines.filter((line) => line.matchStatus === "BELUM_COCOK").length,
    totalCount: statementLines.length,
    status: (reconciliation?.status ?? "BERJALAN") as "BERJALAN" | "SELESAI",
    closedAt: reconciliation?.closedAt ? reconciliation.closedAt.toISOString() : null,
  };
}

/** Keeps the `Reconciliation` row in step with the derived balances after every change. */
export async function syncReconciliation(data: ReconciliationData) {
  return db.reconciliation.upsert({
    where: {
      bankAccountId_periodYear_periodMonth: {
        bankAccountId: data.book.id,
        periodYear: data.year,
        periodMonth: data.month,
      },
    },
    create: {
      bankAccountId: data.book.id,
      periodYear: data.year,
      periodMonth: data.month,
      bookBalance: data.bookBalance,
      statementBalance: data.statementBalance,
    },
    update: { bookBalance: data.bookBalance, statementBalance: data.statementBalance },
  });
}

/** A closed reconciliation is read-only. */
export function requireOpenReconciliation(data: ReconciliationData) {
  if (data.status === "SELESAI") {
    rule("Rekonsiliasi periode ini sudah diselesaikan — buka kembali sebelum mengubah pasangan.");
  }
}

/** Two mutations pair up only when value and direction are identical. */
export function sameMovement(
  statement: { debit: number; credit: number },
  journal: { debit: number; credit: number },
) {
  return money(statement.debit) === money(journal.debit) && money(statement.credit) === money(journal.credit);
}
