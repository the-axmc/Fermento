import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { getDb } from "./_db";
import { signJwt } from "./_auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { username, password, wallet, accepted } = req.body ?? {};
  if (!username || !password || !wallet || accepted !== true) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const db = await getDb();
  const users = db.collection("users");
  const exists = await users.findOne({ $or: [{ username }, { wallet }] });
  if (exists) return res.status(409).json({ error: "User or wallet already exists" });

  const passwordHash = await bcrypt.hash(password, 10);
  await users.insertOne({
    username,
    wallet,
    acceptedTos: true,
    passwordHash,
    createdAt: new Date(),
  });

  const token = signJwt({ sub: username, wallet });
  res.json({ token });
}
