import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";

const createSchema = z.object({
  code: z.string().trim().min(1, "Kode vendor harus diisi.").max(24),
  name: z.string().trim().min(1, "Nama vendor harus diisi.").max(180),
  category: z.string().trim().max(60).optional(),
  npwp: z.string().trim().max(40).optional(),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email("Format email tidak valid."), z.literal("")]).optional(),
  address: z.string().trim().max(400).optional(),
  paymentTerm: z.number().int().min(0).max(365).default(30),
});

export async function GET() {
  return handleRead(async (context) => {
    const vendors = await db.vendor.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
    });
    return NextResponse.json(vendors);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const duplicate = await db.vendor.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: body.code } },
      select: { id: true },
    });
    if (duplicate) rule("Kode vendor sudah dipakai.");

    const vendor = await db.vendor.create({
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
      },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "Vendor",
      entityId: vendor.id,
      summary: `Tambah vendor ${vendor.code} · ${vendor.name}`,
    });

    return NextResponse.json(vendor, { status: 201 });
  });
}
