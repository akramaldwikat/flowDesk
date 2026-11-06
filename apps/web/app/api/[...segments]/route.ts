import { proxy } from "../../../lib/proxy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<{ segments: string[] }> },
) {
  return proxy(request, (await context.params).segments);
}
export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
  handler as HEAD,
};
