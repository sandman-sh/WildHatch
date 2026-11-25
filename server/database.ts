import pg from "pg";

export type Query = (
  sql: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, any>[] }>;

export type Database = <T>(
  write: boolean,
  run: (query: Query) => Promise<T>,
) => Promise<T>;

let pool: pg.Pool | undefined;

export const database: Database = async (write, run) => {
  if (!pool) {
    const connectionString = process.env.WILDHATCH_DATABASE_URL;
    if (!connectionString) throw Error("WildHatch database is not configured.");
    const url = new URL(connectionString);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const ca = process.env.WILDHATCH_DATABASE_CA?.replaceAll("\\n", "\n");
    if (!local) {
      for (const parameter of [
        "sslmode",
        "sslrootcert",
        "sslcert",
        "sslkey",
        "uselibpqcompat",
      ])
        url.searchParams.delete(parameter);
    }
    pool = new pg.Pool({
      connectionString: url.href,
      ssl: local ? undefined : { rejectUnauthorized: true, ca },
      max: 3,
      allowExitOnIdle: true,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 5000,
    });
    pool.on("error", (error: NodeJS.ErrnoException) => {
      console.error(
        "WildHatch database connection ended",
        error.code ?? "unavailable",
      );
    });
  }
  const client = await pool.connect();
  try {
    const begin = write
      ? "BEGIN"
      : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY";
    await client.query(
      begin +
        "; SET LOCAL search_path = wildhatch; SET LOCAL statement_timeout = '8s'" +
        (write ? "; SELECT pg_advisory_xact_lock(287467, 2)" : ""),
    );
    const result = await run((sql, params) => client.query(sql, params));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};
