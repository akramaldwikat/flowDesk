# FlowDesk — Phase 3 completion report

Validated locally on **6–7 November 2026 (Asia/Amman)**. **Independent Demo Project**. All sample organizations, people and records are fictional.

## 1. Executive status

**READY FOR PORTFOLIO REVIEW.** The operational core works end to end with PostgreSQL persistence, authentication, capability-based authorization and organization isolation. M0–M9 are implemented. This means ready to review the independent project and its evidence; it does not authorize deployment, publication or changing the portfolio.

Project: `flowdesk/`, separate from the sibling `portfolio`. SHA-256 comparison of all **54** original portfolio source/documentation files found **0 changes, 0 additions and 0 missing files**; generated build/dependency files were excluded from both comparisons.

## 2. Exact stack and versions

| Component                                | Validated version                |
| ---------------------------------------- | -------------------------------- |
| Node.js                                  | 24.21.0                          |
| pnpm project package manager             | 12.18.0                          |
| Next.js / React / React DOM              | 16.4.5 / 19.3.1 / 19.3.1         |
| NestJS common/core/platform-express      | 12.4.0                           |
| NestJS JWT                               | 12.0.4                           |
| Express                                  | 5.3.0, direct runtime dependency |
| TypeScript                               | 5.9.3                            |
| Tailwind / PostCSS plugin                | 4.3.4                            |
| Prisma CLI / client / PostgreSQL adapter | 7.10.1                           |
| PostgreSQL                               | 18.6, `postgres:18-alpine` image |
| PostgreSQL Node driver                   | 8.23.1                           |
| Zod                                      | 4.6.7                            |
| Argon2 implementation                    | @node-rs/argon2 2.2.2            |
| Helmet / cookie-parser                   | 8.3.0 / 1.4.7                    |
| Supertest / tsx                          | 7.3.1 / 4.23.15                  |
| ESLint / typescript-eslint / Prettier    | 9.39.5 / 8.72.1 / 3.9.10         |
| Lucide / Manrope variable font           | 0.577.0 / 5.3.0                  |
| Docker engine                            | 29.8.0                           |

Versions are locked in `pnpm-lock.yaml`. ESLint 9 is intentionally retained for compatibility with the Next lint plugins' declared peer ranges; its deprecation is a tooling maintenance item, not a vulnerability reported by the final audit.

## 3. Repository architecture

`apps/web`: App Router page entry, client workspace views, auth/onboarding, native dialogs, responsive shell and API client. `apps/api`: Nest controllers, auth guard/service, tenant operations, configuration and safe errors. `packages/contracts`: strict Zod schemas, capability policy and response types. `packages/database`: Prisma model, SQL migrations, PostgreSQL adapter and private local seed. `docs`: architecture, domain, permissions, authentication, isolation, testing, deployment strategy, API and this report. `scripts`: private local setup.

The browser reaches Nest through the Next `/api` rewrite. PostgreSQL supplies persistent business data, sessions and auth throttle counters. No decorative infrastructure or external integrations were added.

## 4. Domain model

User, Organization, Membership, Client, Project, Task, RefreshSession, AuditEvent and AuthThrottle. Membership carries a role within one organization. Client → Project → Task relationships and task creator/assignee links use composite organization foreign keys. Tasks carry an integer version. Indexes cover memberships, organization lists, project/task relationships, status/dates, sessions and activity.

Revoked memberships remain for historical references. Referenced clients cannot be deleted. Projects use Active, Completed and Archived. Completing a project requires all its tasks Done; closed projects must be reopened before task mutations.

## 5. Authentication design

Argon2id, 64 MiB memory, three iterations and one lane. Ten-minute HS256 access JWTs verify issuer/audience/algorithm and an active backing session. Refresh secrets contain 256 random bits; only hashes are stored. Rotation, family replay revocation, current logout and logout-all serialize under a per-user PostgreSQL advisory transaction lock. Refresh expiry remains absolute at seven days.

Cookies are HttpOnly and SameSite=Lax, with production Secure flags and prefixed names. Refresh cookies are limited to `/api/auth`. No authentication tokens in JSON, localStorage, audit records or logs. The UI coalesces refresh requests within a tab and retries a protected request once.

## 6. Authorization design

A central capability map defines Admin, Manager and Member operations; backend policy is authoritative. Admin manages workspace and memberships. Manager manages clients, projects and tasks. Member reads the workspace and changes only tasks assigned to that membership. Activity scope is Admin: all organization events; Manager: business entities; Member: own actions. Last-active-Admin demotion/removal is rejected atomically.

