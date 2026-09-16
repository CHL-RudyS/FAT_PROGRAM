import { NextResponse } from "next/server";
import { resolveDatabaseUrl } from "@/lib/db";

/**
 * Deployment diagnostic. Reports configuration and database readiness without
 * ever exposing credentials — only the host and booleans/counts.
 */
export async function GET() {
  const checks: Record<string, unknown> = {
    // Lets you confirm which commit is actually live.
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  };

  // Names only, never values — shows whether the function can see any database
  // variable at all, which is the usual cause of a failed bootstrap.
  const KNOWN_DB_VARS = [
    "DATABASE_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
  ];
  checks.databaseVarsPresent = KNOWN_DB_VARS.filter((name) => Boolean(process.env[name]));
  checks.vercelEnv = process.env.VERCEL_ENV ?? "(bukan Vercel)";

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
        problem: "Fungsi ini tidak melihat satu pun variabel database.",
        fix:
          "Di Vercel → Settings → Environment Variables project INI, tambahkan DATABASE_URL, centang environment Production, " +
          "lalu Deployments → Redeploy. Perubahan environment variable baru berlaku setelah deployment baru.",
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

    // Healthy: report only the status and which commit is live, so this public
    // endpoint does not keep advertising the database host and row counts.
    return NextResponse.json({ ok: true, commit: checks.commit });
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
          ? "Set SETUP_TOKEN di environment variables, lalu buka /api/setup?token=<nilai itu> — skema dibuat dan diisi dari sana."
          : "Periksa connection string dan apakah database mengizinkan koneksi dari Vercel.",
        detail: message.slice(0, 300),
        checks,
      },
      { status: 503 },
    );
  }
}
