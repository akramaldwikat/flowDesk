import { config as dotenv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";
dotenv({ path: resolve(__dirname, "../../../.env"), quiet: true });
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().startsWith("postgresql://"),
  JWT_SECRET: z.string().min(32),
  WEB_ORIGIN: z.url().refine((value) => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && url.origin === value;
    } catch {
      return false;
    }
  }, "Use a canonical HTTP(S) origin without credentials, paths, query or fragment."),
  API_PORT: z.coerce.number().int().min(1024).max(65535).default(4100),
  API_BIND_HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
  TRUST_PROXY: z.enum(["true", "false"]).default("false"),
});
export function parseEnvironment(env: Record<string, string | undefined>) {
  const parsed = schema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      "Invalid server environment: " +
        parsed.error.issues.map((i) => i.path.join(".")).join(", "),
    );
  if (
    parsed.data.NODE_ENV === "production" &&
    !parsed.data.WEB_ORIGIN.startsWith("https://")
  )
    throw new Error("Production requires an HTTPS web origin");
  if (
    parsed.data.NODE_ENV === "production" &&
    /^(replace|change-?me|placeholder)/i.test(parsed.data.JWT_SECRET)
  )
    throw new Error(
      "Production JWT_SECRET must be replaced with a private random value",
    );
  return parsed.data;
}
export const config = parseEnvironment(process.env);
export const cookieNames = {
  access: config.NODE_ENV === "production" ? "__Host-fd_access" : "fd_access",
  refresh:
    config.NODE_ENV === "production" ? "__Secure-fd_refresh" : "fd_refresh",
};
