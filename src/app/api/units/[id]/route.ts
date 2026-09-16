import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { can } from "@/lib/auth";

const patchSchema = z.object({
  code: z.string().trim().min(1, "Kode unit harus diisi.").max(4, "Kode unit maksimal 4 huruf.").optional(),
  name: z.string().trim().min(1, "Nama cabang harus diisi.").max(180).optional(),
  city: z.string().trim().max(180).nullable().optional(),
  isActive: z.boolean().optional(),
  needsWork: z.boolean().optional(),
  hasVariance: z.boolean().optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/units/[id]">) {
  const { id } = await ctx.params;

  return handle(request, patchSchema, async ({ body, context }) => {
    if (!can(context.user, "setelan.kelola")) {
      rule("Hanya Administrator yang bisa mengubah unit bisnis.");
    }

    const unit = await db.businessUnit.findFirst({ where: { id, companyId: context.companyId } });
    if (!unit) rule("Unit bisnis tidak ditemukan di entitas ini.");

    const code = body.code ? body.code.toUpperCase() : unit.code;
    if (code !== unit.code) {
      const used = await db.journalEntry.count({ where: { unitId: unit.id } });
      if (used > 0) {
        rule("Kode unit melekat pada nomor jurnal — tidak bisa diubah setelah ada transaksi.");
      }
      const duplicate = await db.businessUnit.findUnique({
        where: { companyId_code: { companyId: context.companyId, code } },
        select: { id: true },
      });
      if (duplicate) rule("Kode unit sudah dipakai di entitas ini.");
    }

    const updated = await db.businessUnit.update({
      where: { id: unit.id },
      data: {
        code,
        name: body.name ?? unit.name,
        address: body.city === undefined ? unit.address : body.city || null,
        isActive: body.isActive ?? unit.isActive,
        needsWork: body.needsWork ?? unit.needsWork,
        hasVariance: body.hasVariance ?? unit.hasVariance,
      },
    });

    await recordAudit(context, {
      action: "UPDATE",
      entityType: "BusinessUnit",
      entityId: updated.id,
      summary: `Ubah unit bisnis ${updated.code} · ${updated.name}`,
      changes: {
        before: { code: unit.code, name: unit.name, isActive: unit.isActive, needsWork: unit.needsWork, hasVariance: unit.hasVariance },
        after: { code: updated.code, name: updated.name, isActive: updated.isActive, needsWork: updated.needsWork, hasVariance: updated.hasVariance },
      },
    });

    return NextResponse.json(updated);
  });
}
