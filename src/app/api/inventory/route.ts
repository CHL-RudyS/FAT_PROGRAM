import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";

const createSchema = z.object({
  code: z.string().trim().min(1, "Kode barang harus diisi.").max(24),
  name: z.string().trim().min(1, "Nama barang harus diisi.").max(180),
  warehouse: z.string().trim().min(1, "Gudang harus dipilih.").max(80),
  unitName: z.string().trim().min(1, "Satuan harus diisi.").max(24),
  minimum: z.number().min(0).default(0),
  openingStock: z.number().min(0).default(0),
  openingCost: z.number().min(0).default(0),
  unitId: z.string().trim().min(1).optional(),
});

export async function GET() {
  return handleRead(async (context) => {
    const items = await db.inventoryItem.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      include: { movements: { orderBy: { date: "desc" }, take: 50 } },
    });
    return NextResponse.json(items);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const duplicate = await db.inventoryItem.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: body.code } },
      select: { id: true },
    });
    if (duplicate) rule("Kode barang sudah dipakai.");

    const unitId = body.unitId ?? context.unitId;
    const unit = await db.businessUnit.findFirst({
      where: { id: unitId, companyId: context.companyId },
      select: { id: true, code: true },
    });
    if (!unit) rule("Gudang unit tidak ditemukan di perusahaan aktif.");

    const item = await db.inventoryItem.create({
      data: {
        companyId: context.companyId,
        unitId: unit.id,
        code: body.code,
        name: body.name,
        warehouse: body.warehouse,
        unitName: body.unitName,
        stock: body.openingStock,
        minimum: body.minimum,
        averageCost: body.openingCost,
        status: "AKTIF",
      },
    });

    // Saldo awal dicatat sebagai mutasi masuk supaya kartu stok tetap utuh.
    if (body.openingStock > 0) {
      await db.inventoryMovement.create({
        data: {
          itemId: item.id,
          date: new Date(),
          kind: "MASUK",
          quantity: body.openingStock,
          unitCost: body.openingCost,
          reference: "SALDO-AWAL",
          note: "Saldo awal persediaan",
        },
      });
    }

    await recordAudit(context, {
      action: "CREATE",
      entityType: "InventoryItem",
      entityId: item.id,
      summary: `Tambah barang ${item.code} · ${item.name} (gudang ${item.warehouse})`,
      changes: { openingStock: body.openingStock, openingCost: body.openingCost, minimum: body.minimum },
    });

    return NextResponse.json(item, { status: 201 });
  });
}
