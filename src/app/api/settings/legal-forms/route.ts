import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { can } from "@/lib/auth";
import { LEGAL_FORMS_KEY, readLegalForms, writeLegalForms } from "../_legal-forms";

const entrySchema = z.object({
  code: z.string().trim().min(1, "Inisial harus diisi.").max(24),
  label: z.string().trim().max(180).optional(),
});

const deleteSchema = z.object({
  code: z.string().trim().min(1, "Inisial harus diisi.").max(24),
});

export async function GET() {
  return handleRead(async () => NextResponse.json(await readLegalForms()));
}

export async function POST(request: Request) {
  return handle(request, entrySchema, async ({ body, context }) => {
    if (!can(context.user, "setelan.kelola")) {
      rule("Hanya Administrator yang bisa mengubah daftar inisial.");
    }

    const forms = await readLegalForms();
    const code = body.code.toUpperCase();
    if (forms.some((form) => form.code.toUpperCase() === code)) {
      rule("Inisial ini sudah ada di daftar.");
    }

    const next = [...forms, { code, label: body.label ?? "" }].sort((a, b) => a.code.localeCompare(b.code));
    await writeLegalForms(next);

    await recordAudit(context, {
      action: "CREATE",
      entityType: "SystemSetting",
      entityId: LEGAL_FORMS_KEY,
      summary: `Tambah inisial perusahaan ${code}`,
    });

    return NextResponse.json(next, { status: 201 });
  });
}

export async function DELETE(request: Request) {
  return handle(request, deleteSchema, async ({ body, context }) => {
    if (!can(context.user, "setelan.kelola")) {
      rule("Hanya Administrator yang bisa mengubah daftar inisial.");
    }

    const used = await db.company.count({ where: { legalForm: body.code } });
    if (used > 0) rule("Inisial ini masih dipakai entitas — tidak bisa dihapus.");

    const forms = await readLegalForms();
    const next = forms.filter((form) => form.code !== body.code);
    if (next.length === forms.length) rule("Inisial tidak ditemukan.");

    await writeLegalForms(next);

    await recordAudit(context, {
      action: "DELETE",
      entityType: "SystemSetting",
      entityId: LEGAL_FORMS_KEY,
      summary: `Hapus inisial perusahaan ${body.code}`,
    });

    return NextResponse.json(next);
  });
}
