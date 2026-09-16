import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runSeed } from "@/lib/seed";
import { SCHEMA_SQL } from "@/lib/schema-sql";

export const maxDuration = 300;

/**
 * Prisma emits plain DDL — no dollar-quoted bodies — so splitting on `;` is safe.
 * Each statement is preceded by a `-- CreateTable` style comment, which has to be
 * stripped line by line rather than by rejecting the whole chunk.
 */
function statementsOf(sql: string) {
  return sql
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

async function tablesExist() {
  try {
    await db.user.count();
    return true;
  } catch {
    return false;
  }
}

async function createSchema() {
  let applied = 0;
  for (const statement of statementsOf(SCHEMA_SQL)) {
    await db.$executeRawUnsafe(statement);
    applied += 1;
  }
  return applied;
}

/**
 * One-time bootstrap for a fresh deployment, for environments with no terminal.
 * Creates the schema if it is missing, then loads the reference data.
 *
 * Guarded twice: SETUP_TOKEN must match, and it refuses once the database
 * already has users, so it cannot overwrite a live system.
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

  const steps: string[] = [];

  try {
    if (await tablesExist()) {
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
      steps.push("Skema sudah ada.");
    } else {
      const applied = await createSchema();
      steps.push(`Skema dibuat (${applied} perintah SQL).`);
    }

    await runSeed(db);
    steps.push("Data awal dimuat.");

    const [users, companies, accounts] = await Promise.all([
      db.user.count(),
      db.company.count(),
      db.account.count(),
    ]);

    return NextResponse.json({
      ok: true,
      steps,
      message: "Setup selesai. Login dengan kartika@kantor.id / rahasia123, lalu ganti kata sandinya.",
      created: { users, companies, accounts },
      next: "Hapus SETUP_TOKEN dari environment variables.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const notConfigured = message.includes("Database belum dikonfigurasi");

    return NextResponse.json(
      {
        ok: false,
        problem: notConfigured
          ? "Fungsi ini tidak melihat satu pun variabel database."
          : "Setup gagal.",
        fix: notConfigured
          ? "Di Vercel → Settings → Environment Variables project INI, tambahkan DATABASE_URL, centang Production, lalu Redeploy. Perubahan environment variable hanya berlaku pada deployment baru. Cek /api/health untuk melihat variabel apa yang terbaca."
          : "Periksa apakah database mengizinkan koneksi dari Vercel.",
        steps,
        detail: message.slice(0, 400),
      },
      { status: notConfigured ? 503 : 500 },
    );
  }
}
