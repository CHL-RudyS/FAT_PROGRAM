import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { recordAudit, rule } from "@/lib/api";
import { requireActiveContext } from "@/lib/context";
import { MONTHS_ID } from "@/lib/format";

const reportSchema = z.object({
  action: z.literal("LAPOR"),
  reportedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.")
    .optional(),
});

/** Menandai satu bukti pajak sudah dilaporkan di SPT Masa. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/tax/[id]">) {
  try {
    const context = await requireActiveContext();
    const { id } = await ctx.params;
    const body = reportSchema.parse(await request.json());

    const canReport = context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.posting");
    if (!canReport) rule("Anda tidak berhak melaporkan pajak.");

    const record = await db.taxRecord.findFirst({ where: { id, companyId: context.companyId } });
    if (!record) rule("Bukti pajak tidak ditemukan.");
    if (record!.status === "DILAPORKAN") rule("Bukti pajak ini sudah dilaporkan.");
    if (record!.status === "DRAF") rule("Setor pajaknya dulu sebelum dilaporkan.");

    const reportedAt = body.reportedAt ? new Date(`${body.reportedAt}T00:00:00`) : new Date();

    const updated = await db.taxRecord.update({
      where: { id: record!.id },
      data: { status: "DILAPORKAN", reportedAt },
    });

    await recordAudit(context, {
      action: "UPDATE",
      entityType: "TaxRecord",
      entityId: record!.id,
      summary: `Lapor SPT Masa ${record!.kind.replace(/_/g, " ")} ${MONTHS_ID[record!.periodMonth - 1]} ${record!.periodYear}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? "Data tidak valid.", field: first?.path.join(".") },
        { status: 400 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
      if (error.message === "NO_ACTIVE_CONTEXT") {
        return NextResponse.json({ error: "Pilih perusahaan dan unit bisnis dulu." }, { status: 409 });
      }
      if (error.message.startsWith("RULE:")) {
        return NextResponse.json({ error: error.message.slice(5) }, { status: 422 });
      }
    }
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
