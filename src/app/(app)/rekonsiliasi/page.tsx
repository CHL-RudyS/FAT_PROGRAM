import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { periodLabel } from "@/lib/format";
import { loadBooks } from "@/app/api/cash/_lib/books";
import { loadReconciliation, type ReconciliationData } from "@/app/api/reconciliation/_lib/recon";
import RekonsiliasiScreen, { type PeriodOption } from "./RekonsiliasiScreen";

type Search = { akun?: string; periode?: string };

function recentPeriods(count = 12): PeriodOption[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return { key: `${year}-${month}`, year, month, label: periodLabel(year, month) };
  });
}

/** Layar 18 — Rekonsiliasi Bank. */
export default async function RekonsiliasiPage({ searchParams }: { searchParams: Promise<Search> }) {
  const context = await requireActiveContext();
  const query = await searchParams;

  const [books, accounts] = await Promise.all([
    loadBooks(context.companyId, { onlyActive: true }),
    db.account.findMany({
      where: { companyId: context.companyId, isPostable: true, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const periods = recentPeriods();
  const period = periods.find((item) => item.key === query.periode) ?? periods[0];
  const book = books.find((item) => item.id === query.akun) ?? books[0] ?? null;

  let data: ReconciliationData | null = null;
  let loadError: string | null = null;
  if (book) {
    try {
      data = await loadReconciliation(context.companyId, book.id, period.year, period.month);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      loadError = message.startsWith("RULE:") ? message.slice(5) : "Data rekonsiliasi tidak bisa dimuat.";
    }
  }

  return (
    <RekonsiliasiScreen
      books={books.map((item) => ({
        id: item.id,
        label: item.label,
        accountCode: item.accountCode,
        unitCode: item.unitCode,
        unitName: item.unitName,
      }))}
      accounts={accounts.filter((account) => account.id !== book?.ledgerAccountId)}
      periods={periods}
      selectedBookId={book?.id ?? ""}
      selectedPeriodKey={period.key}
      loadError={loadError}
      data={
        data
          ? {
              statementLines: data.statementLines,
              journalLines: data.journalLines,
              bookBalance: data.bookBalance,
              statementBalance: data.statementBalance,
              difference: data.difference,
              matchedCount: data.matchedCount,
              unmatchedCount: data.unmatchedCount,
              totalCount: data.totalCount,
              periodTo: data.periodTo,
              status: data.status,
            }
          : null
      }
    />
  );
}
