# Phase 4 Part A — publication preparation review

7 November 2026, Asia/Amman. **Independent Demo Project; fictional records only.** This is the historical Part A review. In Part B, Akram approved MIT (2026 Akram Aldwikat), the initial commit and source publication to https://github.com/akramaldwikat/flowDesk.git. Part A statements about pending source approval/license below describe that earlier review, not the current license. Deployment and portfolio changes remain unauthorized.

## 1. Repository review

Reviewed ignore rules, environment loading, API/web/contracts, both migrations, relational schema, seed, integration tests, package/lock files, docs and captures. Original source and fictional records are retained. `.env`, logs, dependency/build output, Next-managed next-env.d.ts, local database artifacts and private keys are excluded. Older `docs/qa/` captures remain local and ignored; fresh reviewed JPEGs under `docs/screenshots/` are the publication candidates. The Phase 3 report's machine-specific path was removed and its public screenshot references updated. No confidential employer/client material was identified; ownership still rests on the independent-project provenance supplied by the owner, not a forensic guarantee.

## 2. Public README

Rewritten around the product and engineering evidence first, with an actual dashboard, architecture boundaries, feature scope, real stack, RBAC, tenancy, tests, screenshots, setup, private demo strategy and limitations. It prominently identifies fictional data and says hosting/publication is pending. No fake live badge, repository URL, adoption metric or customer claim.

## 3. Secret and candidate review

`pnpm review:publication` checks Git candidate files against generated local secrets and known token/private-key patterns, private paths/emails, forbidden artifacts and screenshot metadata. `--staged` reads actual index contents through Git. Secret values are never printed. Placeholder-only `.env.example` and `.env.production.example` are intentional exceptions; real environment files remain ignored. This focused scanner plus manual review is not a security certification. Final candidate and Git-index scans report zero findings. Five isolated manual probes passed: clean candidate accepted; staged token detected despite a cleaned working file; clean working file accepted; generated local secret detected; staged log rejected. No fixture values were printed. No finding may be ignored before committing.

## 4. License recommendation

Recommend **MIT**, subject to explicit owner selection and confirmation of rights. Apache-2.0 offers a more explicit patent framework; no license restricts general reuse while platform terms still apply. [Comparison and sources](license-decision.md). No LICENSE, package license grant or all-rights-reserved notice has been silently applied.

## 5. Screenshot inventory

Nine actual running-application captures: dashboard, clients, projects, project detail, task board, members, activity, authentication and one mobile project detail. Only Northstar fictional seed identities and `.example` emails appear. No browser chrome, URL bar, password, local machine path or real contact details. [Inventory, dimensions and hashes](screenshots/README.md). Desktop heading overflow found during image review was corrected and affected images refreshed.

## 6. Demo strategy

Recommend **Option C: privately supplied review credentials**, closed registration, finite review windows and disposable reviewer workspaces. Prefer read-only for first hosting; writes need separately approved allowlist/quotas. No public password is created. [Option comparison and policy](demo-strategy.md).

## 7. Production security work required

Current production mode is not a demo lockdown. Before hosting: disable direct registration and demo admin/organization mutations; enforce approved write policy and transactional quotas; bound sessions/audit retention; implement owner-only provisioning/reset and DB-backed readiness; verify ingress trust, default-domain bypass, HTTPS cookies and rate budgets. Existing tenant/session controls remain; new demo-policy tests are required. Part A only adds canonical-origin validation, production JWT placeholder rejection, explicit private-service binding and configuration tests, not the unapproved demo behavior.

## 8. Deployment architecture

Recommend paid Render web + private API + managed PostgreSQL in one region. This reduces vendor/network and OS maintenance overhead. An actual quotation, spending limit, domain and secrets must be approved; no fixed price or live availability is asserted. [Configuration, source links and release runbook](deployment.md). No service, remote repo or billable resource was created.

## 9. Database/reset strategy

Use separate disposable demo DB and least-privilege runtime/release/maintenance identities. Keep existing local seed's production refusal. Implement a separate allowlisted, locked, scoped and atomic maintenance command; reset manually around review windows initially. Hard quotas provide bounds; periodic reset alone does not. Test wrong-target refusal, rollback and restore first. No Redis/BullMQ or scheduler is added.

## 10. Git commit plan

Prefer **one coherent initial commit**: `feat: add validated FlowDesk operational core and publication preparation`. The current auth/business code shares modules and generated contracts; manufacturing six historical milestones would create misleading or invalid intermediate states. Include workspace, code, migrations, tests, docs and reviewed captures in the same buildable snapshot. Apply the chosen license only after instruction, then repeat the candidate/index review before the commit.

