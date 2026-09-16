import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSeed } from "@/lib/seed";

export const maxDuration = 300;

/**
 * One-time bootstrap for a fresh deployment, for environments where there is no
 * terminal to run `npm run db:seed` from.
 *
 * Guarded twice: it needs SETUP_TOKEN to match, and it refuses once the database
 * already has users, so it cannot be used to overwrite a live system.
 * Remove SETUP_TOKEN from the environment once the deployment is seeded.
 */
export async function GET(request: Request) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) {
    return NextResponse.json(
      {
        ok: false,
        problem: "SETUP_TOKEN belum diset.",
        fix: "Tambahkan SETUP_TOKEN di Vercel → Settings → Environment Variables, redeploy, lalu buka /api/setup?token=<nilai itu>.",
      },
      { status: 503 },
    );
  }

  const token = new URL(request.url).searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json({ ok: false, problem: "Token tidak cocok." }, { status: 403 });
  }

  try {
    const existing = await db.user.count();
    if (existing > 0) {
      return NextResponse.json(
        {
          ok: false,
          problem: `Database sudah berisi ${existing} pengguna — seed dilewati agar data tidak tertimpa.`,
          fix: "Hapus SETUP_TOKEN dari environment variables; setup sudah selesai.",
        },
        { status: 409 },
      );
    }

    await runSeed(db);

    const [users, companies, accounts] = await Promise.all([
      db.user.count(),
      db.company.count(),
      db.account.count(),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Seed selesai. Login dengan kartika@kantor.id / rahasia123, lalu ganti kata sandinya.",
      created: { users, companies, accounts },
      next: "Hapus SETUP_TOKEN dari environment variables.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missingTable = /does not exist|P2021/i.test(message);
    return NextResponse.json(
      {
        ok: false,
        problem: missingTable
          ? "Tabel belum dibuat — skema belum ter-push ke database."
          : "Seed gagal.",
        fix: missingTable
          ? "Pastikan build menjalankan `prisma db push` (lihat script build di package.json), lalu redeploy."
          : "Periksa detail di bawah.",
        detail: message.slice(0, 400),
      },
      { status: 500 },
    );
  }
}
