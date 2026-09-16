import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";

const updateSchema = z.object({
  code: z.string().trim().min(1, "Kode customer harus diisi.").max(24).optional(),
  name: z.string().trim().min(1, "Nama customer harus diisi.").max(180).optional(),
  npwp: z.string().trim().max(40).optional(),
  paymentTerm: z.number().int().min(0).max(365).optional(),
  creditLimit: z.number().min(0).optional(),
  status: z.enum(["AKTIF", "NONAKTIF"]).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/customer/[id]">) {
  const { id } = await ctx.params;

  return handle(request, updateSchema, async ({ body, context }) => {
    const customer = await db.customer.findFirst({
      where: { id, companyId: context.companyId },
    });
    if (!customer) rule("Customer tidak ditemukan.");

    if (body.code && body.code !== customer.code) {
      const duplicate = await db.customer.findUnique({
        where: { companyId_code: { companyId: context.companyId, code: body.code } },
        select: { id: true },
      });
      if (duplicate) rule("Kode customer sudah dipakai.");
    }

    const updated = await db.customer.update({
      where: { id: customer.id },
      data: {
        code: body.code ?? undefined,
        name: body.name ?? undefined,
        npwp: body.npwp === undefined ? undefined : body.npwp || null,
        paymentTerm: body.paymentTerm ?? undefined,
        creditLimit: body.creditLimit ?? undefined,
        status: body.status ?? undefined,
      },
    });

    await recordAudit(context, {
      action: "UPDATE",
      entityType: "Customer",
      entityId: updated.id,
      summary: `Ubah customer ${updated.code} · ${updated.name}`,
      changes: body,
    });

    return NextResponse.json(updated);
  });
}
