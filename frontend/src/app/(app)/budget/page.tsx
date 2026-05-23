"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatAED } from "@/lib/utils";

interface Budget {
  id: number;
  category_id: number;
  category_name: string;
  category_color: string;
  monthly_limit: number;
  enabled: boolean;
  spent_this_month: number;
  percentage: number;
  status: "ok" | "warning" | "exceeded";
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon?: string;
}

const STATUS_BAR: Record<string, string> = {
  ok: "bg-emerald-500",
  warning: "bg-amber-400",
  exceeded: "bg-red-500",
};

const STATUS_TEXT: Record<string, string> = {
  ok: "text-emerald-600",
  warning: "text-amber-600",
  exceeded: "text-red-600",
};

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [formLimit, setFormLimit] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api.listBudgets(), api.listCategories()])
      .then(([budgetRes, catRes]) => {
        const budgetData = Array.isArray(budgetRes) ? budgetRes : (budgetRes as any).data ?? [];
        const catData = Array.isArray(catRes) ? catRes : [];
        setBudgets(budgetData);
        setCategories(catData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle(budget: Budget) {
    setTogglingId(budget.id);
    try {
      await api.updateBudget(budget.id, { enabled: !budget.enabled });
      setBudgets((prev) =>
        prev.map((b) => (b.id === budget.id ? { ...b, enabled: !b.enabled } : b))
      );
    } catch {
      // silently ignore
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!window.confirm(`Remove budget alert for "${name}"?`)) return;
    setDeletingId(id);
    try {
      await api.deleteBudget(id);
      setBudgets((prev) => prev.filter((b) => b.id !== id));
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formCategoryId || !formLimit) return;
    const limitNum = parseFloat(formLimit);
    if (isNaN(limitNum) || limitNum <= 0) return;
    setSaving(true);
    try {
      const res = await api.createBudget(Number(formCategoryId), limitNum);
      const created = (res as any).data ?? res;
      setBudgets((prev) => [...prev, created]);
      setShowForm(false);
      setFormCategoryId("");
      setFormLimit("");
    } catch {
      // silently ignore
    } finally {
      setSaving(false);
    }
  }

  const usedCategoryIds = new Set(budgets.map((b) => b.category_id));
  const availableCategories = categories.filter((c) => !usedCategoryIds.has(c.id));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budget Alerts</h1>
          <p className="text-slate-400 text-sm mt-1">Set monthly spending limits per category</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Budget
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl border border-gray-100 p-5 mb-4"
        >
          <p className="text-sm font-semibold text-slate-900 mb-4">New Budget Alert</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Category</label>
              <select
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="">Select a category…</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Monthly Limit (AED)</label>
              <input
                type="number"
                min="1"
                step="any"
                value={formLimit}
                onChange={(e) => setFormLimit(e.target.value)}
                required
                placeholder="e.g. 2000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormCategoryId(""); setFormLimit(""); }}
              className="px-5 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {budgets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <svg className="mx-auto mb-4 text-slate-300" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <p className="text-slate-500 font-medium">No budget alerts set up yet.</p>
          <p className="text-slate-400 text-sm mt-1">Add a budget to start tracking spending limits.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const pct = Math.min(budget.percentage ?? 0, 100);
            const barColor = STATUS_BAR[budget.status] ?? STATUS_BAR.ok;
            const textColor = STATUS_TEXT[budget.status] ?? STATUS_TEXT.ok;
            return (
              <div
                key={budget.id}
                className={`bg-white rounded-2xl border p-5 transition-opacity ${budget.enabled ? "border-gray-100 opacity-100" : "border-gray-100 opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="flex-shrink-0 w-3 h-3 rounded-full"
                      style={{ backgroundColor: budget.category_color || "#94a3b8" }}
                    />
                    <span className="font-semibold text-slate-900 truncate">{budget.category_name}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(budget)}
                      disabled={togglingId === budget.id}
                      aria-label={budget.enabled ? "Disable budget" : "Enable budget"}
                      className="relative flex-shrink-0"
                    >
                      <span
                        className={`block w-10 h-5 rounded-full transition-colors ${budget.enabled ? "bg-emerald-500" : "bg-slate-200"}`}
                      />
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${budget.enabled ? "translate-x-5" : ""}`}
                      />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(budget.id, budget.category_name)}
                      disabled={deletingId === budget.id}
                      className="text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                      aria-label="Delete budget"
                    >
                      {deletingId === budget.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-500">
                      {formatAED(budget.spent_this_month)} <span className="text-slate-300">of</span> {formatAED(budget.monthly_limit)}
                    </span>
                    <span className={`text-sm font-semibold ${textColor}`}>{Math.round(budget.percentage ?? 0)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {budget.status === "exceeded" && (
                  <p className="text-xs text-red-500 mt-2 font-medium">Over budget this month</p>
                )}
                {budget.status === "warning" && (
                  <p className="text-xs text-amber-600 mt-2 font-medium">Approaching limit</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
