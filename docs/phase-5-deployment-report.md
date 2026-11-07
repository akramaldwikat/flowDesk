# Phase 5 hosted deployment verification

Deployed 7 November 2026 from GitHub `main`, revision [a05f956](https://github.com/akramaldwikat/flowDesk/commit/a05f956aa50b9728dc32e1d7bee0f22a6d108e3c). The source revision was also pushed to `phase5/demo-deployment`. This report and the README link are documentation updates; auto-deploy is off.

| Resource | Verified configuration                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Web      | [Live demo](https://flowdesk-web-8atx.onrender.com/), Render Free, Frankfurt                                                                 |
| API      | [Liveness](https://flowdesk-api-lqbx.onrender.com/api/health), Render Free, Frankfurt                                                        |
| Database | Dedicated Neon Free `flowdesk-demo` project, Frankfurt, `flowdesk_demo` database; direct verified TLS 1.3, three runtime connections maximum |
| Cost     | Owner confirmed no Render payment method. Both services use one Free instance, no persistent disk, no paid fallback or add-ons.              |

Both deployment records reached Live at the reviewed revision. Render uses its default TCP deploy checks; HTTP liveness and database readiness were checked separately. All three Prisma migrations completed without rollback, migration status was current, and the hosted schema diff was empty. Provisioning created only fictional data.

Hosted HTTPS checks confirmed liveness/readiness 200, anonymous session requests 401, direct API requests without the proxy credential 403, registration 403, and wrong Origin 403. The configured web origin passed CORS checks; the foreign origin did not. Both cookies retained their separate host-only paths, Secure, HttpOnly and SameSite=Lax attributes. Refresh rotated cookies, replay revoked the family, and logout invalidated the session.

Admin, Manager, and Member signed in through the hosted API. Admin could not rename the workspace, administer team roles, or delete records. Manager could create bounded client/project/task records. Member could update an assigned task; unassigned-task updates and client creation were denied. The hosted API returned 429 at the client, project, task and hourly write boundaries; the fourth active login displaced the oldest session. Task quota fixtures stayed within the 40-task cap. The global 100-session storage ceiling was verified locally without filling the hosted database.

The owner-only reset rejected a wrong target, restored one workspace, three accounts, three clients, three projects and twelve tasks, invalidated old sessions, and rotated all three QA passwords. All replacement logins were verified. No passwords or deployment credentials are included in this repository.

Hosted desktop browser checks at 1440×900 covered Admin sign-in, dashboard, clients, projects/detail, task board, activity, read-only team controls and session recovery after reload. Manager sign-in, dashboard and clients were also observed. Browser control timed out during the remaining walkthrough. Member permissions and mutations were verified over hosted HTTPS; the authenticated Member walkthrough and full 390×844 mobile walkthrough are outstanding.

The deployment logs reviewed contained no matching passwords, cookie values, tokens, database credentials, proxy secrets, or startup errors. The available logs were application/build logs; the hosted HTTP checks separately verified response codes. The local gate passed all 50 tests, production builds, Prisma status/diff, audit and staged publication scan.

Neon compute was observed idle. A single request to the deployed web proxy's `/api/ready` returned HTTP 200 in about one second, verifying wake and reconnection. The full Render idle-to-wake cycle is not yet verified. No keep-alive job was added. The portfolio was not modified.
