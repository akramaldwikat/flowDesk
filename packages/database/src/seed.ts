import { config } from "dotenv";
import { hash, Algorithm } from "@node-rs/argon2";
import { createDatabase } from "./index";
config({ path: "../../.env", quiet: true });
async function seed() {
  const url = process.env.DATABASE_URL,
    password = process.env.DEMO_PASSWORD;
  if (!url || !password || password.length < 12)
    throw new Error(
      "Set DATABASE_URL and a private DEMO_PASSWORD of at least 12 characters.",
    );
  if (process.env.NODE_ENV === "production")
    throw new Error("Local demo seed is disabled in production.");
  const db = createDatabase(url);
  try {
    const passwordHash = await hash(password, {
      algorithm: Algorithm.Argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
    const users = await Promise.all(
      [
        ["admin", "Alex Morgan"],
        ["manager", "Sam Rivera"],
        ["member", "Jordan Lee"],
      ].map(([role, name]) =>
        db.user.upsert({
          where: { email: `${role}@flowdesk.example` },
          update: {},
          create: { name, email: `${role}@flowdesk.example`, passwordHash },
        }),
      ),
    );
    if (await db.membership.findFirst({ where: { userId: users[0].id } })) {
      console.log(
        "Private local seed already exists; existing data preserved.",
      );
      return;
    }
    await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: "Northstar Digital" },
      });
      const members = [];
      for (let i = 0; i < users.length; i++)
        members.push(
          await tx.membership.create({
            data: {
              organizationId: org.id,
              userId: users[i].id,
              role: (["ADMIN", "MANAGER", "MEMBER"] as const)[i],
            },
          }),
        );
      const clients = [];
      for (const [name, contact, email] of [
        ["Cedar Studio", "Taylor Quinn", "hello@cedar.example"],
        ["Harbor Works", "Casey Brooks", "team@harbor.example"],
        ["Meadow Collective", "Riley Ellis", "studio@meadow.example"],
      ])
        clients.push(
          await tx.client.create({
            data: {
              organizationId: org.id,
              name,
              contactName: contact,
              email,
              notes: "Fictional demo record — no real client relationship.",
            },
          }),
        );
      const projectNames = [
        "Client onboarding workspace",
        "Operations dashboard",
        "Service request portal",
      ];
      for (let i = 0; i < 3; i++) {
        const project = await tx.project.create({
          data: {
            organizationId: org.id,
            clientId: clients[i].id,
            name: projectNames[i],
            description:
              "An original fictional project used to exercise the operational workflow.",
            startDate: new Date(),
            dueDate: new Date(Date.now() + (14 + i * 7) * 86400000),
          },
        });
        for (let j = 0; j < 4; j++)
          await tx.task.create({
            data: {
              organizationId: org.id,
              projectId: project.id,
              title: [
                `Map ${clients[i].name} requirements`,
                "Draft the data model",
                "Review the implementation",
                "Validate the handover",
              ][j],
              description: "Sample task for the independent FlowDesk demo.",
              status: (["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const)[j],
              priority: (["HIGH", "MEDIUM", "LOW", "MEDIUM"] as const)[j],
              assigneeMembershipId: members[(i + j) % 3].id,
              createdByMembershipId: members[0].id,
              dueDate: new Date(Date.now() + (j + 2) * 86400000),
            },
          });
        await tx.auditEvent.create({
          data: {
            organizationId: org.id,
            actorMembershipId: members[0].id,
            action: "project.created",
            entityType: "project",
            entityId: project.id,
            metadata: { name: project.name, source: "fictional local seed" },
          },
        });
      }
    });
    console.log(
      "Created private fictional workspace: 3 users, 3 clients, 3 projects and 12 tasks. Password remains in your ignored local environment.",
    );
  } finally {
    await db.$disconnect();
  }
}
seed().catch(() => {
  console.error(
    "Seed failed. Check private local configuration; no credential values are logged.",
  );
  process.exitCode = 1;
});
