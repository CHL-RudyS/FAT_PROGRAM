import "server-only";

/** Pembulatan dua desimal, dipakai untuk nilai rupiah dan HPP rata-rata. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Kuantitas persediaan disimpan dengan 4 desimal (`Decimal(18,4)`). */
export function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10_000) / 10_000;
}

export function decimalToNumber(value: unknown): number {
  const parsed = Number(value === null || value === undefined ? 0 : String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Rata-rata bergerak (moving average) — dasar penilaian yang dipakai prototipe.
 * Hanya penerimaan barang (MASUK) yang memperbarui HPP rata-rata; pengeluaran
 * dan penyesuaian memakai HPP yang berlaku saat itu. Perhitungan dilakukan per
 * gudang unit, bukan per entitas.
 */
export function applyMovement(
  current: { stock: number; averageCost: number },
  movement: { kind: "MASUK" | "KELUAR" | "PENYESUAIAN"; quantity: number; unitCost?: number },
): { stock: number; averageCost: number } {
  const stock = current.stock;
  const averageCost = current.averageCost;

  if (movement.kind === "MASUK") {
    const quantity = Math.abs(movement.quantity);
    const unitCost = movement.unitCost ?? averageCost;
    const nextStock = round4(stock + quantity);
    // Stok negatif tidak boleh menyeret rata-rata; pakai HPP masuk terakhir.
    if (nextStock <= 0) return { stock: nextStock, averageCost: round2(unitCost) };
    const value = stock * averageCost + quantity * unitCost;
    return { stock: nextStock, averageCost: round2(value / nextStock) };
  }

  if (movement.kind === "KELUAR") {
    return { stock: round4(stock - Math.abs(movement.quantity)), averageCost };
  }

  // PENYESUAIAN membawa selisih bertanda: positif menambah, negatif mengurangi.
  return { stock: round4(stock + movement.quantity), averageCost };
}
