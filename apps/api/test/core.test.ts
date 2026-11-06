import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { config as dotenv } from "dotenv";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import type { INestApplication } from "@nestjs/common";
import { createDatabase } from "@flowdesk/database";
dotenv({ path: resolve(__dirname, "../../../.env"), quiet: true });
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = randomBytes(48).toString("hex");
const testUrl = new URL(process.env.DATABASE_URL || "postgresql://invalid");
if (
  testUrl.pathname !== "/flowdesk_test" ||
  testUrl.hostname !== "127.0.0.1" ||
  testUrl.port !== "55434"
)
  throw new Error(
    "Tests require the dedicated local flowdesk_test database on port 55434.",
  );
const origin = process.env.WEB_ORIGIN || "http://localhost:3100";
const password = randomBytes(24).toString("base64url");
let app: INestApplication;
const db = createDatabase(process.env.DATABASE_URL!);
type Agent = ReturnType<typeof request.agent>;
type Actor = { agent: Agent; id: string; email: string; membership: string };
let admin: Actor, manager: Actor, member: Actor, other: Actor;
let orgA: string,
  orgB: string,
  clientA: string,
  clientB: string,
  projectA: string,
  projectB: string,
  taskA: string,
  taskB: string;
const headers = { Origin: origin, "X-FlowDesk-Request": "1" };
const path = (org: string, resource: string) =>
  `/api/organizations/${org}/${resource}`;
async function actor(label: string) {
  const agent = request.agent(app.getHttpServer());
  const email = `${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${randomUUID()}@flowdesk.example`;
  const res = await agent
    .post("/api/auth/register")
    .set(headers)
    .send({ name: label, email, password })
    .expect(201);
  return { agent, id: res.body.user.id as string, email, membership: "" };
}
async function setupOrg(who: Actor, name: string) {
  const r = await who.agent
    .post("/api/organizations")
    .set(headers)
    .send({ name })
    .expect(201);
  return r.body.id as string;
}
before(async () => {
  execFileSync(
    process.execPath,
    [
      resolve(
        __dirname,
        "../../../packages/database/node_modules/prisma/build/index.js",
      ),
      "migrate",
      "deploy",
    ],
    {
      cwd: resolve(__dirname, "../../../packages/database"),
      env: process.env,
      stdio: "pipe",
    },
  );
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditEvent", "Task", "Project", "Client", "Membership", "Organization", "RefreshSession", "User", "AuthThrottle" CASCADE',
  );
  const { createApp } = await import("../src/app");
  app = await createApp();
  await app.init();
  admin = await actor("Admin");
  manager = await actor("Manager");
  member = await actor("Member");
  other = await actor("Other Admin");
  orgA = await setupOrg(admin, "Organization A");
  orgB = await setupOrg(other, "Organization B");
  for (const [who, role] of [
    [manager, "MANAGER"],
    [member, "MEMBER"],
  ] as const) {
    const m = await admin.agent
      .post(path(orgA, "members"))
      .set(headers)
      .send({ email: who.email, role })
      .expect(201);
    who.membership = m.body.id;
  }
  admin.membership = (
    await db.membership.findFirstOrThrow({
      where: { userId: admin.id, organizationId: orgA },
    })
  ).id;
  other.membership = (
    await db.membership.findFirstOrThrow({
      where: { userId: other.id, organizationId: orgB },
    })
  ).id;
  clientA = (
    await admin.agent
      .post(path(orgA, "clients"))
      .set(headers)
      .send({ name: "Fictional A" })
      .expect(201)
  ).body.id;
  clientB = (
    await other.agent
      .post(path(orgB, "clients"))
      .set(headers)
      .send({ name: "Fictional B" })
      .expect(201)
  ).body.id;
  projectA = (
    await admin.agent
      .post(path(orgA, "projects"))
      .set(headers)
      .send({ name: "Project A", clientId: clientA })
      .expect(201)
  ).body.id;
  projectB = (
    await other.agent
      .post(path(orgB, "projects"))
      .set(headers)
      .send({ name: "Project B", clientId: clientB })
      .expect(201)
  ).body.id;
  taskA = (
    await admin.agent
      .post(path(orgA, "tasks"))
      .set(headers)
      .send({
        title: "Assigned task",
        projectId: projectA,
        assigneeMembershipId: member.membership,
      })
      .expect(201)
  ).body.id;
  taskB = (
    await other.agent
      .post(path(orgB, "tasks"))
      .set(headers)
      .send({ title: "Other task", projectId: projectB })
      .expect(201)
  ).body.id;
});
after(async () => {
  await app?.close();
  await db.$disconnect();
});

