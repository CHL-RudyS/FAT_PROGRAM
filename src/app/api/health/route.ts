import { NextResponse } from "next/server";
import { resolveDatabaseUrl } from "@/lib/db";

/**
 * Deployment diagnostic. Reports configuration and database readiness without
 * ever exposing credentials — only the host and booleans/counts.
 */
export async function GET() {
  const checks: Record<string, unknown> = {};

  const url = resolveDatabaseUrl();
  checks.databaseUrlSet = Boolean(url);
  if (url) {
    try {
      checks.databaseHost = new URL(url).host;
    } catch {
      checks.databaseHost = "tidak bisa dibaca — periksa format connection string";
    }
  }
  checks.sessionSecretSet = Boolean(process.env.SESSION_SECRET);

  if (!url) {
    return NextResponse.json(
      {
        ok: false,
        problem: "DATABASE_URL belum diset di environment variables.",
        fix: "Tambahkan DATABASE_URL (atau POSTGRES_URL) di Vercel → Settings → Environment Variables, lalu redeploy.",
        checks,
      },
      { status: 503 },
    );
  }

  try {
    const { db } = await import("@/lib/db");
    await db.$queryRaw`SELECT 1`;
    checks.databaseReachable = true;

    const [users, companies] = await Promise.all([db.user.count(), db.company.count()]);
    checks.userCount = users;
    checks.companyCount = companies;
    checks.schemaCreated = true;

    if (users === 0) {
      return NextResponse.json(
        {
          ok: false,
          problem: "Skema sudah ada tetapi belum ada data — seed belum dijalankan.",
          fix: "Tanpa terminal: set SETUP_TOKEN di environment variables, redeploy, lalu buka /api/setup?token=<nilai itu>. Dengan terminal: `npm run db:seed`.",
          checks,
        },
        { status: 503 },
      );
    }

    if (!process.env.SESSION_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          problem: "SESSION_SECRET belum diset — login akan gagal saat membuat sesi.",
          fix: "Tambahkan SESSION_SECRET di Vercel → Settings → Environment Variables, lalu redeploy.",
          checks,
        },
        { status: 503 },
      );
    }

    // Healthy: report nothing beyond the status, so this public endpoint does
    // not keep advertising the database host and row counts.
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missingTable = /does not exist|relation .* does not exist|P2021/i.test(message);

    checks.databaseReachable = !missingTable ? false : true;
    checks.schemaCreated = false;

    return NextResponse.json(
      {
        ok: false,
        problem: missingTable
          ? "Terhubung ke database, tetapi tabelnya belum dibuat."
          : "Tidak bisa terhubung ke database.",
        fix: missingTable
          ? "Build menjalankan `prisma db push`, jadi redeploy biasanya cukup — pastikan DATABASE_URL tersedia saat build."
          : "Periksa connection string dan apakah database mengizinkan koneksi dari Vercel.",
        detail: message.slice(0, 300),
        checks,
      },
      { status: 503 },
    );
  }
}
