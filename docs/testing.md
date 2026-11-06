# Testing strategy

Use Node's test runner and Supertest against the real Nest application with a dedicated `flowdesk_test` PostgreSQL database. Tests must refuse cleanup against any other database name. Use fixtures created by tests; no employer data or real credentials.

Cover registration/login, current user, refresh rotation/reuse, expiry/revocation, onboarding, same-tenant CRUD, cross-tenant reads and writes, capability denials, assigned-member status changes, invalid foreign references, last-Admin protection, optimistic task conflicts, archive rules and transactional audit events. Auth throttle tests use distinct fixture state. Test migration deployment on the empty test database and check schema drift.

Browser QA uses the real running application and original fictional records. Walk registration→organization→client→project→tasks→assignment→status progression→activity, then exercise Manager and Member and direct forbidden requests in integration tests. Inspect mobile/tablet/desktop layouts. Local test passwords are never published in documentation. Record actual counts and limitations in the final QA report.

## Phase 5 local validation

The current suite has **50 tests**: the original 37 scenarios, ten additional PostgreSQL demo/configuration scenarios, and three pure server-proxy tests. Demo fixtures/reset are confined to the guarded local test database; no hosted resource is contacted. New coverage includes project/task/client quotas, concurrent write budgets, closed registration/admin/delete operations, Member status changes, session storage/expiry, reset credential/session races, retention, target/TLS validation and cookie forwarding. Browser checks at desktop and 390px confirm demo notices and that /register presents sign-in with no registration link and no horizontal overflow. No hosted cold-start, Neon TLS or Render HTTPS cookie verification is claimed.
