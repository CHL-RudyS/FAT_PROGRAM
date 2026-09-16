import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handle, handleRead, recordAudit, rule } from "@/lib/api";
import { can } from "@/lib/auth";

const patchSchema = z.object({
  name: z.string().trim().min(1, "Nama pengguna harus diisi.").max(180).optional(),
  email: z.string().trim().email("Format email tidak valid.").optional(),
  jobTitle: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  roleId: z.string().trim().min(1).optional(),
  status: z.enum(["AKTIF", "NONAKTIF", "DIKUNCI"]).optional(),
  /** Full replacement of this user's per-unit grants. */
  unitIds: z.array(z.string().trim().min(1)).optional(),
});

export async function PATCH(request: Request, ctx: RouteContext<"/api/users/[id]">) {
  const { id } = await ctx.params;

  return handle(request, patchSchema, async ({ body, context }) => {
    if (!can(context.user, "pengguna.kelola")) {
      rule("Hanya Administrator yang bisa mengubah pengguna.");
    }

    const user = await db.user.findUnique({
      where: { id },
      include: { role: { select: { id: true, code: true, name: true } }, unitAccess: { select: { unitId: true } } },
    });
    if (!user) rule("Pengguna tidak ditemukan.");

    if (user.id === context.user.id && body.status && body.status !== "AKTIF") {
      rule("Anda tidak bisa menonaktifkan akun sendiri.");
    }

    // The login name doubles as the identifier, so it has to stay unique. The
    // session cookie carries the user id, so changing it never signs anyone out.
    let email = user.email;
    if (body.email) {
      email = body.email.toLowerCase();
      if (email !== user.email) {
        const duplicate = await db.user.findUnique({ where: { email }, select: { id: true } });
        if (duplicate) rule("Email itu sudah dipakai pengguna lain.");
      }
    }

    let roleName = user.role.name;
    if (body.roleId && body.roleId !== user.roleId) {
      const role = await db.role.findUnique({ where: { id: body.roleId }, select: { id: true, name: true } });
      if (!role) rule("Peran tidak ditemukan.");
      roleName = role.name;
    }

    if (body.unitIds) {
      const units = await db.businessUnit.findMany({
        where: { id: { in: body.unitIds } },
        select: { id: true },
      });
      const keep = new Set(units.map((unit) => unit.id));

      await db.userUnitAccess.deleteMany({
        where: { userId: user.id, unitId: { notIn: [...keep] } },
      });
      for (const unitId of keep) {
        await db.userUnitAccess.upsert({
          where: { userId_unitId: { userId: user.id, unitId } },
          update: {},
          create: { userId: user.id, unitId },
        });
      }
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        name: body.name ?? user.name,
        email,
        jobTitle: body.jobTitle === undefined ? user.jobTitle : body.jobTitle || null,
        phone: body.phone === undefined ? user.phone : body.phone || null,
        roleId: body.roleId ?? user.roleId,
        status: body.status ?? user.status,
      },
      select: { id: true, name: true, email: true, status: true },
    });

    if (updated.status !== "AKTIF") {
      await db.session.updateMany({
        where: { userId: updated.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await recordAudit(context, {
      action: "UPDATE",
      entityType: "User",
      entityId: updated.id,
      summary: `Ubah pengguna ${updated.name}`,
      changes: {
        before: { email: user.email, status: user.status, role: user.role.name, units: user.unitAccess.length },
        after: {
          email: updated.email,
          status: updated.status,
          role: roleName,
          units: body.unitIds?.length ?? user.unitAccess.length,
        },
      },
    });

    return NextResponse.json(updated);
  });
}

/**
 * Removes an account outright. Accounts that already carry work — a journal
 * they posted, an approval they signed, an audit trail — cannot be removed,
 * because the record has to keep naming who did it; those are deactivated
 * instead, which the PATCH above handles.
 */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/users/[id]">) {
  const { id } = await ctx.params;

  return handleRead(async (context) => {
    if (!can(context.user, "pengguna.kelola")) {
      rule("Hanya Administrator yang bisa menghapus pengguna.");
    }
    if (id === context.user.id) rule("Anda tidak bisa menghapus akun sendiri.");

    const user = await db.user.findUnique({
      where: { id },
      include: { role: { select: { code: true, name: true } } },
    });
    if (!user) rule("Pengguna tidak ditemukan.");

    if (user.role.code === "ADMIN") {
      const admins = await db.user.count({
        where: { role: { code: "ADMIN" }, status: "AKTIF" },
      });
      if (admins <= 1) rule("Ini satu-satunya Administrator aktif — sistem harus punya minimal satu.");
    }

    // AuditLog.userId is nullable, so the database would happily orphan the
    // trail instead of refusing. An accounting log that no longer names who
    // acted is worth less than the convenience of a hard delete.
    const trail = await db.auditLog.count({ where: { userId: user.id } });
    if (trail > 0) {
      rule(
        `Pengguna ini sudah pernah memakai sistem — ada ${trail} catatan jejak audit yang harus tetap menyebut pelakunya, jadi akunnya tidak bisa dihapus. Pilih Non-Aktifkan: akunnya tidak bisa dipakai login lagi dan riwayatnya tetap utuh.`,
      );
    }

    try {
      await db.user.delete({ where: { id: user.id } });
    } catch (error) {
      // P2003: a record elsewhere still points at this user.
      if ((error as { code?: string }).code === "P2003") {
        rule(
          "Pengguna ini sudah tercatat pada transaksi atau jejak audit, jadi tidak bisa dihapus. Ubah statusnya menjadi Non-Aktif.",
        );
      }
      throw error;
    }

    await recordAudit(context, {
      action: "DELETE",
      entityType: "User",
      entityId: user.id,
      summary: `Hapus pengguna ${user.name} · ${user.email}`,
      changes: { before: { email: user.email, role: user.role.name, status: user.status } },
    });

    return NextResponse.json({ ok: true });
  });
}
