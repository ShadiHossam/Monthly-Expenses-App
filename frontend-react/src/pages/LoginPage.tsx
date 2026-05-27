import { useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username, password);
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ft-background dark:bg-ve-background px-4">
      <div className="w-full max-w-sm">

        {/* Logo + title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-ft-primary dark:bg-ve-primary-dim rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <MSIcon name="account_balance_wallet" className="text-3xl text-white dark:text-ve-background" />
          </div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">FinTrack</h1>
          <p className="text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1 text-sm">Sign in to your account</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit}
          className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-6 space-y-4 shadow-sm">

          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-ve-error/10 border border-red-100 dark:border-ve-error/20 text-red-700 dark:text-ve-error text-sm px-4 py-3 rounded-xl">
              <MSIcon name="error" className="text-base shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ft-on-surface dark:text-ve-on-surface mb-1.5">Username</label>
            <input
              className="w-full px-4 py-3 border border-ft-outline-variant dark:border-ve-outline rounded-xl bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary text-sm"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ft-on-surface dark:text-ve-on-surface mb-1.5">Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 border border-ft-outline-variant dark:border-ve-outline rounded-xl bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary text-sm"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-ft-primary dark:bg-ve-primary-dim hover:opacity-90 text-white dark:text-ve-background font-semibold py-3 rounded-xl transition-opacity disabled:opacity-60 text-sm">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-6">
          No account?{" "}
          <a href="/register" className="text-ft-primary dark:text-ve-primary font-medium hover:underline">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
