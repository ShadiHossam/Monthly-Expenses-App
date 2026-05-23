"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatAED } from "@/lib/utils";
import Link from "next/link";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  passed: { label: "Passed", className: "bg-emerald-100 text-emerald-700" },
  failed: { label: "Failed", className: "bg-red-100 text-red-700" },
  flagged: { label: "Flagged", className: "bg-amber-100 text-amber-700" },
  pending: { label: "Pending", className: "bg-gray-100 text-gray-500" },
};

function formatMonth(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    api
      .listStatements()
      .then((data) => setStatements(Array.isArray(data) ? data : []))
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number, filename: string) {
    if (!window.confirm(`Delete statement "${filename}"? This will also remove all associated transactions.`)) return;
    setDeletingId(id);
    try {
      await api.deleteStatement(id);
      setStatements((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Statement History</h1>
        <p className="text-slate-400 text-sm mt-1">All uploaded bank statements</p>
      </div>

      {statements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <svg className="mx-auto mb-4 text-slate-300" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-slate-500 font-medium">No statements uploaded yet.</p>
          <p className="text-slate-400 text-sm mt-1">
            <Link href="/upload" className="text-emerald-600 hover:underline">Upload your first statement</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {statements.map((stmt) => {
            const statusCfg = STATUS_CONFIG[stmt.verify_status] ?? STATUS_CONFIG.pending;
            return (
              <div key={stmt.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 truncate">
                        {formatMonth(stmt.period_start)} → {formatMonth(stmt.period_end)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mt-0.5 truncate">{stmt.filename}</p>
                  </div>

                  <button
                    onClick={() => handleDelete(stmt.id, stmt.filename)}
                    disabled={deletingId === stmt.id}
                    className="flex-shrink-0 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    aria-label="Delete statement"
                  >
                    {deletingId === stmt.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Opening Balance</p>
                    <p className="text-sm font-medium text-slate-900">{formatAED(stmt.opening_balance ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Closing Balance</p>
                    <p className="text-sm font-medium text-slate-900">{formatAED(stmt.closing_balance ?? 0)}</p>
                  </div>
                  {stmt.transaction_count != null && (
                    <div>
                      <p className="text-xs text-slate-400">Transactions</p>
                      <p className="text-sm font-medium text-slate-900">{stmt.transaction_count}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400">Uploaded</p>
                    <p className="text-sm font-medium text-slate-900">{formatDate(stmt.created_at)}</p>
                  </div>
                </div>

                {stmt.confidence != null && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-400">
                      Confidence:{" "}
                      <span className={stmt.confidence >= 0.9 ? "text-emerald-600" : stmt.confidence >= 0.7 ? "text-amber-600" : "text-red-500"}>
                        {Math.round(stmt.confidence * 100)}%
                      </span>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
