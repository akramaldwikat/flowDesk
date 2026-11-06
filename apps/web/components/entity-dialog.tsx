import { useState, type FormEvent } from "react";
import {
  priorities,
  projectStatuses,
  roles,
  type ClientView,
  type ProjectView,
  type MembershipView,
} from "@flowdesk/contracts";
import { Modal } from "./primitives";
import { displayStatus, message } from "../lib/api";
export type EntityKind =
  "client" | "project" | "task" | "member" | "organization";
type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  max?: number;
  options?: { value: string; label: string }[];
  multiline?: boolean;
};
export function EntityDialog({
  kind,
  initial,
  editing = false,
  clients,
  projects,
  members,
  onSave,
  onClose,
}: {
  kind: EntityKind;
  initial?: Record<string, unknown>;
  editing?: boolean;
  clients: ClientView[];
  projects: ProjectView[];
  members: MembershipView[];
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  let fields: Field[] = [];
  if (kind === "client")
    fields = [
      { name: "name", label: "Client name", required: true, max: 150 },
      { name: "contactName", label: "Contact name", max: 100 },
      { name: "email", label: "Email address", type: "email", max: 254 },
      { name: "phone", label: "Phone", max: 40 },
      {
        name: "status",
        label: "Status",
        options: ["ACTIVE", "ARCHIVED"].map((value) => ({
          value,
          label: displayStatus(value),
        })),
      },
      { name: "notes", label: "Notes", multiline: true, max: 3000 },
    ];
  if (kind === "project")
    fields = [
      { name: "name", label: "Project name", required: true, max: 150 },
      {
        name: "clientId",
        label: "Client",
        required: true,
        options: clients.map((c) => ({ value: c.id, label: c.name })),
      },
      {
        name: "status",
        label: "Project status",
        options: projectStatuses.map((value) => ({
          value,
          label: displayStatus(value),
        })),
      },
      { name: "startDate", label: "Start date", type: "date" },
      { name: "dueDate", label: "Due date", type: "date" },
      { name: "description", label: "Description", multiline: true, max: 3000 },
    ];
  if (kind === "task")
    fields = [
      { name: "title", label: "Task title", required: true, max: 180 },
      {
        name: "projectId",
        label: "Project",
        required: true,
        options: projects
          .filter((p) => p.status === "ACTIVE")
          .map((p) => ({ value: p.id, label: p.name })),
      },
      {
        name: "priority",
        label: "Priority",
        options: priorities.map((value) => ({
          value,
          label: displayStatus(value),
        })),
      },
      {
        name: "assigneeMembershipId",
        label: "Assignee",
        options: [
          { value: "", label: "Unassigned" },
          ...members.map((m) => ({
            value: m.id,
            label: m.user.name + " · " + displayStatus(m.role),
          })),
        ],
      },
      { name: "dueDate", label: "Due date", type: "date" },
      { name: "description", label: "Description", multiline: true, max: 3000 },
    ];
  if (kind === "member")
    fields = initial
      ? [
          {
            name: "role",
            label: "Workspace role",
            options: roles.map((value) => ({
              value,
              label: displayStatus(value),
            })),
          },
        ]
      : [
          {
            name: "email",
            label: "Registered teammate email",
            type: "email",
            required: true,
          },
          {
            name: "role",
            label: "Workspace role",
            options: roles.map((value) => ({
              value,
              label: displayStatus(value),
            })),
          },
        ];
  if (kind === "organization")
    fields = [
      { name: "name", label: "Workspace name", required: true, max: 100 },
    ];
  const defaultFor = (field: Field) => {
    const value = initial?.[field.name];
    if (field.type === "date")
      return typeof value === "string" ? value.slice(0, 10) : "";
    if (value !== undefined && value !== null) return String(value);
    if (field.name === "role") return "MEMBER";
    if (field.name === "priority") return "MEDIUM";
    if (field.name === "status") return "ACTIVE";
    return "";
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data: Record<string, unknown> = Object.fromEntries(
      new FormData(e.currentTarget),
    );
    if (kind === "task" && editing && initial) data.version = initial.version;
    try {
      await onSave(data);
      onClose();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${editing ? "Edit" : "New"} ${kind === "organization" ? "workspace" : kind === "member" ? "team member" : kind}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        {kind === "member" && !initial && (
          <p className="form-hint">
            Your teammate must register an account first. This grants access to
            the current workspace only.
          </p>
        )}
        <fieldset disabled={busy} className="form-fields">
          {fields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.required ? " *" : ""}
              {field.multiline ? (
                <textarea
                  name={field.name}
                  defaultValue={defaultFor(field)}
                  maxLength={field.max}
                  rows={4}
                />
              ) : field.options ? (
                <select
                  name={field.name}
                  defaultValue={defaultFor(field)}
                  required={field.required}
                >
                  {field.required && (
                    <option value="" disabled>
                      Select {field.label.toLowerCase()}
                    </option>
                  )}
                  {field.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type || "text"}
                  defaultValue={defaultFor(field)}
                  required={field.required}
                  maxLength={field.max}
                />
              )}
            </label>
          ))}
        </fieldset>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy
              ? "Saving…"
              : "Save " + (kind === "organization" ? "workspace" : kind)}
          </button>
        </div>
      </form>
    </Modal>
  );
}
