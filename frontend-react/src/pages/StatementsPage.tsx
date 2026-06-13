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

function parseVerifyErrors(raw: any): string[] {
  if (!raw) return ["Unknown error"];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
      return [String(parsed)];
    } catch { return [raw]; }
  }
  if (Array.isArray(raw)) return raw.map(String);
  return [JSON.stringify(raw)];
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const [retryAllMsg, setRetryAllMsg] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [errorStatement, setErrorStatement] = useState<any | null>(null);

  useEffect(() => {
    api.listStatements()
      .then(data => setStatements(Array.isArray(data) ? data : []))
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, filename: string) {
    if (!window.confirm(`Delete statement "${filename}"? This will also remove all associated transactions.`)) return;
    setDeletingId(id);
    try {
      await api.deleteStatement(id);
      setStatements(prev => prev.filter(s => s.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch {} finally { setDeletingId(null); }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (!window.confirm(`Delete ${ids.length} statement${ids.length !== 1 ? "s" : ""}? This will also remove all associated transactions.`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map(id => api.deleteStatement(id)));
      const succeeded = new Set(ids.filter((_, i) => results[i].status === "fulfilled"));
      if (succeeded.size > 0) {
        setStatements(prev => prev.filter(s => !succeeded.has(s.id)));
        setSelectedIds(prev => { const next = new Set(prev); succeeded.forEach(id => next.delete(id)); return next; });
      }
      const failedCount = results.filter(r => r.status === "rejected").length;
      if (failedCount > 0) {
        alert(`${failedCount} statement${failedCount !== 1 ? "s" : ""} could not be deleted — please try again.`);
      }
    } finally { setBulkDeleting(false); }
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === statements.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(statements.map(s => s.id)));
    }
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
      const queued = result.queued ?? 0;
      setRetryAllMsg(`Queued ${queued} statement${queued !== 1 ? "s" : ""} for reprocessing`);
    } catch {
      setRetryAllMsg("Failed to queue statements — please try again");
    } finally {
      setRetryingAll(false);
    }
  }

  const stuckCount = statements.filter(s => s.verify_status === "pending" || s.verify_status === "failed").length;
  const allSelected = statements.length > 0 && selectedIds.size === statements.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  if (loading) {
    return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <>
    <div className="px-6 pt-6 pb-10 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Statements</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">All uploaded bank statements</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
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
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 px-4 py-3 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl">
          <span className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface">
            {selectedIds.size} statement{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-ft-on-surface dark:hover:text-ve-on-surface transition-colors px-3 py-1.5 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-2 px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
            >
              {bulkDeleting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <MSIcon name="delete" className="text-lg" />}
              Delete {selectedIds.size} selected
            </button>
          </div>
        </div>
      )}

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
          <div className="flex items-center gap-2 px-1 pb-1">
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = someSelected; }}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-ft-primary dark:accent-ve-primary cursor-pointer"
            />
            <span className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Select all</span>
          </div>

          {statements.map(stmt => {
            const statusCfg = STATUS_CONFIG[stmt.verify_status] ?? STATUS_CONFIG.pending;
            const isStuck = stmt.verify_status === "pending" || stmt.verify_status === "failed";
            const isSelected = selectedIds.has(stmt.id);
            return (
              <div key={stmt.id} className={cn(
                "bg-ft-surface dark:bg-ve-surface border rounded-2xl p-5 transition-colors",
                isSelected
                  ? "border-ft-primary dark:border-ve-primary"
                  : "border-ft-outline-variant dark:border-ve-outline"
              )}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(stmt.id)}
                      className="w-4 h-4 rounded accent-ft-primary dark:accent-ve-primary cursor-pointer shrink-0 mt-0.5"
                    />
                    <div className="w-10 h-10 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center shrink-0">
                      <MSIcon name="description" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">
                          {formatMonth(stmt.period_start)} → {formatMonth(stmt.period_end)}
                        </span>
                        {stmt.verify_status === "failed" ? (
                          <button
                            onClick={() => setErrorStatement(stmt)}
                            className={cn("text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80", statusCfg.light, statusCfg.dark)}
                            title="Click to see errors"
                          >
                            {statusCfg.label} ↗
                          </button>
                        ) : (
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusCfg.light, statusCfg.dark)}>
                            {statusCfg.label}
                          </span>
                        )}
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

    {/* Verification error modal */}
    {errorStatement && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-ft-surface dark:bg-ve-surface rounded-2xl p-6 max-w-md w-full mx-4 border border-ft-outline-variant dark:border-ve-outline">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-ft-on-surface dark:text-ve-on-surface">Verification Errors</h3>
            <button onClick={() => setErrorStatement(null)}
              className="material-symbols-outlined text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-ft-on-surface dark:hover:text-ve-on-surface">
              close
            </button>
          </div>
          <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3">{errorStatement.filename}</p>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {parseVerifyErrors(errorStatement.verify_errors).map((e: string, i: number) => (
              <li key={i} className="text-sm text-red-600 dark:text-ve-error bg-red-50 dark:bg-ve-error/10 rounded-lg px-3 py-2">
                {e}
              </li>
            ))}
          </ul>
          <button onClick={() => setErrorStatement(null)}
            className="mt-4 w-full border border-ft-outline-variant dark:border-ve-outline rounded-xl py-2 text-sm text-ft-on-surface dark:text-ve-on-surface hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
            Close
          </button>
        </div>
      </div>
    )}
    </>
  );
}
