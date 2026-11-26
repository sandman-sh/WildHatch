let api;

/** Handle Vercel `/api/*` requests, restoring rewritten `wildhatchRoute` paths. */
export default async function handler(req, res) {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const route =
      url.pathname === "/api/handler" && url.searchParams.get("wildhatchRoute");
    api ??= (await import("./_api.mjs")).default;
    return await api(req, res, route ? "/api/" + route : undefined);
  } catch (error) {
    console.error("WildHatch API failed to initialize", error);
    if (!res.headersSent) {
      res
        .writeHead(500, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({
            error: "The WildHatch server is temporarily unavailable.",
          }),
        );
    }
  }
}
