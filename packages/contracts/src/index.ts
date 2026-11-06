import { z } from "zod";
export const roles = ["ADMIN", "MANAGER", "MEMBER"] as const;
export type Role = (typeof roles)[number];
export const taskStatuses = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;
export const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const projectStatuses = ["ACTIVE", "COMPLETED", "ARCHIVED"] as const;
export type Capability =
  | "read"
  | "organization.manage"
  | "members.manage"
  | "clients.manage"
  | "projects.manage"
  | "tasks.manage"
  | "tasks.status"
  | "activity";
const capabilities: Record<Role, readonly Capability[]> = {
  ADMIN: [
    "read",
    "organization.manage",
    "members.manage",
    "clients.manage",
    "projects.manage",
    "tasks.manage",
    "tasks.status",
    "activity",
  ],
  MANAGER: [
    "read",
    "clients.manage",
    "projects.manage",
    "tasks.manage",
    "tasks.status",
    "activity",
  ],
  MEMBER: ["read", "tasks.status", "activity"],
};
export const can = (role: Role, capability: Capability) =>
  capabilities[role].includes(capability);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();
export const id = z.uuid();
export const registerSchema = z
  .object({
    name: text(100),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const loginSchema = registerSchema.pick({ email: true, password: true });
export const organizationSchema = z.object({ name: text(100) }).strict();
export const memberSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
    role: z.enum(roles),
  })
  .strict();
export const memberUpdateSchema = z.object({ role: z.enum(roles) }).strict();
export const clientSchema = z
  .object({
    name: text(150),
    contactName: optionalText(100),
    email: z.union([z.email(), z.literal(""), z.null()]).optional(),
    phone: optionalText(40),
    notes: optionalText(3000),
    status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  })
  .strict();
const date = z.union([z.iso.date(), z.literal(""), z.null()]).optional();
export const projectSchema = z
  .object({
    clientId: id,
    name: text(150),
    description: optionalText(3000),
    status: z.enum(projectStatuses).default("ACTIVE"),
    startDate: date,
    dueDate: date,
  })
  .strict()
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    message: "Due date must not precede start date",
    path: ["dueDate"],
  });
export const taskSchema = z
  .object({
    projectId: id,
    title: text(180),
    description: optionalText(3000),
    priority: z.enum(priorities).default("MEDIUM"),
    assigneeMembershipId: z.union([id, z.literal(""), z.null()]).optional(),
    dueDate: date,
  })
  .strict();
export const taskUpdateSchema = taskSchema.extend({
  version: z.number().int().positive(),
});
export const statusSchema = z
  .object({
    status: z.enum(taskStatuses),
    version: z.number().int().positive(),
  })
  .strict();
export const versionSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
export const listQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().max(100).default(""),
    projectId: id.optional(),
    clientId: id.optional(),
    status: z
      .enum([...taskStatuses, ...projectStatuses, "ARCHIVED"])
      .optional(),
    mine: z.enum(["true", "false"]).optional(),
  })
  .strict();
export type RegisterInput = z.infer<typeof registerSchema>;
export type ClientInput = z.infer<typeof clientSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type StatusInput = z.infer<typeof statusSchema>;
export type ListQuery = z.infer<typeof listQuery>;
export interface UserView {
  id: string;
  name: string;
  email: string;
}
export interface MembershipView {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  active: boolean;
  user: UserView;
  organization?: OrganizationView;
}
export interface OrganizationView {
  id: string;
  name: string;
  createdAt: string;
}
export interface MeView {
  user: UserView;
  memberships: MembershipView[];
}
export interface ClientView extends Omit<ClientInput, "status"> {
  id: string;
  organizationId: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
}
export interface ProjectView {
  id: string;
  organizationId: string;
  clientId: string;
  name: string;
  description: string | null;
  status: (typeof projectStatuses)[number];
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  client: { id: string; name: string };
  _count?: { tasks: number };
}
export interface TaskView {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: (typeof taskStatuses)[number];
  priority: (typeof priorities)[number];
  assigneeMembershipId: string | null;
  createdByMembershipId: string;
  dueDate: string | null;
  version: number;
  createdAt: string;
  project: {
    id: string;
    name: string;
    status: (typeof projectStatuses)[number];
  };
  assignee: (MembershipView & { user: UserView }) | null;
}
export interface AuditView {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
  actor: { user: UserView };
}
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface DashboardView {
  activeClients: number;
  activeProjects: number;
  openTasks: number;
  dueSoon: number;
  recentActivity: AuditView[];
  myTasks: TaskView[];
}
