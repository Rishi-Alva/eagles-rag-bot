import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { closePool, databaseUrl, getPool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = databaseUrl();
  if (!url) {
    // eslint-disable-next-line no-console
    console.error("DATABASE_URL is not set. Example:\n  postgresql://eagles:eagles@localhost:5432/eagles_analytics");
    process.exit(1);
  }

  const pool = getPool();
  if (!pool) process.exit(1);

  const schemaPath = resolve(__dirname, "../../db/schema.sql");
  const sql = await readFile(schemaPath, "utf8");
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, schema: schemaPath }, null, 2));
  await closePool();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