See [the permission matrix](permissions.md). UI controls reflect the same policy, while API tests independently exercise forbidden requests.

## 7. Tenant-isolation design

Each operation locks the organization, reloads the user's current active membership and checks capabilities inside its transaction. All resource queries include organization scope. Composite foreign keys reject cross-organization client/project/task/assignee relationships even when bypassing the API. Strict schemas reject organization spoofing fields. Nonmember organizations and foreign resource IDs return not found without exposing the target record.

Membership changes share the same organization write lock as business mutations. Revocation immediately affects subsequent requests and unassigns tasks. Accepted in-flight requests are not claimed to be cancellable.

## 8. Features implemented

Registration/login/logout/refresh/current user; organization creation and rename; workspace switching; adding existing registered teammates, changing roles and revocation; client CRUD/archive; project creation/detail/edit/archive/completion/reopen; task creation/edit/assignment/delete; four-state status workflow; optimistic concurrency; searchable paginated lists; assigned-to-me and status board filters; actual dashboard totals; atomic audit events; loading/error/empty/confirmation states; private idempotent seed and local setup.

## 9. Pages implemented

Login, registration, organization onboarding, dashboard, clients, client details, projects, project details, task board, members, activity and functional workspace/account settings. Native dialogs support forms and confirmations. The interface uses local fonts, restrained colors, reduced-motion support, visible focus indicators, a skip link and native keyboard-accessible status selectors.

## 10. API endpoints

**32 concrete REST method/path combinations**, including health, six auth operations and organization-scoped workspace/business resources. [API reference](api.md) documents methods, bodies, pagination, statuses and error shape. Task mutations require the current version; GET endpoints do not mutate business state. Unsafe methods require exact trusted Origin and the custom request header.

## 11. Database migrations

Two committed migrations: `202611060001_core` creates the relational schema/enums/indexes/composite foreign keys; `202611060002_integrity` adds positive version/throttle and project date-order checks. Both apply to development and the dedicated test database. Final Prisma schema validation passes; migration status is up to date; schema comparison reports **No difference detected**.

## 12. Seed/demo data

Northstar Digital; three fictional role accounts; three clients; three projects; twelve tasks spread across priorities, assignments and all four statuses. Seed audit events identify fictional project creation. `.example` addresses and explicit demo labels prevent a claim of real client work. The seed preserves existing data and refuses production mode.

Passwords are generated privately in ignored local `.env`; there is no default/shared published password and no public demo credential. Browser QA additionally created a separate fictional Cedar QA Studio workspace, three accounts and three tasks. Those local records persist independently of the seed.

## 13. Tests and exact counts

**34 integration tests passed; 0 failed, skipped, cancelled or todo.** Tests run against the real Nest application and guarded PostgreSQL `flowdesk_test` database, deploying committed migrations first.

| Category                                                         | Count  |
| ---------------------------------------------------------------- | ------ |
| Authentication                                                   | 3      |
| Origin/header, auth throttle and malformed/oversized requests    | 3      |
| Organization onboarding                                          | 1      |
| Cross-tenant lists, individual resources and writes              | 10     |
| Foreign references                                               | 2      |
| Independent database composite constraints                       | 1      |
| Member/Manager capability denials                                | 2      |
| Last Admin                                                       | 1      |
| Client CRUD/reference protection                                 | 1      |
| Project dates/archive lifecycle                                  | 1      |
| Assigned workflow, stale concurrent updates, task edit/delete    | 3      |
| Membership revocation/unassignment                               | 1      |
| Real dashboard/audit scope                                       | 1      |
| Identifier/query/pagination validation                           | 1      |
| Rotation/replay, expiry/revocation/logout-all, malformed refresh | 3      |
| **Total**                                                        | **34** |

Browser checks below are separately observed manual UI scenarios, not added to the automated count. Typechecking also includes the integration-test source.

## 14. Security checks

Validated backend authorization denials, foreign references, composite constraints, session expiry/revocation, refresh replay, task conflicts, last-Admin protection, CSRF-related Origin/header rejection, sensitive-auth throttling, malformed JSON and payload size errors. Safe errors include request IDs and omit stacks/database internals. Helmet/API no-store and web frame/nosniff protections were observed over HTTP. Production cookie behavior is implemented; browser QA used local development cookies, not a production HTTPS environment.

