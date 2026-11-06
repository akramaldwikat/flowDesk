# Architecture and implementation plan

FlowDesk is an Independent Demo Project, built from original source and fictional data. The sibling portfolio is outside scope.

## Boundaries

pnpm workspaces: `apps/web` (Next.js App Router), `apps/api` (NestJS modular API), `packages/database` (Prisma/PostgreSQL), `packages/contracts` (Zod requests, response types, capabilities). No Turborepo, Redis, storage or message broker is needed. Next proxies `/api` to Nest so browser cookies stay same-origin. Local PostgreSQL runs in a dedicated Compose project on loopback port 55434; local web uses 3100 and API 4100. The approved future $0 demo uses two Render Free Web Services and Neon Free PostgreSQL; see [deployment](deployment.md). The explicit Next Route Handler authenticates to the public API using a server-only secret. No business/session data depends on the Render filesystem.

## Invariants decided before implementation

- Every business resource is organization-scoped. Composite foreign keys enforce same-organization relationships.
- Membership is the role boundary. A role is never global to a user.
- Tenant operations run in transactions that lock the organization, recheck active membership and evaluate central capabilities. Membership changes and business mutations share this lock to prevent authorization races.
- Passwords use Argon2id. Access JWTs expire after ten minutes; opaque refresh secrets are hashed, rotated and revocable. Tokens live in HttpOnly cookies, never web storage.
- All meaningful mutations and their safe audit events commit together.
- Tasks use integer versions; stale updates fail instead of silently replacing a newer change.
- Membership revocation retains history and unassigns current tasks. The last active Admin cannot be demoted or removed.
- Deleting a referenced client fails with a useful conflict; projects have an archive lifecycle. Archived/completed projects do not accept task mutations until reopened.

## Milestones

M0 workspace/infrastructure → M1 relational model/migration → M2 auth/onboarding → M3 capability and tenant boundary tests → M4 clients → M5 projects → M6 tasks/assignment → M7 accessible task board → M8 dashboard/activity → M9 private local seed and end-to-end QA.

Each milestone uses relevant checks. Final gate: formatting, lint, typecheck, tests against an isolated PostgreSQL database, migrations, builds, audit and a real-browser workflow. Source was published in Phase 4 Part B. Phase 5 Part B authorizes publication of the reviewed hardening and deployment to Render Free plus Neon Free. Actual deployment status is reported separately; portfolio changes remain outside scope.
