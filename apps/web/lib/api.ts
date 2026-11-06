export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}
let refreshing: Promise<boolean> | undefined;
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  retry = true,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: options.method || "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-FlowDesk-Request": "1" },
    ...(options.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (
    response.status === 401 &&
    retry &&
    ![
      "/auth/login",
      "/auth/register",
      "/auth/logout",
      "/auth/refresh",
    ].includes(path)
  ) {
    if (!refreshing)
      refreshing = fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-FlowDesk-Request": "1",
        },
        signal: AbortSignal.timeout(20000),
      })
        .then((r) => r.ok)
        .catch(() => false)
        .finally(() => {
          refreshing = undefined;
        });
    if (await refreshing) return api<T>(path, options, false);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      result?.error?.message ||
        "The request could not be completed. Please try again.",
      result?.error?.details,
    );
  return result as T;
}
export const displayStatus = (value: string) =>
  (
    ({
      TODO: "To do",
      IN_PROGRESS: "In progress",
      REVIEW: "Review",
      DONE: "Done",
      ACTIVE: "Active",
      COMPLETED: "Completed",
      ARCHIVED: "Archived",
      ADMIN: "Admin",
      MANAGER: "Manager",
      MEMBER: "Member",
      LOW: "Low",
      MEDIUM: "Medium",
      HIGH: "High",
      URGENT: "Urgent",
    }) as Record<string, string>
  )[value] || value;
export function dateLabel(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : "No due date";
}
export const message = (e: unknown) =>
  e instanceof ApiError && e.details?.length
    ? e.details.map((d) => `${d.field}: ${d.message}`).join(" · ")
    : e instanceof Error
      ? e.message
      : "Something went wrong. Please try again.";
