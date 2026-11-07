# PHASE 5 — Render Free + Neon Free runbook

**Phase 5 Part B is restricted to Free resources.** The verified URLs, deployed revision, provider settings, and QA results are in the [hosted verification report](phase-5-deployment-report.md). This runbook documents how to deploy and maintain the demo within a **$0/month** configuration.

## Architecture decision

```text
GitHub: akramaldwikat/flowDesk, main
  ├─ Render Free Web Service: flowdesk-web (Next.js)
  └─ Render Free Web Service: flowdesk-api (NestJS)

Browser ─HTTPS→ Next.js /api proxy ─HTTPS→ NestJS ─TLS→ Neon Free PostgreSQL
```

Both services use https://github.com/akramaldwikat/flowDesk. Requested service names do not guarantee assigned hostnames. Record the actual provider-generated HTTPS origins after creation. No custom domain, VPS, Render database, disk, worker, scheduler, Redis, BullMQ or other service is required.

**Choose A: preserve same-origin browser behavior.** A Next.js Route Handler replaces the transparent rewrite so it can authenticate server calls. Browser requests use only `/api` on the web origin. The proxy forwards Cookie, Content-Type, Origin and X-FlowDesk-Request and overwrites X-FlowDesk-Proxy with a private shared PROXY_SECRET. It omits client forwarding/host headers, validates path segments and the fixed target origin, and refuses redirects. Separate Set-Cookie headers return unchanged: host-only Secure/HttpOnly/SameSite=Lax cookies belong to the web hostname, including refresh Path=/api/auth. Tokens never enter web storage.

The public API rejects calls without that secret before parsing/DB access, except GET /api/health. Unsafe methods additionally require exact WEB_ORIGIN and X-FlowDesk-Request: 1 at both servers. Nest CORS allows only WEB_ORIGIN with credentials; ordinary browser calls remain same-origin. Direct browser-to-API calls would complicate cross-site cookies and CORS. TRUST_PROXY=false avoids trusting arbitrary forwarded IPs; shared budgets do not depend on client-IP accuracy. The proxy secret supplements existing session, role and tenant checks. Never put it in NEXT_PUBLIC_ variables, client components or logs.

## Exact Render settings

