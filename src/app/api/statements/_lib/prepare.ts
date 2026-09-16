import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import { periodRange, requireBook, type Book } from "@/app/api/cash/_lib/books";
import { parseStatement, type ColumnMapping, type ParseResult } from "@/app/api/cash/_lib/csv";

export type PrepareInput = {
  bankAccountId: string;
  text: string;
  year: number;
  month: number;
  mapping?: ColumnMapping;
};

function dupKey(date: Date, description: string, debit: number, credit: number) {
  return [
    date.toISOString().slice(0, 10),
    description.trim().toLowerCase(),
    debit.toFixed(2),
    credit.toFixed(2),
  ].join("|");
}

/**
 * Parses the uploaded statement text and layers the checks that need the database on top:
 * the row must fall inside the selected period and must not already be imported.
 */
export async function prepareImport(
  companyId: string,
  input: PrepareInput,
): Promise<{ book: Book; parsed: ParseResult }> {
  const book = await requireBook(companyId, input.bankAccountId);
  const parsed = parseStatement(input.text, input.mapping);
  if (parsed.error) return { book, parsed };

  const { from, to } = periodRange(input.year, input.month);

  const existing = await db.bankStatementLine.findMany({
    where: { bankAccountId: book.id, date: { gte: from, lte: to } },
    select: { date: true, description: true, debit: true, credit: true },
  });
  const seen = new Set(
    existing.map((line) => dupKey(line.date, line.description, toNumber(line.debit), toNumber(line.credit))),
  );

  for (const row of parsed.rows) {
    if (!row.valid || !row.date) continue;
    const date = new Date(row.date);
    if (date < from || date > to) {
      row.valid = false;
      row.error = "Tanggal di luar periode yang dipilih.";
      continue;
    }
    const key = dupKey(date, row.description, row.debit, row.credit);
    if (seen.has(key)) {
      row.valid = false;
      row.error = "Baris sudah pernah diimpor.";
      continue;
    }
    seen.add(key);
  }

  parsed.validCount = parsed.rows.filter((row) => row.valid).length;
  parsed.errorCount = parsed.rows.filter((row) => !row.valid).length;

  return { book, parsed };
}
