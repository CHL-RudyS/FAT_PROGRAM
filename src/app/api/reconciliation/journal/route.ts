import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, nextDocumentNumber, recordAudit, rule } from "@/lib/api";
import { requireOpenPeriod } from "@/app/api/cash/_lib/books";
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
  counterAccountId: z.string().trim().min(1, "Akun lawan harus dipilih."),
  description: z.string().trim().max(240).optional(),
});

/**
 * Tombol "Buat jurnal dari mutasi bank" di layar 18: memposting jurnal berimbang untuk
 * satu baris rekening koran lalu langsung mencocokkannya dengan baris jurnal sisi bank.
 */
export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const data = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    requireOpenReconciliation(data);

    const statement = data.statementLines.find((line) => line.id === body.statementLineId);
    if (!statement) rule("Baris rekening koran tidak ada di periode ini.");
    if (statement.matchStatus === "COCOK") rule("Baris rekening koran sudah dicocokkan.");

    const counter = await db.account.findFirst({
      where: { id: body.counterAccountId, companyId: context.companyId },
      select: { id: true, code: true, name: true, isPostable: true },
    });
    if (!counter) rule("Akun lawan tidak ditemukan.");
    if (!counter.isPostable) rule("Akun lawan induk tidak bisa dipakai untuk posting.");
    if (counter.id === data.book.ledgerAccountId) rule("Akun lawan tidak boleh sama dengan akun kas/bank.");

    const amount = statement.debit > 0 ? statement.debit : statement.credit;
    if (amount <= 0) rule("Nilai mutasi nol — jurnal tidak bisa dibuat.");

    const date = new Date(statement.date);
    const periodId = await requireOpenPeriod(context.companyId, date);
    const number = await nextDocumentNumber(context.companyId, "JURNAL", "JU");
    const description = body.description?.trim() || statement.description;
    const incoming = statement.debit > 0;

    const entry = await db.journalEntry.create({
      data: {
        companyId: context.companyId,
        unitId: data.book.unitId,
        periodId,
        number,
        date,
        description,
        reference: statement.reference ?? data.book.plainName,
        status: "DIPOSTING",
        source: "IMPOR",
        createdById: context.user.id,
        postedById: context.user.id,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: data.book.ledgerAccountId as string,
              description: `${incoming ? "Kas masuk" : "Kas keluar"} ${data.book.plainName}`,
              debit: incoming ? amount : 0,
              credit: incoming ? 0 : amount,
              lineNo: 1,
            },
            {
              accountId: counter.id,
              description,
              debit: incoming ? 0 : amount,
              credit: incoming ? amount : 0,
              lineNo: 2,
            },
          ],
        },
      },
      include: { lines: { select: { id: true, accountId: true, lineNo: true } } },
    });

    const bankLine = entry.lines.find((line) => line.lineNo === 1);
    const reconciliation = await syncReconciliation(data);

    await db.bankStatementLine.update({
      where: { id: statement.id },
      data: {
        matchStatus: "COCOK",
        journalLineId: bankLine?.id ?? null,
        reconciliationId: reconciliation.id,
      },
    });
    await db.statementImport.updateMany({
      where: { lines: { some: { id: statement.id } } },
      data: { matchedCount: { increment: 1 } },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "JournalEntry",
      entityId: entry.id,
      summary: `Jurnal ${number} dibuat dari mutasi bank ${data.book.label}`,
      changes: { statementLineId: statement.id, counterAccount: counter.code, amount },
    });

    const after = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    return NextResponse.json(
      { id: entry.id, number, difference: after.difference, unmatchedCount: after.unmatchedCount },
      { status: 201 },
    );
  });
}
