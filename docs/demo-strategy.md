# Public demo safeguards

Enabled in the [hosted demo](https://flowdesk-web-8atx.onrender.com/) with APP_MODE=demo. See the [deployment report](phase-5-deployment-report.md) and [Render Free + Neon Free runbook](deployment.md). Standard local development retains normal registration and administration behavior. Production demo startup requires an explicitly allowlisted dedicated Neon TLS target.

## Access and mutations

Only predefined fictional Admin (admin@flowdesk.example), Manager (manager@flowdesk.example) and Member (member@flowdesk.example) accounts may sign in. Passwords are privately provisioned for approved reviewers, never published in source/UI/screenshots. Admin is a restricted application demo role; it grants no hosting/database account access. No public admin or reset credential exists.

Backend denies registration, new workspaces, organization/member administration and deletion. Existing RBAC permits Managers ordinary client/project/task edits and Members assigned-task status changes. Origin, session and tenant checks remain required. UI suppresses registration/workspace creation/deletion and explains shared data/cold starts. Visitors cannot provision accounts/tenants.

## Bounds

| Resource                               | Demo limit                                             |
| -------------------------------------- | ------------------------------------------------------ |
| Workspaces / fictional users           | 1 / 3 (all may log in)                                 |
| Clients / projects / tasks             | 5 / 5 / 40                                             |
| Successful business mutations          | 20 shared per hour                                     |
| Active sessions                        | 3 per account; oldest revoked on excess login          |
| Session rows including replay evidence | 100 globally; refuse issuance/rotation at capacity     |
| Session absolute lifetime              | 12 hours, not extended by rotation                     |
| Audit history                          | newest 200, seven days on next successful write        |
| Auth throttle                          | shared PostgreSQL 30/minute per login/refresh endpoint |
| Per-process admission                  | 120/minute, 8 active requests, 2 password checks       |
| JSON request                           | 20 KiB at proxy and API                                |

Counts and mutation budgets run under the same transaction advisory lock and organization lock as business writes. Rejected writes roll budget back. Reset uses the same lock; a second session check inside each workspace transaction prevents pre-reset requests from writing afterward. Login issuance rechecks the verified password hash under lock to reject old credentials after rotation/reset. Expired sessions are deleted; unexpired revoked rows remain for replay detection until expiry. Shared reviewers can exhaust one another's limits.

## Maintenance and retention

Owner-only `pnpm demo:provision` / `pnpm demo:reset` require a dedicated target allowlist and explicit marker confirmation. No HTTP maintenance interface exists. Provisioning refuses nonempty unrecognized data; repeat provisioning preserves fixtures. Reset refuses missing/wrong markers or unrelated users/organizations, invalidates sessions, rotates all three private passwords, replaces only fictional fixtures and increments generation transactionally. Tests use only the guarded local database.

Cleanup runs with writes/authentication and owner maintenance, without background services or polling. Idle expired records can persist until activity, with bounded growth. Physical storage still needs manual monitoring for indexes, MVCC dead tuples and provider history. Use fictional information only and reset before/after review windows. No hosted backup/recovery guarantee is claimed.

## Validation boundary

Local PostgreSQL negative tests cover proxy-only admission, closed registration, role/admin restrictions, quota races, successful-write budgets, sessions, stale requests after reset, retention and maintenance target protection. Proxy tests cover server-only credential injection, separate cookie forwarding, Origin/path/body denials and safe cold-start errors. The [hosted verification report](phase-5-deployment-report.md) distinguishes checks performed in production from local coverage.
