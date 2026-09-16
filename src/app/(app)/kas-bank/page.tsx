import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import { bookBalance, bookBalances, endOfDay, loadBooks, startOfDay } from "@/app/api/cash/_lib/books";
import KasBankScreen, { type CashMovement } from "./KasBankScreen";

/** Layar 25 — Kas & Bank Harian. */
export default async function KasBankPage() {
  const context = await requireActiveContext();

  const books = await loadBooks(context.companyId, { onlyActive: true });
  const ledgerIds = books.map((book) => book.ledgerAccountId).filter((id): id is string => Boolean(id));
  const bookIds = books.map((book) => book.id);

  const today = new Date();
  const dayFrom = startOfDay(today);
  const dayTo = endOfDay(today);
  const beforeToday = new Date(dayFrom.getTime() - 1);

  const [balances, openingBalances, lines, units, expenseAccounts, unreconciled, transfers, pettyLimit] =
    await Promise.all([
      bookBalances(books),
      Promise.all(books.map((book) => bookBalance(book, beforeToday))),
      ledgerIds.length === 0
        ? Promise.resolve([])
        : db.journalLine.findMany({
            where: {
              accountId: { in: ledgerIds },
              entry: { companyId: context.companyId, status: "DIPOSTING", date: { gte: dayFrom, lte: dayTo } },
            },
            include: {
              entry: { select: { id: true, number: true, date: true, createdAt: true, description: true, unitId: true } },
              account: { select: { id: true, code: true, name: true } },
            },
          }),
      db.businessUnit.findMany({
        where: { companyId: context.companyId, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      db.account.findMany({
        where: { companyId: context.companyId, type: "BEBAN", isPostable: true, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true },
      }),
      bookIds.length === 0
        ? Promise.resolve(0)
        : db.bankStatementLine.count({
            where: { bankAccountId: { in: bookIds }, matchStatus: "BELUM_COCOK" },
          }),
      db.journalEntry.findMany({
        where: { companyId: context.companyId, description: { startsWith: "Transfer" } },
        orderBy: { date: "desc" },
        take: 12,
        select: { id: true, number: true, date: true, description: true, status: true, unitId: true },
      }),
      db.systemSetting.findUnique({ where: { key: "pettyCashLimit" } }),
    ]);

  const lastMovements = await Promise.all(
    books.map((book) =>
      book.ledgerAccountId
        ? db.journalLine.findFirst({
            where: {
              accountId: book.ledgerAccountId,
              entry: { unitId: book.unitId, status: "DIPOSTING" },
            },
            orderBy: { entry: { date: "desc" } },
            select: { entry: { select: { date: true } } },
          })
        : Promise.resolve(null),
    ),
  );

  const openingByBook = new Map(books.map((book, index) => [book.id, openingBalances[index]]));
  const unitCodeById = new Map(units.map((unit) => [unit.id, unit.code]));

  // Saldo berjalan per buku: saldo sebelum hari ini lalu ditambah mutasi hari ini berurutan.
  const running = new Map(books.map((book) => [book.id, openingByBook.get(book.id) ?? 0]));
  const movements: CashMovement[] = [...lines]
    .sort((a, b) => a.entry.createdAt.getTime() - b.entry.createdAt.getTime())
    .map((line) => {
      const book =
        books.find((item) => item.ledgerAccountId === line.accountId && item.unitId === line.entry.unitId) ??
        books.find((item) => item.ledgerAccountId === line.accountId) ??
        null;
      const debit = toNumber(line.debit);
      const credit = toNumber(line.credit);
      const balance = book ? (running.get(book.id) ?? 0) + debit - credit : 0;
      if (book) running.set(book.id, balance);
      return {
        id: line.id,
        time: `${String(line.entry.createdAt.getHours()).padStart(2, "0")}:${String(line.entry.createdAt.getMinutes()).padStart(2, "0")}`,
        reference: line.entry.number,
        accountCode: line.account.code,
        accountName: line.account.name,
        bankAccountId: book?.id ?? "",
        description: line.description ?? line.entry.description,
        unitCode: unitCodeById.get(line.entry.unitId) ?? "—",
        debit,
        credit,
        balance,
      };
    });

  const limitValue = pettyLimit?.value as { perClaim?: number } | null;
  const perClaim = typeof limitValue?.perClaim === "number" ? limitValue.perClaim : 0;

  const bookRows = books.map((book, index) => ({
    id: book.id,
    lastMovement: lastMovements[index]?.entry.date.toISOString() ?? null,
    label: book.label,
    plainName: book.plainName,
    accountCode: book.accountCode,
    accountNumber: book.accountNumber,
    bankName: book.bankName,
    kind: book.kind,
    unitId: book.unitId,
    unitCode: book.unitCode,
    unitName: book.unitName,
    balance: balances.get(book.id) ?? 0,
    hasLedgerAccount: Boolean(book.ledgerAccountId),
  }));

  const pettyPerUnit = units.map((unit) => {
    const unitBooks = bookRows.filter((book) => book.unitId === unit.id && book.kind === "KAS");
    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      balance: unitBooks.reduce((total, book) => total + book.balance, 0),
      limit: perClaim,
      hasBook: unitBooks.length > 0,
    };
  });

  const assetAccounts = await db.account.findMany({
    where: { companyId: context.companyId, type: "ASET", isPostable: true, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  return (
    <KasBankScreen
      books={bookRows}
      movements={movements}
      units={units}
      pettyPerUnit={pettyPerUnit}
      expenseAccounts={expenseAccounts}
      assetAccounts={assetAccounts}
      unreconciled={unreconciled}
      transfers={transfers
        .filter((entry) => !entry.description.startsWith("Transfer masuk"))
        .slice(0, 6)
        .map((entry) => ({
          id: entry.id,
          number: entry.number,
          date: entry.date.toISOString(),
          description: entry.description,
          status: entry.status,
          unitCode: unitCodeById.get(entry.unitId) ?? "—",
        }))}
      pendingTransfers={transfers.filter((entry) => entry.status === "DRAF").length}
      activeUnitName={context.unit.name}
      activeUnitId={context.unitId}
      today={`${dayFrom.getFullYear()}-${String(dayFrom.getMonth() + 1).padStart(2, "0")}-${String(dayFrom.getDate()).padStart(2, "0")}`}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("kas.ubah")}
    />
  );
}
