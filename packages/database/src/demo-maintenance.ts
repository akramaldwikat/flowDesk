import { hash, verify, Algorithm } from "@node-rs/argon2";
import { createDatabase } from "./index";
import { assertDemoTarget, demoPolicy } from "./demo-policy";
export async function maintainDemo(
  env: Record<string, string | undefined>,
  action: "provision" | "reset",
  confirmation: string,
) {
  const url = assertDemoTarget(env);
  if (confirmation !== demoPolicy.marker)
    throw new Error("Explicit demo confirmation is required");
  const passwords = [
    env.DEMO_ADMIN_PASSWORD,
    env.DEMO_MANAGER_PASSWORD,
    env.DEMO_MEMBER_PASSWORD,
  ];
  if (
    passwords.some(
      (p) =>
        !p ||
        p.length < 16 ||
        p.length > 128 ||
        /^(replace|placeholder)/i.test(p),
    )
  )
    throw new Error(
      "Set private, distinct demo passwords of 16–128 characters",
    );
  if (new Set(passwords).size !== 3)
    throw new Error("Demo passwords must be distinct");
  const hashes: string[] = [];
  for (const password of passwords)
    hashes.push(
      await hash(password!, {
        algorithm: Algorithm.Argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      }),
    );
  const db = createDatabase(url.toString(), 1);
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${demoPolicy.lock},0))`;
        const control = await tx.demoControl.findUnique({
          where: { id: demoPolicy.marker },
        });
        const emails = [...demoPolicy.emails];
        if (control) {
          if (
            control.organizationId !== demoPolicy.organizationId ||
            (await tx.demoControl.count()) !== 1
          )
            throw new Error("Unrecognized demo marker");
          if (
            (await tx.organization.count({
              where: { id: { not: demoPolicy.organizationId } },
            })) ||
            (await tx.user.count({ where: { email: { notIn: emails } } }))
          )
            throw new Error("Refusing maintenance: unrelated data exists");
          if (action === "provision") return "Existing demo preserved";
          for (let i = 0; i < emails.length; i++) {
            const previous = await tx.user.findUnique({
              where: { email: emails[i] },
            });
            if (
              previous &&
              (await verify(previous.passwordHash, passwords[i]!))
            )
              throw new Error("Reset requires new private demo passwords");
          }
          await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${demoPolicy.organizationId}::uuid FOR UPDATE`;
          const scope = { organizationId: demoPolicy.organizationId };
          await tx.refreshSession.deleteMany();
          await tx.authThrottle.deleteMany();
          await tx.auditEvent.deleteMany({ where: scope });
          await tx.task.deleteMany({ where: scope });
          await tx.project.deleteMany({ where: scope });
          await tx.client.deleteMany({ where: scope });
          await tx.membership.deleteMany({ where: scope });
          await tx.organization.update({
            where: { id: demoPolicy.organizationId },
            data: { name: "Northstar Digital — Shared Demo" },
          });
          await tx.demoControl.update({
            where: { id: demoPolicy.marker },
            data: {
              generation: { increment: 1 },
              mutations: 0,
              windowStart: new Date(),
            },
          });
        } else {
          if (action === "reset")
            throw new Error("Refusing reset: demo marker is missing");
          if (
            (await tx.organization.count()) ||
            (await tx.user.count()) ||
            (await tx.demoControl.count())
          )
            throw new Error(
              "Provisioning requires an empty dedicated database",
            );
          await tx.organization.create({
            data: {
              id: demoPolicy.organizationId,
              name: "Northstar Digital — Shared Demo",
            },
          });
          await tx.demoControl.create({
            data: {
              id: demoPolicy.marker,
              organizationId: demoPolicy.organizationId,
            },
          });
        }
        const members = [];
        for (let i = 0; i < emails.length; i++) {
          const user = await tx.user.upsert({
            where: { email: emails[i] },
            create: {
              email: emails[i],
              name: ["Alex Morgan", "Sam Rivera", "Jordan Lee"][i],
              passwordHash: hashes[i],
            },
            update: { passwordHash: hashes[i] },
          });
          members.push(
            await tx.membership.create({
              data: {
                organizationId: demoPolicy.organizationId,
                userId: user.id,
                role: (["ADMIN", "MANAGER", "MEMBER"] as const)[i],
              },
            }),
          );
        }
        for (const [index, name] of [
          "Cedar Studio",
          "Harbor Works",
          "Meadow Collective",
        ].entries()) {
          const client = await tx.client.create({
            data: {
              organizationId: demoPolicy.organizationId,
              name,
              notes: "Fictional demo record. No real client relationship.",
            },
          });
          const project = await tx.project.create({
            data: {
              organizationId: demoPolicy.organizationId,
              clientId: client.id,
              name: [
                "Client onboarding workspace",
                "Operations dashboard",
                "Service request portal",
              ][index],
              description: "Fictional portfolio sample project.",
              dueDate: new Date(Date.now() + 14 * 86400000),
            },
          });
          for (let i = 0; i < 4; i++)
            await tx.task.create({
              data: {
                organizationId: demoPolicy.organizationId,
                projectId: project.id,
                title: [
                  "Map requirements",
                  "Draft the data model",
                  "Review the implementation",
                  "Validate the handover",
                ][i],
                createdByMembershipId: members[0].id,
                assigneeMembershipId: members[(i % 2) + 1].id,
                status: (["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const)[i],
                dueDate: new Date(Date.now() + (i + 1) * 86400000),
              },
            });
        }
        await tx.auditEvent.create({
          data: {
            organizationId: demoPolicy.organizationId,
            actorMembershipId: members[0].id,
            action: `demo.${action}`,
            entityType: "organization",
            entityId: demoPolicy.organizationId,
          },
        });
        return action === "reset"
          ? "Demo reset; all sessions ended and passwords rotated"
          : "Fictional demo provisioned";
      },
      { maxWait: 10000, timeout: 60000 },
    );
  } finally {
    await db.$disconnect();
  }
}
