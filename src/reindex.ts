import { reindexSite } from "./indexer.js";

async function main() {
  const stats = await reindexSite();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, stats }, null, 2));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

