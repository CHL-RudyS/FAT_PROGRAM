import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule, nextDocumentNumber } from "@/lib/api";
import { MONTHS_ID } from "@/lib/format";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");

const topupSchema = z.object({
  unitId: z.string().min(1, "Buku unit harus dipilih."),
  date: dateString,
  amount: z.number().min(1, "Nilai isi ulang harus diisi."),
  sourceAccountId: z.string().min(1, "Sumber dana harus dipilih."),
  holderName: z.string().trim().min(1, "Pemegang kas harus diisi.").max(120),
});

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

export async function POST(request: Request) {
  return handle(request, topupSchema, async ({ body, context }) => {
    const date = parseDate(body.date);

    const period = await db.fiscalPeriod.findUnique({
      where: {
        companyId_year_month: { companyId: context.companyId, year: date.getFullYear(), month: date.getMonth() + 1 },
      },
    });
    if (period && period.status !== "TERBUKA") {
      rule(
        `Periode ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()} sudah ${
          period.status === "DITUTUP" ? "ditutup" : "dikunci"
        }. Pengisian kas kecil tidak bisa diposting ke periode ini.`,
      );
    }

    const unit = await db.businessUnit.findFirst({
      where: { id: body.unitId, companyId: context.companyId },
      select: { id: true, code: true, name: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan.");

    const cashAccount = await db.account.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: "1-1000" } },
    });
    if (!cashAccount) rule("Akun 1-1000 · Kas belum ada di bagan akun.");

    const sourceAccount = await db.account.findFirst({
      where: { id: body.sourceAccountId, companyId: context.companyId, isPostable: true },
      select: { id: true, code: true, name: true },
    });
    if (!sourceAccount) rule("Akun sumber dana tidak ditemukan.");
    if (sourceAccount!.id === cashAccount!.id) rule("Sumber dana tidak boleh sama dengan akun kas kecil.");

    // Isi ulang dijurnal sebagai pemindahan dari bank ke kas kecil, bukan sebagai beban.
    const number = await nextDocumentNumber(context.companyId, "JURNAL", "JU");
    const entry = await db.journalEntry.create({
      data: {
        companyId: context.companyId,
        unitId: unit!.id,
        periodId: period?.id ?? null,
        number,
        date,
        description: `Pengisian kas kecil · pemegang kas ${body.holderName}`,
        reference: `KK-ISI/${unit!.code}`,
        status: "DIPOSTING",
        source: "KAS_KECIL",
        createdById: context.user.id,
        postedById: context.user.id,
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: cashAccount!.id, description: "Kas kecil", debit: body.amount, credit: 0, lineNo: 1 },
            {
              accountId: sourceAccount!.id,
              description: `${sourceAccount!.code} ${sourceAccount!.name}`,
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
      summary: `Isi ulang kas kecil ${number} · buku ${unit!.code}`,
      changes: { amount: body.amount, sourceAccount: sourceAccount!.code },
    });

    return NextResponse.json(entry, { status: 201 });
  });
}
