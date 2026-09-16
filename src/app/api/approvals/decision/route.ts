import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import type { ActiveContext } from "@/lib/context";

const KIND_LABEL: Record<string, string> = {
  JURNAL: "Jurnal penyesuaian",
  PURCHASE_ORDER: "Purchase order",
  KAS_KECIL: "Klaim reimbursement",
  FAKTUR_PENJUALAN: "Faktur penjualan",
  TUTUP_PERIODE: "Tutup periode",
};

const decisionSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Pilih permintaan yang akan diputuskan."),
  decision: z.enum(["DISETUJUI", "DITOLAK"]),
  reason: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2000).optional(),
  notifyRequester: z.boolean().default(true),
});

/** Only an approver may decide — "approval.putuskan" or the ADMIN role. */
function canDecide(context: ActiveContext) {
  return context.user.roleCode === "ADMIN" || context.user.permissions.includes("approval.putuskan");
}

export async function POST(request: Request) {
  return handle(request, decisionSchema, async ({ body, context }) => {
    if (!canDecide(context)) {
      return NextResponse.json({ error: "Anda tidak berwenang memutuskan persetujuan." }, { status: 403 });
    }

    if (body.decision === "DITOLAK") {
      if (!body.reason) rule("Alasan penolakan harus dipilih.");
      if (!body.note) rule("Catatan untuk pengaju harus diisi.");
    }

    const requests = await db.approvalRequest.findMany({
      where: { id: { in: body.ids }, companyId: context.companyId },
      include: {
        requester: { select: { id: true, name: true } },
        unit: { select: { code: true } },
      },
    });

    if (requests.length === 0) rule("Permintaan tidak ditemukan di perusahaan aktif.");
    const pending = requests.filter((item) => item.status === "MENUNGGU");
    if (pending.length === 0) rule("Permintaan sudah diputuskan sebelumnya.");

    const decidedAt = new Date();
    const noteText = [body.reason, body.note].filter(Boolean).join(" — ") || null;
    const verb = body.decision === "DISETUJUI" ? "disetujui" : "ditolak";

    for (const item of pending) {
      await db.$transaction(async (tx) => {
        await tx.approvalDecision.create({
          data: {
            requestId: item.id,
            approverId: context.user.id,
            status: body.decision,
            note: noteText,
            decidedAt,
          },
        });

        await tx.approvalRequest.update({
          where: { id: item.id },
          data: { status: body.decision, resolvedAt: decidedAt },
        });

        if (body.notifyRequester) {
          await tx.notification.create({
            data: {
              userId: item.requesterId,
              title: `${KIND_LABEL[item.kind] ?? item.kind} ${item.referenceNo} ${verb}`,
              body: noteText
                ? `${context.user.name} · buku ${item.unit.code} · ${noteText}`
                : `${context.user.name} · buku ${item.unit.code} · nilai ${formatAmount(item.amount)}`,
              link: "/persetujuan",
            },
          });
        }
      });

      await recordAudit(context, {
        action: body.decision === "DISETUJUI" ? "APPROVE" : "REJECT",
        entityType: "ApprovalRequest",
        entityId: item.id,
        summary: `Permintaan ${item.referenceNo} ${verb}${noteText ? ` (${noteText})` : ""}`,
      });
    }

    return NextResponse.json({ decided: pending.length, skipped: requests.length - pending.length });
  });
}
