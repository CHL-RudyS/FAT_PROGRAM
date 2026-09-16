import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, nextDocumentNumber, recordAudit, rule } from "@/lib/api";
import { bookBalance, requireBook, requireOpenPeriod } from "@/app/api/cash/_lib/books";

const schema = z.object({
  date: z.string().trim().min(1, "Tanggal harus diisi."),
  bankAccountId: z.string().trim().min(1, "Akun kas / bank harus dipilih."),
  payee: z.string().trim().min(1, "Penerima harus diisi.").max(180),
  amount: z.number().positive("Nilai harus lebih dari nol."),
  expenseAccountId: z.string().trim().min(1, "Akun beban harus dipilih."),
  unitId: z.string().trim().min(1, "Buku unit harus dipilih."),
  purpose: z.string().trim().min(1, "Keperluan harus diisi.").max(240),
  hasAttachment: z.boolean().default(false),
});

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) rule("Tanggal tidak valid.");

    const book = await requireBook(context.companyId, body.bankAccountId);
    if (book.unitId !== body.unitId) {
      rule(`Buku unit harus ${book.unitCode} — sama dengan buku rekening ${book.label}.`);
    }

    const expense = await db.account.findFirst({
      where: { id: body.expenseAccountId, companyId: context.companyId },
      select: { id: true, code: true, name: true, isPostable: true },
    });
    if (!expense) rule("Akun beban tidak ditemukan.");
    if (!expense.isPostable) rule("Akun beban induk tidak bisa dipakai untuk posting.");

    const balance = await bookBalance(book);
    if (body.amount > balance) {
      rule(
        `Nilai melebihi saldo ${book.plainName} ${new Intl.NumberFormat("id-ID", {
          maximumFractionDigits: 0,
        }).format(balance)}.`,
      );
    }
    if (body.amount > 1_000_000 && !body.hasAttachment) {
      rule("Lampiran struk wajib untuk pengeluaran di atas 1.000.000.");
    }

    const periodId = await requireOpenPeriod(context.companyId, date);
    const number = await nextDocumentNumber(context.companyId, "KAS_KECIL", "KK");

    const entry = await db.journalEntry.create({
      data: {
        companyId: context.companyId,
        unitId: book.unitId,
        periodId,
        number,
        date,
        description: `${body.purpose} — ${body.payee}`,
        reference: body.payee,
        status: "DIPOSTING",
        source: "KAS_KECIL",
        createdById: context.user.id,
        postedById: context.user.id,
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId: expense.id,
              description: body.purpose,
              debit: body.amount,
              credit: 0,
              lineNo: 1,
            },
            {
              accountId: book.ledgerAccountId as string,
              description: `Kas keluar ${book.plainName}`,
              debit: 0,
              credit: body.amount,
              lineNo: 2,
            },
          ],
        },
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "JournalEntry",
      entityId: entry.id,
      summary: `Kas keluar ${number} dicatat di buku ${book.unitCode}`,
      changes: { bankAccountId: book.id, amount: body.amount, payee: body.payee },
    });

    return NextResponse.json({ id: entry.id, number, unitCode: book.unitCode }, { status: 201 });
  });
}
