import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { getDb } from "./_db";
import { signJwt } from "./_auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });

  const db = await getDb();
  const user = await db.collection("users").findOne({ username });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, (user as any).passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signJwt({ sub: (user as any).username, wallet: (user as any).wallet });
  res.json({ token });
}
