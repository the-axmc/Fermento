import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
let client: MongoClient | null = null;

export async function getDb() {
  if (!client) client = new MongoClient(uri);
  // In modern drivers, `client.topology` may be undefined - just always ensure connect:
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  if (!(client as any).topology) await client.connect();
  return client.db("fermento");
}
