import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import PersediaanScreen, { type ItemRow, type OpnameEvent } from "./PersediaanScreen";

const DAY = 86_400_000;

/** Kode akun di kartu "Dasar penilaian" diambil dari bagan akun perusahaan. */
function codeOf<T extends { code: string }>(accounts: T[], match: (account: T) => boolean, fallback: string) {
  return accounts.find(match)?.code ?? fallback;
}

export default async function PersediaanPage() {
  const context = await requireActiveContext();

  const [items, units, accounts] = await Promise.all([
    db.inventoryItem.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      include: {
        movements: {
          orderBy: { date: "desc" },
          select: { date: true, kind: true, quantity: true, unitCost: true, reference: true, note: true },
        },
      },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.account.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { code: true, name: true, type: true },
    }),
  ]);

  const now = new Date().getTime();
  const yearAgo = now - 365 * DAY;
  const unitById = new Map(units.map((unit) => [unit.id, unit]));

  // Nilai barang keluar setahun terakhir — pembilang rasio perputaran persediaan.
  const issuedValue = items
    .flatMap((item) => item.movements)
    .reduce(
      (sum, movement) =>
        movement.kind === "KELUAR" && movement.date.getTime() >= yearAgo
          ? sum + Math.abs(toNumber(movement.quantity)) * toNumber(movement.unitCost)
          : sum,
      0,
    );

  const rows: ItemRow[] = items.map((item) => {
    const stock = toNumber(item.stock);
    const averageCost = toNumber(item.averageCost);
    const lastMovement = item.movements[0]?.date ?? null;

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      warehouse: item.warehouse,
      unitId: item.unitId,
      unitCode: unitById.get(item.unitId)?.code ?? "—",
      unitName: item.unitName,
      stock,
      minimum: toNumber(item.minimum),
      averageCost,
      value: stock * averageCost,
      status: item.status,
      lastMovement: lastMovement ? lastMovement.toISOString() : null,
      idleDays: lastMovement ? Math.floor((now - lastMovement.getTime()) / DAY) : null,
    };
  });

  // Tiga opname terakhir — dikelompokkan per tanggal dan gudang dari mutasi penyesuaian.
  const opnameMap = new Map<string, OpnameEvent>();
  for (const item of items) {
    const warehouse = item.warehouse;
    const averageCost = toNumber(item.averageCost);
    for (const movement of item.movements) {
      if (movement.kind !== "PENYESUAIAN") continue;
      const key = `${movement.date.toISOString().slice(0, 10)}|${warehouse}`;
      const event = opnameMap.get(key) ?? {
        date: movement.date.toISOString(),
        warehouse,
        items: 0,
        variance: 0,
        reference: movement.reference ?? null,
      };
      event.items += 1;
      event.variance += toNumber(movement.quantity) * (toNumber(movement.unitCost) || averageCost);
      opnameMap.set(key, event);
    }
  }

  const opnames = Array.from(opnameMap.values())
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  const inventoryValue = rows.reduce((sum, row) => sum + row.value, 0);
  const turnover = inventoryValue > 0 ? issuedValue / inventoryValue : 0;

  const lowered = accounts.map((account) => ({ ...account, lower: account.name.toLowerCase() }));

  return (
    <PersediaanScreen
      items={rows}
      opnames={opnames}
      warehouses={Array.from(new Set(rows.map((row) => row.warehouse))).sort()}
      unitLabel={`${context.unit.code} · ${context.unit.name}`}
      todayIso={new Date().toISOString().slice(0, 10)}
      turnover={turnover}
      accountCodes={{
        inventory: codeOf(lowered, (account) => account.lower.includes("persediaan") && account.type === "ASET", "1-1400"),
        cogs: codeOf(lowered, (account) => account.lower.includes("harga pokok"), "5-1100"),
        variance: codeOf(
          lowered,
          (account) => account.type === "BEBAN" && account.lower.includes("selisih"),
          "6-4900",
        ),
      }}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.ubah")}
    />
  );
}
