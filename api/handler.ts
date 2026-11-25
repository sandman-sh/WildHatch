import type { IncomingMessage, ServerResponse } from "node:http";
import api from "../server/api.ts";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", "http://localhost");
  const route =
    url.pathname === "/api/handler" && url.searchParams.get("wildhatchRoute");
  return api(req, res, route ? "/api/" + route : undefined);
}
