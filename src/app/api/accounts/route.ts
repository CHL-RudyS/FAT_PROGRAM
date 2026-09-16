import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";

/** "Kode akun mengikuti format 4 digit setelah awalan kelompok" (panduan import). */
export const ACCOUNT_CODE_PATTERN = /^[1-9]-\d{4}$/;

export const ACCOUNT_TYPES = ["ASET", "KEWAJIBAN", "EKUITAS", "PENDAPATAN", "BEBAN"] as const;
export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

/** ASET & BEBAN bersaldo normal debit, sisanya kredit. */
export function normalBalanceFor(type: AccountTypeValue) {
  return type === "ASET" || type === "BEBAN" ? "DEBIT" : "KREDIT";
}

/** Kategori akun pada dialog m-akun -> apakah akun bisa menerima jurnal. */
export const ACCOUNT_CATEGORIES = ["ANAK", "SUB", "PARENT_SUB", "MAIN"] as const;

const createSchema = z.object({
  code: z.string().trim().min(1, "Kode akun harus diisi.").max(16),
  name: z.string().trim().min(1, "Nama akun harus diisi.").max(180),
  type: z.enum(ACCOUNT_TYPES),
  parentId: z.string().trim().min(1).nullable().optional(),
  category: z.enum(ACCOUNT_CATEGORIES).default("ANAK"),
  isActive: z.boolean().default(true),
  description: z.string().trim().max(400).optional(),
});

export async function GET() {
  return handleRead(async (context) => {
    const accounts = await db.account.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        normalBalance: true,
        parentId: true,
        level: true,
        isPostable: true,
        isActive: true,
      },
    });
    return NextResponse.json(accounts);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    if (!ACCOUNT_CODE_PATTERN.test(body.code)) {
      rule("Format kode akun harus seperti 7-1200 — awalan kelompok lalu 4 digit.");
    }

    const duplicate = await db.account.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: body.code } },
      select: { id: true },
    });
    if (duplicate) rule("Kode akun sudah dipakai di bagan akun perusahaan ini.");

    let level = 1;
    if (body.parentId) {
      const parent = await db.account.findFirst({
        where: { id: body.parentId, companyId: context.companyId },
        select: { level: true },
      });
      if (!parent) rule("Akun induk tidak ditemukan di perusahaan ini.");
      level = parent.level + 1;
    }

    const account = await db.account.create({
      data: {
        companyId: context.companyId,
        code: body.code,
        name: body.name,
        type: body.type,
        normalBalance: normalBalanceFor(body.type),
        parentId: body.parentId ?? null,
        level,
        isPostable: body.category === "ANAK",
        isActive: body.isActive,
        description: body.description || null,
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "Account",
      entityId: account.id,
      summary: `Tambah akun ${account.code} · ${account.name}`,
    });

    return NextResponse.json(account, { status: 201 });
  });
}
