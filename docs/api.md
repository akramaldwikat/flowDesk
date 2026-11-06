# REST API

Prefix `/api`. Browser uses the same-origin Next proxy. JSON requests use `Content-Type: application/json`. Every mutation requires exact configured `Origin` and `X-FlowDesk-Request: 1`; authentication uses HttpOnly cookies. IDs are UUIDs. Strict Zod schemas reject unexpected fields; contracts are the authoritative request definitions.

| Method             | Path                                   | Behavior                                                    |
| ------------------ | -------------------------------------- | ----------------------------------------------------------- |
| GET                | `/health`                              | Process liveness, independent-demo label                    |
| GET                | `/ready`                               | Manual DB readiness; proxy secret required in demo mode     |
| POST               | `/auth/register`                       | Name/email/password, private session                        |
| POST               | `/auth/login`                          | Email/password, private session                             |
| POST               | `/auth/refresh`                        | Rotate refresh cookie, revoke replayed family               |
| POST               | `/auth/logout`                         | Revoke current refresh family, clear cookies                |
| POST               | `/auth/logout-all`                     | Revoke all user sessions                                    |
| GET                | `/auth/me`                             | Safe current user and active memberships                    |
| GET / POST         | `/organizations`                       | Own memberships / create organization as Admin              |
| GET / PATCH        | `/organizations/:org`                  | Read / rename organization                                  |
| GET                | `/organizations/:org/dashboard`        | Actual counts, own open tasks, visible recent activity      |
| GET / POST         | `/organizations/:org/members`          | Read active members / add existing account                  |
| PATCH / DELETE     | `/organizations/:org/members/:id`      | Change role / revoke and unassign tasks                     |
| GET / POST         | `/organizations/:org/clients`          | Paginated list / create                                     |
| GET / PUT / DELETE | `/organizations/:org/clients/:id`      | Read / replace editable fields / delete unreferenced client |
| GET / POST         | `/organizations/:org/projects`         | Paginated list / create                                     |
| GET / PUT          | `/organizations/:org/projects/:id`     | Read / replace editable fields, lifecycle status            |
| GET / POST         | `/organizations/:org/tasks`            | Paginated list / create and optionally assign               |
| GET / PUT / DELETE | `/organizations/:org/tasks/:id`        | Read / versioned edit / versioned delete                    |
| PATCH              | `/organizations/:org/tasks/:id/status` | `{status, version}`; Member only when assigned              |
| GET                | `/organizations/:org/activity`         | Paginated role-scoped audit events                          |

32 concrete method/path combinations. Every organization route verifies current active membership and capabilities. Cross-tenant IDs yield 404; insufficient capability yields 403. Anonymous/expired/revoked sessions yield 401. Versions, last-Admin protection, references and lifecycle conflicts yield 409. Validation yields 400, oversized bodies 413 and throttling 429. POST success uses 201; other successes use 200.

List responses are `{items,total,page,pageSize}`. `page` starts at 1, `pageSize` defaults to 25 (maximum 100). Clients/projects/tasks support name/title `search`; projects support `clientId`; tasks support `projectId`, task `status`, and `mine=true`. UI uses 12-row client/project/activity pages and 40-task board pages. Activity ignores search and is constrained by role: Admin all organization events, Manager business entities, Member own actions.

PUT is a full editable representation; immutable organization/creator IDs are never accepted. Optional dates are ISO `YYYY-MM-DD` or empty/null. Task edits/deletes/status require the currently read integer version. Membership mutation is Admin-only. Project completion requires all its tasks Done; archived/completed projects reject task mutations until reopened.

Errors use `{error:{code,message,details?},requestId}` and an `X-Request-Id` header. Field details contain safe validation messages. Internal errors never return database internals, request bodies, credentials or stacks. Passwords and tokens never appear in response JSON or audit metadata.