Part A prepares the exact snapshot in the local Git index after the full quality gate; **no commit is made** while the license decision is pending. Before creating the commit, review the final index and author identity; prefer an owner-approved GitHub noreply email to avoid unintentionally publishing private Git metadata. Do not rewrite existing history. No push or remote creation is authorized.

## 11. Suggested GitHub settings

Name: `flowdesk`. Owner: Akram's approved GitHub account. Visibility: public only after explicit approval. Description: **Independent full-stack business operations demo built with Next.js, NestJS, PostgreSQL and capability-based multi-tenant authorization.**

Topics: `nextjs`, `nestjs`, `typescript`, `postgresql`, `prisma`, `fullstack`, `multi-tenant`, `rbac`, `saas`, `portfolio`. Explain “saas” as architecture/demo context, not commercial usage. Set website only to an actually verified demo URL. No default credentials in About, README or issues. Select license only after approval. Enable available dependency/security alerts, secret scanning/push protection and private vulnerability reporting; verify plan availability. Add branch protection/required CI checks only after real checks exist. No automated CI execution is claimed in Part A.

## 12. Portfolio update plan

The existing sibling portfolio remains unchanged. [Exact per-file plan](portfolio-update-plan.md) covers English/Arabic status/copy, true permission/domain facts, screenshots, actual architecture and verified links. Public/hosted destinations must be verified separately. Generic service diagrams/skills must not be overwritten to create false FlowDesk implementation claims.

## 13. Case-study replacement and proof value

[English case study](case-study.md), [Arabic case study](case-study.ar.md), and [resume/freelance proof statements](proof-value.md) distinguish implemented core, local validation, preparation and future work. They replace speculative notification/job architecture with actual sessions, capabilities, composite constraints, locks, audit and tests. No commercial/customer/scale claim is added.

## 14. Quality gate

| Gate                            | Result                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Format / lint                   | Pass; zero lint warnings; Prisma schema also formatted                                           |
| Typecheck                       | Pass across all packages, including API tests                                                    |
| Tests                           | 37 passed, 0 failed/skipped/cancelled/todo: 34 integration + 3 configuration                     |
| Production build                | Contracts, database, API and Next pass; API rebuilt after the final configuration guard          |
| Compiled startup / HTTP smoke   | Login 200, proxied health 200, anonymous me 401, foreign-Origin login 403; DENY/nosniff observed |
| Prisma validation / migrations  | Valid schema; both migrations up to date; no drift                                               |
| Dependency audit / peers        | 0 known vulnerabilities; no peer issues                                                          |
| Publication scan / index review | 0 findings, including actual staged bytes; only reviewed source/docs/assets                      |
| Scanner probes                  | 5/5 isolated manual adversarial checks passed                                                    |
| Documentation links             | All 19 Markdown files checked; 0 broken relative links                                           |
| Screenshots                     | 9 real captures visually inspected; JPEG metadata check clean                                    |
| Portfolio preservation          | All 54 original source/documentation hashes unchanged                                            |

Local-only PostgreSQL fixtures and runtime-generated test passwords remain separate from development data. Browser captures use the built app; no production HTTPS security assessment is claimed. Owned preview/smoke processes are stopped; the dedicated PostgreSQL volume is retained. No remote CI execution is claimed.

## 15. Remaining blockers

Repository publication: choose license, approve author identity/commit and authorize repository creation/push. Hosted demo: implement/test the mandatory controls in section 7, approve provider quotation/domain, separate production credentials and provisioning/reset procedure. Portfolio publication: verify actual URLs and explicitly authorize the scoped file changes. These are distinct decisions; source-publication approval does not authorize deploying the current app unchanged.

## 16. Exact actions needing Akram's approval

1. Select MIT, Apache-2.0 or deliberately no license; approve copyright identity/year if applicable.
2. Approve the reviewed initial snapshot and public Git author identity, then local commit creation.
3. Authorize creating the public `flowdesk` repository under the specified account and pushing that reviewed commit.
4. Approve the demo policy/read-only-versus-bounded-write choice and follow-up launch hardening; then approve the actual hosting quote/spending limit, region/domain, service creation/deployment and separate private credential/provisioning/reset handling.
5. After verified URLs/evidence, authorize applying and publishing the bilingual portfolio update plan.

No credentials are published and no services are deployed. Source preparation can be approved independently; live deployment remains blocked until its controls are implemented.

**READY FOR PUBLICATION APPROVAL — repository and evidence preparation only; not approval to deploy the current demo unchanged.**
