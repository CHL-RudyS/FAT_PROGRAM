import { NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { MAX_BYTES } from "@/app/api/cash/_lib/csv";
import { prepareImport } from "@/app/api/statements/_lib/prepare";

const schema = z.object({
  bankAccountId: z.string().trim().min(1, "Akun bank harus dipilih."),
  fileName: z.string().trim().min(1).max(200),
  text: z.string().max(MAX_BYTES, "Ukuran file melebihi 5 MB."),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  mapping: z
    .object({
      date: z.number().int().min(0).optional(),
      description: z.number().int().min(0).optional(),
      reference: z.number().int().min(0).optional(),
      debit: z.number().int().min(0).optional(),
      credit: z.number().int().min(0).optional(),
      balance: z.number().int().min(0).optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  return handle(request, schema, async ({ body, context }) => {
    const { book, parsed } = await prepareImport(context.companyId, body);
    return NextResponse.json({
      bankAccountId: book.id,
      bankAccountLabel: book.label,
      fileName: body.fileName,
      ...parsed,
    });
  });
}
