import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import {
  loadReconciliation,
  requireOpenReconciliation,
  sameMovement,
  syncReconciliation,
} from "@/app/api/reconciliation/_lib/recon";

const schema = z.object({
  bankAccountId: z.string().trim().min(1, "Akun bank harus dipilih."),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  statementLineId: z.string().trim().min(1, "Pilih satu baris rekening koran."),
  journalLineId: z.string().trim().min(1, "Pilih satu baris buku besar."),
});

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const data = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    requireOpenReconciliation(data);

    const statement = data.statementLines.find((line) => line.id === body.statementLineId);
    if (!statement) rule("Baris rekening koran tidak ada di periode ini.");
    if (statement.matchStatus === "COCOK") rule("Baris rekening koran sudah dicocokkan.");

    const journal = data.journalLines.find((line) => line.id === body.journalLineId);
    if (!journal) rule("Baris buku besar tidak ada di periode ini.");
    if (journal.matched) rule("Baris buku besar sudah dipakai pasangan lain.");

    if (!sameMovement(statement, journal)) {
      rule("Nilai atau arah mutasi tidak sama — pasangan ditolak.");
    }

    const reconciliation = await syncReconciliation(data);

    await db.bankStatementLine.update({
      where: { id: statement.id },
      data: {
        matchStatus: "COCOK",
        journalLineId: journal.id,
        reconciliationId: reconciliation.id,
      },
    });

    await db.statementImport.updateMany({
      where: { lines: { some: { id: statement.id } } },
      data: { matchedCount: { increment: 1 } },
    });

    await recordAudit(context, {
      action: "UPDATE",
      entityType: "BankStatementLine",
      entityId: statement.id,
      summary: `Cocokkan mutasi ${data.book.label} dengan jurnal ${journal.number}`,
      changes: { statementLineId: statement.id, journalLineId: journal.id },
    });

    const after = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    return NextResponse.json({
      matchedCount: after.matchedCount,
      unmatchedCount: after.unmatchedCount,
      difference: after.difference,
    });
  });
}
