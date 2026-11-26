import type { IncomingMessage, ServerResponse } from "node:http";
import api from "./api.ts";

/** Handle Vercel `/api/*` requests, restoring rewritten `wildhatchRoute` paths. */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", "http://localhost");
  const route =
    url.pathname === "/api/handler" && url.searchParams.get("wildhatchRoute");
  return api(req, res, route ? "/api/" + route : undefined);
}
