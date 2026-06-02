import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Minimum 8 characters"); return; }
    setLoading(true);
    setError("");
    try {
      await api.resetPassword(token, password);
      navigate("/login?reset=1");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ft-background dark:bg-ve-background px-4">
        <div className="text-center">
          <p className="text-red-500">Invalid or missing reset token.</p>
          <a href="/forgot-password" className="text-ft-primary dark:text-ve-primary underline text-sm mt-2 block">
            Request a new link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ft-background dark:bg-ve-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Set new password</h1>
        </div>
        {error && (
          <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2">{error}</p>
        )}
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="New password (min 8 chars)"
          className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-4 py-2.5 text-sm
                     bg-ft-surface dark:bg-ve-surface text-ft-on-surface dark:text-ve-on-surface
                     outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
        />
        <input
          type="password"
          required
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-4 py-2.5 text-sm
                     bg-ft-surface dark:bg-ve-surface text-ft-on-surface dark:text-ve-on-surface
                     outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-ft-primary dark:bg-ve-primary text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
