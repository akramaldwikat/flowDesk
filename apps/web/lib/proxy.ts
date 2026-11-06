// Server-only helper: never import from a client component.
export async function proxy(
  request: Request,
  segments: string[],
  env: Record<string, string | undefined> = process.env,
  send: typeof fetch = fetch,
) {
  const fail = (status: number, message: string) =>
    Response.json(
      { error: { message } },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!segments.length || segments.some((p) => !/^[a-zA-Z0-9-]+$/.test(p)))
    return fail(400, "Invalid API path.");
  const origin = env.API_INTERNAL_URL || "http://127.0.0.1:4100";
  let target: URL;
  try {
    target = new URL(origin);
    if (
      target.origin !== origin ||
      !["http:", "https:"].includes(target.protocol)
    )
      throw new Error();
  } catch {
    return fail(503, "API configuration is unavailable.");
  }
  if (
    env.APP_MODE === "demo" &&
    ((target.protocol !== "https:" &&
      !(
        env.NODE_ENV === "development" &&
        ["127.0.0.1", "localhost"].includes(target.hostname)
      )) ||
      !env.PROXY_SECRET ||
      env.PROXY_SECRET.length < 32)
  )
    return fail(503, "Demo configuration is unavailable.");
  if (
    !["GET", "HEAD"].includes(request.method) &&
    (request.headers.get("origin") !== env.WEB_ORIGIN ||
      request.headers.get("x-flowdesk-request") !== "1")
  )
    return fail(403, "Request origin is not permitted.");
  const headers = new Headers();
  for (const name of [
    "cookie",
    "content-type",
    "origin",
    "x-flowdesk-request",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (env.PROXY_SECRET) headers.set("x-flowdesk-proxy", env.PROXY_SECRET);
  let body: Uint8Array | undefined;
  if (!["GET", "HEAD"].includes(request.method) && request.body) {
    const reader = request.body.getReader(),
      chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 20480) {
        await reader.cancel();
        return fail(413, "The request exceeds the allowed size.");
      }
      chunks.push(value);
    }
    body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }
  }
  try {
    const upstream = await send(
      `${origin}/api/${segments.join("/")}${new URL(request.url).search}`,
      {
        method: request.method,
        headers,
        body: body as BodyInit | undefined,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(110000),
      },
    );
    if (!upstream.headers.get("content-type")?.includes("application/json"))
      return fail(
        503,
        "The demo may be waking up. Please wait a minute and try again.",
      );
    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append("Set-Cookie", cookie);
    const id = upstream.headers.get("x-request-id");
    if (id) responseHeaders.set("x-request-id", id);
    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return fail(
      503,
      "The demo may be waking up. Please wait a minute and try again.",
    );
  }
}
