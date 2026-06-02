import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn, formatAED } from "../lib/utils";

const COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6","#f97316"];

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", targetAmount: "", targetDate: "", color: "#10b981" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listSavingsGoals().then(setGoals).catch(() => setGoals([])).finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const goal = await api.createSavingsGoal({
        name: form.name,
        targetAmount: parseFloat(form.targetAmount),
        targetDate: form.targetDate,
        color: form.color,
      });
      setGoals(prev => [...prev, { ...goal, net_saved: 0, progress_pct: 0 }]);
      setShowForm(false);
      setForm({ name: "", targetAmount: "", targetDate: "", color: "#10b981" });
      // Refresh to get server-computed progress
      api.listSavingsGoals().then(setGoals).catch(() => {});
    } catch (err: any) {
      alert(err.message || "Failed to create goal");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this savings goal?")) return;
    await api.deleteSavingsGoal(id);
    setGoals(prev => prev.filter((g: any) => g.id !== id));
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-6 pt-6 pb-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Savings Goals</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Track progress toward financial targets</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ft-primary dark:bg-ve-primary text-white text-sm font-medium">
          <MSIcon name="add" className="text-base" />
          New goal
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate}
          className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-6 flex flex-col gap-3">
          <input required placeholder="Goal name (e.g. Emergency fund)" value={form.name}
            onChange={e => setForm(p => ({...p, name: e.target.value}))}
            className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm w-full bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="number" step="0.01" placeholder="Target (AED)" value={form.targetAmount}
              onChange={e => setForm(p => ({...p, targetAmount: e.target.value}))}
              className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface" />
            <input required type="date" value={form.targetDate}
              onChange={e => setForm(p => ({...p, targetDate: e.target.value}))}
              className="border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface" />
          </div>
          <div className="flex gap-2">
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(p => ({...p, color: c}))}
                className={cn("w-7 h-7 rounded-full border-2 transition-transform",
                  form.color === c ? "border-ft-on-surface dark:border-ve-on-surface scale-110" : "border-transparent")}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-ft-primary dark:bg-ve-primary text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50">
              {saving ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-ft-outline-variant dark:border-ve-outline rounded-xl py-2.5 text-sm text-ft-on-surface dark:text-ve-on-surface">
              Cancel
            </button>
          </div>
        </form>
      )}

      {goals.length === 0 ? (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-16 text-center">
          <MSIcon name="savings" className="text-5xl text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3" />
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">No savings goals yet. Create one to track progress.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal: any) => {
            const pct = goal.progress_pct ?? 0;
            const targetDate = new Date(goal.target_date);
            const overdue = targetDate < new Date() && pct < 100;
            return (
              <div key={goal.id}
                className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: goal.color }} />
                      <h3 className="font-semibold text-ft-on-surface dark:text-ve-on-surface">{goal.name}</h3>
                    </div>
                    <p className={cn("text-xs", overdue ? "text-red-500 dark:text-red-400" : "text-ft-on-surface-variant dark:text-ve-on-surface-variant")}>
                      Target: {targetDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      {overdue && " · Overdue"}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(goal.id)}
                    className="material-symbols-outlined text-base text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-red-500 dark:hover:text-red-400 transition-colors">
                    delete
                  </button>
                </div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-ft-on-surface dark:text-ve-on-surface">
                    {formatAED(goal.net_saved ?? 0)}
                  </span>
                  <span className="text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                    of {formatAED(goal.target_amount)}
                  </span>
                </div>
                <div className="w-full h-2 bg-ft-surface-low dark:bg-ve-surface-high rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                </div>
                <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1.5 text-right">
                  {pct.toFixed(1)}% saved
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
