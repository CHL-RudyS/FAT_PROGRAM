import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import {
  loadReconciliation,
  requireOpenReconciliation,
  syncReconciliation,
} from "@/app/api/reconciliation/_lib/recon";

const schema = z.object({
  bankAccountId: z.string().trim().min(1, "Akun bank harus dipilih."),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  statementLineId: z.string().trim().min(1, "Pilih satu baris rekening koran."),
});

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const data = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    requireOpenReconciliation(data);

    const statement = data.statementLines.find((line) => line.id === body.statementLineId);
    if (!statement) rule("Baris rekening koran tidak ada di periode ini.");
    if (statement.matchStatus !== "COCOK") rule("Baris ini belum dicocokkan.");

    await db.bankStatementLine.update({
      where: { id: statement.id },
      data: { matchStatus: "BELUM_COCOK", journalLineId: null, reconciliationId: null },
    });

    await db.statementImport.updateMany({
      where: { lines: { some: { id: statement.id } }, matchedCount: { gt: 0 } },
      data: { matchedCount: { decrement: 1 } },
    });

    await syncReconciliation(
      await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month),
    );

    await recordAudit(context, {
      action: "UPDATE",
      entityType: "BankStatementLine",
      entityId: statement.id,
      summary: `Batalkan pasangan mutasi ${data.book.label}`,
      changes: { statementLineId: statement.id, journalLineId: statement.journalLineId },
    });

    const after = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    return NextResponse.json({
      matchedCount: after.matchedCount,
      unmatchedCount: after.unmatchedCount,
      difference: after.difference,
    });
  });
}
