# Demo strategy and exposure review

**Design only. No public demo is enabled or deployed.** Current production mode does not disable registration or business writes. Launch controls below remain unimplemented.

| Option                                                 | Benefit                                                             | Risk / complexity                                                                                                           | Recommendation                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A: shared public read/write accounts + automatic reset | Instant hands-on access                                             | Credential harvesting, interference and destruction; hard quotas plus reliable unattended reset needed                      | Reject for first release. A scheduled reset alone does not bound growth. |
| B: predefined accounts + restricted destruction        | Guided role comparison                                              | Still needs server restrictions, quotas, retention and contention management; published passwords attract distributed abuse | Possible later.                                                          |
| C: private review credentials                          | Known small audience; no password on GitHub/portfolio; manual reset | Access is not instant; forwarded credentials still require technical limits                                                 | **Choose for initial portfolio demo.**                                   |

## Recommended access and limits

Use short-lived reviewer access, separate fictional workspace per reviewer and at most **three active review workspaces**. Offer Manager/Member review; retain Admin privately. Credentials must be generated separately from local secrets and delivered privately, never in source, images, URLs or public issues. None are created/distributed in Part A.

Start with **read-only review access** and the validated workflow evidence. If write access is later approved, allow ordinary business changes only inside the reviewer's workspace; block registration, organization creation and membership/role changes for demo accounts. Enforce read-only/allowlist in the API and reflect it in the UI. Hiding buttons is insufficient. These controls are **not implemented yet**.

Proposed hard limits: 5 clients, 5 projects and 40 tasks per review workspace; 5 active sessions/account; 10 refresh rotations/minute/account; global ceilings alongside tenant ceilings. Enforce counts transactionally under concurrent requests. These are proposed operating limits, not measured capacity. No public reset endpoint. Add account/global login budgets because IP-only throttling does not stop distributed abuse.

## Required before hosted access

| Boundary                | Existing control                                                | Launch gap                                                                                               |
| ----------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Registration/accounts   | Strict validation and IP throttle                               | Disable direct POST register; replace registration entry; provision approved accounts only               |
| Organization/membership | RBAC, last Admin, revocation                                    | Block demo organization creation/admin mutations; separate owner recovery                                |
| Creation/destruction    | RBAC, lifecycle rules, task versions                            | Read-only/allowlist, transaction-safe tenant/global quotas, useful limit errors                          |
| Auth abuse              | PostgreSQL IP/path fixed-window limit                           | Account/global login/refresh budgets, session cap, reviewer expiry, verified ingress IP handling         |
| Database growth         | Pagination and payload limits                                   | Hard record bounds, session/audit retention, storage alerts; reset disposable data around review windows |
| Session storage         | Rotation/replay revocation, absolute expiry                     | Prune retired families only after absolute expiry; do not remove replay evidence early                   |
| HTTPS/session delivery  | HttpOnly, production Secure prefixes and paths                  | Validate actual HTTPS cookie behavior and session revocation behind host proxy                           |
| CSRF/CORS               | Exact Origin and custom header, narrow CORS                     | Verify preservation through rewrite and denials on both custom/default hostnames                         |
| Enumeration             | Membership-scoped not-found responses and composite constraints | Re-run negative tests through deployed public path; UUID secrecy is not authority                        |
| Network/proxy           | Loopback defaults; explicit bind supported                      | Private API/DB; verify chain before trusting forwarded IP headers                                        |
| Request budgets         | 20 KiB JSON limit and field limits                              | Match upstream time/body/request/concurrency budgets                                                     |
| Health/recovery         | Process liveness and startup DB connect                         | DB-backed readiness, reset/restore rehearsal, redacted failure alerts                                    |
| Privacy                 | Fictional seed, no uploads/integrations                         | Fictional-only notice; no reviewer personal records; never log cookies or secrets                        |

The existing 37 tests do not validate these unimplemented policies. Add disabled-register, demo-admin-denial, quota race, session-cap, expired-reviewer and wrong-target-reset tests. No security certification is claimed.

## Provisioning/reset design

Use a **separate disposable managed demo database**, never development/test/portfolio or real operational data. Give the runtime only needed business privileges; keep release/migration and maintenance identities separate in provider secret storage.

Keep the current seed's production refusal. After strategy approval, build a separate maintenance command requiring an explicit demo marker, allowlisted database name/host, explicit workspace IDs, maintenance lock and deliberate confirmation flag. Reject unknown targets; do not infer a target from arbitrary DATABASE_URL. Revoke demo sessions, delete scoped events/tasks/projects/clients/memberships in dependency order and reseed atomically from versioned fictional fixtures. Preserve other tenants. Never log passwords/connection strings. Test wrong-target refusal and rollback first.

Begin with **manual reset before and after each review window**. Close access during reset and fail closed if maintenance fails. Delete expired reviewer accounts when finished. If unattended access later needs nightly resets, use one provider-scheduled command; no Redis/BullMQ. Hard quotas bound growth; resets restore a useful starting state. Session/audit retention is also required before claiming storage is bounded.
