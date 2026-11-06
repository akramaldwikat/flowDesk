import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
const target = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(target)) {
  console.log("Existing local .env preserved.");
  process.exit(0);
}
const databasePassword = randomBytes(24).toString("hex");
writeFileSync(
  target,
  `NODE_ENV=development
POSTGRES_USER=flowdesk
POSTGRES_PASSWORD=${databasePassword}
DATABASE_URL=postgresql://flowdesk:${databasePassword}@127.0.0.1:55434/flowdesk
TEST_DATABASE_URL=postgresql://flowdesk:${databasePassword}@127.0.0.1:55434/flowdesk_test
JWT_SECRET=${randomBytes(48).toString("hex")}
WEB_ORIGIN=http://localhost:3100
API_INTERNAL_URL=http://127.0.0.1:4100
API_PORT=4100
TRUST_PROXY=false
DEMO_PASSWORD=${randomBytes(24).toString("base64url")}
`,
  { flag: "wx", mode: 0o600 },
);
console.log(
  "Created private local .env with random secrets. No credentials are printed.",
);
