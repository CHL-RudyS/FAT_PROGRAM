import { requireActiveContext } from "@/lib/context";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import PembelianScreen, {
  type LedgerAccountOption,
  type PurchaseOrderRow,
  type UnitOption,
  type VendorOption,
} from "./PembelianScreen";

/** Batas persetujuan kepala unit — kartu "Batas persetujuan" di prototipe. */
const DEFAULT_APPROVAL_THRESHOLD = 10_000_000;

/** Nomor berikutnya hanya ditampilkan — urutannya baru dipakai saat PO disimpan. */
function previewNumber(pattern: string, sequence: number) {
  const now = new Date();
  return pattern
    .replace("{YYYY}", String(now.getFullYear()))
    .replace("{MM}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace(/\{#+\}/, (match) => String(sequence).padStart(match.length - 2, "0"));
}

export default async function PembelianPage() {
  const context = await requireActiveContext();

  const [vendors, accounts, units, orders, approvals, numbering, thresholdSetting] = await Promise.all([
    db.vendor.findMany({
      where: { companyId: context.companyId, status: "AKTIF" },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.account.findMany({
      where: {
        companyId: context.companyId,
        type: { in: ["ASET", "BEBAN"] },
        isPostable: true,
        isActive: true,
      },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.businessUnit.findMany({
      where: { companyId: context.companyId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.purchaseOrder.findMany({
      where: { companyId: context.companyId },
      orderBy: [{ orderDate: "desc" }, { number: "desc" }],
      take: 200,
      select: {
        id: true,
        number: true,
        orderDate: true,
        deliveryDate: true,
        amount: true,
        receivedAmount: true,
        billedAmount: true,
        status: true,
        stage: true,
        unit: { select: { id: true, code: true } },
        vendor: { select: { id: true, code: true, name: true } },
      },
    }),
    db.approvalRequest.findMany({
      where: { companyId: context.companyId, kind: "PURCHASE_ORDER" },
      orderBy: { requestedAt: "desc" },
      select: { referenceId: true, status: true },
    }),
    db.documentNumbering.findUnique({
      where: { companyId_docType: { companyId: context.companyId, docType: "PURCHASE_ORDER" } },
      select: { pattern: true, nextNumber: true },
    }),
    db.systemSetting.findUnique({ where: { key: "poApprovalThreshold" } }),
  ]);

  const approvalByOrder = new Map<string, string>();
  for (const approval of approvals) {
    if (!approvalByOrder.has(approval.referenceId)) approvalByOrder.set(approval.referenceId, approval.status);
  }

  const rows: PurchaseOrderRow[] = orders.map((order) => ({
    id: order.id,
    number: order.number,
    orderDate: order.orderDate.toISOString(),
    deliveryDate: order.deliveryDate ? order.deliveryDate.toISOString() : null,
    amount: toNumber(order.amount),
    receivedAmount: toNumber(order.receivedAmount),
    billedAmount: toNumber(order.billedAmount),
    status: order.status,
    stage: order.stage,
    unitId: order.unit.id,
    unitCode: order.unit.code,
    vendorId: order.vendor.id,
    vendorCode: order.vendor.code,
    vendorName: order.vendor.name,
    approvalStatus: (approvalByOrder.get(order.id) as PurchaseOrderRow["approvalStatus"]) ?? null,
  }));

  const vendorOptions: VendorOption[] = vendors.map((vendor) => ({
    id: vendor.id,
    code: vendor.code,
    name: vendor.name,
  }));

  const accountOptions: LedgerAccountOption[] = accounts.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
  }));

  const unitOptions: UnitOption[] = units.map((unit) => ({ id: unit.id, code: unit.code, name: unit.name }));

  const thresholdValue = thresholdSetting?.value as { perOrder?: number; amount?: number } | null;
  const threshold = thresholdValue?.perOrder ?? thresholdValue?.amount ?? DEFAULT_APPROVAL_THRESHOLD;

  return (
    <PembelianScreen
      orders={rows}
      vendors={vendorOptions}
      targetAccounts={accountOptions}
      units={unitOptions}
      activeUnit={{ id: context.unit.id, code: context.unit.code, name: context.unit.name }}
      unitCount={units.length}
      todayIso={new Date().toISOString()}
      nextNumber={previewNumber(numbering?.pattern ?? "PO/{YYYY}/{MM}/{####}", numbering?.nextNumber ?? 1)}
      approvalThreshold={typeof threshold === "number" && threshold > 0 ? threshold : DEFAULT_APPROVAL_THRESHOLD}
      canEdit={context.user.roleCode === "ADMIN" || context.user.permissions.includes("jurnal.ubah")}
    />
  );
}
