import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { periodLabel } from "@/lib/format";
import { assertClosable, journalStateFor } from "../route";

const patchSchema = z.object({
  action: z.enum(["ajukan", "tutup", "kunci", "buka"]),
  note: z.string().trim().max(400).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/periods/[id]">) {
  const { id } = await ctx.params;

  return handle(request, patchSchema, async ({ body, context }) => {
    const period = await db.fiscalPeriod.findFirst({
      where: { id, companyId: context.companyId },
      select: { id: true, year: true, month: true, status: true },
    });
    if (!period) rule("Periode tidak ditemukan di perusahaan ini.");

    const label = periodLabel(period.year, period.month);

    if (body.action === "ajukan") {
      if (period.status !== "TERBUKA") rule(`Periode ${label} sudah ${period.status === "DITUTUP" ? "ditutup" : "dikunci"}.`);

      const pending = await db.approvalRequest.findFirst({
        where: {
          companyId: context.companyId,
          unitId: context.unitId,
          kind: "TUTUP_PERIODE",
          referenceId: period.id,
          status: "MENUNGGU",
        },
        select: { id: true },
      });
      if (pending) rule(`Pengajuan penguncian periode ${label} sudah menunggu keputusan administrator.`);

      const approval = await db.approvalRequest.create({
        data: {
          companyId: context.companyId,
          unitId: context.unitId,
          kind: "TUTUP_PERIODE",
          referenceId: period.id,
          referenceNo: label,
          requesterId: context.user.id,
          escalateNote: body.note || null,
        },
        select: { id: true },
      });

      await recordAudit(context, {
        action: "SUBMIT",
        entityType: "FiscalPeriod",
        entityId: period.id,
        summary: `Ajukan penguncian periode ${label}`,
      });

      return NextResponse.json({ id: period.id, status: period.status, approvalId: approval.id });
    }

    if (body.action === "buka") {
      if (period.status === "DIKUNCI") {
        rule(`Periode ${label} sudah dikunci — koreksi hanya lewat jurnal penyesuaian di periode berjalan.`);
      }
      if (period.status === "TERBUKA") rule(`Periode ${label} masih terbuka.`);

      const reopened = await db.fiscalPeriod.update({
        where: { id: period.id },
        data: { status: "TERBUKA", closedAt: null, closedById: null },
        select: { id: true, status: true },
      });
      await recordAudit(context, {
        action: "REOPEN",
        entityType: "FiscalPeriod",
        entityId: period.id,
        summary: `Buka kembali periode ${label}`,
      });
      return NextResponse.json(reopened);
    }

    if (body.action === "tutup" && period.status !== "TERBUKA") {
      rule(`Periode ${label} sudah ${period.status === "DITUTUP" ? "ditutup" : "dikunci"}.`);
    }
    if (body.action === "kunci" && period.status === "DIKUNCI") {
      rule(`Periode ${label} sudah dikunci.`);
    }

    const state = await journalStateFor(context.companyId, period.year, period.month);
    assertClosable(state);

    // Periode sebelumnya harus sudah ditutup supaya saldo awal tidak berubah lagi.
    const previousYear = period.month === 1 ? period.year - 1 : period.year;
    const previousMonth = period.month === 1 ? 12 : period.month - 1;
    const previous = await db.fiscalPeriod.findUnique({
      where: { companyId_year_month: { companyId: context.companyId, year: previousYear, month: previousMonth } },
      select: { status: true },
    });
    if (previous && previous.status === "TERBUKA") {
      rule(`Periode ${periodLabel(previousYear, previousMonth)} masih terbuka — tutup periode sebelumnya dulu.`);
    }

    const updated = await db.fiscalPeriod.update({
      where: { id: period.id },
      data: {
        status: body.action === "kunci" ? "DIKUNCI" : "DITUTUP",
        closedAt: new Date(),
        closedById: context.user.id,
      },
      select: { id: true, status: true },
    });

    await db.approvalRequest.updateMany({
      where: {
        companyId: context.companyId,
        kind: "TUTUP_PERIODE",
        referenceId: period.id,
        status: "MENUNGGU",
      },
      data: { status: "DISETUJUI", resolvedAt: new Date() },
    });

    await recordAudit(context, {
      action: body.action === "kunci" ? "LOCK" : "CLOSE",
      entityType: "FiscalPeriod",
      entityId: period.id,
      summary: `${body.action === "kunci" ? "Kunci" : "Tutup"} periode ${label}`,
      changes: { jurnalTerposting: state.posted },
    });

    return NextResponse.json(updated);
  });
}
