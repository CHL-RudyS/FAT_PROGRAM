import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { loadBooks } from "@/app/api/cash/_lib/books";
import { MAX_BYTES } from "@/app/api/cash/_lib/csv";
import { prepareImport } from "@/app/api/statements/_lib/prepare";

const schema = z.object({
  bankAccountId: z.string().trim().min(1, "Akun bank harus dipilih."),
  fileName: z.string().trim().min(1).max(200),
  text: z.string().max(MAX_BYTES, "Ukuran file melebihi 5 MB."),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  skipErrors: z.boolean().default(false),
  mapping: z
    .object({
      date: z.number().int().min(0).optional(),
      description: z.number().int().min(0).optional(),
      reference: z.number().int().min(0).optional(),
      debit: z.number().int().min(0).optional(),
      credit: z.number().int().min(0).optional(),
      balance: z.number().int().min(0).optional(),
    })
    .optional(),
});

export async function GET() {
  return handleRead(async (context) => {
    const books = await loadBooks(context.companyId);
    const imports = await db.statementImport.findMany({
      where: { bankAccountId: { in: books.map((book) => book.id) } },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    return NextResponse.json(imports);
  });
}

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const { book, parsed } = await prepareImport(context.companyId, body);
    if (parsed.error) rule(parsed.error);
    if (parsed.rows.length === 0) rule("File tidak berisi baris mutasi.");
    if (parsed.errorCount > 0 && !body.skipErrors) {
      rule(`${parsed.errorCount} baris bermasalah — perbaiki file atau pilih "Lewati baris error".`);
    }

    const rows = parsed.rows.filter((row) => row.valid);
    if (rows.length === 0) rule("Tidak ada baris valid untuk diimpor.");

    const created = await db.statementImport.create({
      data: {
        bankAccountId: book.id,
        fileName: body.fileName,
        periodFrom: parsed.periodFrom ? new Date(parsed.periodFrom) : null,
        periodTo: parsed.periodTo ? new Date(parsed.periodTo) : null,
        rowCount: rows.length,
        status: "SELESAI",
        notes:
          parsed.errorCount > 0
            ? `${parsed.errorCount} baris dilewati karena bermasalah`
            : null,
        lines: {
          create: rows.map((row) => ({
            bankAccountId: book.id,
            date: new Date(row.date as string),
            description: row.description,
            reference: row.reference,
            debit: row.debit,
            credit: row.credit,
            runningBalance: row.balance,
          })),
        },
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "StatementImport",
      entityId: created.id,
      summary: `Import mutasi ${body.fileName} ke ${book.label} — ${rows.length} baris`,
      changes: { imported: rows.length, skipped: parsed.errorCount },
    });

    return NextResponse.json(
      {
        id: created.id,
        fileName: created.fileName,
        imported: rows.length,
        skipped: parsed.errorCount,
        bankAccountLabel: book.label,
      },
      { status: 201 },
    );
  });
}
