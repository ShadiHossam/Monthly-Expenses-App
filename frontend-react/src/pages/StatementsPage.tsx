import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { cn, formatAED } from "../lib/utils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

const STATUS_CONFIG: Record<string, { label: string; light: string; dark: string }> = {
  passed:  { label: "Passed",  light: "bg-emerald-50 text-emerald-700", dark: "dark:bg-ve-surface-high dark:text-ve-primary" },
  failed:  { label: "Failed",  light: "bg-red-50 text-red-600",         dark: "dark:bg-ve-surface-high dark:text-ve-error" },
  flagged: { label: "Flagged", light: "bg-amber-50 text-amber-600",     dark: "dark:bg-ve-surface-high dark:text-amber-400" },
  pending: { label: "Pending", light: "bg-ft-surface-low text-ft-on-surface-variant", dark: "dark:bg-ve-surface-high dark:text-ve-on-surface-variant" },
};

function formatMonth(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryAllMsg, setRetryAllMsg] = useState<string | null>(null);

  useEffect(() => {
    api.listStatements()
      .then(data => setStatements(Array.isArray(data) ? data : []))
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, filename: string) {
    if (!window.confirm(`Delete statement "${filename}"? This will also remove all associated transactions.`)) return;
    setDeletingId(id);
    try { await api.deleteStatement(id); setStatements(prev => prev.filter(s => s.id !== id)); }
    catch {} finally { setDeletingId(null); }
  }

  async function handleRetry(id: number) {
    setRetryingId(id);
    try {
      const updated = await api.reverifyStatement(id);
      setStatements(prev => prev.map(s => s.id === id ? { ...s, verify_status: updated.verify_status } : s));
    } catch {} finally { setRetryingId(null); }
  }

  async function handleRetryAll() {
    setRetryingAll(true);
    setRetryAllMsg(null);
    try {
      const result = await api.reverifyAllPending();
      setStatements(prev => prev.map(s =>
        (s.verify_status === "pending" || s.verify_status === "failed")
          ? { ...s, verify_status: "pending" }
          : s
      ));
      setRetryAllMsg(`Queued ${result.queued} statement${result.queued !== 1 ? "s" : ""} for reprocessing`);
    } catch {
      setRetryAllMsg("Failed to queue statements — please try again");
    } finally {
      setRetryingAll(false);
    }
  }

  const stuckCount = statements.filter(s => s.verify_status === "pending" || s.verify_status === "failed").length;

  if (loading) {
    return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="px-6 pt-6 pb-10 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Statements</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">All uploaded bank statements</p>
        </div>

        {stuckCount > 0 && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleRetryAll}
              disabled={retryingAll}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {retryingAll
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <MSIcon name="replay" className="text-lg" />}
              Retry All Pending / Failed ({stuckCount})
            </button>
            {retryAllMsg && (
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{retryAllMsg}</p>
            )}
          </div>
        )}
      </div>

      {statements.length === 0 ? (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-16 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center">
            <MSIcon name="description" className="text-4xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          </div>
          <div>
            <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface">No statements yet</p>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1">Upload your first financial statement to begin tracking your cash flow and generating insights.</p>
          </div>
          <Link to="/upload"
            className="flex items-center gap-2 px-6 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
            <MSIcon name="upload" className="text-lg" />
            Upload Statement
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {statements.map(stmt => {
            const statusCfg = STATUS_CONFIG[stmt.verify_status] ?? STATUS_CONFIG.pending;
            const isStuck = stmt.verify_status === "pending" || stmt.verify_status === "failed";
            return (
              <div key={stmt.id} className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center shrink-0">
                      <MSIcon name="description" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">
                          {formatMonth(stmt.period_start)} → {formatMonth(stmt.period_end)}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusCfg.light, statusCfg.dark)}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5 truncate">{stmt.filename}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isStuck && (
                      <button
                        onClick={() => handleRetry(stmt.id)}
                        disabled={retryingId === stmt.id}
                        title="Retry processing"
                        className="text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 transition-colors disabled:opacity-40"
                      >
                        {retryingId === stmt.id
                          ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                          : <MSIcon name="replay" className="text-xl" />}
                      </button>
                    )}
                    <button onClick={() => handleDelete(stmt.id, stmt.filename)} disabled={deletingId === stmt.id}
                      className="text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-red-500 dark:hover:text-ve-error transition-colors disabled:opacity-40">
                      {deletingId === stmt.id
                        ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <MSIcon name="delete" className="text-xl" />}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Opening Balance</p>
                    <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface tabular-nums mt-0.5">{formatAED(stmt.opening_balance ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Closing Balance</p>
                    <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface tabular-nums mt-0.5">{formatAED(stmt.closing_balance ?? 0)}</p>
                  </div>
                  {stmt.transaction_count != null && (
                    <div>
                      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Transactions</p>
                      <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface mt-0.5">{stmt.transaction_count}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Uploaded</p>
                    <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface mt-0.5">{formatDate(stmt.created_at)}</p>
                  </div>
                </div>

                {stmt.confidence != null && (
                  <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-2">
                    Confidence: <span className={cn("font-semibold", stmt.confidence >= 0.9 ? "text-emerald-600 dark:text-ve-primary" : stmt.confidence >= 0.7 ? "text-amber-500" : "text-red-500 dark:text-ve-error")}>
                      {Math.round(stmt.confidence * 100)}%
                    </span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
