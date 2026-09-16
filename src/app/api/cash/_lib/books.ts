import "server-only";
import { db } from "@/lib/db";
import { rule } from "@/lib/api";
import { toNumber } from "@/lib/format";

/**
 * A "buku" (cash or bank book) as the prototype shows it: `1-1100 · Bank BCA — 288xxxx19`.
 *
 * `BankAccount` has no foreign key to `Account`, so the ledger account a book posts to is
 * carried as a `<kode> · ` prefix inside `BankAccount.name` — exactly the label the
 * prototype renders. `bookAccountCode` parses it back out again.
 */
const NAME_WITH_CODE = /^\s*(\d-\d{3,5})\s*·\s*(.+?)\s*$/;

export type Book = {
  id: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  name: string;
  label: string;
  plainName: string;
  kind: "KAS" | "BANK";
  bankName: string | null;
  accountNumber: string | null;
  accountCode: string | null;
  ledgerAccountId: string | null;
  ledgerAccountName: string | null;
  openingBalance: number;
  isActive: boolean;
};

export function splitBookName(name: string): { accountCode: string | null; plainName: string } {
  const match = NAME_WITH_CODE.exec(name);
  if (!match) return { accountCode: null, plainName: name.trim() };
  return { accountCode: match[1], plainName: match[2] };
}

export function composeBookName(accountCode: string, plainName: string) {
  return `${accountCode} · ${plainName.trim()}`;
}

/** `1-1210 · Bank BCA — 288xxxx19` */
export function bookLabel(input: { name: string; accountNumber: string | null }) {
  return input.accountNumber ? `${input.name} — ${input.accountNumber}` : input.name;
}

type BookFilter = { unitId?: string; bankAccountId?: string; onlyActive?: boolean };

/** Loads every cash/bank book of the company with its resolved ledger account. */
export async function loadBooks(companyId: string, filter: BookFilter = {}): Promise<Book[]> {
  const [bankAccounts, accounts] = await Promise.all([
    db.bankAccount.findMany({
      where: {
        companyId,
        ...(filter.unitId ? { unitId: filter.unitId } : {}),
        ...(filter.bankAccountId ? { id: filter.bankAccountId } : {}),
        ...(filter.onlyActive ? { isActive: true } : {}),
      },
      orderBy: [{ name: "asc" }],
      include: { unit: { select: { code: true, name: true } } },
    }),
    db.account.findMany({
      where: { companyId },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const byCode = new Map(accounts.map((account) => [account.code, account]));

  return bankAccounts.map((bank) => {
    const { accountCode, plainName } = splitBookName(bank.name);
    const ledger = accountCode ? byCode.get(accountCode) : undefined;
    return {
      id: bank.id,
      unitId: bank.unitId,
      unitCode: bank.unit.code,
      unitName: bank.unit.name,
      name: bank.name,
      label: bookLabel(bank),
      plainName,
      kind: bank.kind as "KAS" | "BANK",
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      accountCode: accountCode,
      ledgerAccountId: ledger?.id ?? null,
      ledgerAccountName: ledger?.name ?? null,
      openingBalance: toNumber(bank.openingBalance),
      isActive: bank.isActive,
    };
  });
}

/**
 * Book balance = `BankAccount.openingBalance` + posted debit − credit on the book's ledger
 * account inside the book's own business unit. Never stored, always derived.
 */
export async function bookBalance(book: Book, asOf?: Date): Promise<number> {
  if (!book.ledgerAccountId) return book.openingBalance;
  const sum = await db.journalLine.aggregate({
    where: {
      accountId: book.ledgerAccountId,
      entry: {
        unitId: book.unitId,
        status: "DIPOSTING",
        ...(asOf ? { date: { lte: asOf } } : {}),
      },
    },
    _sum: { debit: true, credit: true },
  });
  return book.openingBalance + toNumber(sum._sum.debit) - toNumber(sum._sum.credit);
}

export async function bookBalances(books: Book[], asOf?: Date): Promise<Map<string, number>> {
  const values = await Promise.all(books.map((book) => bookBalance(book, asOf)));
  return new Map(books.map((book, index) => [book.id, values[index]]));
}

export async function requireBook(companyId: string, bankAccountId: string): Promise<Book> {
  const [book] = await loadBooks(companyId, { bankAccountId });
  if (!book) rule("Rekening kas/bank tidak ditemukan.");
  if (!book.ledgerAccountId) rule(`Rekening ${book.label} belum terhubung ke akun buku besar.`);
  return book;
}

/**
 * Postings are refused into a period whose status is DITUTUP or DIKUNCI.
 * Returns the period id to stamp on the journal entry (null when no period row exists yet).
 */
export async function requireOpenPeriod(companyId: string, date: Date): Promise<string | null> {
  const period = await db.fiscalPeriod.findUnique({
    where: {
      companyId_year_month: { companyId, year: date.getFullYear(), month: date.getMonth() + 1 },
    },
    select: { id: true, status: true },
  });
  if (!period) return null;
  if (period.status !== "TERBUKA") {
    rule("Periode ini sudah ditutup — posting ditolak.");
  }
  return period.id;
}

export function periodRange(year: number, month: number) {
  return {
    from: new Date(year, month - 1, 1, 0, 0, 0, 0),
    to: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
