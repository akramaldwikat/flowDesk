import Link from "next/link";
import { useState, useRef, type ReactNode } from "react";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Columns3,
  Users,
  History,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Plus,
  Layers3,
} from "lucide-react";
import type { MeView, MembershipView } from "@flowdesk/contracts";
import { Avatar, Badge } from "./primitives";
const navigation = [
  ["dashboard", "Overview", LayoutDashboard],
  ["clients", "Clients", Building2],
  ["projects", "Projects", FolderKanban],
  ["tasks", "Task board", Columns3],
  ["members", "Team members", Users],
  ["activity", "Activity", History],
  ["settings", "Settings", Settings],
] as const;
export function Shell({
  me,
  membership,
  section,
  onSwitch,
  onLogout,
  children,
}: {
  me: MeView;
  membership: MembershipView;
  section: string;
  onSwitch: (id: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <div className="app-shell" data-menu={open ? "open" : "closed"}>
      <aside
        className="sidebar"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            toggle.current?.focus();
          }
        }}
      >
        <Link
          className="wordmark"
          href={`/o/${membership.organizationId}/dashboard`}
        >
          flowdesk<span>•</span>
        </Link>
        <div className="workspace-select">
          <span className="workspace-icon">
            <Layers3 size={20} />
          </span>
          <div>
            <small>WORKSPACE</small>
            <select
              aria-label="Switch workspace"
              value={membership.organizationId}
              onChange={(e) => {
                setOpen(false);
                onSwitch(e.target.value);
              }}
            >
              {me.memberships.map((m) => (
                <option key={m.id} value={m.organizationId}>
                  {m.organization?.name}
                </option>
              ))}
              <option value="new">+ New workspace</option>
            </select>
          </div>
          <ChevronDown size={14} aria-hidden="true" />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Workspace navigation">
          {navigation.map(([slug, label, Icon]) => (
            <Link
              key={slug}
              href={`/o/${membership.organizationId}/${slug}`}
              aria-current={section === slug ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="independent-tag">
            <span className="status-dot" />
            Independent demo
          </div>
          <p>
            Sample records are fictional.
            <br />
            No real customers are represented.
          </p>
          <div className="sidebar-user">
            <Avatar name={me.user.name} />
            <div>
              <strong>{me.user.name}</strong>
              <small>{me.user.email}</small>
            </div>
            <button
              className="icon-button"
              onClick={onLogout}
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {open && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="workspace-main">
        <header className="topbar">
          <button
            ref={toggle}
            className="icon-button mobile-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            <strong>
              {navigation.find(([key]) => key === section)?.[1] || "Workspace"}
            </strong>
          </div>
          <div className="topbar-right">
            <Badge value={membership.role} />
            <Link
              className="button secondary small workspace-add"
              href="/onboarding"
            >
              <Plus size={15} />
              New workspace
            </Link>
          </div>
        </header>
        <main id="main-content" className="page-container">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>FlowDesk · Independent Demo Project</span>
          <span>Built for clear, connected work.</span>
        </footer>
      </div>
    </div>
  );
}
