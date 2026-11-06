import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const localEnv = resolve(process.cwd(), "../../.env");
if (process.env.NODE_ENV !== "production" && existsSync(localEnv))
  process.loadEnvFile(localEnv);
const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:4100";
let internalOrigin: URL;
try {
  internalOrigin = new URL(api);
} catch {
  throw new Error("API_INTERNAL_URL must be a canonical HTTP(S) origin");
}
if (
  !["http:", "https:"].includes(internalOrigin.protocol) ||
  internalOrigin.origin !== api
)
  throw new Error(
    "API_INTERNAL_URL must be a canonical HTTP(S) origin without credentials or paths",
  );
const config: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@flowdesk/contracts"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