test("authentication: anonymous requests are denied and registration creates a private session", async () => {
  await request(app.getHttpServer()).get("/api/auth/me").expect(401);
  const me = await admin.agent.get("/api/auth/me").expect(200);
  assert.equal(me.body.user.id, admin.id);
  assert.equal(me.body.memberships[0].role, "ADMIN");
  const json = JSON.stringify(me.body);
  assert.ok(!json.includes("passwordHash"));
  assert.ok(!json.includes("tokenHash"));
  const stored = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
  assert.match(stored.passwordHash, /^\$argon2id\$/);
  assert.notEqual(stored.passwordHash, password);
});
test("authentication: wrong-password and unknown-account errors are indistinguishable", async () => {
  const a = await request(app.getHttpServer())
    .post("/api/auth/login")
    .set(headers)
    .send({ email: admin.email, password: "Incorrect-password-123" })
    .expect(401);
  const b = await request(app.getHttpServer())
    .post("/api/auth/login")
    .set(headers)
    .send({
      email: "unknown@flowdesk.example",
      password: "Incorrect-password-123",
    })
    .expect(401);
  assert.deepEqual(a.body.error, b.body.error);
});
test("authentication: validation rejects weak passwords, unknown fields and invalid email", async () => {
  for (const patch of [
    { password: "short" },
    { email: "invalid" },
    { role: "ADMIN" },
  ])
    await request(app.getHttpServer())
      .post("/api/auth/register")
      .set(headers)
      .send({
        name: "Invalid",
        email: "validation@flowdesk.example",
        password,
        ...patch,
      })
      .expect(400);
});
test("security: same-origin and custom-header checks reject cross-site mutations", async () => {
  const bad = await admin.agent
    .post(path(orgA, "clients"))
    .set("Origin", "https://other.example")
    .set("X-FlowDesk-Request", "1")
    .send({ name: "Blocked" })
    .expect(403);
  assert.ok(bad.body.error);
  await admin.agent
    .post(path(orgA, "clients"))
    .set("Origin", origin)
    .send({ name: "Blocked" })
    .expect(403);
});
test("organization: onboarding is atomic and the creator becomes Admin", async () => {
  const rows = await db.membership.findMany({
    where: { organizationId: orgA, userId: admin.id, active: true },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "ADMIN");
  assert.equal(
    await db.auditEvent.count({
      where: { organizationId: orgA, action: "organization.created" },
    }),
    1,
  );
});
for (const resource of [
  "clients",
  "projects",
  "tasks",
  "members",
  "activity",
  "dashboard",
])
  test(`tenant isolation: organization A cannot list B ${resource}`, async () => {
    await admin.agent.get(path(orgB, resource)).expect(404);
  });
for (const [resource, id] of [
  ["clients", () => clientB],
  ["projects", () => projectB],
  ["tasks", () => taskB],
] as const)
  test(`tenant isolation: foreign ${resource} identifiers do not leak through the current workspace`, async () => {
    await admin.agent.get(path(orgA, `${resource}/${id()}`)).expect(404);
  });
test("tenant isolation: foreign writes, organization spoofing and foreign membership changes fail", async () => {
  await admin.agent
    .put(path(orgA, `clients/${clientB}`))
    .set(headers)
    .send({ name: "Not allowed" })
    .expect(404);
  await admin.agent
    .delete(path(orgA, `clients/${clientB}`))
    .set(headers)
    .expect(404);
  await admin.agent
    .post(path(orgA, "clients"))
    .set(headers)
    .send({ name: "Spoof", organizationId: orgB })
    .expect(400);
  await admin.agent
    .patch(path(orgA, `members/${other.membership}`))
    .set(headers)
    .send({ role: "MEMBER" })
    .expect(404);
});
test("references: foreign clients cannot be attached to projects", async () => {
  await admin.agent
    .post(path(orgA, "projects"))
    .set(headers)
    .send({ name: "Invalid", clientId: clientB })
    .expect(400);
});
test("references: tasks reject foreign projects and assignees", async () => {
  await admin.agent
    .post(path(orgA, "tasks"))
    .set(headers)
    .send({ title: "Invalid", projectId: projectB })
    .expect(400);
  await admin.agent
    .post(path(orgA, "tasks"))
    .set(headers)
    .send({
      title: "Invalid",
      projectId: projectA,
      assigneeMembershipId: other.membership,
    })
    .expect(400);
});
test("database: composite foreign keys reject cross-organization links independently of the API", async () => {
  await assert.rejects(
    db.project.create({
      data: {
        organizationId: orgA,
        clientId: clientB,
        name: "DB constraint check",
      },
    }),
  );
  await assert.rejects(
    db.task.create({
      data: {
        organizationId: orgA,
        projectId: projectB,
        title: "DB constraint check",
        createdByMembershipId: admin.membership,
      },
    }),
  );
  await assert.rejects(
    db.task.update({
      where: { id: taskA },
      data: { assigneeMembershipId: other.membership },
    }),
  );
});
test("RBAC: Member cannot manage clients, projects, tasks or memberships", async () => {
  await member.agent
    .post(path(orgA, "clients"))
    .set(headers)
    .send({ name: "Forbidden" })
    .expect(403);
  await member.agent
    .post(path(orgA, "projects"))
    .set(headers)
    .send({ name: "Forbidden", clientId: clientA })
    .expect(403);
  await member.agent
    .post(path(orgA, "tasks"))
    .set(headers)
    .send({ title: "Forbidden", projectId: projectA })
    .expect(403);
  await member.agent
    .patch(path(orgA, `members/${manager.membership}`))
    .set(headers)
    .send({ role: "ADMIN" })
    .expect(403);
});
test("RBAC: Manager manages business data but cannot change organization or members", async () => {
  const client = await manager.agent
    .post(path(orgA, "clients"))
    .set(headers)
    .send({ name: "Manager client" })
    .expect(201);
  assert.ok(client.body.id);
  await manager.agent
    .patch(`/api/organizations/${orgA}`)
    .set(headers)
    .send({ name: "Not allowed" })
    .expect(403);
  await manager.agent
    .post(path(orgA, "members"))
    .set(headers)
    .send({ email: other.email, role: "MEMBER" })
    .expect(403);
});
test("members: last active Admin cannot be demoted or removed", async () => {
  await admin.agent
    .patch(path(orgA, `members/${admin.membership}`))
    .set(headers)
    .send({ role: "MEMBER" })
    .expect(409);
  await admin.agent
    .delete(path(orgA, `members/${admin.membership}`))
    .set(headers)
    .expect(409);
});
test("clients: full CRUD works and referenced clients are protected", async () => {
  const c = await admin.agent
    .post(path(orgA, "clients"))
    .set(headers)
    .send({ name: "Disposable client", email: "contact@fictional.example" })
    .expect(201);
  const updated = await admin.agent
    .put(path(orgA, `clients/${c.body.id}`))
    .set(headers)
    .send({ name: "Updated client", status: "ARCHIVED" })
    .expect(200);
  assert.equal(updated.body.status, "ARCHIVED");
  await admin.agent.get(path(orgA, `clients/${c.body.id}`)).expect(200);
  await admin.agent
    .delete(path(orgA, `clients/${c.body.id}`))
    .set(headers)
    .expect(200);
  await admin.agent.get(path(orgA, `clients/${c.body.id}`)).expect(404);
  await admin.agent
    .delete(path(orgA, `clients/${clientA}`))
    .set(headers)
    .expect(409);
});
test("projects: invalid date ranges fail and archives prevent task mutation", async () => {
  await admin.agent
    .post(path(orgA, "projects"))
    .set(headers)
    .send({
      name: "Invalid dates",
      clientId: clientA,
      startDate: "2026-12-10",
      dueDate: "2026-11-01",
    })
    .expect(400);
  await admin.agent
    .put(path(orgA, `projects/${projectA}`))
    .set(headers)
    .send({ name: "Project A", clientId: clientA, status: "COMPLETED" })
    .expect(409);
  await admin.agent
    .put(path(orgA, `projects/${projectA}`))
    .set(headers)
    .send({ name: "Project A", clientId: clientA, status: "ARCHIVED" })
    .expect(200);
  await manager.agent
    .post(path(orgA, "tasks"))
    .set(headers)
    .send({ title: "Archived project task", projectId: projectA })
    .expect(409);
  await admin.agent
    .put(path(orgA, `projects/${projectA}`))
    .set(headers)
    .send({ name: "Project A", clientId: clientA, status: "ACTIVE" })
    .expect(200);
});
test("tasks: assigned Member can complete the workflow; unrelated tasks remain protected", async () => {
  for (const status of ["IN_PROGRESS", "REVIEW", "DONE"]) {
    const current = await member.agent
      .get(path(orgA, `tasks/${taskA}`))
      .expect(200);
    const updated = await member.agent
      .patch(path(orgA, `tasks/${taskA}/status`))
      .set(headers)
      .send({ status, version: current.body.version })
      .expect(200);
    assert.equal(updated.body.status, status);
  }
  const otherTask = await admin.agent
    .post(path(orgA, "tasks"))
    .set(headers)
    .send({
      title: "Not assigned to member",
      projectId: projectA,
      assigneeMembershipId: manager.membership,
    })
    .expect(201);
  await member.agent
    .patch(path(orgA, `tasks/${otherTask.body.id}/status`))
    .set(headers)
    .send({ status: "DONE", version: 1 })
    .expect(403);
  await member.agent
    .patch(path(orgA, `tasks/${taskA}/status`))
    .set(headers)
    .send({ status: "DONE", version: 4, title: "Spoofed edit" })
    .expect(400);
});
test("tasks: concurrent stale versions produce one success and one conflict", async () => {
  const task = await admin.agent
    .post(path(orgA, "tasks"))
    .set(headers)
    .send({ title: "Concurrency check", projectId: projectA })
    .expect(201);
  const results = await Promise.all(
    ["IN_PROGRESS", "REVIEW"].map((status) =>
      admin.agent
        .patch(path(orgA, `tasks/${task.body.id}/status`))
        .set(headers)
        .send({ status, version: 1 }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const current = await db.task.findUniqueOrThrow({
    where: { id: task.body.id },
  });
  assert.equal(current.version, 2);
});
test("tasks: editing and deletion require matching versions", async () => {
  const task = await manager.agent
    .post(path(orgA, "tasks"))
    .set(headers)
    .send({ title: "Editable task", projectId: projectA })
    .expect(201);
  const edit = await manager.agent
    .put(path(orgA, `tasks/${task.body.id}`))
    .set(headers)
    .send({
      title: "Edited",
      projectId: projectA,
      priority: "URGENT",
      assigneeMembershipId: member.membership,
      version: 1,
    })
    .expect(200);
  assert.equal(edit.body.version, 2);
  await manager.agent
    .delete(path(orgA, `tasks/${task.body.id}`))
    .set(headers)
    .send({ version: 1 })
    .expect(409);
  await manager.agent
    .delete(path(orgA, `tasks/${task.body.id}`))
    .set(headers)
    .send({ version: 2 })
    .expect(200);
});
test("membership revocation: access ends, tasks are unassigned, reassignment is rejected", async () => {
  const revoked = await actor("Revoked member");
  revoked.membership = (
    await admin.agent
      .post(path(orgA, "members"))
      .set(headers)
      .send({ email: revoked.email, role: "MEMBER" })
      .expect(201)
  ).body.id;
  const task = (
    await admin.agent
      .post(path(orgA, "tasks"))
      .set(headers)
      .send({
        title: "Will be unassigned",
        projectId: projectA,
        assigneeMembershipId: revoked.membership,
      })
      .expect(201)
  ).body;
  await admin.agent
    .delete(path(orgA, `members/${revoked.membership}`))
    .set(headers)
    .expect(200);
  await revoked.agent.get(path(orgA, "clients")).expect(404);
  const current = await db.task.findUniqueOrThrow({ where: { id: task.id } });
  assert.equal(current.assigneeMembershipId, null);
  assert.equal(current.version, 2);
  await admin.agent
    .post(path(orgA, "tasks"))
    .set(headers)
    .send({
      title: "Inactive assignment",
      projectId: projectA,
      assigneeMembershipId: revoked.membership,
    })
    .expect(400);
});
test("activity and dashboard: counts are real, mutations audited and role scope applied", async () => {
  const dashboard = await admin.agent.get(path(orgA, "dashboard")).expect(200);
  assert.equal(
    dashboard.body.activeClients,
    await db.client.count({
      where: { organizationId: orgA, status: "ACTIVE" },
    }),
  );
  const activity = await admin.agent.get(path(orgA, "activity")).expect(200);
  assert.ok(activity.body.total > 0);
  assert.ok(
    activity.body.items.every(
      (e: { organizationId: string }) => e.organizationId === orgA,
    ),
  );
  assert.ok(
    await db.auditEvent.findFirst({
      where: {
        organizationId: orgA,
        entityId: taskA,
        action: "task.status_changed",
      },
    }),
  );
  const own = await member.agent.get(path(orgA, "activity")).expect(200);
  assert.ok(
    own.body.items.every(
      (e: { actorMembershipId: string }) =>
        e.actorMembershipId === member.membership,
    ),
  );
  const managerEvents = await manager.agent
    .get(path(orgA, "activity"))
    .expect(200);
  assert.ok(
    managerEvents.body.items.every((e: { entityType: string }) =>
      ["client", "project", "task"].includes(e.entityType),
    ),
  );
});
test("validation: malformed resource IDs, unknown query fields and excessive pagination fail safely", async () => {
  await admin.agent.get(path(orgA, "tasks/not-a-uuid")).expect(400);
  await admin.agent.get(path(orgA, "tasks?pageSize=99999")).expect(400);
  await admin.agent
    .get(path(orgA, "clients?organizationId=" + orgB))
    .expect(400);
});
test("sessions: rotation changes cookies and replay revokes the successor", async () => {
  const who = await actor("Session rotation");
  const login = await who.agent
    .post("/api/auth/login")
    .set(headers)
    .send({ email: who.email, password })
    .expect(201);
  const cookies = login.headers["set-cookie"] as unknown as string[];
  assert.ok(
    cookies.every((c) => c.includes("HttpOnly") && c.includes("SameSite=Lax")),
  );
  const refreshCookie = cookies
    .find((c) => c.startsWith("fd_refresh="))!
    .split(";")[0];
  const rotated = await who.agent
    .post("/api/auth/refresh")
    .set(headers)
    .expect(201);
  assert.notEqual(
    (rotated.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("fd_refresh="))!
      .split(";")[0],
    refreshCookie,
  );
  await who.agent.get("/api/auth/me").expect(200);
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set(headers)
    .set("Cookie", refreshCookie)
    .expect(401);
  await who.agent.get("/api/auth/me").expect(401);
});
test("sessions: expired JWTs, expired backing sessions, logout and logout-all are rejected", async () => {
  const who = await actor("Session expiry");
  const login = await who.agent
    .post("/api/auth/login")
    .set(headers)
    .send({ email: who.email, password })
    .expect(201);
  const accessCookie = (login.headers["set-cookie"] as unknown as string[])
    .find((c) => c.startsWith("fd_access="))!
    .split(";")[0];
  const jwt = new JwtService({ secret: process.env.JWT_SECRET });
  const payload = jwt.decode<{ sub: string; sid: string }>(
    accessCookie.split("=")[1],
  );
  const expired = jwt.sign(
    { sub: payload.sub, sid: payload.sid },
    { expiresIn: -1, issuer: "flowdesk", audience: "flowdesk-web" },
  );
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set("Cookie", "fd_access=" + expired)
    .expect(401);
  await db.refreshSession.update({
    where: { id: payload.sid },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await who.agent.get("/api/auth/me").expect(401);
  await who.agent.post("/api/auth/refresh").set(headers).expect(401);
  await who.agent
    .post("/api/auth/login")
    .set(headers)
    .send({ email: who.email, password })
    .expect(201);
  await who.agent.post("/api/auth/logout").set(headers).expect(201);
  await who.agent.get("/api/auth/me").expect(401);
  const another = request.agent(app.getHttpServer());
  await another
    .post("/api/auth/login")
    .set(headers)
    .send({ email: who.email, password })
    .expect(201);
  await who.agent
    .post("/api/auth/login")
    .set(headers)
    .send({ email: who.email, password })
    .expect(201);
  await who.agent.post("/api/auth/logout-all").set(headers).expect(201);
  await another.get("/api/auth/me").expect(401);
});
test("sessions: malformed refresh tokens fail without database errors", async () => {
  await request(app.getHttpServer())
    .post("/api/auth/refresh")
    .set(headers)
    .set("Cookie", "fd_refresh=" + "-".repeat(36) + "." + "a".repeat(43))
    .expect(401);
});
test("security: authentication attempts are rate limited in shared PostgreSQL state", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: Math.floor(Date.now() / 60000) * 60000 + 5000,
  });
  await db.authThrottle.deleteMany();
  for (let i = 0; i < 30; i++)
    await request(app.getHttpServer())
      .post("/api/auth/login")
      .set(headers)
      .send({
        email: "absent@flowdesk.example",
        password: "Incorrect-password-123",
      })
      .expect(401);
  await request(app.getHttpServer())
    .post("/api/auth/login")
    .set(headers)
    .send({
      email: "absent@flowdesk.example",
      password: "Incorrect-password-123",
    })
    .expect(429);
});

test("security: malformed JSON and oversized requests return safe errors", async () => {
  const malformed = await request(app.getHttpServer())
    .post("/api/auth/login")
    .set(headers)
    .set("Content-Type", "application/json")
    .send("{invalid")
    .expect(400);
  assert.equal(malformed.body.error.code, "INVALID_JSON");
  assert.ok(!JSON.stringify(malformed.body).includes("SyntaxError"));
  const large = await request(app.getHttpServer())
    .post("/api/auth/login")
    .set(headers)
    .send({ email: "large@flowdesk.example", password: "x".repeat(25000) })
    .expect(413);
  assert.equal(large.body.error.code, "REQUEST_TOO_LARGE");
});
