import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, nextDocumentNumber, recordAudit, rule } from "@/lib/api";
import { bookBalance, requireBook, requireOpenPeriod } from "@/app/api/cash/_lib/books";

/** Akun RAK antar-unit yang dieliminasi saat konsolidasi (lihat catatan di layar 25). */
const RAK_CODE = "2-1900";

const schema = z.object({
  fromUnitId: z.string().trim().min(1, "Buku pengirim harus dipilih."),
  fromBankAccountId: z.string().trim().min(1, "Akun sumber harus dipilih."),
  toUnitId: z.string().trim().min(1, "Buku penerima harus dipilih."),
  toBankAccountId: z.string().trim().min(1, "Akun tujuan harus dipilih."),
  date: z.string().trim().min(1, "Tanggal harus diisi."),
  amount: z.number().positive("Nilai transfer harus lebih dari nol."),
  purpose: z.string().trim().min(1, "Keperluan harus diisi.").max(240),
});

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) rule("Tanggal tidak valid.");

    const source = await requireBook(context.companyId, body.fromBankAccountId);
    const target = await requireBook(context.companyId, body.toBankAccountId);

    if (source.id === target.id) rule("Akun sumber dan akun tujuan tidak boleh sama.");
    if (source.unitId !== body.fromUnitId) rule(`Akun sumber ada di buku ${source.unitCode}.`);
    if (target.unitId !== body.toUnitId) rule(`Akun tujuan ada di buku ${target.unitCode}.`);

    const balance = await bookBalance(source);
    if (body.amount > balance) {
      rule(
        `Nilai melebihi saldo ${source.plainName} ${new Intl.NumberFormat("id-ID", {
          maximumFractionDigits: 0,
        }).format(balance)}.`,
      );
    }

    const periodId = await requireOpenPeriod(context.companyId, date);
    const base = {
      companyId: context.companyId,
      periodId,
      date,
      status: "DIPOSTING" as const,
      source: "MANUAL" as const,
      createdById: context.user.id,
      postedById: context.user.id,
      postedAt: new Date(),
    };

    // Dalam satu buku unit: satu jurnal berimbang — kredit akun sumber, debit akun tujuan.
    if (source.unitId === target.unitId) {
      const number = await nextDocumentNumber(context.companyId, "JURNAL", "JU");
      const entry = await db.journalEntry.create({
        data: {
          ...base,
          unitId: source.unitId,
          number,
          description: `Transfer antar buku · ${body.purpose}`,
          reference: `${source.plainName} → ${target.plainName}`,
          lines: {
            create: [
              {
                accountId: target.ledgerAccountId as string,
                description: `Kas masuk ${target.plainName}`,
                debit: body.amount,
                credit: 0,
                lineNo: 1,
              },
              {
                accountId: source.ledgerAccountId as string,
                description: `Kas keluar ${source.plainName}`,
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
        summary: `Transfer antar buku ${number}: ${source.label} → ${target.label}`,
        changes: { amount: body.amount, from: source.id, to: target.id },
      });

      return NextResponse.json(
        { id: entry.id, number, numbers: [number], fromUnitCode: source.unitCode, toUnitCode: target.unitCode },
        { status: 201 },
      );
    }

    // Antar buku unit: dua jurnal berimbang lewat akun RAK antar-unit.
    const rak = await db.account.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: RAK_CODE } },
      select: { id: true, isPostable: true },
    });
    if (!rak || !rak.isPostable) {
      rule(`Akun RAK antar-unit ${RAK_CODE} belum ada di bagan akun — transfer antar buku unit belum bisa diposting.`);
    }

    const outNumber = await nextDocumentNumber(context.companyId, "JURNAL", "JU");
    const outEntry = await db.journalEntry.create({
      data: {
        ...base,
        unitId: source.unitId,
        number: outNumber,
        description: `Transfer keluar ke buku ${target.unitCode} · ${body.purpose}`,
        reference: source.plainName,
        lines: {
          create: [
            { accountId: rak.id, description: `RAK antar-unit ${target.unitCode}`, debit: body.amount, credit: 0, lineNo: 1 },
            {
              accountId: source.ledgerAccountId as string,
              description: `Kas keluar ${source.plainName}`,
              debit: 0,
              credit: body.amount,
              lineNo: 2,
            },
          ],
        },
      },
    });

    const inNumber = await nextDocumentNumber(context.companyId, "JURNAL", "JU");
    const inEntry = await db.journalEntry.create({
      data: {
        ...base,
        unitId: target.unitId,
        number: inNumber,
        description: `Transfer masuk dari buku ${source.unitCode} · ${body.purpose}`,
        reference: target.plainName,
        lines: {
          create: [
            {
              accountId: target.ledgerAccountId as string,
              description: `Kas masuk ${target.plainName}`,
              debit: body.amount,
              credit: 0,
              lineNo: 1,
            },
            { accountId: rak.id, description: `RAK antar-unit ${source.unitCode}`, debit: 0, credit: body.amount, lineNo: 2 },
          ],
        },
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "JournalEntry",
      entityId: outEntry.id,
      summary: `Transfer antar buku ${outNumber}/${inNumber}: ${source.label} → ${target.label}`,
      changes: { amount: body.amount, from: source.id, to: target.id, entries: [outEntry.id, inEntry.id] },
    });

    return NextResponse.json(
      {
        id: outEntry.id,
        number: outNumber,
        numbers: [outNumber, inNumber],
        fromUnitCode: source.unitCode,
        toUnitCode: target.unitCode,
      },
      { status: 201 },
    );
  });
}
