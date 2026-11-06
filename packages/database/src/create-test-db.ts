import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";
config({ path: resolve(__dirname, "../../../.env"), quiet: true });
async function main() {
  const url = new URL(process.env.TEST_DATABASE_URL || "postgresql://invalid");
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== "55434" ||
    url.pathname !== "/flowdesk_test"
  )
    throw new Error(
      "Only the dedicated local flowdesk_test database can be created.",
    );
  url.pathname = "/postgres";
  const client = new pg.Client({ connectionString: url.toString() });
  try {
    await client.connect();
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname=$1",
      ["flowdesk_test"],
    );
    if (!exists.rowCount) await client.query("CREATE DATABASE flowdesk_test");
    console.log("Dedicated local test database is ready.");
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "Could not prepare the local test database. Check private environment settings and PostgreSQL availability.",
  );
  process.exitCode = 1;
});
