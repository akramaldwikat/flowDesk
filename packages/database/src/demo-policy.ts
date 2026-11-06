export const demoPolicy = {
  marker: "flowdesk-demo-v1",
  lock: "flowdesk-demo",
  organizationId: "d30d3000-0000-4000-8000-000000000001",
  emails: [
    "admin@flowdesk.example",
    "manager@flowdesk.example",
    "member@flowdesk.example",
  ] as const,
  clients: 5,
  projects: 5,
  tasks: 40,
  auditEvents: 200,
  mutationsPerHour: 20,
  sessionRows: 100,
  activeSessions: 3,
  sessionHours: 12,
} as const;

// DATABASE_URL is the only connection source. These two values are target assertions, not URLs.
export function assertDemoTarget(env: Record<string, string | undefined>) {
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL || "");
  } catch {
    throw new Error("Invalid demo DATABASE_URL");
  }
  if (env.APP_MODE !== "demo") throw new Error("APP_MODE=demo is required");
  if (url.protocol !== "postgresql:")
    throw new Error("Demo requires PostgreSQL");
  const localTest =
    env.NODE_ENV === "test" &&
    url.hostname === "127.0.0.1" &&
    url.port === "55434" &&
    url.pathname === "/flowdesk_test";
  if (localTest) return url;
  if (
    env.NODE_ENV !== "production" ||
    !url.hostname.endsWith(".neon.tech") ||
    url.hostname.includes("-pooler.") ||
    url.searchParams.get("sslmode") !== "verify-full"
  )
    throw new Error(
      "Demo requires a direct Neon TLS connection with sslmode=verify-full",
    );
  if (
    !env.DEMO_DATABASE_HOST ||
    !env.DEMO_DATABASE_NAME ||
    url.hostname !== env.DEMO_DATABASE_HOST ||
    decodeURIComponent(url.pathname.slice(1)) !== env.DEMO_DATABASE_NAME ||
    !env.DEMO_DATABASE_NAME.startsWith("flowdesk_demo")
  )
    throw new Error(
      "Demo database must match the explicit demo host/name allowlist",
    );
  if (
    /(REPLACE|ACTUAL|PLACEHOLDER)/i.test(env.DEMO_DATABASE_HOST) ||
    /(REPLACE|ACTUAL|PLACEHOLDER)/i.test(url.username + " " + url.password)
  )
    throw new Error("Replace the demo target placeholders");
  return url;
}
