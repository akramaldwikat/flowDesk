import {
  Inject,
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@flowdesk/database";
import {
  can,
  type Capability,
  type Role,
  type ClientInput,
  type ProjectInput,
  type TaskInput,
  type TaskUpdateInput,
  type StatusInput,
  type ListQuery,
} from "@flowdesk/contracts";
import { Database } from "./db";
import { type AuthRequest } from "./auth";
import { uuid } from "./http";
type Identity = AuthRequest["identity"];
type Tx = Prisma.TransactionClient;
const userSelect = { id: true, name: true, email: true } as const;
const memberInclude = { user: { select: userSelect } } as const;
const projectInclude = {
  client: { select: { id: true, name: true } },
  _count: { select: { tasks: true } },
} as const;
const taskInclude = {
  project: { select: { id: true, name: true, status: true } },
  assignee: { include: memberInclude },
} as const;
function date(value?: string | null) {
  return value ? new Date(value + "T00:00:00.000Z") : null;
}
function page(q: ListQuery) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}
async function event(
  tx: Tx,
  org: string,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Prisma.InputJsonObject = {},
) {
  await tx.auditEvent.create({
    data: {
      organizationId: org,
      actorMembershipId: actor,
      action,
      entityType,
      entityId,
      metadata,
    },
  });
}
@Injectable()
export class WorkspaceService {
  constructor(@Inject(Database) private readonly db: Database) {}
  async organizations(identity: Identity) {
    return this.db.client.membership.findMany({
      where: { userId: identity.userId, active: true },
      include: { organization: true, user: { select: userSelect } },
    });
  }
  async createOrganization(identity: Identity, name: string) {
    return this.db.client.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name } });
      const m = await tx.membership.create({
        data: {
          organizationId: org.id,
          userId: identity.userId,
          role: "ADMIN",
        },
      });
      await event(
        tx,
        org.id,
        m.id,
        "organization.created",
        "organization",
        org.id,
        { name },
      );
      return org;
    });
  }
  async run<T>(
    identity: Identity,
    org: string,
    capability: Capability,
    write: boolean,
    fn: (tx: Tx, m: { id: string; role: Role }) => Promise<T>,
  ): Promise<T> {
    uuid(org);
    return this.db.client.$transaction(
      async (tx) => {
        if (write)
          await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org}::uuid FOR UPDATE`;
        else
          await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${org}::uuid FOR SHARE`;
        const membership = await tx.membership.findFirst({
          where: { organizationId: org, userId: identity.userId, active: true },
        });
        if (!membership) throw new NotFoundException("Workspace not found.");
        if (!can(membership.role, capability))
          throw new ForbiddenException("Your role does not allow this action.");
        return fn(tx, membership);
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
  organization(identity: Identity, org: string) {
    return this.run(identity, org, "read", false, (tx) =>
      tx.organization.findUniqueOrThrow({ where: { id: org } }),
    );
  }
  updateOrganization(identity: Identity, org: string, name: string) {
    return this.run(
      identity,
      org,
      "organization.manage",
      true,
      async (tx, m) => {
        const result = await tx.organization.update({
          where: { id: org },
          data: { name },
        });
        await event(
          tx,
          org,
          m.id,
          "organization.updated",
          "organization",
          org,
          { name },
        );
        return result;
      },
    );
  }
  members(identity: Identity, org: string) {
    return this.run(identity, org, "read", false, (tx) =>
      tx.membership.findMany({
        where: { organizationId: org, active: true },
        include: memberInclude,
        orderBy: { createdAt: "asc" },
      }),
    );
  }
  addMember(identity: Identity, org: string, email: string, role: Role) {
    return this.run(identity, org, "members.manage", true, async (tx, m) => {
      const user = await tx.user.findUnique({ where: { email } });
      if (!user)
        throw new BadRequestException(
          "Ask this teammate to register before adding them.",
        );
      const existing = await tx.membership.findUnique({
        where: {
          organizationId_userId: { organizationId: org, userId: user.id },
        },
      });
      if (existing?.active)
        throw new ConflictException("This person is already a member.");
      const result = await tx.membership.upsert({
        where: {
          organizationId_userId: { organizationId: org, userId: user.id },
        },
        create: { organizationId: org, userId: user.id, role },
        update: { active: true, role },
        include: memberInclude,
      });
      await event(tx, org, m.id, "membership.added", "membership", result.id, {
        name: user.name,
        role,
      });
      return result;
    });
  }
  changeMember(identity: Identity, org: string, id: string, role?: Role) {
    uuid(id);
    return this.run(identity, org, "members.manage", true, async (tx, m) => {
      const target = await tx.membership.findFirst({
        where: { id, organizationId: org, active: true },
      });
      if (!target) throw new NotFoundException("Member not found.");
      if (
        target.role === "ADMIN" &&
        role !== "ADMIN" &&
        (await tx.membership.count({
          where: { organizationId: org, role: "ADMIN", active: true },
        })) <= 1
      )
        throw new ConflictException(
          "The workspace must retain an active Admin.",
        );
      if (!role)
        await tx.task.updateMany({
          where: { organizationId: org, assigneeMembershipId: id },
          data: { assigneeMembershipId: null, version: { increment: 1 } },
        });
      const result = await tx.membership.update({
        where: { id },
        data: role ? { role } : { active: false },
        include: memberInclude,
      });
      await event(
        tx,
        org,
        m.id,
        role ? "membership.role_changed" : "membership.revoked",
        "membership",
        id,
        { ...(role ? { role } : {}), name: result.user.name },
      );
      return result;
    });
  }
  listClients(identity: Identity, org: string, q: ListQuery) {
    return this.run(identity, org, "read", false, async (tx) => {
      const where = {
        organizationId: org,
        name: { contains: q.search, mode: "insensitive" as const },
      };
      const [items, total] = await Promise.all([
        tx.client.findMany({
          where,
          ...page(q),
          include: { _count: { select: { projects: true } } },
          orderBy: { createdAt: "desc" },
        }),
        tx.client.count({ where }),
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    });
  }
  getClient(identity: Identity, org: string, id: string) {
    uuid(id);
    return this.run(identity, org, "read", false, async (tx) => {
      const item = await tx.client.findFirst({
        where: { id, organizationId: org },
        include: { _count: { select: { projects: true } } },
      });
      if (!item) throw new NotFoundException("Client not found.");
      return item;
    });
  }
  saveClient(identity: Identity, org: string, data: ClientInput, id?: string) {
    if (id) uuid(id);
    return this.run(identity, org, "clients.manage", true, async (tx, m) => {
      if (
        id &&
        !(await tx.client.findFirst({ where: { id, organizationId: org } }))
      )
        throw new NotFoundException("Client not found.");
      const item = id
        ? await tx.client.update({ where: { id }, data })
        : await tx.client.create({ data: { ...data, organizationId: org } });
      await event(
        tx,
        org,
        m.id,
        id ? "client.updated" : "client.created",
        "client",
        item.id,
        { name: item.name },
      );
      return item;
    });
  }
  deleteClient(identity: Identity, org: string, id: string) {
    uuid(id);
    return this.run(identity, org, "clients.manage", true, async (tx, m) => {
      const item = await tx.client.findFirst({
        where: { id, organizationId: org },
      });
      if (!item) throw new NotFoundException("Client not found.");
      if (
        await tx.project.count({ where: { clientId: id, organizationId: org } })
      )
        throw new ConflictException(
          "This client has projects. Archive the client instead.",
        );
      await tx.client.delete({ where: { id } });
      await event(tx, org, m.id, "client.deleted", "client", id, {
        name: item.name,
      });
      return { ok: true };
    });
  }
  listProjects(identity: Identity, org: string, q: ListQuery) {
    return this.run(identity, org, "read", false, async (tx) => {
      const where = {
        organizationId: org,
        ...(q.clientId ? { clientId: q.clientId } : {}),
        name: { contains: q.search, mode: "insensitive" as const },
      };
      const [items, total] = await Promise.all([
        tx.project.findMany({
          where,
          ...page(q),
          include: projectInclude,
          orderBy: { createdAt: "desc" },
        }),
        tx.project.count({ where }),
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    });
  }
  getProject(identity: Identity, org: string, id: string) {
    uuid(id);
    return this.run(identity, org, "read", false, async (tx) => {
      const item = await tx.project.findFirst({
        where: { id, organizationId: org },
        include: projectInclude,
      });
      if (!item) throw new NotFoundException("Project not found.");
      return item;
    });
  }
  saveProject(
    identity: Identity,
    org: string,
    data: ProjectInput,
    id?: string,
  ) {
    if (id) uuid(id);
    return this.run(identity, org, "projects.manage", true, async (tx, m) => {
      if (
        id &&
        !(await tx.project.findFirst({ where: { id, organizationId: org } }))
      )
        throw new NotFoundException("Project not found.");
      if (
        !(await tx.client.findFirst({
          where: { id: data.clientId, organizationId: org },
        }))
      )
        throw new BadRequestException("Select a client in this workspace.");
      if (
        data.status === "COMPLETED" &&
        id &&
        (await tx.task.count({
          where: {
            projectId: id,
            organizationId: org,
            status: { not: "DONE" },
          },
        }))
      )
        throw new ConflictException(
          "Complete all project tasks before completing the project.",
        );
      const values = {
        ...data,
        startDate: date(data.startDate),
        dueDate: date(data.dueDate),
      };
      const item = id
        ? await tx.project.update({
            where: { id },
            data: values,
            include: projectInclude,
          })
        : await tx.project.create({
            data: { ...values, organizationId: org },
            include: projectInclude,
          });
      await event(
        tx,
        org,
        m.id,
        id ? "project.updated" : "project.created",
        "project",
        item.id,
        { name: item.name, status: item.status },
      );
      return item;
    });
  }
  listTasks(identity: Identity, org: string, q: ListQuery) {
    return this.run(identity, org, "read", false, async (tx, m) => {
      const where: Prisma.TaskWhereInput = {
        organizationId: org,
        ...(q.projectId ? { projectId: q.projectId } : {}),
        ...(q.mine === "true" ? { assigneeMembershipId: m.id } : {}),
        title: { contains: q.search, mode: "insensitive" },
      };
      if (
        q.status &&
        ["TODO", "IN_PROGRESS", "REVIEW", "DONE"].includes(q.status)
      )
        where.status = q.status as "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
      const [items, total] = await Promise.all([
        tx.task.findMany({
          where,
          ...page(q),
          include: taskInclude,
          orderBy: { createdAt: "desc" },
        }),
        tx.task.count({ where }),
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    });
  }
  getTask(identity: Identity, org: string, id: string) {
    uuid(id);
    return this.run(identity, org, "read", false, async (tx) => {
      const item = await tx.task.findFirst({
        where: { id, organizationId: org },
        include: taskInclude,
      });
      if (!item) throw new NotFoundException("Task not found.");
      return item;
    });
  }
  private async references(tx: Tx, org: string, data: TaskInput) {
    const project = await tx.project.findFirst({
      where: { id: data.projectId, organizationId: org },
    });
    if (!project)
      throw new BadRequestException("Select a project in this workspace.");
    if (project.status !== "ACTIVE")
      throw new ConflictException(
        "Reopen this project before changing its tasks.",
      );
    if (
      data.assigneeMembershipId &&
      !(await tx.membership.findFirst({
        where: {
          id: data.assigneeMembershipId,
          organizationId: org,
          active: true,
        },
      }))
    )
      throw new BadRequestException(
        "Select an active member in this workspace.",
      );
  }
  saveTask(
    identity: Identity,
    org: string,
    data: TaskInput | TaskUpdateInput,
    id?: string,
  ) {
    if (id) uuid(id);
    return this.run(identity, org, "tasks.manage", true, async (tx, m) => {
      let previous;
      if (id) {
        previous = await tx.task.findFirst({
          where: { id, organizationId: org },
          include: { project: true },
        });
        if (!previous) throw new NotFoundException("Task not found.");
        if (previous.project.status !== "ACTIVE")
          throw new ConflictException(
            "Reopen this project before changing its tasks.",
          );
        if (!("version" in data) || previous.version !== data.version)
          throw new ConflictException(
            "This task changed. Reload before trying again.",
          );
      }
      await this.references(tx, org, data);
      const values = {
        projectId: data.projectId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        assigneeMembershipId: data.assigneeMembershipId || null,
        dueDate: date(data.dueDate),
      };
      const item = id
        ? await tx.task.update({
            where: { id },
            data: { ...values, version: { increment: 1 } },
            include: taskInclude,
          })
        : await tx.task.create({
            data: {
              ...values,
              organizationId: org,
              createdByMembershipId: m.id,
            },
            include: taskInclude,
          });
      await event(
        tx,
        org,
        m.id,
        id ? "task.updated" : "task.created",
        "task",
        item.id,
        { title: item.title },
      );
      if (
        item.assigneeMembershipId !== previous?.assigneeMembershipId &&
        item.assigneeMembershipId
      )
        await event(tx, org, m.id, "task.assigned", "task", item.id, {
          assigneeMembershipId: item.assigneeMembershipId,
          title: item.title,
        });
      return item;
    });
  }
  status(identity: Identity, org: string, id: string, data: StatusInput) {
    uuid(id);
    return this.run(identity, org, "tasks.status", true, async (tx, m) => {
      const item = await tx.task.findFirst({
        where: { id, organizationId: org },
        include: { project: true },
      });
      if (!item) throw new NotFoundException("Task not found.");
      if (!can(m.role, "tasks.manage") && item.assigneeMembershipId !== m.id)
        throw new ForbiddenException(
          "You can update only tasks assigned to you.",
        );
      if (item.project.status !== "ACTIVE")
        throw new ConflictException(
          "Reopen this project before changing its tasks.",
        );
      if (item.version !== data.version)
        throw new ConflictException(
          "This task changed. Reload before trying again.",
        );
      const result = await tx.task.update({
        where: { id },
        data: { status: data.status, version: { increment: 1 } },
        include: taskInclude,
      });
      await event(tx, org, m.id, "task.status_changed", "task", id, {
        title: item.title,
        from: item.status,
        to: data.status,
      });
      return result;
    });
  }
  deleteTask(identity: Identity, org: string, id: string, version: number) {
    uuid(id);
    return this.run(identity, org, "tasks.manage", true, async (tx, m) => {
      const item = await tx.task.findFirst({
        where: { id, organizationId: org },
        include: { project: true },
      });
      if (!item) throw new NotFoundException("Task not found.");
      if (item.project.status !== "ACTIVE")
        throw new ConflictException(
          "Reopen this project before changing its tasks.",
        );
      if (item.version !== version)
        throw new ConflictException(
          "This task changed. Reload before trying again.",
        );
      await tx.task.delete({ where: { id } });
      await event(tx, org, m.id, "task.deleted", "task", id, {
        title: item.title,
      });
      return { ok: true };
    });
  }
  private activityWhere(
    org: string,
    m: { id: string; role: Role },
  ): Prisma.AuditEventWhereInput {
    return {
      organizationId: org,
      ...(m.role === "MEMBER"
        ? { actorMembershipId: m.id }
        : m.role === "MANAGER"
          ? { entityType: { in: ["client", "project", "task"] } }
          : {}),
    };
  }
  activity(identity: Identity, org: string, q: ListQuery) {
    return this.run(identity, org, "activity", false, async (tx, m) => {
      const where = this.activityWhere(org, m);
      const [items, total] = await Promise.all([
        tx.auditEvent.findMany({
          where,
          ...page(q),
          include: { actor: { include: memberInclude } },
          orderBy: { createdAt: "desc" },
        }),
        tx.auditEvent.count({ where }),
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    });
  }
  dashboard(identity: Identity, org: string) {
    return this.run(identity, org, "read", false, async (tx, m) => {
      const now = new Date(
          new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
        ),
        soon = new Date(Date.now() + 7 * 86400000),
        open = { organizationId: org, status: { not: "DONE" as const } };
      const [
        activeClients,
        activeProjects,
        openTasks,
        dueSoon,
        recentActivity,
        myTasks,
      ] = await Promise.all([
        tx.client.count({ where: { organizationId: org, status: "ACTIVE" } }),
        tx.project.count({ where: { organizationId: org, status: "ACTIVE" } }),
        tx.task.count({ where: open }),
        tx.task.count({ where: { ...open, dueDate: { gte: now, lte: soon } } }),
        tx.auditEvent.findMany({
          where: this.activityWhere(org, m),
          include: { actor: { include: memberInclude } },
          orderBy: { createdAt: "desc" },
          take: 6,
        }),
        tx.task.findMany({
          where: { ...open, assigneeMembershipId: m.id },
          include: taskInclude,
          orderBy: { dueDate: "asc" },
          take: 6,
        }),
      ]);
      return {
        activeClients,
        activeProjects,
        openTasks,
        dueSoon,
        recentActivity,
        myTasks,
      };
    });
  }
}
