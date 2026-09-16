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

function createClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "Database belum dikonfigurasi: set DATABASE_URL (atau POSTGRES_URL) di environment variables.",
    );
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

/**
 * Connects lazily, on first use. `next build` imports every route module to
 * collect its configuration, so constructing the client at module scope would
 * fail the build whenever DATABASE_URL is absent at build time.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
