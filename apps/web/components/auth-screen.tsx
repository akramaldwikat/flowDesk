import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowUpRight, Layers3, ArrowRight, ShieldCheck } from "lucide-react";
import { api, message } from "../lib/api";
export function AuthScreen({
  register,
  demoMode = false,
  initialError = "",
  onSuccess,
}: {
  register: boolean;
  demoMode?: boolean;
  initialError?: string;
  onSuccess: () => void;
}) {
  const [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(register ? "/auth/register" : "/auth/login", {
        method: "POST",
        body: values,
      });
      onSuccess();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Link className="wordmark" href="/">
          flowdesk<span>•</span>
        </Link>
        <div>
          <p className="eyebrow">A CLEARER WAY TO WORK</p>
          <h2>
            The work is connected.
            <br />
            Your workspace
            <br />
            should be, too.
          </h2>
          <p>
            Clients, projects and tasks. A considered home for your team’s
            day-to-day operations.
          </p>
          <div className="auth-flow">
            <span>Client</span>
            <ArrowRight size={16} />
            <span>Project</span>
            <ArrowRight size={16} />
            <span>Task</span>
          </div>
        </div>
        <div className="demo-note">
          <Layers3 size={18} />
          <span>
            Independent Demo Project
            <br />
            <small>Original software. Fictional sample data.</small>
          </span>
        </div>
      </aside>
      <main id="main-content" className="auth-main">
        <div className="auth-card">
          <p className="eyebrow">YOUR OPERATIONS, IN ONE PLACE</p>
          <h1>{register ? "Create your account." : "Welcome back."}</h1>
          <p>
            {register
              ? "Start with an account. Then create a workspace for your team."
              : "Sign in to pick up where your team left off."}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={1}
                  maxLength={100}
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={12}
                maxLength={128}
                required
              />
              {register && (
                <small>
                  Use at least 12 characters. Keep this password private.
                </small>
              )}
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="button" disabled={busy}>
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
              <ArrowUpRight size={17} />
            </button>
          </form>
          {demoMode && (
            <p className="demo-note">
              Shared portfolio demo. Use the fictional Admin, Manager or Member
              account supplied by the owner. Registration is closed. Cold starts
              can take a minute. Use fictional data only; changes may be reset.
            </p>
          )}
          <p hidden={demoMode} className="auth-switch">
            {register ? "Already have an account?" : "New to FlowDesk?"}{" "}
            <Link href={register ? "/login" : "/register"}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="auth-private">
            <ShieldCheck size={16} />
            This is an independent application demo. Use fictional information.
          </p>
        </div>
      </main>
    </div>
  );
}
