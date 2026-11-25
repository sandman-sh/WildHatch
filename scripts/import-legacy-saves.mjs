import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { database } from "../server/database.ts";

const tables = {
  profiles: ["token", "data"],
  wallets: ["address", "token"],
  battles: ["id", "result"],
  wild_receipts: ["signature", "owner", "item", "reward"],
  listings: ["id", "seller", "beast", "price", "currency"],
  sales: ["id", "species", "price", "sold_at", "currency"],
};

export function readLegacy(path) {
  const source = new DatabaseSync(path, { readOnly: true });
  try {
    source.exec("BEGIN");
    const rows = {};
    for (const [table, columns] of Object.entries(tables)) {
      const info = source.prepare("PRAGMA table_info(" + table + ")").all();
      if (!info.length) {
        rows[table] = [];
        continue;
      }
      const names = new Set(info.map((column) => column.name));
      const projection = columns.map((column) =>
        column === "currency" && !names.has(column)
          ? "'shards' AS currency"
          : column,
      );
      rows[table] = source
        .prepare(
          "SELECT " +
            projection.join(", ") +
            " FROM " +
            table +
            " ORDER BY rowid",
        )
        .all();
    }
    source.exec("COMMIT");
    return rows;
  } finally {
    source.close();
  }
}

export async function importLegacy(transact, snapshot) {
  await transact(true, async (query) => {
    // This tool is intentionally a cutover import into an unused database.
    // Merging histories could replay payments or duplicate a traded beast.
    for (const table of Object.keys(tables)) {
      if ((await query("SELECT 1 FROM " + table + " LIMIT 1")).rows.length)
        throw Error(
          "Destination already has game data. Use an empty WildHatch schema.",
        );
    }
    for (const [table, columns] of Object.entries(tables)) {
      const values = columns.map((_, i) => "$" + (i + 1));
      const sql =
        "INSERT INTO " +
        table +
        " (" +
        columns.join(", ") +
        ") VALUES (" +
        values.join(", ") +
        ")";
      for (const row of snapshot[table])
        await query(
          sql,
          columns.map((column) => row[column]),
        );
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [path, flag] = process.argv.slice(2);
  if (!path || (flag && flag !== "--inspect")) {
    console.error(
      "Usage: npm run saves:import -- <existing SQLite file> [--inspect]",
    );
    process.exitCode = 1;
  } else {
    try {
      const snapshot = readLegacy(path);
      const counts = Object.fromEntries(
        Object.entries(snapshot).map(([table, rows]) => [table, rows.length]),
      );
      if (flag !== "--inspect") {
        await importLegacy(database, snapshot);
        console.log("Imported saves into Supabase Postgres.");
      }
      console.log(counts);
    } catch (error) {
      const alreadyInUse = error.message.startsWith(
        "Destination already has game data.",
      );
      console.error(
        alreadyInUse
          ? error.message
          : "Import failed. Check the source file, database connection, and WildHatch migration.",
      );
      process.exitCode = 1;
    }
  }
}
