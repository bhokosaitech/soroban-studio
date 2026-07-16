import { randomBytes } from "crypto";
import { prisma } from "./db";

/** A short, URL-safe, unguessable slug (~12 chars). */
function newSlug(): string {
  return randomBytes(9).toString("base64url");
}

/** Generate a slug that isn't already taken (collisions are astronomically rare). */
export async function uniqueShareSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const slug = newSlug();
    const existing = await prisma.share.findUnique({ where: { slug } });
    if (!existing) return slug;
  }
  throw new Error("Could not generate a unique share link — try again.");
}

export type ShareMode = "readonly" | "fork";

export function isShareMode(v: unknown): v is ShareMode {
  return v === "readonly" || v === "fork";
}
