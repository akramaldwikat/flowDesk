import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnvironment } from "../src/config";
const environment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://example.invalid/demo",
  JWT_SECRET: "test-only-production-configuration-value-not-a-real-secret",
  WEB_ORIGIN: "https://flowdesk.example",
};
test("production config: rejects noncanonical origins and requires HTTPS", () => {
  for (const WEB_ORIGIN of [
    "https://flowdesk.example/path",
    "https://flowdesk.example/",
    "https://user:password@flowdesk.example",
    "https://flowdesk.example?x=1",
    "https://flowdesk.example#x",
    "ftp://flowdesk.example",
    "http://flowdesk.example",
  ])
    assert.throws(() => parseEnvironment({ ...environment, WEB_ORIGIN }));
  assert.equal(
    parseEnvironment(environment).WEB_ORIGIN,
    "https://flowdesk.example",
  );
});
test("production config: local bind remains default and explicit private-service bind is supported", () => {
  assert.equal(parseEnvironment(environment).API_BIND_HOST, "127.0.0.1");
  assert.equal(
    parseEnvironment({
      ...environment,
      API_BIND_HOST: "0.0.0.0",
      API_PORT: "10000",
    }).API_PORT,
    10000,
  );
  assert.throws(() =>
    parseEnvironment({ ...environment, API_BIND_HOST: "untrusted.invalid" }),
  );
});
test("production config: invalid settings fail without exposing submitted secrets", () => {
  assert.throws(() =>
    parseEnvironment({
      ...environment,
      JWT_SECRET: "REPLACE_WITH_A_NEW_RANDOM_SECRET_AT_LEAST_48_BYTES",
    }),
  );
  const secret = "private-test-value";
  assert.throws(
    () =>
      parseEnvironment({
        ...environment,
        WEB_ORIGIN: "invalid-origin-" + secret,
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes("WEB_ORIGIN") &&
      !error.message.includes(secret),
  );
  assert.throws(
    () =>
      parseEnvironment({
        ...environment,
        JWT_SECRET: secret,
        API_PORT: "invalid",
      }),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes("JWT_SECRET") &&
      !error.message.includes(secret),
  );
});
