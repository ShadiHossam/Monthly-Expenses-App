import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ft-background dark:bg-ve-background px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl text-green-600 dark:text-green-400">mark_email_read</span>
          </div>
          <h2 className="text-xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-2">Check your email</h2>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-6">
            If that email exists, a reset link has been sent. The link expires in 1 hour.
          </p>
          <Link to="/login" className="text-ft-primary dark:text-ve-primary underline text-sm">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ft-background dark:bg-ve-background px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <div className="text-center mb-2">
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Reset password</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1">
            Enter your email and we'll send a reset link
          </p>
        </div>
        {error && (
          <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-2">{error}</p>
        )}
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-4 py-2.5 text-sm
                     bg-ft-surface dark:bg-ve-surface text-ft-on-surface dark:text-ve-on-surface
                     outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-ft-primary dark:bg-ve-primary text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <Link to="/login" className="text-sm text-center text-ft-on-surface-variant dark:text-ve-on-surface-variant underline">
          Back to login
        </Link>
      </form>
    </div>
  );
}
