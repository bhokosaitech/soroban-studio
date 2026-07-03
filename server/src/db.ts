import { PrismaClient } from "@prisma/client";

/** Singleton Prisma client. */
export const prisma = new PrismaClient();
