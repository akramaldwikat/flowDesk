import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { config as dotenv } from "dotenv";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import {
  createDatabase,
  demoPolicy,
  assertDemoTarget,
} from "@flowdesk/database";
import { maintainDemo } from "@flowdesk/database/dist/demo-maintenance";
dotenv({ path: resolve(__dirname, "../../../.env"), quiet: true });
process.env.NODE_ENV = "test";
process.env.APP_MODE = "demo";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PROXY_SECRET = randomBytes(48).toString("hex");
process.env.JWT_SECRET = randomBytes(48).toString("hex");
process.env.TRUST_PROXY = "false";
process.env.DEMO_MANAGER_PASSWORD = randomBytes(24).toString("hex");
process.env.DEMO_MEMBER_PASSWORD = randomBytes(24).toString("hex");
process.env.DEMO_ADMIN_PASSWORD = randomBytes(24).toString("hex");
assertDemoTarget(process.env);
const db = createDatabase(process.env.DATABASE_URL!),
  org = demoPolicy.organizationId;
const headers = {
  Origin: process.env.WEB_ORIGIN || "http://localhost:3100",
  "X-FlowDesk-Request": "1",
  "X-FlowDesk-Proxy": process.env.PROXY_SECRET,
};
let app: INestApplication;
async function maintenance(action: "provision" | "reset") {
  if (action === "reset") {
    process.env.DEMO_ADMIN_PASSWORD = randomBytes(24).toString("hex");
    process.env.DEMO_MANAGER_PASSWORD = randomBytes(24).toString("hex");
    process.env.DEMO_MEMBER_PASSWORD = randomBytes(24).toString("hex");
  }
  return maintainDemo(process.env, action, demoPolicy.marker);
}
async function login(role = "manager") {
  const agent = request.agent(app.getHttpServer());
  const response = await agent
    .post("/api/auth/login")
    .set(headers)
    .send({
      email: `${role}@flowdesk.example`,
      password:
        process.env[
          role === "admin"
            ? "DEMO_ADMIN_PASSWORD"
            : role === "manager"
              ? "DEMO_MANAGER_PASSWORD"
              : "DEMO_MEMBER_PASSWORD"
        ],
    })
    .expect(201);
  assert.equal(response.body.user.passwordHash, undefined);
  return agent;
}
before(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "DemoControl", "AuditEvent", "Task", "Project", "Client", "Membership", "Organization", "RefreshSession", "User", "AuthThrottle" CASCADE',
  );
  await maintenance("provision");
  const { createApp } = await import("../src/app");
  app = await createApp();
  await app.init();
});
beforeEach(async () => {
  await maintenance("reset");
});
after(async () => {
  await app?.close();
  await db.$disconnect();
});
test("demo public API requires the proxy secret except DB-independent liveness", async () => {
  await request(app.getHttpServer()).get("/api/health").expect(200);
  await request(app.getHttpServer()).get("/api/auth/me").expect(403);
  await request(app.getHttpServer()).get("/api/ready").set(headers).expect(200);
  await request(app.getHttpServer())
    .post("/api/auth/register")
    .set(headers)
    .send({})
    .expect(403);
  await request(app.getHttpServer())
    .get("/api/auth/me")
    .set({ ...headers, "X-FlowDesk-Proxy": "wrong" })
    .expect(403);
});
test("predefined accounts work; tenant creation, team changes, deletion and wrong origins are blocked", async () => {
  const agent = await login();
  await agent
    .post("/api/organizations")
    .set(headers)
    .send({ name: "Unbounded tenant" })
    .expect(403);
  await agent
    .post(`/api/organizations/${org}/members`)
    .set(headers)
    .send({ email: "admin@flowdesk.example", role: "ADMIN" })
    .expect(403);
  const client = await db.client.findFirstOrThrow();
  await agent
    .delete(`/api/organizations/${org}/clients/${client.id}`)
    .set(headers)
    .expect(403);
  await agent
    .post(`/api/organizations/${org}/clients`)
    .set({ ...headers, Origin: "https://evil.example" })
    .send({ name: "Denied" })
    .expect(403);
  const member = await login("member");
  await member
    .post(`/api/organizations/${org}/clients`)
    .set(headers)
    .send({ name: "Denied" })
    .expect(403);
  const admin = await login("admin");
  await admin.get("/api/auth/me").set(headers).expect(200);
  await admin
    .patch("/api/organizations/" + org)
    .set(headers)
    .send({ name: "Forbidden rename" })
    .expect(403);
  await admin
    .post("/api/organizations/" + org + "/members")
    .set(headers)
    .send({ email: "member@flowdesk.example", role: "ADMIN" })
    .expect(403);
  await admin
    .delete("/api/organizations/" + org + "/clients/" + client.id)
    .set(headers)
    .expect(403);
});
test("concurrent creation cannot exceed the record quota; failed writes do not consume mutation budget", async () => {
  const agent = await login();
  const results = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      agent
        .post(`/api/organizations/${org}/clients`)
        .set(headers)
        .send({ name: `Fictional ${i}` }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 2);
  assert.equal(results.filter((r) => r.status === 429).length, 3);
  assert.equal(await db.client.count(), 5);
  assert.equal(
    (
      await db.demoControl.findUniqueOrThrow({
        where: { id: demoPolicy.marker },
      })
    ).mutations,
    2,
  );
});
test("shared hourly write budget survives concurrency and resets on demand only", async () => {
  const agent = await login(),
    client = await db.client.findFirstOrThrow();
  await db.demoControl.update({
    where: { id: demoPolicy.marker },
    data: { mutations: 19 },
  });
  const results = await Promise.all(
    [1, 2, 3].map((i) =>
      agent
        .put(`/api/organizations/${org}/clients/${client.id}`)
        .set(headers)
        .send({ name: `Edit ${i}` }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(results.filter((r) => r.status === 429).length, 2);
  await db.demoControl.update({
    where: { id: demoPolicy.marker },
    data: { windowStart: new Date(Date.now() - 3600001) },
  });
  await agent
    .put(`/api/organizations/${org}/clients/${client.id}`)
    .set(headers)
    .send({ name: "Next window" })
    .expect(200);
  assert.equal(
    (
      await db.demoControl.findUniqueOrThrow({
        where: { id: demoPolicy.marker },
      })
    ).mutations,
    1,
  );
});
test("sessions are bounded, reset revokes sessions and stale requests fail inside transactions", async () => {
  const first = await login();
  for (let i = 0; i < 3; i++) await login();
  await first.get("/api/auth/me").set(headers).expect(401);
  assert.equal(
    await db.refreshSession.count({ where: { revokedAt: null } }),
    3,
  );
  const session = await db.refreshSession.findFirstOrThrow({
    where: { revokedAt: null },
  });
  const { WorkspaceService } = await import("../src/workspace");
  const service = app.get(WorkspaceService);
  await maintenance("reset");
  await assert.rejects(
    () =>
      service.saveClient(
        { userId: session.userId, sessionId: session.id },
        org,
        { name: "Late request", status: "ACTIVE" },
      ),
    /reset/,
  );
  const generation = (
    await db.demoControl.findUniqueOrThrow({ where: { id: demoPolicy.marker } })
  ).generation;
  await maintenance("provision");
  assert.equal(
    (
      await db.demoControl.findUniqueOrThrow({
        where: { id: demoPolicy.marker },
      })
    ).generation,
    generation,
  );
});
test("audit retention is bounded by age and row count on successful writes", async () => {
  const agent = await login(),
    actor = await db.membership.findFirstOrThrow();
  await db.auditEvent.createMany({
    data: Array.from({ length: 205 }, () => ({
      organizationId: org,
      actorMembershipId: actor.id,
      action: "test",
      entityType: "organization",
      entityId: org,
    })),
  });
  await db.auditEvent.create({
    data: {
      organizationId: org,
      actorMembershipId: actor.id,
      action: "expired",
      entityType: "organization",
      entityId: org,
      createdAt: new Date(Date.now() - 8 * 86400000),
    },
  });
  const client = await db.client.findFirstOrThrow();
  await agent
    .put(`/api/organizations/${org}/clients/${client.id}`)
    .set(headers)
    .send({ name: "Retention trigger" })
    .expect(200);
  assert.equal(await db.auditEvent.count(), 200);
  assert.equal(await db.auditEvent.count({ where: { action: "expired" } }), 0);
});
test("maintenance rejects wrong targets, missing confirmation and unrelated data without wiping", async () => {
  for (const DATABASE_URL of [
    "postgresql://example.invalid/flowdesk_demo",
    "postgresql://127.0.0.1:55434/flowdesk",
    "https://127.0.0.1:55434/flowdesk_test",
  ])
    assert.throws(() => assertDemoTarget({ ...process.env, DATABASE_URL }));
  await assert.rejects(
    () => maintainDemo(process.env, "reset", "wrong"),
    /confirmation/,
  );
  const other = await db.organization.create({
    data: { name: "Protected unrelated workspace" },
  });
  await assert.rejects(() => maintenance("reset"), /unrelated/);
  assert.equal(await db.organization.count(), 2);
  assert.equal(await db.task.count(), 12);
  await db.organization.delete({ where: { id: other.id } });
});

test("project/task quotas and assigned Member status work in demo mode", async () => {
  const manager = await login(),
    member = await login("member");
  const membership = await db.membership.findFirstOrThrow({
    where: { role: "MEMBER" },
  });
  const task = await db.task.findFirstOrThrow({
    where: { assigneeMembershipId: membership.id },
  });
  await member
    .patch(`/api/organizations/${org}/tasks/${task.id}/status`)
    .set(headers)
    .send({ status: "DONE", version: task.version })
    .expect(200);
  const client = await db.client.findFirstOrThrow(),
    project = await db.project.findFirstOrThrow();
  await db.project.createMany({
    data: [1, 2].map((i) => ({
      organizationId: org,
      clientId: client.id,
      name: `Quota fixture ${i}`,
    })),
  });
  await manager
    .post(`/api/organizations/${org}/projects`)
    .set(headers)
    .send({ clientId: client.id, name: "Over quota" })
    .expect(429);
  const creator = await db.membership.findFirstOrThrow({
    where: { role: "ADMIN" },
  });
  await db.task.createMany({
    data: Array.from({ length: 28 }, (_, i) => ({
      organizationId: org,
      projectId: project.id,
      title: `Quota fixture ${i}`,
      createdByMembershipId: creator.id,
    })),
  });
  await manager
    .post(`/api/organizations/${org}/tasks`)
    .set(headers)
    .send({ projectId: project.id, title: "Over quota" })
    .expect(429);
  assert.equal(await db.project.count(), 5);
  assert.equal(await db.task.count(), 40);
});

test("session storage cap retains replay evidence, expiry frees capacity, and reset rotates credentials", async () => {
  const agent = await login(),
    user = await db.user.findUniqueOrThrow({
      where: { email: "manager@flowdesk.example" },
    });
  await db.refreshSession.createMany({
    data: Array.from({ length: 99 }, () => ({
      userId: user.id,
      familyId: randomUUID(),
      tokenHash: randomBytes(32).toString("hex"),
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    })),
  });
  const { AuthService } = await import("../src/auth");
  const auth = app.get(AuthService);
  await assert.rejects(
    () => auth.issue(user.id, user.passwordHash),
    /session limit/,
  );
  await agent.post("/api/auth/refresh").set(headers).send({}).expect(429);
  assert.equal(await db.refreshSession.count(), 100);
  await db.refreshSession.updateMany({
    where: { revokedAt: { not: null } },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await auth.issue(user.id, user.passwordHash);
  assert.equal(await db.refreshSession.count(), 2);
  const oldHash = user.passwordHash;
  await maintenance("reset");
  assert.notEqual(
    (await db.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash,
    oldHash,
  );
  await assert.rejects(() => auth.issue(user.id, oldHash), /Sign in again/);
});

test("production demo target rejects pooled, non-TLS, mismatched or non-demo databases", () => {
  const env = {
    NODE_ENV: "production",
    APP_MODE: "demo",
    DATABASE_URL:
      "postgresql://ep-fixture.neon.tech/flowdesk_demo?sslmode=verify-full",
    DEMO_DATABASE_HOST: "ep-fixture.neon.tech",
    DEMO_DATABASE_NAME: "flowdesk_demo",
  };
  assert.equal(assertDemoTarget(env).hostname, env.DEMO_DATABASE_HOST);
  for (const DATABASE_URL of [
    env.DATABASE_URL.replace("verify-full", "require"),
    env.DATABASE_URL.replace("ep-fixture.", "ep-fixture-pooler."),
    env.DATABASE_URL.replace("/flowdesk_demo", "/other"),
  ])
    assert.throws(() => assertDemoTarget({ ...env, DATABASE_URL }));
  assert.throws(() =>
    assertDemoTarget({ ...env, DEMO_DATABASE_HOST: "other.neon.tech" }),
  );
});
