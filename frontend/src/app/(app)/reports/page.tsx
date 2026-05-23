"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatAED } from "@/lib/utils";
import { exportReportPDF, exportReportExcel } from "@/lib/exportUtils";

type Preset = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getPresetDates(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (preset === "this_month") {
    return { from: `${y}-${pad(m)}-01`, to: todayStr() };
  }
  if (preset === "last_month") {
    const d = new Date(y, m - 2, 1);
    const last = new Date(y, m - 1, 0);
    return {
      from: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`,
      to: `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`,
    };
  }
  if (preset === "this_quarter") {
    const q = Math.ceil(m / 3);
    const qStart = (q - 1) * 3 + 1;
    return { from: `${y}-${pad(qStart)}-01`, to: todayStr() };
  }
  if (preset === "this_year") {
    return { from: `${y}-01-01`, to: todayStr() };
  }
  return { from: todayStr(), to: todayStr() };
}

function makeLabel(from: string, to: string) {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}

const PRESET_LABELS: Record<string, string> = {
  this_month: "This Month",
  last_month: "Last Month",
  this_quarter: "This Quarter",
  this_year: "This Year",
  custom: "Custom",
};

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

  useEffect(() => {
    api.listSavedReports().then((res: any) => setSavedReports(res.data || []));
  }, []);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      const { from: f, to: t } = getPresetDates(p);
      setFrom(f);
      setTo(t);
    }
  }

  async function generate(overrideFrom?: string, overrideTo?: string) {
    const f = overrideFrom ?? from;
    const t = overrideTo ?? to;
    setLoading(true);
    setError("");
    setReport(null);
    try {
      const res = await api.generateReport(f, t) as any;
      setReport(res.data);
    } catch (e: any) {
      setError(e.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!saveName.trim() || !report) return;
    setSaving(true);
    try {
      const res = await api.saveReport(saveName.trim(), report.from_date, report.to_date) as any;
      setSavedReports(prev => [res.data, ...prev]);
      setSaveName("");
      setShowSaveInput(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await api.deleteSavedReport(id);
    setSavedReports(prev => prev.filter(r => r.id !== id));
  }

  function loadSaved(r: any) {
    setFrom(r.from_date);
    setTo(r.to_date);
    setPreset("custom");
    generate(r.from_date, r.to_date);
  }

  const label = report ? makeLabel(report.from_date, report.to_date) : makeLabel(from, to);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-12">
      <h1 className="text-xl font-bold text-slate-900 mb-5">Reports</h1>

      {/* Preset buttons */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {(["this_month", "last_month", "this_quarter", "this_year", "custom"] as Preset[]).map(p => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === p ? "bg-emerald-500 text-white" : "bg-gray-100 text-slate-600 hover:bg-gray-200"
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="flex gap-2 mb-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={from}
                max={to}
                onChange={e => setFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input
                type="date"
                value={to}
                min={from}
                max={todayStr()}
                onChange={e => setTo(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
        )}

        <button
          onClick={() => generate()}
          disabled={loading}
          className="w-full bg-emerald-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating…" : "Generate Report"}
        </button>
      </div>

      {/* Saved templates */}
      {savedReports.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-2 px-1">Saved Templates</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {savedReports.map(r => (
              <div
                key={r.id}
                className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-3 pr-2 py-1.5 whitespace-nowrap flex-shrink-0"
              >
                <button
                  onClick={() => loadSaved(r)}
                  className="text-sm text-slate-700 font-medium hover:text-emerald-600 transition-colors"
                >
                  {r.name}
                </button>
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-slate-300 hover:text-red-400 transition-colors p-0.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {report && !loading && (
        <>
          {/* Period label */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-slate-600">{label}</p>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-slate-400 mb-1">Total Spent</p>
              <p className="text-lg font-bold text-slate-900">{formatAED(report.summary.total_debits)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-slate-400 mb-1">Total Income</p>
              <p className="text-lg font-bold text-emerald-600">{formatAED(report.summary.total_credits)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-slate-400 mb-1">Net</p>
              <p className={`text-lg font-bold ${report.summary.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatAED(report.summary.net)}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-slate-400 mb-1">Transactions</p>
              <p className="text-lg font-bold text-slate-900">{report.summary.transaction_count}</p>
            </div>
          </div>

          {/* Biggest expense */}
          {report.summary.biggest_expense && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-4">
              <p className="text-xs font-medium text-amber-600 mb-1">Biggest Expense</p>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800 truncate pr-4">
                  {report.summary.biggest_expense.description}
                </p>
                <p className="text-sm font-bold text-slate-900 flex-shrink-0">
                  {formatAED(report.summary.biggest_expense.amount)}
                </p>
              </div>
              <p className="text-xs text-amber-500 mt-0.5">
                {new Date(report.summary.biggest_expense.date + "T00:00:00").toLocaleDateString("en-AE", { dateStyle: "medium" })}
              </p>
            </div>
          )}

          {/* Category breakdown */}
          {report.category_breakdown?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="font-semibold text-slate-900 mb-4">Spending by Category</h2>
              <div className="space-y-3">
                {report.category_breakdown.map((cat: any, i: number) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color || COLORS[i % COLORS.length] }}
                        />
                        <span className="text-slate-700 truncate max-w-[140px]">{cat.category_name}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-slate-400 text-xs">{cat.percentage}%</span>
                        <span className="font-medium text-slate-900">{formatAED(cat.total)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(cat.percentage, 100)}%`,
                          backgroundColor: cat.color || COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Monthly overview */}
          {report.monthly_overview?.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="font-semibold text-slate-900 mb-4">Monthly Overview</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">Month</th>
                      <th className="text-right pb-2 font-medium">Income</th>
                      <th className="text-right pb-2 font-medium">Spent</th>
                      <th className="text-right pb-2 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {report.monthly_overview.map((m: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 text-slate-700">{m.month_label}</td>
                        <td className="py-2 text-right text-emerald-600 font-medium">{formatAED(m.total_credits)}</td>
                        <td className="py-2 text-right text-slate-700">{formatAED(m.total_debits)}</td>
                        <td className={`py-2 text-right font-semibold ${m.net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {formatAED(m.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Frequent places */}
          {report.frequent_places?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="font-semibold text-slate-900 mb-4">Frequent Places</h2>
              <div className="space-y-3">
                {report.frequent_places.map((place: any, i: number) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-emerald-600">{place.visit_count}x</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{place.merchant_name}</p>
                      <p className="text-xs text-slate-400">{place.frequency_reason} · avg {formatAED(place.avg_spend)}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 flex-shrink-0">{formatAED(place.total_spent)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action bar */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <button
                  onClick={() => exportReportPDF(report, label)}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-900 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
                <button
                  onClick={() => exportReportExcel(report, label)}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Excel
                </button>
              </div>

              {showSaveInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Template name…"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveInput(false); }}
                    autoFocus
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim() || saving}
                    className="px-4 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setShowSaveInput(false); setSaveName(""); }}
                    className="px-3 bg-gray-100 text-slate-600 rounded-xl text-sm hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowSaveInput(true)}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 text-slate-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
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
