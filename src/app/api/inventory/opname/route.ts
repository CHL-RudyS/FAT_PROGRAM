import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, recordAudit, rule } from "@/lib/api";
import { decimalToNumber, round2, round4 } from "../valuation";

const opnameSchema = z.object({
  warehouse: z.string().trim().min(1, "Gudang harus dipilih.").max(80),
  cutoffDate: z.string().trim().min(1, "Tanggal cut-off harus diisi."),
  scope: z.string().trim().max(60).default("Seluruh SKU"),
  counter: z.string().trim().min(1, "Petugas hitung harus diisi.").max(120),
  varianceAccount: z.string().trim().max(60).optional(),
  freeze: z.boolean().default(true),
  counts: z
    .array(
      z.object({
        itemId: z.string().trim().min(1),
        counted: z.number().min(0, "Hasil hitung tidak boleh negatif."),
      }),
    )
    .min(1, "Isi hasil hitung minimal satu barang."),
});

/**
 * Menyimpan hasil stock opname. Setiap selisih dicatat sebagai satu
 * InventoryMovement berjenis PENYESUAIAN bertanda (positif menambah stok,
 * negatif mengurangi) lalu stok barang disetel ke hasil hitung fisik.
 * HPP rata-rata tidak berubah — hanya penerimaan barang yang memperbaruinya.
 */
export async function POST(request: Request) {
  return handle(request, opnameSchema, async ({ body, context }) => {
    const date = new Date(`${body.cutoffDate.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) rule("Tanggal cut-off tidak valid.");

    const ids = body.counts.map((entry) => entry.itemId);
    const items = await db.inventoryItem.findMany({
      where: { id: { in: ids }, companyId: context.companyId, warehouse: body.warehouse },
    });
    if (items.length !== new Set(ids).size) {
      rule("Ada barang yang tidak ditemukan di gudang yang dipilih.");
    }

    const reference = `OPN/${body.cutoffDate.slice(0, 10)}/${body.warehouse}`;
    const lines: Array<{ code: string; name: string; system: number; counted: number; difference: number; value: number }> = [];

    for (const item of items) {
      const count = body.counts.find((entry) => entry.itemId === item.id);
      if (!count) continue;

      const system = decimalToNumber(item.stock);
      const counted = round4(count.counted);
      const difference = round4(counted - system);
      const averageCost = decimalToNumber(item.averageCost);

      if (difference !== 0) {
        await db.inventoryMovement.create({
          data: {
            itemId: item.id,
            date,
            kind: "PENYESUAIAN",
            quantity: difference,
            unitCost: averageCost,
            reference,
            note: `Stock opname ${body.warehouse} · petugas ${body.counter}${
              body.varianceAccount ? ` · selisih ke ${body.varianceAccount}` : ""
            }`,
          },
        });
        await db.inventoryItem.update({ where: { id: item.id }, data: { stock: counted } });
      }

      lines.push({
        code: item.code,
        name: item.name,
        system,
        counted,
        difference,
        value: round2(difference * averageCost),
      });
    }

    const adjusted = lines.filter((line) => line.difference !== 0);
    const varianceValue = round2(adjusted.reduce((sum, line) => sum + line.value, 0));

    await recordAudit(context, {
      action: "CREATE",
      entityType: "InventoryMovement",
      summary: `Stock opname ${body.warehouse} per ${body.cutoffDate.slice(0, 10)} · ${adjusted.length} barang selisih`,
      changes: {
        scope: body.scope,
        counter: body.counter,
        varianceAccount: body.varianceAccount,
        freeze: body.freeze,
        varianceValue,
        lines: adjusted,
      },
    });

    return NextResponse.json(
      { reference, counted: lines.length, adjusted: adjusted.length, varianceValue, lines },
      { status: 201 },
    );
  });
}
