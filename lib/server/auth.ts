import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db";
import { env } from "./env";

const client = new OAuth2Client(env.googleClientId);

export const SESSION_COOKIE = "session";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  googleId: string | null;
}

/**
 * Verify a Google ID token, upsert the matching user, and return a signed JWT
 * (7d) to store in the session cookie. Throws on an invalid token.
 */
export async function signInWithGoogle(
  idToken: string
): Promise<{ token: string; user: SessionUser }> {
  const ticket = await client.verifyIdToken({ idToken, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.email) throw new Error("Invalid token payload");

  const user = await prisma.user.upsert({
    where: { email: payload.email },
    update: { name: payload.name, googleId: payload.sub },
    create: { email: payload.email, name: payload.name, googleId: payload.sub },
  });

  const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: "7d" });
  return { token, user };
}

/**
 * Resolve the current user from the `session` cookie, or null if unauthenticated.
 * Route Handlers call this and return 401 when it yields null.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { userId?: string };
    if (!payload.userId) return null;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    return user ?? null;
  } catch {
    return null;
  }
}
