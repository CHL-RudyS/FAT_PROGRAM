import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { can } from "@/lib/auth";

const patchSchema = z.object({
  numbering: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        pattern: z.string().trim().min(1, "Pola nomor harus diisi.").max(80),
        nextNumber: z.number().int().min(1, "Nomor berikut minimal 1.").max(9_999_999),
      }),
    )
    .optional(),
  integrations: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        status: z.enum(["TERHUBUNG", "TERPUTUS", "BELUM_DIATUR"]),
        syncNow: z.boolean().optional(),
      }),
    )
    .optional(),
});

export async function GET() {
  return handleRead(async (context) => {
    const [numbering, integrations] = await Promise.all([
      db.documentNumbering.findMany({ where: { companyId: context.companyId }, orderBy: { docType: "asc" } }),
      db.integration.findMany({ orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ numbering, integrations });
  });
}

export async function PATCH(request: Request) {
  return handle(request, patchSchema, async ({ body, context }) => {
    if (!can(context.user, "setelan.kelola")) {
      rule("Hanya Administrator yang bisa mengubah setelan sistem.");
    }

    const changed: string[] = [];

    for (const entry of body.numbering ?? []) {
      const numbering = await db.documentNumbering.findFirst({
        where: { id: entry.id, companyId: context.companyId },
      });
      if (!numbering) rule("Penomoran dokumen tidak ditemukan di entitas ini.");
      if (numbering.pattern === entry.pattern && numbering.nextNumber === entry.nextNumber) continue;

      await db.documentNumbering.update({
        where: { id: numbering.id },
        data: { pattern: entry.pattern, nextNumber: entry.nextNumber },
      });
      changed.push(`${numbering.docType} → ${entry.pattern} #${entry.nextNumber}`);
    }

    for (const entry of body.integrations ?? []) {
      const integration = await db.integration.findUnique({ where: { id: entry.id } });
      if (!integration) rule("Integrasi tidak ditemukan.");
      if (integration.status === entry.status && !entry.syncNow) continue;

      await db.integration.update({
        where: { id: integration.id },
        data: {
          status: entry.status,
          lastSyncAt: entry.syncNow ? new Date() : integration.lastSyncAt,
        },
      });
      changed.push(`${integration.name} → ${entry.status}`);
    }

    if (changed.length > 0) {
      await recordAudit(context, {
        action: "UPDATE",
        entityType: "SystemSetting",
        summary: `Ubah setelan sistem: ${changed.join(", ")}`,
        changes: { after: changed },
      });
    }

    return NextResponse.json({ changed: changed.length });
  });
}
