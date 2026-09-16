import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { bookBalances, composeBookName, loadBooks, splitBookName } from "@/app/api/cash/_lib/books";

const createSchema = z.object({
  name: z.string().trim().min(1, "Nama rekening harus diisi.").max(120),
  accountCode: z.string().trim().min(1, "Akun buku besar harus dipilih.").max(16),
  kind: z.enum(["KAS", "BANK"]).default("BANK"),
  unitId: z.string().trim().min(1, "Buku unit harus dipilih."),
  bankName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(60).optional(),
  openingBalance: z.number().min(0).default(0),
});

export async function GET() {
  return handleRead(async (context) => {
    const books = await loadBooks(context.companyId);
    const balances = await bookBalances(books);
    return NextResponse.json(
      books.map((book) => ({ ...book, balance: balances.get(book.id) ?? book.openingBalance })),
    );
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const unit = await db.businessUnit.findFirst({
      where: { id: body.unitId, companyId: context.companyId },
      select: { id: true, code: true, name: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan.");

    const account = await db.account.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: body.accountCode } },
      select: { id: true, code: true, name: true, type: true, isPostable: true },
    });
    if (!account) rule("Akun buku besar tidak ditemukan.");
    if (!account.isPostable) rule("Akun buku besar induk tidak bisa dipakai untuk posting.");
    if (account.type !== "ASET") rule("Akun kas/bank harus bertipe aset.");

    const { plainName } = splitBookName(body.name);
    const name = composeBookName(account.code, plainName);

    const existing = await loadBooks(context.companyId, { unitId: unit.id });
    if (existing.some((book) => book.accountCode === account.code)) {
      rule(`Akun ${account.code} sudah dipakai rekening lain di buku ${unit.code}.`);
    }
    if (existing.some((book) => book.name.toLowerCase() === name.toLowerCase())) {
      rule("Nama rekening sudah dipakai di buku unit ini.");
    }

    const bankAccount = await db.bankAccount.create({
      data: {
        companyId: context.companyId,
        unitId: unit.id,
        name,
        kind: body.kind,
        bankName: body.bankName || null,
        accountNumber: body.accountNumber || null,
        openingBalance: body.openingBalance,
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "BankAccount",
      entityId: bankAccount.id,
      summary: `Tambah rekening ${name} di buku ${unit.code}`,
    });

    return NextResponse.json(bankAccount, { status: 201 });
  });
}
