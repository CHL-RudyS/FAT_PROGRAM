import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule, nextDocumentNumber } from "@/lib/api";
import { parseDate, requirePostablePeriod, round2 } from "./_lib/shared";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal jurnal tidak valid.");

const lineSchema = z.object({
  accountId: z.string().trim().min(1, "Akun harus dipilih."),
  description: z.string().trim().max(240).optional(),
  unitId: z.string().trim().min(1).optional(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
});

const createSchema = z.object({
  date: dateString,
  unitId: z.string().trim().min(1).optional(),
  reference: z.string().trim().max(120).optional(),
  description: z.string().trim().min(1, "Keterangan jurnal harus diisi.").max(240),
  lines: z.array(lineSchema).min(2, "Jurnal harus punya minimal dua baris."),
  post: z.boolean().default(false),
});

export async function GET() {
  return handleRead(async (context) => {
    const entries = await db.journalEntry.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: 200,
      include: {
        unit: { select: { code: true, name: true } },
        lines: { select: { debit: true, credit: true } },
      },
    });
    return NextResponse.json(entries);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const date = parseDate(body.date);
    if (Number.isNaN(date.getTime())) rule("Tanggal jurnal tidak valid.");

    const unitId = body.unitId ?? context.unitId;
    const unit = await db.businessUnit.findFirst({
      where: { id: unitId, companyId: context.companyId },
      select: { id: true, code: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan di perusahaan ini.");

    const lines = body.lines
      .map((line, index) => ({ ...line, debit: round2(line.debit), credit: round2(line.credit), lineNo: index + 1 }))
      .filter((line) => line.debit > 0 || line.credit > 0);

    if (lines.length < 2) rule("Jurnal harus punya minimal dua baris bernilai.");
    for (const line of lines) {
      if (line.debit > 0 && line.credit > 0) {
        rule(`Baris ${line.lineNo} tidak boleh diisi debit dan kredit sekaligus.`);
      }
      // JournalLine belum menyimpan unit sendiri, jadi pasangan jurnal RAK antar-unit
      // belum bisa dibuat otomatis — semua baris harus berada di buku yang sama.
      if (line.unitId && line.unitId !== unit.id) {
        rule(`Baris ${line.lineNo} memakai unit berbeda dari buku aktif — jurnal antar-unit belum didukung.`);
      }
    }

    const accountIds = [...new Set(lines.map((line) => line.accountId))];
    const accounts = await db.account.findMany({
      where: { id: { in: accountIds }, companyId: context.companyId, isPostable: true, isActive: true },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      rule("Ada baris yang memakai akun tidak aktif atau akun penampung — pilih akun anak yang aktif.");
    }

    const totalDebit = round2(lines.reduce((sum, line) => sum + line.debit, 0));
    const totalCredit = round2(lines.reduce((sum, line) => sum + line.credit, 0));

    let period: { id: string; status: string } | null = null;
    if (body.post) {
      if (totalDebit !== totalCredit) {
        rule("Jurnal belum seimbang — total debit harus sama dengan total kredit sebelum diposting.");
      }
      period = await requirePostablePeriod(context.companyId, date);
    } else {
      period = await db.fiscalPeriod.findUnique({
        where: { companyId_year_month: { companyId: context.companyId, year: date.getFullYear(), month: date.getMonth() + 1 } },
        select: { id: true, status: true },
      });
    }

    const number = await nextDocumentNumber(context.companyId, "JURNAL", "JU");

    const entry = await db.journalEntry.create({
      data: {
        companyId: context.companyId,
        unitId: unit.id,
        periodId: period?.id ?? null,
        number,
        date,
        description: body.description,
        reference: body.reference || null,
        status: body.post ? "DIPOSTING" : "DRAF",
        source: "MANUAL",
        createdById: context.user.id,
        postedById: body.post ? context.user.id : null,
        postedAt: body.post ? new Date() : null,
        lines: {
          create: lines.map((line, index) => ({
            accountId: line.accountId,
            description: line.description || null,
            debit: line.debit,
            credit: line.credit,
            lineNo: index + 1,
          })),
        },
      },
      select: { id: true, number: true, status: true },
    });

    await recordAudit(context, {
      action: body.post ? "POST" : "CREATE",
      entityType: "JournalEntry",
      entityId: entry.id,
      summary: `${body.post ? "Posting" : "Simpan draf"} jurnal ${entry.number} · ${body.description}`,
      changes: { totalDebit, totalCredit, baris: lines.length },
    });

    return NextResponse.json({ ...entry, totalDebit, totalCredit }, { status: 201 });
  });
}
