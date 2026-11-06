"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Plus,
  Search,
  FolderKanban,
  Building2,
  CheckCheck,
  Clock3,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import {
  can as hasCapability,
  taskStatuses,
  type MeView,
  type MembershipView,
  type ClientView,
  type ProjectView,
  type TaskView,
  type DashboardView,
  type AuditView,
  type PageResult,
  type OrganizationView,
} from "@flowdesk/contracts";
import { api, ApiError, dateLabel, displayStatus, message } from "../lib/api";
import { AuthScreen } from "./auth-screen";
import { Shell } from "./shell";
import { Avatar, Badge, Empty, Modal, Pagination } from "./primitives";
import { EntityDialog, type EntityKind } from "./entity-dialog";

type Data = {
  dashboard?: DashboardView;
  clients?: PageResult<ClientView>;
  projects?: PageResult<ProjectView>;
  tasks?: PageResult<TaskView>;
  activity?: PageResult<AuditView>;
  members?: MembershipView[];
  client?: ClientView;
  project?: ProjectView;
  organization?: OrganizationView;
};
type Editing = {
  kind: EntityKind;
  id?: string;
  initial?: Record<string, unknown>;
};
const titles: Record<string, [string, string]> = {
  dashboard: [
    "A little clarity. A lot of progress.",
    "Your workspace at a glance. Every number reflects your team’s work.",
  ],
  clients: [
    "Good work starts with good relationships.",
    "Keep your client details and their projects connected.",
  ],
  projects: [
    "Bring the bigger picture into focus.",
    "A shared home for every client engagement.",
  ],
  tasks: [
    "Make room for the work that matters.",
    "Move tasks forward, one clear next step at a time.",
  ],
  members: [
    "The people behind the progress.",
    "Workspace access and responsibilities, all in one place.",
  ],
  activity: [
    "A clear record of what changed.",
    "Changes made in this workspace, with the people behind them.",
  ],
  settings: [
    "Make this space yours.",
    "Manage your workspace and account sessions.",
  ],
};
function actionLabel(action: string) {
  return action
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/^./, (s) => s.toUpperCase());
}
async function allPages<T>(path: string): Promise<T[]> {
  const first = await api<PageResult<T>>(`${path}?pageSize=100`);
  const items = [...first.items];
  for (let page = 2; items.length < first.total; page++) {
    const next = await api<PageResult<T>>(`${path}?pageSize=100&page=${page}`);
    items.push(...next.items);
    if (!next.items.length) break;
  }
  return items;
}
function Activity({ items }: { items: AuditView[] }) {
  return (
    <div className="activity-list">
      {items.map((item) => (
        <div className="activity-row" key={item.id}>
          <Avatar name={item.actor.user.name} />
          <div>
            <strong>{item.actor.user.name}</strong>
            <p>
              {actionLabel(item.action)}
              {typeof item.metadata.name === "string"
                ? ` · ${item.metadata.name}`
                : typeof item.metadata.title === "string"
                  ? ` · ${item.metadata.title}`
                  : ""}
            </p>
          </div>
          <time dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleString("en", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      ))}
    </div>
  );
}

export function FlowdeskApp({ demoMode = false }: { demoMode?: boolean }) {
  const pathname = usePathname();
  return <Workspace key={pathname} pathname={pathname} demoMode={demoMode} />;
}

function Workspace({
  pathname,
  demoMode,
}: {
  pathname: string;
  demoMode: boolean;
}) {
  const router = useRouter();
  const can = (
    role: Parameters<typeof hasCapability>[0],
    capability: Parameters<typeof hasCapability>[1],
  ) =>
    !(
      demoMode && ["organization.manage", "members.manage"].includes(capability)
    ) && hasCapability(role, capability);
  const parts = pathname.split("/").filter(Boolean),
    orgId = parts[0] === "o" ? parts[1] : undefined,
    section = parts[2] || "dashboard",
    detailId = parts[3];
  const [me, setMe] = useState<MeView | null | undefined>();
  const [data, setData] = useState<Data>({});
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [mine, setMine] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    run: () => Promise<void>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refs, setRefs] = useState<{
    clients: ClientView[];
    projects: ProjectView[];
    members: MembershipView[];
  }>({ clients: [], projects: [], members: [] });
  const base = `/organizations/${orgId}`,
    href = (s: string) => `/o/${orgId}/${s}`;
  const membership = me?.memberships.find((m) => m.organizationId === orgId);
  const refreshMe = useCallback(async () => {
    try {
      const value = await api<MeView>("/auth/me");
      setMe(value);
      return value;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setMe(null);
        return null;
      }
      setError(message(err));
      setMe(null);
      return null;
    }
  }, [setMe, setError]);
  useEffect(() => {
    let ignore = false;
    void api<MeView>("/auth/me")
      .then((value) => {
        if (!ignore) setMe(value);
      })
      .catch((err) => {
        if (!ignore) {
          if (!(err instanceof ApiError && err.status === 401))
            setError(message(err));
          setMe(null);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    if (me === undefined) return;
    if (!me) {
      if (!["/login", "/register"].includes(pathname)) router.replace("/login");
      return;
    }
    if (["/", "/login", "/register"].includes(pathname))
      router.replace(
        me.memberships.length
          ? `/o/${me.memberships[0].organizationId}/dashboard`
          : "/onboarding",
      );
  }, [me, pathname, router]);
  const requestKey = JSON.stringify([
    orgId,
    section,
    detailId,
    page,
    search,
    mine,
    filter,
    revision,
    membership,
  ]);
  const loading = loadedKey !== requestKey;
  useEffect(() => {
    if (!membership || !orgId) return;
    let ignore = false;
    const query = new URLSearchParams({
      page: String(page),
      pageSize: section === "tasks" ? "40" : "12",
      search,
    });
    if (mine) query.set("mine", "true");
    if (filter) query.set("status", filter);
    async function load() {
      let result: Data = {};
      switch (section) {
        case "dashboard":
          result = { dashboard: await api<DashboardView>(`${base}/dashboard`) };
          break;
        case "clients":
          result = detailId
            ? {
                client: await api<ClientView>(`${base}/clients/${detailId}`),
                projects: await api<PageResult<ProjectView>>(
                  `${base}/projects?clientId=${detailId}&page=${page}&pageSize=12`,
                ),
              }
            : {
                clients: await api<PageResult<ClientView>>(
                  `${base}/clients?${query}`,
                ),
              };
          break;
        case "projects":
          result = detailId
            ? {
                project: await api<ProjectView>(`${base}/projects/${detailId}`),
                tasks: await api<PageResult<TaskView>>(
                  `${base}/tasks?projectId=${detailId}&page=${page}&pageSize=40`,
                ),
              }
            : {
                projects: await api<PageResult<ProjectView>>(
                  `${base}/projects?${query}`,
                ),
              };
          break;
        case "tasks":
          result = {
            tasks: await api<PageResult<TaskView>>(`${base}/tasks?${query}`),
          };
          break;
        case "members":
          result = { members: await api<MembershipView[]>(`${base}/members`) };
          break;
        case "activity":
          result = {
            activity: await api<PageResult<AuditView>>(
              `${base}/activity?${query}`,
            ),
          };
          break;
        case "settings":
          result = { organization: await api<OrganizationView>(base) };
          break;
        default:
          throw new Error(
            "This page does not exist. Choose a page from the navigation.",
          );
      }
      if (!ignore) {
        setData(result);
      }
    }
    void load()
      .catch((err) => {
        if (!ignore) {
          setData({});
          setError(message(err));
          if (err instanceof ApiError && err.status === 401) setMe(null);
        }
      })
      .finally(() => {
        if (!ignore) setLoadedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [
    orgId,
    section,
    detailId,
    page,
    search,
    mine,
    filter,
    revision,
    membership,
    base,
    requestKey,
  ]);
  async function logout(all = false) {
    try {
      await api(all ? "/auth/logout-all" : "/auth/logout", { method: "POST" });
      setMe(null);
      router.push("/login");
    } catch (err) {
      setError(message(err));
    }
  }
  function reload(text = "Changes saved.") {
    setNotice(text);
    setRevision((n) => n + 1);
  }
  async function openEdit(edit: Editing) {
    setError("");
    try {
      if (edit.kind === "task" || edit.kind === "project") {
        const [clients, projects, members] = await Promise.all([
          allPages<ClientView>(`${base}/clients`),
          allPages<ProjectView>(`${base}/projects`),
          api<MembershipView[]>(`${base}/members`),
        ]);
        setRefs({ clients, projects, members });
      }
      setEditing(edit);
    } catch (err) {
      setError(message(err));
    }
  }
  async function save(body: Record<string, unknown>) {
    if (!editing) return;
    const plural = {
      client: "clients",
      project: "projects",
      task: "tasks",
      member: "members",
      organization: "",
    }[editing.kind];
    const path =
      editing.kind === "organization"
        ? base
        : `${base}/${plural}${editing.id ? `/${editing.id}` : ""}`;
    await api(path, {
      method: editing.id
        ? editing.kind === "member" || editing.kind === "organization"
          ? "PATCH"
          : "PUT"
        : "POST",
      body,
    });
    if (editing.kind === "organization" || editing.kind === "member")
      await refreshMe();
    reload();
  }
  async function changeStatus(task: TaskView, status: string) {
    setError("");
    try {
      await api(`${base}/tasks/${task.id}/status`, {
        method: "PATCH",
        body: { status, version: task.version },
      });
      reload(`${task.title} moved to ${displayStatus(status)}.`);
    } catch (err) {
      setError(message(err));
      setRevision((n) => n + 1);
    }
  }
  function remove(
    title: string,
    description: string,
    run: () => Promise<unknown>,
  ) {
    setConfirmation({
      title,
      description,
      run: async () => {
        await run();
        await refreshMe();
        reload("Removed successfully.");
      },
    });
  }
  const taskCard = (task: TaskView) => (
    <article className="task-card" key={task.id}>
      <div className="task-top">
        <Badge value={task.priority} />
        {can(membership!.role, "tasks.manage") &&
          task.project.status === "ACTIVE" && (
            <div className="row-actions">
              <button
                className="icon-button"
                aria-label={`Edit ${task.title}`}
                onClick={() =>
                  void openEdit({
                    kind: "task",
                    id: task.id,
                    initial: { ...task },
                  })
                }
              >
                <Pencil size={14} />
              </button>
              <button
                className="icon-button"
                style={demoMode ? { display: "none" } : undefined}
                aria-label={`Delete ${task.title}`}
                onClick={() =>
                  remove(
                    "Delete task?",
                    `“${task.title}” will be permanently removed. Its audit history will remain.`,
                    () =>
                      api(`${base}/tasks/${task.id}`, {
                        method: "DELETE",
                        body: { version: task.version },
                      }),
                  )
                }
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
      </div>
      <h3>{task.title}</h3>
      <Link className="task-project" href={href(`projects/${task.projectId}`)}>
        <FolderKanban size={13} />
        {task.project.name}
      </Link>
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      <div className="task-meta">
        <span>
          {task.assignee ? (
            <>
              <Avatar name={task.assignee.user.name} />
              {task.assignee.user.name}
            </>
          ) : (
            "Unassigned"
          )}
        </span>
        <span>
          <Clock3 size={13} />
          {dateLabel(task.dueDate)}
        </span>
      </div>
      {task.project.status === "ACTIVE" &&
      (can(membership!.role, "tasks.manage") ||
        task.assigneeMembershipId === membership!.id) ? (
        <select
          className="status-select"
          aria-label={`Status of ${task.title}`}
          value={task.status}
          onChange={(e) => void changeStatus(task, e.target.value)}
        >
          {taskStatuses.map((status) => (
            <option key={status} value={status}>
              {displayStatus(status)}
            </option>
          ))}
        </select>
      ) : (
        <div className="task-readonly">
          <Badge value={task.status} />
          <small>
            {task.project.status !== "ACTIVE"
              ? "Project is closed"
              : "View only"}
          </small>
        </div>
      )}
    </article>
  );
  function pager(result: PageResult<unknown> | undefined) {
    return result && <Pagination {...result} onPage={setPage} />;
  }
  function projectCards(result: PageResult<ProjectView>) {
    return (
      <>
        <div className="project-grid">
          {result.items.map((project) => (
            <Link
              className="project-card"
              key={project.id}
              href={href(`projects/${project.id}`)}
            >
              <div className="project-card-top">
                <span className="project-symbol">
                  <FolderKanban size={22} />
                </span>
                <ArrowUpRight size={18} />
              </div>
              <div>
                <small>{project.client.name}</small>
                <h2>{project.name}</h2>
                <p>
                  {project.description ||
                    "A shared space for this project’s next steps."}
                </p>
              </div>
              <div className="project-card-bottom">
                <Badge value={project.status} />
                <span>
                  {project._count?.tasks || 0} tasks ·{" "}
                  {dateLabel(project.dueDate)}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {!result.items.length && (
          <Empty
            title="No projects here yet"
            description="Connect a project to a client to start organizing work."
          />
        )}
        {pager(result)}
      </>
    );
  }
  if (me === undefined)
    return (
      <main id="main-content" className="boot-state">
        <span className="wordmark">
          flowdesk<span>•</span>
        </span>
        <p role="status">Opening your workspace…</p>
      </main>
    );
  if (!me)
    return (
      <AuthScreen
        key={pathname}
        register={!demoMode && pathname === "/register"}
        demoMode={demoMode}
        initialError={error}
        onSuccess={() => void refreshMe()}
      />
    );
  if (
    !demoMode &&
    (pathname === "/onboarding" ||
      (!me.memberships.length &&
        pathname !== "/login" &&
        pathname !== "/register"))
  )
    return (
      <Onboarding
        me={me}
        onLogout={() => void logout()}
        onCreated={async (org) => {
          await refreshMe();
          router.push(`/o/${org.id}/dashboard`);
        }}
      />
    );
  if (!membership)
    return (
      <main id="main-content" className="boot-state">
        <h1>Choose your workspace.</h1>
        <p>You can access workspaces where you have an active membership.</p>
        {me.memberships.map((m) => (
          <Link
            className="button secondary"
            key={m.id}
            href={`/o/${m.organizationId}/dashboard`}
          >
            {m.organization?.name}
          </Link>
        ))}
        {!demoMode && (
          <Link className="button" href="/onboarding">
            Create workspace
          </Link>
        )}
        <button className="button secondary" onClick={() => void logout()}>
          Sign out
        </button>
      </main>
    );
  const title = titles[section] || [
    "Page unavailable",
    "Choose another workspace page.",
  ];
  return (
    <Shell
      demoMode={demoMode}
      me={me}
      membership={membership}
      section={section}
      onSwitch={(id) =>
        router.push(id === "new" ? "/onboarding" : `/o/${id}/dashboard`)
      }
      onLogout={() => void logout()}
    >
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {section === "dashboard"
              ? `WELCOME BACK, ${me.user.name.split(" ")[0].toUpperCase()}`
              : section.toUpperCase()}
          </p>
          <h1>{data.client?.name || data.project?.name || title[0]}</h1>
          <p>
            {data.client
              ? "Client details and connected projects."
              : data.project
                ? `${data.project.client.name} · ${data.project.description || "Keep this project moving forward."}`
                : title[1]}
          </p>
        </div>
        <div className="heading-actions">
          {detailId && (
            <Link className="button secondary" href={href(section)}>
              <ArrowLeft size={16} />
              Back
            </Link>
          )}
          {section === "clients" && can(membership.role, "clients.manage") && (
            <button
              className="button"
              onClick={() =>
                void openEdit(
                  data.client
                    ? {
                        kind: "client",
                        id: data.client.id,
                        initial: { ...data.client },
                      }
                    : { kind: "client" },
                )
              }
            >
              <Plus size={16} />
              {data.client ? "Edit client" : "New client"}
            </button>
          )}
          {section === "projects" &&
            can(membership.role, "projects.manage") && (
              <button
                className="button"
                onClick={() =>
                  void openEdit(
                    data.project
                      ? {
                          kind: "project",
                          id: data.project.id,
                          initial: { ...data.project },
                        }
                      : { kind: "project" },
                  )
                }
              >
                <Plus size={16} />
                {data.project ? "Edit project" : "New project"}
              </button>
            )}
          {section === "tasks" && can(membership.role, "tasks.manage") && (
            <button
              className="button"
              onClick={() => void openEdit({ kind: "task" })}
            >
              <Plus size={16} />
              New task
            </button>
          )}
          {section === "members" && can(membership.role, "members.manage") && (
            <button
              className="button"
              onClick={() => void openEdit({ kind: "member" })}
            >
              <Plus size={16} />
              Add teammate
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div className="notice" role="status">
          <CheckCheck size={17} />
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="error error-row" role="alert">
          <span>{error}</span>
          <button
            className="button secondary small"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}
      {!detailId && ["clients", "projects", "tasks"].includes(section) && (
        <form
          className="toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(searchDraft);
          }}
        >
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label={`Search ${section}`}
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder={`Search ${section}…`}
              maxLength={100}
            />
            <button className="button secondary small">Search</button>
          </div>
          {section === "tasks" && (
            <div className="task-filters">
              <label>
                <input
                  type="checkbox"
                  checked={mine}
                  onChange={(e) => {
                    setMine(e.target.checked);
                    setPage(1);
                  }}
                />
                Assigned to me
              </label>
              <select
                aria-label="Filter task status"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {taskStatuses.map((s) => (
                  <option value={s} key={s}>
                    {displayStatus(s)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>
      )}
      {loading ? (
        <div className="loading-panel" role="status">
          <span className="loading-dot" />
          Loading workspace data…
        </div>
      ) : (
        <>
          {data.dashboard && (
            <>
              <div className="metrics">
                {[
                  [
                    Building2,
                    "Active clients",
                    data.dashboard.activeClients,
                    "clients",
                  ],
                  [
                    FolderKanban,
                    "Active projects",
                    data.dashboard.activeProjects,
                    "projects",
                  ],
                  [
                    MoreHorizontal,
                    "Open tasks",
                    data.dashboard.openTasks,
                    "tasks",
                  ],
                  [Clock3, "Due in 7 days", data.dashboard.dueSoon, "tasks"],
                ].map(([Icon, label, count, link]) => {
                  const MetricIcon = Icon as typeof Building2;
                  return (
                    <Link
                      href={href(String(link))}
                      className="metric"
                      key={String(label)}
                    >
                      <div>
                        <span>{String(label)}</span>
                        <MetricIcon size={19} />
                      </div>
                      <strong>{String(count)}</strong>
                      <small>
                        {label === "Due in 7 days"
                          ? "Open tasks due today through the next 7 days"
                          : "View " + String(label).toLowerCase()}
                        <ArrowUpRight size={14} />
                      </small>
                    </Link>
                  );
                })}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Your next steps</h2>
                      <p>Up to six open tasks assigned to you.</p>
                    </div>
                    <Link href={href("tasks")}>
                      Task board
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                  {data.dashboard.myTasks.length ? (
                    <div className="my-tasks">
                      {data.dashboard.myTasks.map((t) => (
                        <Link key={t.id} href={href(`projects/${t.projectId}`)}>
                          <span className="task-check" />
                          <div>
                            <strong>{t.title}</strong>
                            <small>
                              {t.project.name} · {dateLabel(t.dueDate)}
                            </small>
                          </div>
                          <Badge value={t.priority} />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="A clear to-do list"
                      description="Your assigned open tasks will appear here."
                      action={
                        <Link
                          className="button secondary small"
                          href={href("tasks")}
                        >
                          Explore task board
                        </Link>
                      }
                    />
                  )}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent activity</h2>
                      <p>A live record of workspace changes.</p>
                    </div>
                    <Link href={href("activity")} aria-label="See all activity">
                      <ArrowUpRight size={17} />
                    </Link>
                  </div>
                  <Activity items={data.dashboard.recentActivity} />
                  {!data.dashboard.recentActivity.length && (
                    <Empty
                      title="A fresh start"
                      description="Your workspace activity will appear here."
                    />
                  )}
                </section>
              </div>
              {data.dashboard.activeClients === 0 && (
                <div className="getting-started">
                  <span className="project-symbol">
                    <Building2 size={24} />
                  </span>
                  <div>
                    <h2>Your first client is the beginning.</h2>
                    <p>
                      Add a client, connect a project, then break the work into
                      tasks.
                    </p>
                  </div>
                  <Link className="button" href={href("clients")}>
                    Get started
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              )}
            </>
          )}
          {data.clients && (
            <section className="panel">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Contact</th>
                      <th>Status</th>
                      <th>Projects</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clients.items.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link
                            className="table-name"
                            href={href(`clients/${c.id}`)}
                          >
                            <span className="client-symbol">
                              {c.name.slice(0, 1)}
                            </span>
                            {c.name}
                          </Link>
                        </td>
                        <td>
                          <strong>{c.contactName || "No contact added"}</strong>
                          <small>{c.email || "No email added"}</small>
                        </td>
                        <td>
                          <Badge value={c.status} />
                        </td>
                        <td>{c._count?.projects || 0}</td>
                        <td>
                          <Link
                            className="icon-button"
                            href={href(`clients/${c.id}`)}
                            aria-label={`Open ${c.name}`}
                          >
                            <ArrowUpRight size={17} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.clients.items.length && (
                <Empty
                  title={search ? "No matching clients" : "Start with a client"}
                  description={
                    search
                      ? "Try another name or email address."
                      : "Add a fictional client to connect relationships with the work."
                  }
                />
              )}
              {pager(data.clients)}
            </section>
          )}
          {data.client && (
            <section className="detail-summary panel">
              <div>
                <p className="eyebrow">CONTACT</p>
                <h2>{data.client.contactName || "No contact added"}</h2>
                <p>
                  {data.client.email || "No email added"}
                  <br />
                  {data.client.phone || "No phone added"}
                </p>
              </div>
              <div>
                <p className="eyebrow">CLIENT NOTES</p>
                <p>{data.client.notes || "No notes yet."}</p>
                <Badge value={data.client.status} />
              </div>
              {!demoMode && can(membership.role, "clients.manage") && (
                <button
                  className="button danger secondary"
                  onClick={() =>
                    remove(
                      "Delete client?",
                      `“${data.client!.name}” can only be deleted if it has no projects. Archive it to preserve connected work.`,
                      async () => {
                        await api(`${base}/clients/${data.client!.id}`, {
                          method: "DELETE",
                        });
                        router.push(href("clients"));
                      },
                    )
                  }
                >
                  <Trash2 size={15} />
                  {demoMode ? "Deletion disabled in demo" : "Delete client"}
                </button>
              )}
            </section>
          )}
          {data.client && (
            <div className="section-heading">
              <h2>Connected projects</h2>
              {can(membership.role, "projects.manage") && (
                <button
                  className="button secondary small"
                  onClick={() =>
                    void openEdit({
                      kind: "project",
                      initial: { clientId: data.client!.id },
                    })
                  }
                >
                  <Plus size={15} />
                  New project
                </button>
              )}
            </div>
          )}
          {data.projects && projectCards(data.projects)}
          {data.project && (
            <>
              <div className="project-detail-bar">
                <Badge value={data.project.status} />
                <span>
                  Started{" "}
                  {data.project.startDate
                    ? dateLabel(data.project.startDate)
                    : "—"}
                </span>
                <span>Due {dateLabel(data.project.dueDate)}</span>
                {can(membership.role, "tasks.manage") &&
                  data.project.status === "ACTIVE" && (
                    <button
                      className="button small"
                      onClick={() =>
                        void openEdit({
                          kind: "task",
                          initial: { projectId: data.project!.id },
                        })
                      }
                    >
                      <Plus size={15} />
                      New task
                    </button>
                  )}
              </div>
              <div className="section-heading">
                <h2>Project tasks</h2>
                <p>
                  Closed projects are read only. Reopen a project to make
                  changes.
                </p>
              </div>
            </>
          )}
          {data.tasks && (
            <>
              <div className="board" aria-label="Task board">
                {taskStatuses.map((status) => {
                  const tasks = data.tasks!.items.filter(
                    (t) => t.status === status,
                  );
                  return (
                    <section
                      className={`board-column column-${status.toLowerCase()}`}
                      key={status}
                    >
                      <header>
                        <h2>
                          <span />
                          {displayStatus(status)}
                        </h2>
                        <span className="column-count">{tasks.length}</span>
                      </header>
                      <div className="column-tasks">
                        {tasks.map(taskCard)}
                        {!tasks.length && (
                          <p className="column-empty">No tasks in this stage</p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
              <p className="board-note">
                Counts show this page of results. Change status using each
                task’s selector.
              </p>
              {pager(data.tasks)}
            </>
          )}
          {data.members && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>{data.members.length} active teammates</h2>
                  <p>
                    {can(membership.role, "members.manage")
                      ? "Add registered accounts and set their workspace roles."
                      : "An admin manages access. Members can update their own assigned tasks."}
                  </p>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Teammate</th>
                      <th>Email address</th>
                      <th>Role</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <span className="table-name">
                            <Avatar name={m.user.name} />
                            {m.user.name}
                            {m.id === membership.id && <small>(you)</small>}
                          </span>
                        </td>
                        <td>{m.user.email}</td>
                        <td>
                          <Badge value={m.role} />
                        </td>
                        <td>
                          {can(membership.role, "members.manage") && (
                            <div className="row-actions">
                              <button
                                className="button secondary small"
                                onClick={() =>
                                  void openEdit({
                                    kind: "member",
                                    id: m.id,
                                    initial: { role: m.role },
                                  })
                                }
                              >
                                Edit role
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Remove ${m.user.name}`}
                                onClick={() =>
                                  remove(
                                    "Remove teammate?",
                                    `${m.user.name} will lose access immediately. Their tasks will become unassigned.`,
                                    () =>
                                      api(`${base}/members/${m.id}`, {
                                        method: "DELETE",
                                      }),
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          {data.activity && (
            <section className="panel">
              <Activity items={data.activity.items} />
              {!data.activity.items.length && (
                <Empty
                  title="No activity yet"
                  description="Your visible workspace changes will appear here."
                />
              )}
              {pager(data.activity)}
            </section>
          )}
          {data.organization && (
            <div className="settings-grid">
              <section className="panel settings-panel">
                <p className="eyebrow">WORKSPACE DETAILS</p>
                <h2>{data.organization.name}</h2>
                <p>
                  Roles apply within this workspace. Access is checked on every
                  request.
                </p>
                {can(membership.role, "organization.manage") ? (
                  <button
                    className="button secondary"
                    onClick={() =>
                      setEditing({
                        kind: "organization",
                        id: orgId,
                        initial: { name: data.organization!.name },
                      })
                    }
                  >
                    <Pencil size={15} />
                    Edit workspace
                  </button>
                ) : (
                  <p className="form-hint">
                    Only a workspace admin can change these details.
                  </p>
                )}
              </section>
              <section className="panel settings-panel">
                <p className="eyebrow">YOUR ACCOUNT</p>
                <h2>{me.user.name}</h2>
                <p>{me.user.email}</p>
                <button
                  className="button secondary"
                  onClick={() =>
                    remove(
                      "Sign out everywhere?",
                      "All your active sessions across devices will end immediately.",
                      () => logout(true),
                    )
                  }
                >
                  Sign out of all devices
                </button>
                <p className="form-hint">
                  FlowDesk is an independent demo. No billing or production
                  customer data.
                </p>
              </section>
            </div>
          )}
        </>
      )}
      {editing && (
        <EntityDialog
          key={`${editing.kind}-${editing.id || "new"}`}
          kind={editing.kind}
          editing={!!editing.id}
          initial={editing.initial}
          {...refs}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <p>{confirmation.description}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setConfirmation(null)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await confirmation.run();
                  setConfirmation(null);
                } catch (err) {
                  setError(message(err));
                  setConfirmation(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Working…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </Shell>
  );
}

function Onboarding({
  me,
  onCreated,
  onLogout,
}: {
  me: MeView;
  onCreated: (org: OrganizationView) => Promise<void>;
  onLogout: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("name");
    setBusy(true);
    setError("");
    try {
      const org = await api<OrganizationView>("/organizations", {
        method: "POST",
        body: { name },
      });
      await onCreated(org);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="onboarding" id="main-content">
      <Link href="/" className="wordmark">
        flowdesk<span>•</span>
      </Link>
      <div className="panel onboarding-card">
        <span className="project-symbol">
          <Building2 size={27} />
        </span>
        <p className="eyebrow">A HOME FOR YOUR TEAM</p>
        <h1>Create your workspace.</h1>
        <p>
          Hi {me.user.name.split(" ")[0]}. Give your team’s work a place to come
          together. You’ll be its first admin.
        </p>
        <form onSubmit={submit}>
          <label>
            Workspace name
            <input
              name="name"
              placeholder="e.g. Cedar Studio"
              required
              maxLength={100}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Creating…" : "Create workspace"}
            <ArrowUpRight size={17} />
          </button>
        </form>
        <p className="form-hint">
          Independent Demo Project · Use fictional information.
        </p>
        {me.memberships.length > 0 && (
          <Link href={`/o/${me.memberships[0].organizationId}/dashboard`}>
            Back to existing workspace
          </Link>
        )}
        <button className="text-button" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </main>
  );
}
