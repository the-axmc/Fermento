// /api/_db.ts
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI!;
if (!uri) throw new Error("Missing MONGODB_URI");

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  const client = cachedClient ?? new MongoClient(uri);
  if (!cachedClient) {
    await client.connect();
    cachedClient = client;
  }
  cachedDb = client.db(); // uses default DB from URI
  return cachedDb;
}