Candidate source/documentation scan found **0 matches for the generated local database password, JWT secret or demo password**. `.env`, private logs/audit output, node_modules, compiled output and `.next` are ignored by Git. This focused scan is not a security certification or substitute for an independent assessment.

## 15. Browser walkthrough results

| Real-browser scenario                                                    | Result                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Register → onboarding → create organization → Admin dashboard            | Passed                                                       |
| Create client → persisted details → connected project                    | Passed                                                       |
| Create multiple tasks → assignment → To do → In progress → Review → Done | Passed                                                       |
| Review audit actor/action/task details                                   | Passed                                                       |
| Admin adds existing accounts as Manager and Member                       | Passed                                                       |
| Attempt to demote last Admin                                             | Rejected with useful error; role preserved                   |
| Manager creates/assigns tasks; membership controls unavailable           | Passed                                                       |
| Member updates assigned task; unrelated task remains view only           | Passed                                                       |
| Member creation/edit controls unavailable; own activity only             | Passed                                                       |
| Complete status change using keyboard                                    | Passed                                                       |
| Reload preserves task state and session                                  | Passed                                                       |
| Mobile 390×844, tablet 768×1024, desktop 1440×900                        | Passed; 1/2/4 board columns, no document horizontal overflow |
| Mobile navigation and return to normal viewport                          | Passed                                                       |

Captured browser error logs were empty at final observation. Direct unauthorized API operations are covered by integration tests rather than relying on hidden UI controls. Original Phase 3 QA captures remain local and are excluded from publication. Current public-safe captures are listed in [the screenshot inventory](screenshots/README.md). Browser QA used the development server. Separate built-server smoke checks follow.

## 16. Build results

Formatting, lint with zero warnings, full typecheck and production builds pass. Contracts/database/API compile with TypeScript; Next production build completes and emits the App Router workspace entry, icon and not-found route.

Compiled Nest startup and Next production-server HTTP smoke pass: login HTML **200**, proxied health **200**, anonymous current-user **401**, foreign-Origin login **403**, web `X-Frame-Options: DENY`, `nosniff`, API `Cache-Control: no-store`. The smoke check caught and resolved a missing direct Express runtime declaration. Local compiled-API smoke used development environment settings; no HTTPS production deployment was attempted. Owned web/API preview processes were stopped after verification; the dedicated PostgreSQL container and volume are retained.

## 17. Dependency audit

Final `pnpm audit`: **0 known vulnerabilities** across severities. `pnpm peers check`: **no peer dependency issues**. A targeted minimatch override protects the TypeScript lint toolchain dependency. No unreviewed dotenv agent skill was approved or installed. The dependency lockfile remains local.

## 18. Git status

Independent local Git repository initialized. Source files remain untracked for review; no commits, staging, configured remotes, pushes, remote repository creation, publishing or deployment. Secrets and generated artifacts are ignored. The sibling portfolio is unchanged by the source hash comparison.

## 19. Known limitations

- No password recovery, verification email, MFA, email invitations or public-demo lifecycle. Registration must remain private until those access/abuse decisions are reviewed.
- All active roles read workspace business data; no private projects. Activity intentionally varies by role.
- The board is paginated (40 tasks); column counts reflect the current page. Reference selectors load all workspace choices and suit a small team.
- Reads/writes coordinate through organization locks. This favors correctness and understandable authorization over high write throughput; no performance/scale claims are made.
- Concurrent refresh from separate tabs may trigger strict replay protection and require signing in again; coalescing is within one tab.
- Audit and retired session retention/cleanup, backup/restore, monitoring, operational alerts and load testing are future operational work.
- ESLint 9 is deprecated upstream but remains the compatible peer range for the installed Next lint plugins. Review a coordinated toolchain upgrade when those plugins support the next major.
- No automated browser suite, screen-reader audit, cross-browser matrix or production HTTPS security assessment is claimed. Browser evidence comes from the connected browser and listed widths.
- No billing, payments, AI, storage, automation, notifications, real-time collaboration or native mobile app.

## 20. Remaining issues

**No known unresolved defect in tenant isolation, authorization or the primary operational workflow.** The limitations above are explicit scope/operational constraints, not hidden completed features. Deployment readiness and an independent security review remain future work. Licensing and public-repository publication choices have not been made for the user.

## 21. Recommended next step

Review the local application, code, screenshots and architecture together. After accepting that review, separately authorize any repository publication, public demo deployment, credential strategy or portfolio case-study update. Phase 3 stops here.
