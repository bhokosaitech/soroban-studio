import { Router } from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "./db.js";
import { env } from "./env.js";

const client = new OAuth2Client(env.googleClientId);

export const authRouter = Router();

authRouter.use(cookieParser());

authRouter.post("/google", async (req, res) => {
  const idToken = req.body?.idToken;
  if (!idToken) return res.status(400).json({ error: "Missing idToken" });

  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.googleClientId });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(400).json({ error: "Invalid token payload" });

    const email = payload.email;
    const name = payload.name;
    const googleId = payload.sub;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name, googleId },
      create: { email, name, googleId },
    });

    const token = jwt.sign({ userId: user.id }, env.jwtSecret, { expiresIn: "7d" });
    res.cookie("session", token, { httpOnly: true, sameSite: "lax" });
    res.json({ user });
  } catch (err) {
    console.error("Google auth error", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

export function requireAuth(req: any, res: any, next: any) {
  try {
    const token = req.cookies?.session || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : undefined);
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const payload: any = jwt.verify(token, env.jwtSecret);
    const userId = payload.userId as string;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    prisma.user.findUnique({ where: { id: userId } }).then((u) => {
      if (!u) return res.status(401).json({ error: "Unauthorized" });
      req.user = u;
      next();
    }).catch((e) => {
      console.error(e);
      res.status(500).json({ error: "Internal" });
    });
  } catch (e) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
