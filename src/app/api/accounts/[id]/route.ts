import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { ACCOUNT_CATEGORIES, ACCOUNT_CODE_PATTERN, ACCOUNT_TYPES, normalBalanceFor } from "../_lib/shared";

const patchSchema = z.object({
  code: z.string().trim().min(1, "Kode akun harus diisi.").max(16).optional(),
  name: z.string().trim().min(1, "Nama akun harus diisi.").max(180).optional(),
  type: z.enum(ACCOUNT_TYPES).optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
  category: z.enum(ACCOUNT_CATEGORIES).optional(),
  isActive: z.boolean().optional(),
  description: z.string().trim().max(400).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/accounts/[id]">) {
  const { id } = await ctx.params;

  return handle(request, patchSchema, async ({ body, context }) => {
    const account = await db.account.findFirst({
      where: { id, companyId: context.companyId },
    });
    if (!account) rule("Akun tidak ditemukan di perusahaan ini.");

    const usage = await db.journalLine.count({ where: { accountId: account.id } });

    if (body.code && body.code !== account.code) {
      if (usage > 0) {
        rule("Kode akun tidak bisa diubah setelah ada transaksi — buat akun baru dan nonaktifkan yang lama.");
      }
      if (!ACCOUNT_CODE_PATTERN.test(body.code)) {
        rule("Format kode akun harus seperti 7-1200 — awalan kelompok lalu 4 digit.");
      }
      const duplicate = await db.account.findUnique({
        where: { companyId_code: { companyId: context.companyId, code: body.code } },
        select: { id: true },
      });
      if (duplicate) rule("Kode akun sudah dipakai di bagan akun perusahaan ini.");
    }

    let level = account.level;
    if (body.parentId !== undefined) {
      if (body.parentId === null) {
        level = 1;
      } else {
        if (body.parentId === account.id) rule("Akun tidak bisa menjadi induk dirinya sendiri.");
        const parent = await db.account.findFirst({
          where: { id: body.parentId, companyId: context.companyId },
          select: { id: true, level: true, parentId: true },
        });
        if (!parent) rule("Akun induk tidak ditemukan di perusahaan ini.");

        // Tolak lingkaran induk-anak.
        let walker = parent.parentId;
        while (walker) {
          if (walker === account.id) rule("Akun induk tidak boleh berada di bawah akun ini.");
          const next: { parentId: string | null } | null = await db.account.findUnique({
            where: { id: walker },
            select: { parentId: true },
          });
          walker = next?.parentId ?? null;
        }
        level = parent.level + 1;
      }
    }

    const type = body.type ?? account.type;
    const isPostable = body.category ? body.category === "ANAK" : account.isPostable;

    if (!isPostable && usage > 0) {
      rule("Akun sudah dipakai di jurnal — kategorinya tidak bisa diubah menjadi akun penampung.");
    }

    const updated = await db.account.update({
      where: { id: account.id },
      data: {
        code: body.code ?? account.code,
        name: body.name ?? account.name,
        type,
        normalBalance: normalBalanceFor(type),
        parentId: body.parentId === undefined ? account.parentId : body.parentId,
        level,
        isPostable,
        isActive: body.isActive ?? account.isActive,
        description: body.description === undefined ? account.description : body.description || null,
      },
    });

    await recordAudit(context, {
      action: "UPDATE",
      entityType: "Account",
      entityId: updated.id,
      summary: `Ubah akun ${updated.code} · ${updated.name}`,
      changes: { before: { name: account.name, type: account.type, isActive: account.isActive }, after: { name: updated.name, type: updated.type, isActive: updated.isActive } },
    });

    return NextResponse.json(updated);
  });
}
