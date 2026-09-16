import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import KasKecilScreen, {
  type ClaimRow,
  type LedgerAccountOption,
  type UnitOption,
} from "./KasKecilScreen";

/** Akun kas kecil di bagan akun bawaan — prototipe memakai 1-1120. */
const PETTY_CASH_CODE = "1-1000";

function previewNumber(pattern: string, sequence: number) {
  const now = new Date();
  return pattern
    .replace("{YYYY}", String(now.getFullYear()))
    .replace("{MM}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{#+\}/, (match) => String(sequence).padStart(match.length - 2, "0"));
}

export default async function KasKecilPage() {
  const context = await requireActiveContext();

  const [claims, expenseAccounts, sourceAccounts, units, numbering, limitSetting, cashAccount] = await Promise.all([
    db.pettyCashClaim.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ claimDate: "desc" }, { number: "desc" }],
      take: 200,
      select: {
        id: true,
        number: true,
        claimDate: true,
        category: true,
        amount: true,
        description: true,
        receiptName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        unit: { select: { id: true, code: true } },
        requester: { select: { id: true, name: true } },
      },
    }),
    db.account.findMany({
      where: { companyId: context.companyId, type: "BEBAN", isPostable: true, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.account.findMany({
      where: { companyId: context.companyId, type: "ASET", isPostable: true, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.documentNumbering.findUnique({
      where: { companyId_docType: { companyId: context.companyId, docType: "KAS_KECIL" } },
      select: { pattern: true, nextNumber: true },
    }),
    db.systemSetting.findUnique({ where: { key: "pettyCashLimit" } }),
    db.account.findUnique({
      where: { companyId_code: { companyId: context.companyId, code: PETTY_CASH_CODE } },
      select: { id: true, code: true, name: true },
    }),
  ]);

  // Saldo kas kecil buku aktif = mutasi terposting di akun kas kecil.
  const balance = cashAccount
    ? await db.journalLine.aggregate({
        where: {
          accountId: cashAccount.id,
          entry: { companyId: context.companyId, unitId: context.unitId, status: "DIPOSTING" },
        },
        _sum: { debit: true, credit: true },
      })
    : null;

  const rows: ClaimRow[] = claims.map((claim) => ({
    id: claim.id,
    number: claim.number,
    claimDate: claim.claimDate.toISOString(),
    category: claim.category,
    amount: toNumber(claim.amount),
    description: claim.description,
    receiptName: claim.receiptName,
    status: claim.status,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    unitId: claim.unit.id,
    unitCode: claim.unit.code,
    requesterId: claim.requester.id,
    requesterName: claim.requester.name,
  }));

  const accountOptions = (list: Array<{ id: string; code: string; name: string }>): LedgerAccountOption[] =>
    list.map((account) => ({ id: account.id, code: account.code, name: account.name }));

  const unitOptions: UnitOption[] = units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

  const limitValue = limitSetting?.value as
    | { perClaim?: number; perCategory?: Record<string, number>; fixedFund?: number; minTopUp?: number; holder?: string }
    | null;

  return (
    <KasKecilScreen
      claims={rows}
      expenseAccounts={accountOptions(expenseAccounts)}
      sourceAccounts={accountOptions(sourceAccounts)}
      units={unitOptions}
      activeUnit={{ id: context.unit.id, code: context.unit.code, name: context.unit.name }}
      requesterName={context.user.name}
      todayIso={new Date().toISOString()}
      nextNumber={previewNumber(numbering?.pattern ?? "KK/{YYYY}/{MM}/{####}", numbering?.nextNumber ?? 1)}
      perClaimLimit={typeof limitValue?.perClaim === "number" ? limitValue.perClaim : 5_000_000}
      categoryLimits={limitValue?.perCategory ?? {}}
      fixedFund={typeof limitValue?.fixedFund === "number" ? limitValue.fixedFund : 0}
      minTopUp={typeof limitValue?.minTopUp === "number" ? limitValue.minTopUp : 0}
      holderName={limitValue?.holder ?? ""}
      cashAccountCode={cashAccount?.code ?? PETTY_CASH_CODE}
      cashBalance={balance ? toNumber(balance._sum.debit) - toNumber(balance._sum.credit) : 0}
      canDecide={context.user.roleCode === "ADMIN" || context.user.permissions.includes("approval.putuskan")}
    />
  );
}
