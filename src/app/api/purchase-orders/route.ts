import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule, nextDocumentNumber } from "@/lib/api";
import { MONTHS_ID } from "@/lib/format";

/** Fallback batas persetujuan kepala unit dari kartu "Batas persetujuan" di prototipe. */
const DEFAULT_APPROVAL_THRESHOLD = 10_000_000;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.");

const lineSchema = z.object({
  description: z.string().trim().min(1, "Barang / jasa harus diisi.").max(200),
  quantity: z.number().positive("Kuantitas harus lebih dari nol."),
  unitName: z.string().trim().max(24).optional(),
  unitPrice: z.number().min(1, "Harga satuan harus diisi."),
});

const createSchema = z.object({
  vendorId: z.string().min(1, "Vendor harus dipilih."),
  unitId: z.string().min(1).optional(),
  number: z.string().trim().max(60).optional(),
  orderDate: dateString,
  deliveryDate: dateString.optional(),
  targetAccountId: z.string().min(1, "Akun tujuan harus dipilih."),
  ppnRate: z.number().min(0).max(100).default(11),
  lines: z.array(lineSchema).min(1, "Barang / jasa harus diisi."),
  submit: z.boolean().default(false),
});

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

async function requireOpenPeriod(companyId: string, date: Date) {
  const period = await db.fiscalPeriod.findUnique({
    where: {
      companyId_year_month: { companyId, year: date.getFullYear(), month: date.getMonth() + 1 },
    },
  });
  if (period && period.status !== "TERBUKA") {
    rule(
      `Periode ${MONTHS_ID[date.getMonth()]} ${date.getFullYear()} sudah ${
        period.status === "DITUTUP" ? "ditutup" : "dikunci"
      }. PO tidak bisa dicatat ke periode ini.`,
    );
  }
  return period;
}

async function approvalThreshold() {
  const setting = await db.systemSetting.findUnique({ where: { key: "poApprovalThreshold" } });
  const value = setting?.value as { perOrder?: number; amount?: number } | null;
  const amount = value?.perOrder ?? value?.amount;
  return typeof amount === "number" && amount > 0 ? amount : DEFAULT_APPROVAL_THRESHOLD;
}

export async function GET() {
  return handleRead(async (context) => {
    const orders = await db.purchaseOrder.findMany({
      where: { companyId: context.companyId, unitId: context.unitId },
      orderBy: { orderDate: "desc" },
      include: { vendor: { select: { code: true, name: true } }, lines: true },
    });
    return NextResponse.json(orders);
  });
}

export async function POST(request: Request) {
  return handle(request, createSchema, async ({ body, context }) => {
    const orderDate = parseDate(body.orderDate);
    const deliveryDate = body.deliveryDate ? parseDate(body.deliveryDate) : null;
    await requireOpenPeriod(context.companyId, orderDate);

    const vendor = await db.vendor.findFirst({
      where: { id: body.vendorId, companyId: context.companyId },
      select: { id: true, name: true },
    });
    if (!vendor) rule("Vendor tidak ditemukan di perusahaan ini.");

    // Buku unit dari dialog — default ke unit aktif.
    const unitId = body.unitId ?? context.unitId;
    if (unitId !== context.unitId) {
      const unit = await db.businessUnit.findFirst({
        where: { id: unitId, companyId: context.companyId },
        select: { id: true },
      });
      if (!unit) rule("Buku unit tidak ditemukan.");
    }

    const targetAccount = await db.account.findFirst({
      where: { id: body.targetAccountId, companyId: context.companyId, isPostable: true },
      select: { id: true, code: true, name: true },
    });
    if (!targetAccount) rule("Akun tujuan tidak ditemukan.");

    const lines = body.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitName: line.unitName || null,
      unitPrice: line.unitPrice,
      amount: money(line.quantity * line.unitPrice),
    }));
    const subtotal = money(lines.reduce((sum, line) => sum + line.amount, 0));
    const ppn = money((subtotal * body.ppnRate) / 100);
    const amount = money(subtotal + ppn);

    const number = body.number?.trim()
      ? body.number.trim()
      : await nextDocumentNumber(context.companyId, "PURCHASE_ORDER", "PO");

    const duplicate = await db.purchaseOrder.findUnique({
      where: { companyId_number: { companyId: context.companyId, number } },
      select: { id: true },
    });
    if (duplicate) rule("Nomor PO sudah dipakai.");

    const threshold = await approvalThreshold();
    const needsApproval = body.submit && amount > threshold;

    const order = await db.purchaseOrder.create({
      data: {
        companyId: context.companyId,
        unitId,
        vendorId: vendor!.id,
        number,
        orderDate,
        deliveryDate,
        amount,
        status: body.submit ? (needsApproval ? "MENUNGGU_PERSETUJUAN" : "DISETUJUI") : "DRAF",
        stage: "Pesan",
        notes: `${targetAccount!.code} ${targetAccount!.name}`,
        lines: { create: lines },
      },
    });

    // PO di atas batas unit masuk kotak persetujuan, bukan langsung disetujui.
    if (needsApproval) {
      await db.approvalRequest.create({
        data: {
          companyId: context.companyId,
          unitId,
          kind: "PURCHASE_ORDER",
          referenceId: order.id,
          referenceNo: number,
          requesterId: context.user.id,
          amount,
          status: "MENUNGGU",
        },
      });
    }

    await recordAudit(context, {
      action: "CREATE",
      entityType: "PurchaseOrder",
      entityId: order.id,
      summary: `${body.submit ? "Ajukan" : "Simpan draf"} PO ${number} · ${vendor!.name}`,
      changes: { subtotal, ppn, amount, status: order.status, needsApproval },
    });

    return NextResponse.json({ ...order, needsApproval, threshold }, { status: 201 });
  });
}
