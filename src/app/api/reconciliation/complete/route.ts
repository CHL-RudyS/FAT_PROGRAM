import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { formatAmount } from "@/lib/format";
import { loadReconciliation, syncReconciliation } from "@/app/api/reconciliation/_lib/recon";

const schema = z.object({
  bankAccountId: z.string().trim().min(1, "Akun bank harus dipilih."),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  reopen: z.boolean().default(false),
});

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const data = await loadReconciliation(context.companyId, body.bankAccountId, body.year, body.month);
    const reconciliation = await syncReconciliation(data);

    if (body.reopen) {
      if (data.status !== "SELESAI") rule("Rekonsiliasi periode ini masih berjalan.");
      await db.reconciliation.update({
        where: { id: reconciliation.id },
        data: { status: "BERJALAN", closedAt: null },
      });
      await recordAudit(context, {
        action: "UPDATE",
        entityType: "Reconciliation",
        entityId: reconciliation.id,
        summary: `Buka kembali rekonsiliasi ${data.book.label}`,
      });
      return NextResponse.json({ status: "BERJALAN" });
    }

    if (data.status === "SELESAI") rule("Rekonsiliasi periode ini sudah diselesaikan.");

    // Hanya boleh SELESAI kalau selisih nol.
    if (data.difference !== 0) {
      rule(`Selisih ${formatAmount(data.difference)} belum nol — rekonsiliasi belum bisa diselesaikan.`);
    }

    await db.reconciliation.update({
      where: { id: reconciliation.id },
      data: { status: "SELESAI", closedAt: new Date() },
    });

    await recordAudit(context, {
      action: "UPDATE",
      entityType: "Reconciliation",
      entityId: reconciliation.id,
      summary: `Rekonsiliasi ${data.book.label} periode ${body.month}/${body.year} ditutup`,
      changes: { bookBalance: data.bookBalance, statementBalance: data.statementBalance },
    });

    return NextResponse.json({ status: "SELESAI" });
  });
}
