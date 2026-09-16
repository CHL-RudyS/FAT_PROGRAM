import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, setActiveContext } from "@/lib/auth";

const schema = z.object({
  companyId: z.string().min(1),
  unitId: z.string().min(1),
});

export async function POST(request: Request) {
  await requireUser();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Perusahaan dan unit bisnis harus dipilih." }, { status: 400 });
  }

  const unit = await db.businessUnit.findFirst({
    where: { id: parsed.data.unitId, companyId: parsed.data.companyId },
    select: { id: true },
  });
  if (!unit) {
    return NextResponse.json({ error: "Unit bisnis tidak ditemukan." }, { status: 404 });
  }

  await setActiveContext(parsed.data.companyId, parsed.data.unitId);
  return NextResponse.json({ ok: true });
}
