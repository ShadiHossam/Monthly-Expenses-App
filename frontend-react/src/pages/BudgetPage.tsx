import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn, formatAED } from "../lib/utils";

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
  breach_count: number;
  last_breach_month: string | null;
}

interface Category {
  id: number;
  name: string;
  color: string;
  icon?: string;
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#ec4899", "#f43f5e", "#64748b",
];

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

async function loadBudgets(year: number, month: number): Promise<Budget[]> {
  const res = await api.listBudgets({ year, month });
  return Array.isArray(res) ? res as unknown as Budget[] : ((res as any).data ?? []);
}

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function BudgetPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formLimit, setFormLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLimit, setEditLimit] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Alert banner
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadBudgets(selectedYear, selectedMonth), api.listCategories()])
      .then(([budgetList, catRes]) => {
        setBudgets(budgetList);
        setCategories(Array.isArray(catRes) ? catRes : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedYear, selectedMonth]);

  function goPrevMonth() {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  }

  function goNextMonth() {
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  }

  async function handleToggle(budget: Budget) {
    setTogglingId(budget.id);
    try {
      await api.updateBudget(budget.id, { enabled: !budget.enabled });
      setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, enabled: !b.enabled } : b));
    } catch (err: any) {
      setActionError(err.message || "Couldn't update this budget. Please try again.");
    } finally { setTogglingId(null); }
  }

  async function handleDelete(id: number) {
    setConfirmDelete(null);
    setDeletingId(id);
    try {
      await api.deleteBudget(id);
      setBudgets(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      setActionError(err.message || "Couldn't remove this budget. Please try again.");
    } finally { setDeletingId(null); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formCategoryId || !formLimit) return;
    const limitNum = parseFloat(formLimit);
    if (isNaN(limitNum) || limitNum <= 0) return;
    setSaving(true);
    try {
      await api.createBudget(Number(formCategoryId), limitNum);
      const fresh = await loadBudgets(selectedYear, selectedMonth);
      setBudgets(fresh);
      setShowForm(false); setFormCategoryId(""); setFormLimit("");
    } catch (err: any) {
      setActionError(err.message || "Couldn't create this budget. Please try again.");
    } finally { setSaving(false); }
  }

  function handleEditStart(budget: Budget) {
    setEditingId(budget.id);
    setEditLimit(String(budget.monthly_limit));
    setEditColor(budget.category_color || "#94a3b8");
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditLimit("");
    setEditColor("");
  }

  async function handleEditSave(budget: Budget) {
    const limitNum = parseFloat(editLimit);
    if (isNaN(limitNum) || limitNum <= 0) return;
    setEditSaving(true);
    try {
      const tasks: Promise<unknown>[] = [api.updateBudget(budget.id, { monthly_limit: limitNum })];
      if (editColor !== budget.category_color) {
        tasks.push(api.updateCategory(budget.category_id, { color: editColor }));
      }
      await Promise.all(tasks);
      const fresh = await loadBudgets(selectedYear, selectedMonth);
      setBudgets(fresh);
      setEditingId(null);
    } catch (err: any) {
      setActionError(err.message || "Couldn't save changes. Please try again.");
    } finally { setEditSaving(false); }
  }

  const usedCategoryIds = new Set(budgets.map(b => b.category_id));
  const availableCategories = categories.filter(c => !usedCategoryIds.has(c.id));
  const exceededBudgets = budgets.filter(b => b.enabled && b.status === "exceeded");
  const warningBudgets = budgets.filter(b => b.enabled && b.status === "warning");
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  return (
    <div className="px-6 pt-6 pb-10 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Budgets &amp; Goals</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Track your spending limits and savings milestones.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          <MSIcon name="add" className="text-lg" />
          Create New Budget
        </button>
      </div>

      {/* ── Month navigator ── */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={goPrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface dark:hover:bg-ve-surface transition-colors"
          aria-label="Previous month"
        >
          <MSIcon name="chevron_left" className="text-xl" />
        </button>
        <span className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface min-w-[130px] text-center">
          {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          {isCurrentMonth && <span className="ml-1.5 text-xs font-medium text-ft-primary dark:text-ve-primary">(current)</span>}
        </span>
        <button
          onClick={goNextMonth}
          disabled={isCurrentMonth}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface dark:hover:bg-ve-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <MSIcon name="chevron_right" className="text-xl" />
        </button>
        {loading && <div className="w-4 h-4 border-2 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin ml-1" />}
      </div>

      {/* ── Alert banner ── */}
      {!alertsDismissed && (exceededBudgets.length > 0 || warningBudgets.length > 0) && (
        <div className={cn(
          "rounded-2xl p-4 mb-5 flex items-start justify-between gap-3",
          exceededBudgets.length > 0
            ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            : "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
        )}>
          <div className="flex items-start gap-3">
            <MSIcon name="notifications_active" className={cn("text-xl mt-0.5", exceededBudgets.length > 0 ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400")} />
            <div>
              {exceededBudgets.length > 0 && (
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  {exceededBudgets.length} budget{exceededBudgets.length > 1 ? "s" : ""} exceeded this month: {exceededBudgets.map(b => b.category_name).join(", ")}
                </p>
              )}
              {warningBudgets.length > 0 && (
                <p className={cn("text-sm font-semibold text-amber-700 dark:text-amber-300", exceededBudgets.length > 0 && "mt-0.5")}>
                  {warningBudgets.length} budget{warningBudgets.length > 1 ? "s" : ""} nearing limit: {warningBudgets.map(b => b.category_name).join(", ")}
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setAlertsDismissed(true)} className="shrink-0 text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:opacity-70 transition-opacity">
            <MSIcon name="close" className="text-lg" />
          </button>
        </div>
      )}

      {/* ── Create form ── */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5">
          <p className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">New Budget Alert</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1 font-medium">Category</label>
              <select value={formCategoryId} onChange={e => setFormCategoryId(e.target.value)} required
                className="w-full border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary">
                <option value="">Select a category…</option>
                {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1 font-medium">Monthly Limit (AED)</label>
              <input type="number" min="1" step="any" value={formLimit} onChange={e => setFormLimit(e.target.value)} required placeholder="e.g. 2000"
                className="w-full border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button type="submit" disabled={saving}
              className="px-5 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormCategoryId(""); setFormLimit(""); }}
              className="px-5 py-2.5 text-ft-on-surface-variant dark:text-ve-on-surface-variant text-sm font-medium rounded-xl hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Empty state ── */}
      {budgets.length === 0 ? (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-14 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center">
            <MSIcon name="account_balance_wallet" className="text-4xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          </div>
          <div>
            <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface">No budgets set up yet</p>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1">Add a budget to start tracking your spending limits.</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
            <MSIcon name="add" className="text-lg" />
            Create First Budget
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map(budget => {
            const pct = Math.min(budget.percentage ?? 0, 100);
            const barColor = budget.status === "exceeded" ? "bg-red-500 dark:bg-ve-error" : budget.status === "warning" ? "bg-amber-400" : "bg-ft-primary dark:bg-ve-primary-dim";
            const statusLabel = budget.status === "exceeded" ? "Over budget" : budget.status === "warning" ? "Nearing Limit" : "Safe";
            const statusColor = budget.status === "exceeded" ? "text-red-500 dark:text-ve-error" : budget.status === "warning" ? "text-amber-500" : "text-ft-primary dark:text-ve-primary";
            const remaining = budget.monthly_limit - budget.spent_this_month;
            const isEditing = editingId === budget.id;

            return (
              <div key={budget.id} className={cn(
                "bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 transition-opacity",
                !budget.enabled && "opacity-60"
              )}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  {/* Category icon + label */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (budget.category_color || "#94a3b8") + "20" }}>
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: budget.category_color || "#94a3b8" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{budget.category_name}</p>
                      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Monthly Budget</p>
                    </div>
                  </div>
                  {/* Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", statusColor,
                      budget.status === "ok" ? "bg-emerald-50 dark:bg-ve-surface-high" : budget.status === "warning" ? "bg-amber-50 dark:bg-ve-surface-high" : "bg-red-50 dark:bg-ve-surface-high"
                    )}>{statusLabel}</span>
                    <button onClick={() => handleToggle(budget)} disabled={togglingId === budget.id} aria-label={budget.enabled ? "Disable" : "Enable"}
                      className="relative shrink-0">
                      <span className={cn("block w-10 h-5 rounded-full transition-colors", budget.enabled ? "bg-ft-primary dark:bg-ve-primary-dim" : "bg-ft-outline-variant dark:bg-ve-outline")} />
                      <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 bg-white dark:bg-ve-on-surface rounded-full shadow transition-transform", budget.enabled ? "translate-x-5" : "")} />
                    </button>
                    <button
                      onClick={() => isEditing ? handleEditCancel() : handleEditStart(budget)}
                      className={cn("transition-colors", isEditing ? "text-ft-primary dark:text-ve-primary" : "text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-ft-primary dark:hover:text-ve-primary")}
                      aria-label="Edit"
                    >
                      <MSIcon name={isEditing ? "edit_off" : "edit"} className="text-lg" />
                    </button>
                    <button onClick={() => setConfirmDelete({ id: budget.id, name: budget.category_name })} disabled={deletingId === budget.id}
                      className="text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-red-500 dark:hover:text-ve-error transition-colors disabled:opacity-40">
                      {deletingId === budget.id
                        ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        : <MSIcon name="delete" className="text-lg" />}
                    </button>
                  </div>
                </div>

                {/* Amounts */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface tabular-nums">
                    {formatAED(budget.spent_this_month ?? 0)} <span className="font-normal text-ft-on-surface-variant dark:text-ve-on-surface-variant">/ {formatAED(budget.monthly_limit)}</span>
                  </span>
                  <span className={cn("text-sm font-bold tabular-nums", statusColor)}>{Math.round(budget.percentage ?? 0)}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-ft-surface-low dark:bg-ve-surface-high rounded-full overflow-hidden mb-2">
                  <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                </div>

                {/* Remaining + breach history */}
                <div className="flex items-center justify-between">
                  <p className={cn("text-xs font-medium", statusColor)}>
                    {budget.status === "exceeded"
                      ? `Over budget by ${formatAED(Math.abs(remaining))}`
                      : budget.status === "warning"
                      ? `${formatAED(remaining)} remaining — approaching limit`
                      : `${formatAED(remaining)} remaining`}
                  </p>
                  {budget.breach_count > 0 && (
                    <p className={cn("text-xs font-medium tabular-nums", budget.breach_count >= 4 ? "text-red-500 dark:text-ve-error" : "text-amber-500")}>
                      <MSIcon name="history" className="text-xs mr-0.5 align-middle" />
                      Exceeded {budget.breach_count}× in last 12 months
                    </p>
                  )}
                </div>

                {/* ── Inline edit form ── */}
                {isEditing && (
                  <div className="mt-4 pt-4 border-t border-ft-outline-variant dark:border-ve-outline">
                    <p className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface mb-3">Edit Budget</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Monthly limit */}
                      <div>
                        <label className="block text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1 font-medium">Monthly Limit (AED)</label>
                        <input
                          type="number" min="1" step="any"
                          value={editLimit}
                          onChange={e => setEditLimit(e.target.value)}
                          className="w-full border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
                        />
                      </div>

                      {/* Color picker */}
                      <div>
                        <label className="block text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1 font-medium">Category Color</label>
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_COLORS.map(color => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditColor(color)}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 transition-transform hover:scale-110",
                                editColor === color ? "border-ft-on-surface dark:border-ve-on-surface scale-110" : "border-transparent"
                              )}
                              style={{ backgroundColor: color }}
                              aria-label={color}
                            />
                          ))}
                          {/* Custom color input */}
                          <label className="w-6 h-6 rounded-full border-2 border-dashed border-ft-outline-variant dark:border-ve-outline flex items-center justify-center cursor-pointer hover:scale-110 transition-transform overflow-hidden relative">
                            <input
                              type="color"
                              value={editColor}
                              onChange={e => setEditColor(e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <MSIcon name="colorize" className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                          </label>
                          {/* Preview swatch */}
                          <div className="w-6 h-6 rounded-full border-2 border-ft-outline-variant dark:border-ve-outline" style={{ backgroundColor: editColor }} title="Current color" />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => handleEditSave(budget)}
                        disabled={editSaving}
                        className="px-4 py-2 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity"
                      >
                        {editSaving ? "Saving…" : "Save Changes"}
                      </button>
                      <button
                        type="button"
                        onClick={handleEditCancel}
                        className="px-4 py-2 text-ft-on-surface-variant dark:text-ve-on-surface-variant text-sm font-medium rounded-xl hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ft-surface dark:bg-ve-surface rounded-2xl p-6 max-w-sm w-full mx-4 border border-ft-outline-variant dark:border-ve-outline">
            <h3 className="font-bold text-lg text-ft-on-surface dark:text-ve-on-surface mb-2">Remove budget alert?</h3>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-4">
              You'll stop getting alerts for "{confirmDelete.name}" spending. Your past transactions won't be affected.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-ft-outline-variant dark:border-ve-outline rounded-xl py-2 text-sm text-ft-on-surface dark:text-ve-on-surface hover:bg-ft-surface-low dark:hover:bg-ve-surface-high">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete.id)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2 text-sm font-medium">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Action error toast */}
      {actionError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-50 dark:bg-ve-surface-high border border-red-100 dark:border-ve-error/30 rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-3 w-[calc(100%-2rem)] max-w-sm">
          <MSIcon name="error" className="text-lg text-red-500 dark:text-ve-error shrink-0" />
          <p className="text-sm text-red-600 dark:text-ve-error flex-1">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-red-400 dark:text-ve-error hover:text-red-600 dark:hover:text-ve-on-surface shrink-0">
            <MSIcon name="close" className="text-base" />
          </button>
        </div>
      )}
    </div>
  );
}
