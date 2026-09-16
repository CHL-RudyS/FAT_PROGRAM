import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit } from "@/lib/api";
import {
  loadReconciliation,
  money,
  requireOpenReconciliation,
  syncReconciliation,
  type ReconJournalLine,
  type ReconStatementLine,
} from "@/app/api/reconciliation/_lib/recon";

const schema = z.object({
  bankAccountId: z.string().trim().min(1, "Akun bank harus dipilih."),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

/** Same value and direction; the closer the dates the better the candidate. */
const MAX_DAY_GAP = 3;
const DAY = 24 * 60 * 60 * 1000;

function gapInDays(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY;
}

function pickBest(statement: ReconStatementLine, candidates: ReconJournalLine[]) {
  let best: ReconJournalLine | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const journal of candidates) {
    if (money(journal.debit) !== money(statement.debit)) continue;
    if (money(journal.credit) !== money(statement.credit)) continue;
    const gap = gapInDays(statement.date, journal.date);
    if (gap > MAX_DAY_GAP) continue;
    if (gap < bestGap) {
      best = journal;
      bestGap = gap;
    }
  }
  return best;
}

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const data = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    requireOpenReconciliation(data);

    const reconciliation = await syncReconciliation(data);
    const available = data.journalLines.filter((line) => !line.matched);
    const taken = new Set<string>();
    let matched = 0;

    for (const statement of data.statementLines) {
      if (statement.matchStatus !== "BELUM_COCOK") continue;
      const journal = pickBest(
        statement,
        available.filter((line) => !taken.has(line.id)),
      );
      if (!journal) continue;

      taken.add(journal.id);
      await db.bankStatementLine.update({
        where: { id: statement.id },
        data: { matchStatus: "COCOK", journalLineId: journal.id, reconciliationId: reconciliation.id },
      });
      await db.statementImport.updateMany({
        where: { lines: { some: { id: statement.id } } },
        data: { matchedCount: { increment: 1 } },
      });
      matched += 1;
    }

    if (matched > 0) {
      await recordAudit(context, {
        action: "UPDATE",
        entityType: "Reconciliation",
        entityId: reconciliation.id,
        summary: `${matched} transaksi tercocokkan otomatis di ${data.book.label}`,
        changes: { matched },
      });
    }

    const after = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    return NextResponse.json({
      matched,
      matchedCount: after.matchedCount,
      unmatchedCount: after.unmatchedCount,
      difference: after.difference,
    });
  });
}
