/**
 * Fee relay for the Vercel deployment, the twin of `POST /api/relay` in
 * scripts/producer-api.ts. The SDF relayer proxy refuses browser origins, so
 * the app posts here and this function forwards the body server-side.
 * Set PUBLIC_RELAYER_URL=/api/relay in the Vercel project and redeploy.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

const UPSTREAM =
  process.env.RELAYER_UPSTREAM ??
  "https://smart-account-relayer-proxy.sdf-ecosystem.workers.dev";

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (c: Buffer) => (data += c.toString()));
    req.on("end", () => resolve(data));
  });

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== "POST")
    return json(res, 405, { success: false, error: "POST only" });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await readBody(req)) as Record<string, unknown>;
  } catch {
    return json(res, 400, { success: false, error: "body must be JSON" });
  }
  const ok =
    typeof body.xdr === "string" ||
    (typeof body.func === "string" && Array.isArray(body.auth));
  if (!ok)
    return json(res, 400, {
      success: false,
      error: "Request must include xdr, or func and auth",
    });
  const upstream = await fetch(UPSTREAM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  res.writeHead(upstream.status, { "Content-Type": "application/json" });
  res.end(await upstream.text());
}
