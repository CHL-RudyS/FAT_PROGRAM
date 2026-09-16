import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { toNumber } from "@/lib/format";
import { requirePostablePeriod, round2 } from "../route";

const patchSchema = z.object({
  action: z.enum(["posting", "batal"]),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/journal/[id]">) {
  const { id } = await ctx.params;

  return handle(request, patchSchema, async ({ body, context }) => {
    const entry = await db.journalEntry.findFirst({
      where: { id, companyId: context.companyId },
      include: { lines: { select: { debit: true, credit: true } } },
    });
    if (!entry) rule("Jurnal tidak ditemukan di perusahaan ini.");
    if (entry.status !== "DRAF") rule("Hanya jurnal berstatus draf yang bisa diproses.");

    if (body.action === "batal") {
      const cancelled = await db.journalEntry.update({
        where: { id: entry.id },
        data: { status: "BATAL" },
        select: { id: true, number: true, status: true },
      });
      await recordAudit(context, {
        action: "CANCEL",
        entityType: "JournalEntry",
        entityId: cancelled.id,
        summary: `Batalkan jurnal ${cancelled.number}`,
      });
      return NextResponse.json(cancelled);
    }

    const totalDebit = round2(entry.lines.reduce((sum, line) => sum + toNumber(line.debit), 0));
    const totalCredit = round2(entry.lines.reduce((sum, line) => sum + toNumber(line.credit), 0));
    if (entry.lines.length < 2) rule("Jurnal harus punya minimal dua baris bernilai.");
    if (totalDebit !== totalCredit) {
      rule("Jurnal belum seimbang — total debit harus sama dengan total kredit sebelum diposting.");
    }

    const period = await requirePostablePeriod(context.companyId, entry.date);

    const posted = await db.journalEntry.update({
      where: { id: entry.id },
      data: {
        status: "DIPOSTING",
        periodId: period?.id ?? entry.periodId,
        postedById: context.user.id,
        postedAt: new Date(),
      },
      select: { id: true, number: true, status: true },
    });

    await recordAudit(context, {
      action: "POST",
      entityType: "JournalEntry",
      entityId: posted.id,
      summary: `Posting jurnal ${posted.number}`,
      changes: { totalDebit, totalCredit },
    });

    return NextResponse.json(posted);
  });
}
