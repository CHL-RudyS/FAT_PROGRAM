import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import AsetTetapScreen, {
  type AccountOption,
  type AssetRow,
  type UnitOption,
} from "./AsetTetapScreen";

/** Kode akun yang ditampilkan di keterangan metrik diambil dari bagan akun perusahaan. */
function codeOf(
  accounts: Array<{ code: string; name: string; type: string }>,
  match: (account: { code: string; name: string; type: string }) => boolean,
  fallback: string,
) {
  return accounts.find(match)?.code ?? fallback;
}

export default async function AsetTetapPage() {
  const context = await requireActiveContext();

  const [assets, units, accounts] = await Promise.all([
    db.fixedAsset.findMany({
      where: { companyId: context.companyId },
      orderBy: { code: "asc" },
      include: {
        depreciations: {
          select: { periodYear: true, periodMonth: true, expense: true, postedAt: true },
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
      select: { id: true, code: true, name: true, type: true, isPostable: true },
    }),
  ]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const unitById = new Map(units.map((unit) => [unit.id, unit]));

  const rows: AssetRow[] = assets.map((asset) => {
    // Akumulasi hanya menghitung baris jadwal yang sudah dijalankan (diposting),
    // jadwal yang baru dibuat belum mengurangi nilai buku.
    const accumulated = asset.depreciations.reduce(
      (sum, entry) => (entry.postedAt ? sum + toNumber(entry.expense) : sum),
      0,
    );
    const periodExpense = asset.depreciations.reduce(
      (sum, entry) =>
        entry.postedAt && entry.periodYear === currentYear && entry.periodMonth === currentMonth
          ? sum + toNumber(entry.expense)
          : sum,
      0,
    );
    const postedPeriods = asset.depreciations.filter((entry) => entry.postedAt).length;
    const acquisitionCost = toNumber(asset.acquisitionCost);
    const unit = unitById.get(asset.unitId);

    return {
      id: asset.id,
      code: asset.code,
      name: asset.name,
      group: asset.group,
      unitId: asset.unitId,
      unitCode: unit?.code ?? "—",
      unitName: unit?.name ?? "",
      acquisitionDate: asset.acquisitionDate.toISOString(),
      acquisitionCost,
      residualValue: toNumber(asset.residualValue),
      usefulLifeMonths: asset.usefulLifeMonths,
      method: asset.method,
      status: asset.status,
      accumulated,
      bookValue: acquisitionCost - accumulated,
      periodExpense,
      postedPeriods,
    };
  });

  const assetAccounts: AccountOption[] = accounts
    .filter((account) => account.type === "ASET" && account.isPostable)
    .map((account) => ({ id: account.id, code: account.code, name: account.name }));

  const expenseAccounts: AccountOption[] = accounts
    .filter((account) => account.type === "BEBAN" && account.isPostable)
    .map((account) => ({ id: account.id, code: account.code, name: account.name }));

  const unitOptions: UnitOption[] = units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

  const lowered = accounts.map((account) => ({ ...account, lower: account.name.toLowerCase() }));

  return (
    <AsetTetapScreen
      assets={rows}
      units={unitOptions}
      assetAccounts={assetAccounts}
      expenseAccounts={expenseAccounts}
      unitId={context.unitId}
      unitLabel={`${context.unit.code} · ${context.unit.name}`}
      currentYear={currentYear}
      currentMonth={currentMonth}
      accountCodes={{
        asset: codeOf(lowered, (account) => account.name.toLowerCase().includes("aset tetap"), "1-2000"),
        accumulated: codeOf(lowered, (account) => account.name.toLowerCase().includes("akumulasi"), "1-2100"),
        expense: codeOf(
          lowered,
          (account) => account.type === "BEBAN" && account.name.toLowerCase().includes("penyusutan"),
          "6-3000",
        ),
      }}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.ubah")}
    />
  );
}
