import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { applyMovement, decimalToNumber, round2 } from "../valuation";

const movementSchema = z.object({
  itemId: z.string().trim().min(1, "Barang harus dipilih."),
  date: z.string().trim().min(1, "Tanggal mutasi harus diisi."),
  kind: z.enum(["MASUK", "KELUAR", "PENYESUAIAN"]),
  quantity: z.number().refine((value) => value !== 0, "Jumlah mutasi tidak boleh nol."),
  unitCost: z.number().min(0).default(0),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(240).optional(),
});

/**
 * Mencatat satu mutasi kartu stok. Penerimaan (MASUK) memperbarui HPP rata-rata
 * bergerak pada gudang unit yang bersangkutan.
 */
export async function POST(request: Request) {
  return handle(request, movementSchema, async ({ body, context }) => {
    const item = await db.inventoryItem.findFirst({
      where: { id: body.itemId, companyId: context.companyId },
    });
    if (!item) rule("Barang tidak ditemukan di perusahaan aktif.");

    const date = new Date(`${body.date.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) rule("Tanggal mutasi tidak valid.");

    const stock = decimalToNumber(item!.stock);
    const averageCost = decimalToNumber(item!.averageCost);

    if (body.kind === "KELUAR" && Math.abs(body.quantity) > stock) {
      rule("Jumlah keluar melebihi stok yang tersedia.");
    }
    if (body.kind === "MASUK" && body.unitCost <= 0) {
      rule("Harga satuan penerimaan harus diisi agar HPP rata-rata bisa dihitung.");
    }

    const next = applyMovement({ stock, averageCost }, body);
    if (next.stock < 0) rule("Mutasi membuat stok menjadi negatif.");

    const movement = await db.inventoryMovement.create({
      data: {
        itemId: item!.id,
        date,
        kind: body.kind,
        quantity: body.quantity,
        unitCost: body.kind === "MASUK" ? body.unitCost : averageCost,
        reference: body.reference,
        note: body.note,
      },
    });

    await db.inventoryItem.update({
      where: { id: item!.id },
      data: { stock: next.stock, averageCost: next.averageCost },
    });

    await recordAudit(context, {
      action: "CREATE",
      entityType: "InventoryMovement",
      entityId: movement.id,
      summary: `Mutasi ${body.kind.toLowerCase()} ${item!.code} · ${item!.name}`,
      changes: {
        quantity: body.quantity,
        unitCost: body.unitCost,
        stockBefore: stock,
        stockAfter: next.stock,
        averageCostBefore: averageCost,
        averageCostAfter: next.averageCost,
      },
    });

    return NextResponse.json(
      {
        movement,
        stock: next.stock,
        averageCost: next.averageCost,
        value: round2(next.stock * next.averageCost),
      },
      { status: 201 },
    );
  });
}
