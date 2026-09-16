import { NextResponse } from "next/server";
import { handleRead, rule } from "@/lib/api";
import { loadReconciliation } from "@/app/api/reconciliation/_lib/recon";

/** GET /api/reconciliation?bankAccountId=…&year=2026&month=8 */
export async function GET(request: Request) {
  return handleRead(async (context) => {
    const params = new URL(request.url).searchParams;
    const bankAccountId = params.get("bankAccountId")?.trim();
    const year = Number(params.get("year"));
    const month = Number(params.get("month"));

    if (!bankAccountId) rule("Akun bank harus dipilih.");
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      rule("Periode tidak valid.");
    }

    const data = await loadReconciliation(context.companyId, bankAccountId, year, month);
    const { book, ...rest } = data;
    return NextResponse.json({
      ...rest,
      bankAccountId: book.id,
      bankAccountLabel: book.label,
      unitCode: book.unitCode,
      accountCode: book.accountCode,
    });
  });
}
