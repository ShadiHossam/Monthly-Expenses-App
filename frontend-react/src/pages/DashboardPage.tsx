import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { formatAED, getMonthRange, getQuarterRange, getYearRange } from "../lib/utils";
import AskAIModal from "../components/AskAIModal";
import ExportButtons from "../components/ExportButtons";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

type Period = "month" | "quarter" | "year" | "custom";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function DashboardPage() {
  const today = new Date();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [quarterOffset, setQuarterOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [customTo, setCustomTo] = useState(() => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  const [summary, setSummary] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAskAI, setShowAskAI] = useState(false);

  // Close month picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowMonthPicker(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function getRange(): { from: string; to: string } {
    if (period === "custom") return { from: customFrom, to: customTo };
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    if (period === "month") {
      const d = new Date(y, m - 1 + monthOffset, 1);
      return getMonthRange(d.getFullYear(), d.getMonth() + 1);
    }
    if (period === "quarter") {
      const baseQ = Math.ceil(m / 3);
      let totalQ = (y * 4 + baseQ - 1) + quarterOffset;
      const qYear = Math.floor(totalQ / 4);
      const q = (totalQ % 4) + 1;
      return getQuarterRange(qYear, q);
    }
    return getYearRange(y + yearOffset);
  }

  function getPeriodLabel() {
    if (period === "custom") {
      if (!customFrom || !customTo) return "Custom range";
      return `${customFrom} → ${customTo}`;
    }
    if (period === "month") {
      const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      return d.toLocaleDateString("en-AE", { month: "long", year: "numeric" });
    }
    if (period === "quarter") {
      const baseQ = Math.ceil((today.getMonth() + 1) / 3);
      let totalQ = (today.getFullYear() * 4 + baseQ - 1) + quarterOffset;
      const qYear = Math.floor(totalQ / 4);
      const q = (totalQ % 4) + 1;
      return `Q${q} ${qYear}`;
    }
    return `${today.getFullYear() + yearOffset}`;
  }

  function canGoForward() {
    if (period === "month") return monthOffset < 0;
    if (period === "quarter") return quarterOffset < 0;
    if (period === "year") return yearOffset < 0;
    return false;
  }

  useEffect(() => {
    if (period === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    const { from, to } = getRange();
    Promise.all([
      api.getSummary(from, to),
      api.getCategoryBreakdown(from, to),
      api.listTransactions({ from, to, limit: 5 }),
      api.getFrequentPlaces(from, to),
    ]).then(([s, b, t, p]) => {
      setSummary((s as any).data);
      setBreakdown((b as any).data || []);
      setRecent(Array.isArray(t) ? t : []);
      setPlaces(((p as any).data || []).slice(0, 4));
    }).catch(console.error).finally(() => setLoading(false));
  }, [period, monthOffset, quarterOffset, yearOffset, customFrom, customTo]);

  const savingsRate = summary?.total_credits > 0
    ? Math.round(((summary.total_credits - summary.total_debits) / summary.total_credits) * 100)
    : null;

  const { from: rangeFrom, to: rangeTo } = period !== "custom" || (customFrom && customTo)
    ? getRange()
    : { from: customFrom, to: customTo };
  const daysDiff = rangeFrom && rangeTo
    ? Math.max(1, Math.round((new Date(rangeTo).getTime() - new Date(rangeFrom).getTime()) / 86400000) + 1)
    : 30;
  const avgDaily = summary?.total_debits ? summary.total_debits / daysDiff : null;

  function handleExcelExport() {
    const periodLabel = getPeriodLabel();
    const sheets = [];

    if (summary) {
      sheets.push({
        name: "Summary",
        columns: [
          { header: "Metric", key: "metric", width: 24 },
          { header: "Value (AED)", key: "value", width: 18 },
        ],
        rows: [
          { metric: "Period", value: periodLabel },
          { metric: "Opening Balance", value: Number(summary.opening_balance ?? 0).toFixed(2) },
          { metric: "Closing Balance", value: Number(summary.closing_balance ?? 0).toFixed(2) },
          { metric: "Total Income", value: Number(summary.total_credits ?? 0).toFixed(2) },
          { metric: "Total Expenses", value: Number(summary.total_debits ?? 0).toFixed(2) },
          { metric: "Transactions", value: summary.transaction_count ?? 0 },
          { metric: "Savings Rate", value: savingsRate !== null ? `${savingsRate}%` : "N/A" },
          { metric: "Avg Daily Spend", value: avgDaily ? Number(avgDaily).toFixed(2) : "N/A" },
        ],
      });
    }

    if (breakdown.length > 0) {
      sheets.push({
        name: "By Category",
        columns: [
          { header: "Category", key: "category_name", width: 22 },
          { header: "Total (AED)", key: "total", width: 16 },
          { header: "% of Spend", key: "percentage", width: 12 },
          { header: "Transactions", key: "count", width: 14 },
        ],
        rows: breakdown.map((c: any) => ({
          category_name: c.category_name,
          total: Number(c.total).toFixed(2),
          percentage: `${c.percentage?.toFixed(1)}%`,
          count: c.count ?? "",
        })),
      });
    }

    if (recent.length > 0) {
      sheets.push({
        name: "Recent Transactions",
        columns: [
          { header: "Date", key: "txn_date", width: 14 },
          { header: "Merchant", key: "merchant_name", width: 28 },
          { header: "Type", key: "txn_type", width: 10 },
          { header: "Amount (AED)", key: "amount", width: 14 },
        ],
        rows: recent.map((t: any) => ({
          txn_date: t.txn_date,
          merchant_name: t.merchant_name || t.description,
          txn_type: t.txn_type === "credit" ? "Income" : "Expense",
          amount: (t.txn_type === "credit" ? "+" : "-") + Number(t.amount).toFixed(2),
        })),
      });
    }

    exportToExcel(sheets, `dashboard_${periodLabel.replace(/\s/g, "_")}`);
  }

  function handlePDFExport() {
    const periodLabel = getPeriodLabel();
    const sections = [];

    if (summary) {
      sections.push({
        title: "Summary",
        columns: ["Metric", "Value (AED)"],
        rows: [
          ["Opening Balance", Number(summary.opening_balance ?? 0).toFixed(2)],
          ["Closing Balance", Number(summary.closing_balance ?? 0).toFixed(2)],
          ["Total Income", `+${Number(summary.total_credits ?? 0).toFixed(2)}`],
          ["Total Expenses", `-${Number(summary.total_debits ?? 0).toFixed(2)}`],
          ["Transactions", String(summary.transaction_count ?? 0)],
          ["Savings Rate", savingsRate !== null ? `${savingsRate}%` : "N/A"],
        ] as (string | number)[][],
      });
    }

    if (breakdown.length > 0) {
      sections.push({
        title: "Spending by Category",
        columns: ["Category", "Total (AED)", "% of Spend"],
        rows: breakdown.map((c: any) => [
          c.category_name,
          Number(c.total).toFixed(2),
          `${c.percentage?.toFixed(1)}%`,
        ]) as (string | number)[][],
      });
    }

    if (places.length > 0) {
      sections.push({
        title: "Top Places",
        columns: ["Merchant", "Visits", "Avg Spend (AED)", "Total (AED)"],
        rows: places.map((p: any) => [
          p.merchant_name,
          p.visit_count,
          Number(p.total_spent / p.visit_count).toFixed(2),
          Number(p.total_spent).toFixed(2),
        ]) as (string | number)[][],
      });
    }

    exportToPDF(sections, `dashboard_${periodLabel.replace(/\s/g, "_")}`, "Dashboard Report", periodLabel);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      {/* Period selector */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
          {(["month", "quarter", "year", "custom"] as Period[]).map(p => (
            <button key={p} onClick={() => { setPeriod(p); setShowMonthPicker(false); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${period === p ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-gray-100"}`}>
              {p === "custom" ? "Custom" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          </div>
          {!loading && summary?.transaction_count > 0 && (
            <ExportButtons onExportExcel={handleExcelExport} onExportPDF={handlePDFExport} />
          )}
        </div>

        {/* Navigation for month/quarter/year */}
        {period !== "custom" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (period === "month") setMonthOffset(o => o - 1);
                else if (period === "quarter") setQuarterOffset(o => o - 1);
                else setYearOffset(o => o - 1);
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

            {/* Month label — clickable for month picker */}
            {period === "month" ? (
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => { setPickerYear(new Date(today.getFullYear(), today.getMonth() + monthOffset, 1).getFullYear()); setShowMonthPicker(v => !v); }}
                  className="text-sm font-semibold text-slate-700 min-w-[140px] text-center px-2 py-1 rounded-lg hover:bg-gray-100 flex items-center justify-center gap-1">
                  {getPeriodLabel()}
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {showMonthPicker && (
                  <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 w-64">
                    {/* Picker year navigation */}
                    <div className="flex items-center justify-between mb-3">
                      <button onClick={() => setPickerYear(y => y - 1)} className="p-1 rounded-lg hover:bg-gray-100">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <span className="font-semibold text-slate-800 text-sm">{pickerYear}</span>
                      <button onClick={() => setPickerYear(y => y + 1)} disabled={pickerYear >= today.getFullYear()} className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {MONTHS.map((mon, idx) => {
                        const isFuture = pickerYear > today.getFullYear() || (pickerYear === today.getFullYear() && idx > today.getMonth());
                        const targetOffset = (pickerYear - today.getFullYear()) * 12 + (idx - today.getMonth());
                        const isSelected = targetOffset === monthOffset;
                        return (
                          <button key={mon} disabled={isFuture}
                            onClick={() => { setMonthOffset(targetOffset); setShowMonthPicker(false); }}
                            className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${isSelected ? "bg-emerald-500 text-white" : isFuture ? "text-slate-300 cursor-not-allowed" : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700"}`}>
                            {mon}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm font-semibold text-slate-700 min-w-[120px] text-center">{getPeriodLabel()}</span>
            )}

            <button
              onClick={() => {
                if (period === "month") setMonthOffset(o => Math.min(o + 1, 0));
                else if (period === "quarter") setQuarterOffset(o => Math.min(o + 1, 0));
                else setYearOffset(o => Math.min(o + 1, 0));
              }}
              disabled={!canGoForward()}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Custom date range inputs */}
      {period === "custom" && (
        <div className="flex items-center gap-3 mb-5 bg-white border border-gray-200 rounded-xl p-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1 font-medium">From</label>
            <input type="date" value={customFrom} max={customTo || today.toISOString().split("T")[0]}
              onChange={e => setCustomFrom(e.target.value)}
              className="w-full text-sm font-medium text-slate-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="text-slate-300 mt-4">→</div>
          <div className="flex-1">
            <label className="block text-xs text-slate-500 mb-1 font-medium">To</label>
            <input type="date" value={customTo} min={customFrom} max={today.toISOString().split("T")[0]}
              onChange={e => setCustomTo(e.target.value)}
              className="w-full text-sm font-medium text-slate-800 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Balance card */}
          <div className="bg-emerald-500 rounded-2xl p-6 text-white mb-4">
            <p className="text-emerald-100 text-sm font-medium mb-1">Closing Balance</p>
            <p className="text-4xl font-bold mb-4">{formatAED(summary?.closing_balance ?? 0)}</p>
            <div className="flex gap-4">
              <div>
                <p className="text-emerald-100 text-xs">Opening</p>
                <p className="text-lg font-semibold">{formatAED(summary?.opening_balance ?? 0)}</p>
              </div>
              <div className="w-px bg-emerald-400" />
              <div>
                <p className="text-emerald-100 text-xs">Income</p>
                <p className="text-lg font-semibold">+{formatAED(summary?.total_credits ?? 0)}</p>
              </div>
              <div className="w-px bg-emerald-400" />
              <div>
                <p className="text-emerald-100 text-xs">Spent</p>
                <p className="text-lg font-semibold">-{formatAED(summary?.total_debits ?? 0)}</p>
              </div>
            </div>
          </div>

          {/* Quick stats row */}
          {summary?.transaction_count > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
                <p className="text-xs text-slate-500 mb-1">Savings Rate</p>
                <p className={`text-xl font-bold ${savingsRate !== null && savingsRate >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {savingsRate !== null ? `${savingsRate}%` : "—"}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
                <p className="text-xs text-slate-500 mb-1">Avg / Day</p>
                <p className="text-xl font-bold text-slate-800">
                  {avgDaily ? formatAED(avgDaily) : "—"}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
                <p className="text-xs text-slate-500 mb-1">Transactions</p>
                <p className="text-xl font-bold text-slate-800">{summary?.transaction_count ?? 0}</p>
              </div>
            </div>
          )}

          {/* Biggest expense */}
          {summary?.biggest_expense && (
            <div className="bg-white rounded-2xl p-4 mb-4 border border-gray-100 flex items-center gap-4">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Biggest expense</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{summary.biggest_expense.description}</p>
              </div>
              <p className="text-red-600 font-bold shrink-0">{formatAED(summary.biggest_expense.amount)}</p>
            </div>
          )}

          {/* Category breakdown */}
          {breakdown.length > 0 && (
            <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-100">
              <h2 className="font-semibold text-slate-900 mb-4">Spending by Category</h2>
              <div className="space-y-3">
                {breakdown.slice(0, 6).map((cat: any) => (
                  <div key={cat.category_name}
                    className="cursor-pointer group"
                    onClick={() => {
                      const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo });
                      if (cat.category_id) qs.set("category_id", String(cat.category_id));
                      navigate(`/transactions?${qs}`);
                    }}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-slate-700 group-hover:text-emerald-600 transition-colors">{cat.category_name}</span>
                      </span>
                      <span className="font-medium text-slate-900 flex items-center gap-1">
                        {formatAED(cat.total)}
                        <span className="text-slate-400 text-xs ml-1.5">{cat.percentage?.toFixed(0)}%</span>
                        <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Frequent places */}
          {places.length > 0 && (
            <div className="bg-white rounded-2xl p-5 mb-4 border border-gray-100">
              <h2 className="font-semibold text-slate-900 mb-3">Top Places</h2>
              <div className="space-y-2.5">
                {places.map((p: any, i: number) => (
                  <div key={p.merchant_name || i}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => {
                      const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo, search: p.merchant_name });
                      navigate(`/transactions?${qs}`);
                    }}>
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-emerald-600 transition-colors">{p.merchant_name}</p>
                      <p className="text-xs text-slate-400">{p.visit_count} visits</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-sm text-slate-900 shrink-0">{formatAED(p.total_spent)}</p>
                      <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          {recent.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100">
              <div className="flex justify-between items-center px-5 pt-5 pb-3">
                <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
                <a href={`/transactions?from=${rangeFrom}&to=${rangeTo}`} className="text-sm text-emerald-600 font-medium hover:text-emerald-700">
                  See all →
                </a>
              </div>
              <div className="divide-y divide-gray-50">
                {recent.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{t.merchant_name || t.description}</p>
                      <p className="text-xs text-slate-400">{new Date(t.txn_date).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}</p>
                    </div>
                    <span className={`font-semibold text-sm ${t.txn_type === "credit" ? "text-emerald-600" : "text-slate-900"}`}>
                      {t.txn_type === "credit" ? "+" : "-"}{formatAED(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!summary?.transaction_count && (
            <div className="text-center py-16">
              <p className="text-slate-400 mb-4">No data for this period</p>
              <a href="/upload" className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-medium inline-block">Upload Statement</a>
            </div>
          )}
        </>
      )}

      {/* Floating Ask AI button */}
      <button
        onClick={() => setShowAskAI(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white px-4 py-3 rounded-2xl shadow-lg transition-all hover:shadow-violet-200 hover:shadow-xl z-40"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-sm font-medium">Ask AI</span>
      </button>

      <AskAIModal
        open={showAskAI}
        onClose={() => setShowAskAI(false)}
        fromDate={rangeFrom}
        toDate={rangeTo}
      />
    </div>
  );
}
