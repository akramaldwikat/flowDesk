import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
process.env.API_PORT = process.env.PORT || "10000";
process.env.API_BIND_HOST = "0.0.0.0";
// Validate before migrations; fail closed rather than migrate the wrong database.
try {
  const { config } = await import("../apps/api/dist/config.js");
  if (config.NODE_ENV !== "production" || config.APP_MODE !== "demo")
    throw new Error();
  const result = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      cwd: fileURLToPath(new URL("../packages/database/", import.meta.url)),
      env: process.env,
      stdio: "pipe",
      timeout: 180000,
    },
  );
  if (result.status !== 0) throw new Error();
  console.log("Production migrations applied. Starting API.");
  await import("../apps/api/dist/main.js");
} catch {
  console.error(
    "API startup stopped: check demo configuration, TLS and migration status privately.",
  );
  process.exitCode = 1;
}
