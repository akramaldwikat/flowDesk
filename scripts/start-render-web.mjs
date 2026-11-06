import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const origin = process.env.API_INTERNAL_URL;
try {
  const url = new URL(origin);
  const web = new URL(process.env.WEB_ORIGIN);
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.APP_MODE !== "demo" ||
    url.origin !== origin ||
    url.protocol !== "https:" ||
    !process.env.PROXY_SECRET ||
    process.env.PROXY_SECRET.length < 32 ||
    web.protocol !== "https:" ||
    web.origin !== process.env.WEB_ORIGIN ||
    /^(replace|placeholder)/i.test(process.env.PROXY_SECRET) ||
    /(ACTUAL_|REPLACE_|PLACEHOLDER)/i.test(
      origin + " " + process.env.WEB_ORIGIN,
    )
  )
    throw new Error();
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "0.0.0.0",
      "--port",
      process.env.PORT || "10000",
    ],
    {
      cwd: fileURLToPath(new URL("../apps/web/", import.meta.url)),
      env: process.env,
      stdio: "inherit",
    },
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => child.kill(signal));
  child.on("error", () => {
    console.error("Web startup failed.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch {
  console.error(
    "Web startup stopped: set production demo HTTPS origins and a private PROXY_SECRET.",
  );
  process.exitCode = 1;
}
