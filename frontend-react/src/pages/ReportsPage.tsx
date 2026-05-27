import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn, formatAED } from "../lib/utils";
import { exportReportPDF, exportReportExcel } from "../lib/exportUtils";

type Preset = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function getPresetDates(preset: Preset): { from: string; to: string } {
  const now = new Date(); const y = now.getFullYear(); const m = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (preset === "this_month") return { from: `${y}-${pad(m)}-01`, to: todayStr() };
  if (preset === "last_month") {
    const d = new Date(y, m - 2, 1); const last = new Date(y, m - 1, 0);
    return { from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`, to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}` };
  }
  if (preset === "this_quarter") { const q = Math.ceil(m / 3); return { from: `${y}-${pad((q - 1) * 3 + 1)}-01`, to: todayStr() }; }
  if (preset === "this_year") return { from: `${y}-01-01`, to: todayStr() };
  return { from: todayStr(), to: todayStr() };
}

function makeLabel(from: string, to: string) {
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}

const PRESET_LABELS: Record<string, string> = { this_month: "This Month", last_month: "Last Month", this_quarter: "This Quarter", this_year: "This Year", custom: "Custom" };
const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("this_month");
  const [from, setFrom] = useState(() => getPresetDates("this_month").from);
  const [to, setTo] = useState(() => getPresetDates("this_month").to);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => { api.listSavedReports().then((res: any) => setSavedReports(res.data || [])); }, []);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") { const { from: f, to: t } = getPresetDates(p); setFrom(f); setTo(t); }
  }

  async function generate(overrideFrom?: string, overrideTo?: string) {
    setLoading(true); setError(""); setReport(null);
    try { const res = await api.generateReport(overrideFrom ?? from, overrideTo ?? to) as any; setReport(res.data); }
    catch (e: any) { setError(e.message || "Failed to generate report"); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!saveName.trim() || !report) return;
    setSaving(true);
    try { const res = await api.saveReport(saveName.trim(), report.from_date, report.to_date) as any; setSavedReports(prev => [res.data, ...prev]); setSaveName(""); setShowSaveInput(false); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    await api.deleteSavedReport(id);
    setSavedReports(prev => prev.filter(r => r.id !== id));
  }

  function loadSaved(r: any) { setFrom(r.from_date); setTo(r.to_date); setPreset("custom"); generate(r.from_date, r.to_date); }

  const label = report ? makeLabel(report.from_date, report.to_date) : makeLabel(from, to);

  return (
    <div className="px-6 pt-6 pb-12 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Reports</h1>
        <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Generate detailed financial reports for any period</p>
      </div>

      {/* ── Preset + generate ── */}
      <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {(["this_month", "last_month", "this_quarter", "this_year", "custom"] as Preset[]).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                preset === p
                  ? "bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background"
                  : "bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface-variant dark:text-ve-on-surface-variant border border-ft-outline-variant dark:border-ve-outline hover:bg-ft-surface-container dark:hover:bg-ve-surface-highest"
              )}>
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1">From</label>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
                className="w-full border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2 text-sm text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1">To</label>
              <input type="date" value={to} min={from} max={todayStr()} onChange={e => setTo(e.target.value)}
                className="w-full border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2 text-sm text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
            </div>
          </div>
        )}

        <button onClick={() => generate()} disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
          <MSIcon name="summarize" className="text-lg" />
          {loading ? "Generating…" : "Generate Report"}
        </button>
      </div>

      {/* ── Saved templates ── */}
      {savedReports.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-2 px-1">Saved Templates</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {savedReports.map(r => (
              <div key={r.id} className="flex items-center gap-1.5 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-full pl-3 pr-2 py-1.5 whitespace-nowrap shrink-0">
                <button onClick={() => loadSaved(r)} className="text-sm text-ft-on-surface dark:text-ve-on-surface font-medium hover:text-ft-primary dark:hover:text-ve-primary transition-colors">{r.name}</button>
                <button onClick={() => handleDelete(r.id)} className="text-ft-outline dark:text-ve-outline hover:text-red-400 dark:hover:text-ve-error transition-colors p-0.5">
                  <MSIcon name="close" className="text-sm" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 dark:bg-ve-surface border border-red-100 dark:border-ve-error text-red-600 dark:text-ve-error text-sm rounded-xl px-4 py-3 mb-4">{error}</div>}

      {loading && <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /></div>}

      {report && !loading && (
        <>
          <p className="text-sm font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-4">{label}</p>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { label: "Total Spent", value: formatAED(report.summary.total_debits), color: "text-red-500 dark:text-ve-error" },
              { label: "Total Income", value: formatAED(report.summary.total_credits), color: "text-emerald-600 dark:text-ve-primary" },
              { label: "Net", value: formatAED(report.summary.net), color: report.summary.net >= 0 ? "text-emerald-600 dark:text-ve-primary" : "text-red-500 dark:text-ve-error" },
              { label: "Transactions", value: String(report.summary.transaction_count), color: "text-ft-on-surface dark:text-ve-on-surface" },
            ].map(card => (
              <div key={card.label} className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4">
                <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1">{card.label}</p>
                <p className={cn("text-lg font-bold tabular-nums", card.color)}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Biggest expense */}
          {report.summary.biggest_expense && (
            <div className="bg-amber-50 dark:bg-ve-surface border border-amber-100 dark:border-ve-outline rounded-2xl p-4 mb-4">
              <p className="text-xs font-semibold text-amber-600 dark:text-ve-on-surface-variant mb-1">Biggest Expense</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate pr-4">{report.summary.biggest_expense.merchant_name}</p>
                <p className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums shrink-0">{formatAED(report.summary.biggest_expense.amount)}</p>
              </div>
              <p className="text-xs text-amber-500 dark:text-ve-on-surface-variant mt-0.5">
                {new Date(report.summary.biggest_expense.date + "T00:00:00").toLocaleDateString("en-AE", { dateStyle: "medium" })}
              </p>
            </div>
          )}

          {/* Category breakdown */}
          {report.category_breakdown?.length > 0 && (
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-4">
              <h2 className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">Spending by Category</h2>
              <div className="space-y-3">
                {report.category_breakdown.map((cat: any, i: number) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.category_color || COLORS[i % COLORS.length] }} />
                        <span className="text-ft-on-surface dark:text-ve-on-surface font-medium truncate max-w-[140px]">{cat.category_name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-ft-on-surface-variant dark:text-ve-on-surface-variant">{cat.percentage}%</span>
                        <span className="font-semibold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(cat.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-ft-surface-low dark:bg-ve-surface-high rounded-full overflow-hidden">
                      <div className="h-1.5 rounded-full" style={{ width: `${Math.min(cat.percentage, 100)}%`, backgroundColor: cat.category_color || COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly overview */}
          {report.monthly_overview?.length > 1 && (
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-4">
              <h2 className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">Monthly Overview</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant border-b border-ft-outline-variant dark:border-ve-outline">
                      <th className="text-left pb-2 font-semibold">Month</th>
                      <th className="text-right pb-2 font-semibold">Income</th>
                      <th className="text-right pb-2 font-semibold">Spent</th>
                      <th className="text-right pb-2 font-semibold">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ft-outline-variant dark:divide-ve-outline">
                    {report.monthly_overview.map((m: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2.5 text-ft-on-surface dark:text-ve-on-surface">{m.month_label}</td>
                        <td className="py-2.5 text-right text-emerald-600 dark:text-ve-primary font-medium tabular-nums">{formatAED(m.total_credits)}</td>
                        <td className="py-2.5 text-right text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(m.total_debits)}</td>
                        <td className={cn("py-2.5 text-right font-semibold tabular-nums", m.net >= 0 ? "text-emerald-600 dark:text-ve-primary" : "text-red-500 dark:text-ve-error")}>{formatAED(m.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Frequent places */}
          {report.frequent_places?.length > 0 && (
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-4">
              <h2 className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">Frequent Places</h2>
              <div className="space-y-3">
                {report.frequent_places.map((place: any, i: number) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-ft-surface-low dark:bg-ve-surface-high rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-ft-primary dark:text-ve-primary">{place.visit_count}x</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{place.merchant_name}</p>
                      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{place.frequency_reason} · avg {formatAED(place.avg_spend)}</p>
                    </div>
                    <p className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums shrink-0">{formatAED(place.total_spent)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button onClick={() => exportReportPDF(report, label)}
                  className="flex-1 flex items-center justify-center gap-2 bg-ft-on-surface dark:bg-ve-on-surface text-ft-surface dark:text-ve-background rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                  <MSIcon name="download" className="text-lg" />
                  Download PDF
                </button>
                <button onClick={() => exportReportExcel(report, label)}
                  className="flex-1 flex items-center justify-center gap-2 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity">
                  <MSIcon name="table_chart" className="text-lg" />
                  Download Excel
                </button>
              </div>

              {showSaveInput ? (
                <div className="flex gap-2">
                  <input type="text" placeholder="Template name…" value={saveName} onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveInput(false); }} autoFocus
                    className="flex-1 border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2 text-sm text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
                  <button onClick={handleSave} disabled={!saveName.trim() || saving}
                    className="px-4 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                    Save
                  </button>
                  <button onClick={() => { setShowSaveInput(false); setSaveName(""); }}
                    className="px-3 bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface-variant dark:text-ve-on-surface-variant rounded-xl text-sm hover:bg-ft-surface-container dark:hover:bg-ve-surface-highest transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowSaveInput(true)}
                  className="w-full flex items-center justify-center gap-2 border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant rounded-xl py-2.5 text-sm font-semibold hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
                  <MSIcon name="bookmark" className="text-lg" />
                  Save as Template
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
