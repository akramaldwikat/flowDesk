import { test } from "node:test";
import assert from "node:assert/strict";
import { proxy } from "../lib/proxy";
const env = {
  APP_MODE: "demo",
  API_INTERNAL_URL: "https://api.example",
  WEB_ORIGIN: "https://web.example",
  PROXY_SECRET: "test-only-proxy-secret-at-least-32-characters",
};
test("proxy authenticates server-side and preserves separate host-only cookies", async () => {
  const request = new Request("https://web.example/api/auth/login", {
    method: "POST",
    headers: {
      origin: env.WEB_ORIGIN,
      "x-flowdesk-request": "1",
      "content-type": "application/json",
      cookie: "fd=value",
      "x-flowdesk-proxy": "attacker",
      "x-forwarded-for": "attacker",
    },
    body: "{}",
  });
  const result = await proxy(
    request,
    ["auth", "login"],
    env,
    async (input, options) => {
      assert.equal(input, "https://api.example/api/auth/login");
      const headers = new Headers(options?.headers);
      assert.equal(headers.get("x-flowdesk-proxy"), env.PROXY_SECRET);
      assert.equal(headers.get("x-forwarded-for"), null);
      assert.equal(headers.get("cookie"), "fd=value");
      assert.equal(options?.redirect, "manual");
      const response = new Response("{}", {
        headers: { "content-type": "application/json" },
      });
      response.headers.append(
        "set-cookie",
        "__Host-fd_access=a; Path=/; Secure; HttpOnly; SameSite=Lax",
      );
      response.headers.append(
        "set-cookie",
        "__Secure-fd_refresh=b; Path=/api/auth; Secure; HttpOnly; SameSite=Lax",
      );
      return response;
    },
  );
  assert.equal(result.status, 200);
  assert.equal(result.headers.getSetCookie().length, 2);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(result.headers.get("x-flowdesk-proxy"), null);
});
test("proxy denies unsafe origins, malformed targets/paths and oversized bodies before forwarding", async () => {
  const send: typeof fetch = async () => {
    throw new Error("Must not forward");
  };
  assert.equal(
    (
      await proxy(
        new Request("https://web.example/api/x", { method: "POST" }),
        ["x"],
        env,
        send,
      )
    ).status,
    403,
  );
  assert.equal(
    (await proxy(new Request("https://web.example/api/x"), [".."], env, send))
      .status,
    400,
  );
  assert.equal(
    (
      await proxy(
        new Request("https://web.example/api/x"),
        ["x"],
        { ...env, API_INTERNAL_URL: "https://api.example/evil" },
        send,
      )
    ).status,
    503,
  );
  const request = new Request("https://web.example/api/x", {
    method: "POST",
    headers: { origin: env.WEB_ORIGIN, "x-flowdesk-request": "1" },
    body: "x".repeat(20481),
  });
  assert.equal((await proxy(request, ["x"], env, send)).status, 413);
});
test("cold-start HTML and network failure become safe retryable errors without leaking internals", async () => {
  for (const send of [
    async () => new Response("<html>provider</html>"),
    async () => {
      throw new Error("secret internal URL");
    },
  ]) {
    const result = await proxy(
      new Request("https://web.example/api/health"),
      ["health"],
      env,
      send,
    );
    assert.equal(result.status, 503);
    assert.match(await result.text(), /waking up/);
  }
});
