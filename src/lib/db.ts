import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Vercel's Postgres/Neon integrations don't always expose DATABASE_URL — they
 * commonly set POSTGRES_URL (pooled) and POSTGRES_URL_NON_POOLING instead.
 */
export function resolveDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  );
}

function createClient() {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "Database belum dikonfigurasi: set DATABASE_URL (atau POSTGRES_URL) di environment variables.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
