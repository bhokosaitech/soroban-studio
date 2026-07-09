import { NextResponse } from "next/server";
import { signInWithGoogle, SESSION_COOKIE } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/google — exchange a Google ID token for a session cookie. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const idToken = body?.idToken;
  if (!idToken) return NextResponse.json({ error: "Missing idToken" }, { status: 400 });

  try {
    const { token, user } = await signInWithGoogle(idToken);
    const res = NextResponse.json({ user });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch (err) {
    console.error("Google auth error", err);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
