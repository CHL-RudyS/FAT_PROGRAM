import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { periodLabel } from "@/lib/format";
import { loadBooks } from "@/app/api/cash/_lib/books";
import ImportMutasiScreen from "./ImportMutasiScreen";

/** Dua belas periode terakhir, dihitung di server supaya markup awal stabil. */
function recentPeriods(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return { key: `${year}-${month}`, year, month, label: periodLabel(year, month) };
  });
}

/** Layar 17 — Import Mutasi Bank. */
export default async function ImportMutasiPage() {
  const context = await requireActiveContext();

  const books = await loadBooks(context.companyId, { onlyActive: true });
  const bookIds = books.map((book) => book.id);

  const [imports, units, pendingMapping] = await Promise.all([
    bookIds.length === 0
      ? Promise.resolve([])
      : db.statementImport.findMany({
          where: { bankAccountId: { in: bookIds } },
          orderBy: { createdAt: "desc" },
          take: 40,
        }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    bookIds.length === 0
      ? Promise.resolve(0)
      : db.bankStatementLine.count({
          where: { bankAccountId: { in: bookIds }, matchStatus: "BELUM_COCOK" },
        }),
  ]);

  const labelOf = new Map(books.map((book) => [book.id, book.label]));

  return (
    <ImportMutasiScreen
      books={books.map((book) => ({ id: book.id, label: book.label, unitCode: book.unitCode }))}
      history={imports.map((row) => ({
        id: row.id,
        fileName: row.fileName,
        bankAccountLabel: labelOf.get(row.bankAccountId) ?? "—",
        rowCount: row.rowCount,
        matchedCount: row.matchedCount,
        status: row.status,
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
      }))}
      units={units}
      periods={recentPeriods()}
      pendingMapping={pendingMapping}
      unitCode={context.unit.code}
      unitName={context.unit.name}
    />
  );
}
