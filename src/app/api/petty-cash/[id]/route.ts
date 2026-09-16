import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { recordAudit, rule } from "@/lib/api";
import { requireActiveContext } from "@/lib/context";

const decideSchema = z.object({
  action: z.enum(["SETUJUI", "TOLAK"]),
  reason: z.string().trim().max(120).optional(),
  note: z.string().trim().max(600).optional(),
  notifyRequester: z.boolean().default(true),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/petty-cash/[id]">) {
  try {
    const context = await requireActiveContext();
    const { id } = await ctx.params;
    const body = decideSchema.parse(await request.json());

    const canDecide =
      context.user.roleCode === "ADMIN" || context.user.permissions.includes("approval.putuskan");
    if (!canDecide) rule("Anda tidak berhak memutuskan klaim ini.");

    // Daftar klaim menampilkan seluruh buku unit perusahaan, jadi keputusan juga dicakup per perusahaan.
    const claim = await db.pettyCashClaim.findFirst({
      where: { id, companyId: context.companyId },
    });
    if (!claim) rule("Klaim tidak ditemukan.");
    if (claim!.status !== "DIAJUKAN") rule("Hanya klaim yang menunggu persetujuan yang bisa diputuskan.");

    if (body.action === "TOLAK") {
      if (!body.reason) rule("Alasan penolakan harus dipilih.");
      if (!body.note) rule("Catatan untuk pengaju harus diisi.");
    }

    const updated = await db.pettyCashClaim.update({
      where: { id: claim!.id },
      data:
        body.action === "SETUJUI"
          ? { status: "DISETUJUI" }
          : {
              status: "DITOLAK",
              description: `${claim!.description ?? ""} · Ditolak: ${body.reason} — ${body.note}`.trim(),
            },
    });

    if (body.action === "TOLAK" && body.notifyRequester) {
      await db.notification.create({
        data: {
          userId: claim!.requesterId,
          title: `Klaim ${claim!.number} ditolak`,
          body: `${body.reason} — ${body.note}`,
          link: "/kas-kecil",
        },
      });
    }

    await recordAudit(context, {
      action: body.action === "SETUJUI" ? "APPROVE" : "REJECT",
      entityType: "PettyCashClaim",
      entityId: claim!.id,
      summary:
        body.action === "SETUJUI"
          ? `Setujui klaim kas kecil ${claim!.number}`
          : `Tolak klaim kas kecil ${claim!.number} · ${body.reason}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ZodError) {
      const first = error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? "Data tidak valid.", field: first?.path.join(".") },
        { status: 400 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Tidak diizinkan." }, { status: 401 });
      if (error.message === "NO_ACTIVE_CONTEXT") {
        return NextResponse.json({ error: "Pilih perusahaan dan unit bisnis dulu." }, { status: 409 });
      }
      if (error.message.startsWith("RULE:")) {
        return NextResponse.json({ error: error.message.slice(5) }, { status: 422 });
      }
    }
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server." }, { status: 500 });
  }
}
