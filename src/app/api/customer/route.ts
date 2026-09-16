import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";

const createSchema = z.object({
  code: z.string().trim().min(1, "Kode customer harus diisi.").max(24),
  name: z.string().trim().min(1, "Nama customer harus diisi.").max(180),
  category: z.string().trim().max(60).optional(),
  npwp: z.string().trim().max(40).optional(),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email("Format email tidak valid."), z.literal("")]).optional(),
  address: z.string().trim().max(400).optional(),
  paymentTerm: z.number().int().min(0).max(365).default(30),
  creditLimit: z.number().min(0).default(0),
});

export async function GET() {
  return handleRead(async (context) => {
    const customers = await db.customer.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
    });
    return NextResponse.json(customers);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const duplicate = await db.customer.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: body.code } },
      select: { id: true },
    });
    if (duplicate) rule("Kode customer sudah dipakai.");

    const customer = await db.customer.create({
      data: {
        companyId: context.companyId,
        code: body.code,
        name: body.name,
        category: body.category || null,
        npwp: body.npwp || null,
        contactName: body.contactName || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        paymentTerm: body.paymentTerm,
        creditLimit: body.creditLimit,
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "Customer",
      entityId: customer.id,
      summary: `Tambah customer ${customer.code} · ${customer.name}`,
    });

    return NextResponse.json(customer, { status: 201 });
  });
}
