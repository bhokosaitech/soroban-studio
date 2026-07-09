import { PrismaClient } from "@prisma/client";

/**
 * Singleton Prisma client. In dev, Next's hot reload re-evaluates modules, which
 * would otherwise leak a new connection pool on every change — so we cache the
 * instance on globalThis and reuse it.
 */
const globalForPrisma = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = prisma;