Both services: **Web Service**, native **Node**, **Free** instance, branch **main**, repository above, **Root Directory blank**, auto-deploy **Off**, no disk, no autoscaling. Shared packages require the repository root ([monorepo behavior](https://render.com/docs/monorepo-support)). `.node-version` pins Node 24.21.0; pnpm is 12.18.0. Use the same reviewed Git revision for both services. Do not use Docker Compose in production.

### Web

Name: `flowdesk-web`. Build Command (one line):

```sh
npm exec --yes --package=pnpm@12.18.0 -- pnpm install --frozen-lockfile --prod=false && npm exec --yes --package=pnpm@12.18.0 -- pnpm build:web
```

Start Command:

```sh
node scripts/start-render-web.mjs
```

Health Check Path: `/login` (page rendering, no DB access). The wrapper binds 0.0.0.0 on Render's PORT, default 10000. The web build requires no database secret.

### API

Name: `flowdesk-api`. Build Command (one line):

```sh
npm exec --yes --package=pnpm@12.18.0 -- pnpm install --frozen-lockfile --prod=false && npm exec --yes --package=pnpm@12.18.0 -- pnpm build:api
```

Start Command:

```sh
node scripts/start-render-api.mjs
```

Health Check Path: `/api/health` (process liveness, no DB query). Wrapper validates demo configuration, runs migrations, then starts Nest on 0.0.0.0 and Render's PORT. Failure stops startup with a generic message; CLI output is captured rather than exposing connection strings. No seed/reset runs on start or cold wake.

Prisma generation, included in build:api:

```sh
pnpm db:generate
```

Migration command:

```sh
pnpm --filter @flowdesk/database exec prisma migrate deploy
```

Startup executes the equivalent CLI through Node. Do not configure a pre-deploy command: it is unavailable on Free web services ([deploy lifecycle](https://render.com/docs/deploys#pre-deploy-command)). Keep dev dependencies installed because startup needs the migration CLI. Routine deployment uses no interactive shell steps.

## Environment matrix

Enter values privately in each service's provider settings. `.env.production.example` is reference only; do not upload a populated file. Origins below mean the actual assigned HTTPS origins, without trailing slash/path/query/credentials.

| Variable           | Web      | API         | Value                                                                      |
| ------------------ | -------- | ----------- | -------------------------------------------------------------------------- |
| NODE_ENV           | yes      | yes         | production                                                                 |
| APP_MODE           | yes      | yes         | demo                                                                       |
| WEB_ORIGIN         | yes      | yes         | https://ACTUAL_WEB_HOST.onrender.com                                       |
| API_INTERNAL_URL   | yes      | no          | https://ACTUAL_API_HOST.onrender.com; historical name, public HTTPS target |
| PROXY_SECRET       | secret   | same secret | new independent random 48-byte base64url value                             |
| DATABASE_URL       | **no**   | secret      | direct Neon TLS URL below                                                  |
| JWT_SECRET         | **no**   | secret      | different new random 48-byte base64url value                               |
| TRUST_PROXY        | no       | yes         | false                                                                      |
| DEMO_DATABASE_HOST | no       | yes         | exact direct Neon hostname; safety assertion                               |
| DEMO_DATABASE_NAME | no       | yes         | flowdesk_demo, or name starting flowdesk_demo; safety assertion            |
| PORT               | provider | provider    | supplied by Render                                                         |

API wrapper sets API_BIND_HOST/API_PORT. Do not reuse development secrets, TEST_DATABASE_URL or local DEMO_PASSWORD. Maintenance passwords never belong in runtime environment. No secret is sent to reviewers except their privately supplied fictional account password.

## Neon and Prisma

Use one dedicated disposable **Neon Free** project, one branch and database `flowdesk_demo`. Choose a region near Render, minimum Free compute and idle suspension. PostgreSQL holds all business data, sessions, throttles and quotas. DATABASE_URL is the only connection source:

```text
postgresql://ROLE:URL_ENCODED_PASSWORD@ACTUAL_DIRECT_HOST.neon.tech/flowdesk_demo?sslmode=verify-full
```

Choose the **direct** connection (pooling disabled in Neon's connection dialog). Preserve generated credentials/host; percent-encode password reserved characters. Set sslmode=verify-full. Production demo rejects localhost/Docker, non-Neon, `-pooler` and non-verified-TLS URLs. Host/name assertions must exactly match the URL.

Prisma 7.10.1 uses existing @prisma/adapter-pg and node-postgres over standard PostgreSQL TCP. Schema provider stays postgresql; Prisma config reads DATABASE_URL for migrations. No Neon-specific adapter/package is required. Node 24 meets [Neon's Prisma requirements](https://neon.com/docs/guides/prisma). Neon generally recommends pooled runtime/direct migration URLs; this small single-instance demo deliberately uses **one direct URL for both**, with **max 3 runtime connections**, avoiding a second URL and transaction-pool/advisory-lock concerns. Owner maintenance uses one connection. Allow headroom for deploy/migration overlap and console access; do not increase API instances/pool size without review.

Pool idle timeout is 10 seconds; connection acquisition timeout is 60 seconds for wake-up. Workspace transactions wait up to 10 seconds and execute up to 15 seconds; maintenance allows 60 seconds. TLS certificates are verified; never disable verification or combine conflicting SSL options ([node-postgres SSL](https://node-postgres.com/features/ssl)). Actual future Neon endpoint/TLS must still be verified after approval.

## Approved deployment procedure

1. Publish the reviewed Phase 5 revision to the existing repository after the local quality gate. The current published operational core predates these hardening changes; do not deploy that old revision.
2. Verify Render workspace and Neon organization are Free with no paid add-ons/fallback. Remain without a charge-enabled payment method, and set spending controls to zero where available. If a card or chargeable setting becomes mandatory, stop for review. Do not authorize spending.
3. Create only the dedicated Neon Free project/database above. Obtain the direct URL privately. Record its exact host/name allowlist; never point maintenance at a database containing real or unrelated data.
4. Prepare the two Render services with the settings above. Creation may trigger an initial deployment, so do not begin creation before approval. If final hostnames are known only after creation, allow an initial fail-closed configuration failure; record the assigned origins, update matching WEB_ORIGIN/API_INTERNAL_URL, and redeploy. Do not guess hostnames.
5. Deploy API first with full configuration. Startup applies checked-in SQL migrations in order under Prisma locking; it creates no users. Confirm liveness. Deploy web at the same revision with final origins. Never run migrate dev, db push, migrate reset or local seed against Neon.
6. On the owner's trusted checkout at that revision, load production DATABASE_URL, NODE_ENV=production, APP_MODE=demo and DEMO_DATABASE_HOST/NAME privately into process environment. Add distinct new DEMO_ADMIN_PASSWORD, DEMO_MANAGER_PASSWORD and DEMO_MEMBER_PASSWORD (16–128 characters each). Run the noninteractive command:

   ```sh
   pnpm demo:provision
   ```

   First provisioning requires an empty dedicated database. It creates one fictional workspace, restricted fictional Admin, Manager and Member, three clients/projects and twelve tasks. Repeat provisioning preserves data. Admin uses a distinct private demo password and remains blocked from workspace/team administration and deletion. This phase creates no hosted credentials.

7. Validate via the actual web HTTPS origin: private Manager login, workspace reads, a fictional task mutation and logout. Check separate Secure/HttpOnly cookies/paths, rotation, replay/logout invalidation, Member limits, registration/admin/deletion denials, wrong Origin and direct API denials. Manually request `/api/ready` through the server proxy once; never use it as a periodic monitor. Do not put secrets in URLs or console scripts.
8. Test actual Render idle/cold start plus Neon wake. Provider HTML/timeouts must give a safe manual retry message. No automatic mutation replay on network failures. Re-run security denials through hosted ingress. Local tests cannot prove hosted cookies/TLS/wake behavior.
9. Record the verified assigned web URL. Only after launch approval may the portfolio link to it temporarily. No portfolio modification is included here.

Schema changes must stay compatible during deploy overlap. Current DemoControl migration is additive. Inspect failures privately and use forward SQL corrections; never treat destructive fixture reset as schema recovery or auto-downgrade schemas. Keep demo access closed while resolving failures.

## Protected maintenance and retention

No HTTP reset endpoint/public reset secret exists. Owner-only reset uses the same explicit target and new private Admin/Manager/Member passwords:

```sh
pnpm demo:reset
```

Root scripts supply `--confirm=flowdesk-demo-v1`. Maintenance verifies Neon allowlist, marker and absence of unrelated users/organizations, takes the same transaction advisory lock as demo auth/writes, invalidates all demo sessions, rotates passwords, replaces only marked fictional fixtures and increments generation. Wrong target/missing marker/unrelated data causes refusal. It never TRUNCATEs Neon. Local test exception is only NODE_ENV=test with 127.0.0.1:55434/flowdesk_test.

Reset is owner-run before review windows/at limits, not a scheduled worker. Audit pruning on successful writes retains newest 200 and seven days; auth activity removes expired session/throttle rows. Idle expired rows remain until activity/reset but their bounds prevent unbounded idle growth. Physical storage also includes indexes, dead tuples and history; row limits cannot guarantee an exact byte cap. Inspect storage manually and reset well before quota exhaustion, leaving space for cleanup. No production backup/recovery guarantee is claimed.

## Free-tier operation

Render Free sleeps after 15 idle minutes; wake-up can take about a minute. Filesystem is ephemeral. **750 instance-hours/month are shared across Free services in the workspace**: both cannot be continuously active all month. Exhaustion suspends service. Bandwidth/build allowances and external-traffic limits also apply; charge-enabled overages can bill. Keep no charge-enabled payment method, auto-deploy off, zero spending controls where available, and accept suspension instead of paid fallback. No uptime pings. ([Render limits](https://render.com/docs/free))

Neon Free currently includes **100 CU-hours/project/month, 1 GB/project storage and 5 GB/project transfer**, with five-minute idle suspension. Compute/transfer exhaustion can suspend access; storage exhaustion blocks growth. Keep the project Free with no upgrades/add-ons. Verify live allowances before creation. ([Neon Free plan](https://neon.com/docs/introduction/plans))

App measures: 3 DB connections, 8 in-flight API requests, 2 concurrent password checks, 120 proxy-authenticated requests/minute/process, PostgreSQL login/refresh throttle 30/minute/endpoint, 20 successful writes/hour, no polling, bounded pagination/JSON bodies, 110-second upstream and 120-second browser timeout. Wake-up may exceed those timeouts; show manual retry guidance. Shared reviewers can affect one another's fictional data and sessions. These controls do not guarantee immunity to provider-edge abuse or uninterrupted availability.

## Deployment record

Record actual provider settings and QA results in the [hosted verification report](phase-5-deployment-report.md). Keep the portfolio outside this deployment phase.
