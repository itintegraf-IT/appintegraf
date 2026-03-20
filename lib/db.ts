import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import mariadb from "mariadb";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function parseDatabaseUrl(url: string): mariadb.PoolConfig | string {
  try {
    const u = new URL(url.replace(/^mysql:\/\//, "http://"));
    const database = u.pathname?.replace(/^\//, "").split("?")[0] || undefined;
    return {
      host: u.hostname || "localhost",
      port: u.port ? parseInt(u.port, 10) : 3306,
      user: u.username || undefined,
      password: u.password || undefined,
      database,
      connectionLimit: 5,
      connectTimeout: 15000,
      acquireTimeout: 20000,
      allowPublicKeyRetrieval: true, // MySQL 8+ caching_sha2_password
    };
  } catch {
    // PrismaMariaDb přijímá i connection string přímo
    return url;
  }
}

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const poolConfig = parseDatabaseUrl(url);
  const adapter = new PrismaMariaDb(poolConfig);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Typ pro transakční klienta v prisma.$transaction(async (tx) => ...) */
export type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
