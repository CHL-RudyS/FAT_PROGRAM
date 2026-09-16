import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { toNumber } from "@/lib/format";
import { OPEN_INVOICE_STATUSES, money, startOfToday } from "../../ap/_ledger";

/** Layar 24 · dialog "m-cadangan" — usulkan cadangan kerugian piutang. */
const proposeSchema = z.object({
  basis: z.enum(["60", "90", "MANUAL"]).default("60"),
  amount: z.number().positive("Nilai usulan harus diisi."),
  reason: z.string().trim().min(1, "Alasan harus diisi.").max(300),
  unitId: z.string().trim().optional(),
});

export async function POST(request: Request) {
  return handle(request, proposeSchema, async ({ body, context }) => {
    const unitId = body.unitId || context.unitId;
    const unit = await db.businessUnit.findFirst({
      where: { id: unitId, companyId: context.companyId },
      select: { id: true, code: true },
    });
    if (!unit) rule("Buku unit tidak ditemukan.");

    const amount = money(body.amount);

    // The proposal may never exceed what is actually outstanding on the chosen basis.
    const open = await db.arInvoice.findMany({
      where: { companyId: context.companyId, unitId: unit.id, status: { in: [...OPEN_INVOICE_STATUSES] } },
      select: { amount: true, paidAmount: true, dueDate: true },
    });

    const cutoffDays = body.basis === "90" ? 90 : 60;
    const today = startOfToday().getTime();
    const eligible = money(
      open.reduce((sum, invoice) => {
        const age = Math.floor((today - invoice.dueDate.getTime()) / 86_400_000);
        if (body.basis !== "MANUAL" && age <= cutoffDays) return sum;
        return sum + toNumber(invoice.amount) - toNumber(invoice.paidAmount);
      }, 0),
    );

    if (eligible <= 0) rule("Belum ada piutang yang memenuhi dasar usulan ini.");
    if (Math.round((amount - eligible) * 100) > 0) {
      rule(`Nilai usulan melebihi piutang yang memenuhi syarat (${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(eligible)}).`);
    }

    const label = body.basis === "MANUAL" ? "Pilih invoice manual" : `Piutang > ${cutoffDays} hari`;
    const referenceNo = `CKP/${unit.code}/${new Date().getFullYear()}`;

    const approval = await db.approvalRequest.create({
      data: {
        companyId: context.companyId,
        unitId: unit.id,
        kind: "JURNAL",
        referenceId: referenceNo,
        referenceNo,
        requesterId: context.user.id,
        amount,
        escalateNote: `Cadangan kerugian piutang · ${label} · ${body.reason}`,
      },
    });

    await recordAudit(context, {
      action: "REQUEST_APPROVAL",
      entityType: "ArInvoice",
      entityId: approval.id,
      summary: `Usulan cadangan kerugian piutang ${referenceNo}`,
      changes: { basis: label, amount, reason: body.reason, unit: unit.code },
    });

    return NextResponse.json({ approval }, { status: 201 });
  });
}
