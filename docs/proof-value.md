# Resume and freelance proof value

Use alongside verifiable evidence and identify this as an **Independent Demo Project**, not employment/client delivery.

## Profile paragraph

I built FlowDesk, an independent business operations demo, from the relational model and API to a responsive Next.js interface. It connects organization memberships, clients, projects and assigned tasks with capability-based authorization, backend tenant isolation, revocable cookie sessions and transactional audit events. Validation includes 37 tests covering permissions, foreign references, session failures and concurrent task writes, plus a real-browser workflow. All records are fictional. Source repository: [akramaldwikat/flowDesk](https://github.com/akramaldwikat/flowDesk). Live hosting is not deployed.

## Resume bullets

- Built a Next.js/NestJS/PostgreSQL monorepo for organization onboarding, clients, projects, task assignment, status progression and activity.
- Enforced tenant boundaries in API transactions and composite foreign keys; centralized Admin/Manager/Member capabilities and protected the last active Admin.
- Implemented Argon2id hashing, rotating/revocable refresh sessions in HttpOnly cookies, optimistic task versions and atomic business/audit writes.
- Validated the local application with 37 tests, production builds and responsive browser evidence; documented launch limitations explicitly.

| Technical claim                     | Evidence                                                               |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Full-stack ownership / architecture | Web/API, shared contracts, migrations, local setup                     |
| Relational modeling / integrity     | Prisma schema, composite keys, constraint tests                        |
| API / authentication                | REST reference, auth service, replay/revocation/expiry tests           |
| Multi-tenancy / authorization       | Central capability policy, tenant transactions, negative tests         |
| Concurrency                         | Version conflict and membership-revocation tests                       |
| Responsive SaaS interface           | Actual screenshot inventory and browser walkthrough                    |
| Security-conscious decisions        | Safe errors/config, threat review, explicit unimplemented launch gates |

Do not claim production SaaS adoption, enterprise readiness, customers, performance at scale, security certification or invented percentages. Add actual GitHub/live links only after verification; local test success does not prove live reliability.
