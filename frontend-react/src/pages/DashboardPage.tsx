import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { cn, formatAED, getMonthRange, getQuarterRange, getYearRange } from "../lib/utils";
import AskAIModal from "../components/AskAIModal";
import UploadModal from "../components/UploadModal";
import ExportButtons from "../components/ExportButtons";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

type Period = "month" | "quarter" | "year" | "custom";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function DashboardPage() {
  const today = new Date();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [quarterOffset, setQuarterOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [customTo, setCustomTo] = useState(() =>
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  );
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  const [summary, setSummary] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAskAI, setShowAskAI] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setShowMonthPicker(false);
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
      const totalQ = (y * 4 + baseQ - 1) + quarterOffset;
      const qYear = Math.floor(totalQ / 4);
      const q = (totalQ % 4) + 1;
      return getQuarterRange(qYear, q);
    }
    return getYearRange(y + yearOffset);
  }

  function getPeriodLabel() {
    if (period === "custom") return customFrom && customTo ? `${customFrom} → ${customTo}` : "Custom range";
    if (period === "month") {
      const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      return d.toLocaleDateString("en-AE", { month: "long", year: "numeric" });
    }
    if (period === "quarter") {
      const baseQ = Math.ceil((today.getMonth() + 1) / 3);
      const totalQ = (today.getFullYear() * 4 + baseQ - 1) + quarterOffset;
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

  function stepBack() {
    if (period === "month") setMonthOffset(o => o - 1);
    else if (period === "quarter") setQuarterOffset(o => o - 1);
    else setYearOffset(o => o - 1);
  }

  function stepForward() {
    if (period === "month") setMonthOffset(o => Math.min(o + 1, 0));
    else if (period === "quarter") setQuarterOffset(o => Math.min(o + 1, 0));
    else setYearOffset(o => Math.min(o + 1, 0));
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
      setSummary(s as any);
      setBreakdown(Array.isArray(b) ? b : []);
      setRecent((t as any)?.content ?? []);
      setPlaces((Array.isArray(p) ? p : []).slice(0, 4));
    }).catch(console.error).finally(() => setLoading(false));
  }, [period, monthOffset, quarterOffset, yearOffset, customFrom, customTo, refreshKey]);

  const savingsRate = summary?.total_credits > 0
    ? Math.round(((summary.total_credits - summary.total_debits) / summary.total_credits) * 100)
    : null;

  const { from: rangeFrom, to: rangeTo } =
    period !== "custom" || (customFrom && customTo) ? getRange() : { from: customFrom, to: customTo };

  const daysDiff = rangeFrom && rangeTo
    ? Math.max(1, Math.round((new Date(rangeTo).getTime() - new Date(rangeFrom).getTime()) / 86400000) + 1)
    : 30;
  const avgDaily = summary?.total_debits ? summary.total_debits / daysDiff : null;

  function handleExcelExport() {
    const label = getPeriodLabel();
    const sheets = [];
    if (summary) {
      sheets.push({
        name: "Summary",
        columns: [{ header: "Metric", key: "metric", width: 24 }, { header: "Value (AED)", key: "value", width: 18 }],
        rows: [
          { metric: "Period", value: label },
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
        columns: [{ header: "Category", key: "category_name", width: 22 }, { header: "Total (AED)", key: "total", width: 16 }, { header: "% of Spend", key: "percentage", width: 12 }, { header: "Transactions", key: "count", width: 14 }],
        rows: breakdown.map((c: any) => ({ category_name: c.category_name, total: Number(c.total).toFixed(2), percentage: `${c.percentage?.toFixed(1)}%`, count: c.count ?? "" })),
      });
    }
    if (recent.length > 0) {
      sheets.push({
        name: "Recent Transactions",
        columns: [{ header: "Date", key: "txn_date", width: 14 }, { header: "Merchant", key: "merchant_name", width: 28 }, { header: "Type", key: "txn_type", width: 10 }, { header: "Amount (AED)", key: "amount", width: 14 }],
        rows: recent.map((t: any) => ({ txn_date: t.txn_date, merchant_name: t.merchant_name || t.description, txn_type: t.txn_type === "credit" ? "Income" : "Expense", amount: (t.txn_type === "credit" ? "+" : "-") + Number(t.amount).toFixed(2) })),
      });
    }
    exportToExcel(sheets, `dashboard_${label.replace(/\s/g, "_")}`);
  }

  function handlePDFExport() {
    const label = getPeriodLabel();
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
        rows: breakdown.map((c: any) => [c.category_name, Number(c.total).toFixed(2), `${c.percentage?.toFixed(1)}%`]) as (string | number)[][],
      });
    }
    exportToPDF(sections, `dashboard_${label.replace(/\s/g, "_")}`, "Dashboard Report", label);
  }

  const hasData = !!summary?.transaction_count;

  return (
    <div className="px-6 pt-6 pb-10 max-w-5xl mx-auto">

      {/* ── Page header ── */}
      <div className="flex items-center gap-2 flex-wrap justify-end mb-6">
          {/* Period tabs */}
          <div className="flex items-center bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-1 gap-1">
            {(["month", "quarter", "year", "custom"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setShowMonthPicker(false); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors",
                  period === p
                    ? "bg-ft-primary text-white dark:bg-ve-primary-dim dark:text-ve-background"
                    : "text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
                )}
              >
                {p === "custom" ? "Custom" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {/* Period navigation */}
          {period !== "custom" && (
            <div className="flex items-center gap-1 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl px-1 py-1">
              <button onClick={stepBack} className="p-1 rounded-lg hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
                <MSIcon name="chevron_left" className="text-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
              </button>
              {period === "month" ? (
                <div className="relative" ref={pickerRef}>
                  <button
                    onClick={() => { setPickerYear(new Date(today.getFullYear(), today.getMonth() + monthOffset, 1).getFullYear()); setShowMonthPicker(v => !v); }}
                    className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface min-w-[120px] text-center px-2 py-1 rounded-lg hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
                  >
                    {getPeriodLabel()}
                  </button>
                  {showMonthPicker && (
                    <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl shadow-xl p-3 w-60">
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setPickerYear(y => y - 1)} className="p-1 rounded-lg hover:bg-ft-surface-low dark:hover:bg-ve-surface-high">
                          <MSIcon name="chevron_left" className="text-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                        </button>
                        <span className="font-semibold text-ft-on-surface dark:text-ve-on-surface text-sm">{pickerYear}</span>
                        <button onClick={() => setPickerYear(y => y + 1)} disabled={pickerYear >= today.getFullYear()} className="p-1 rounded-lg hover:bg-ft-surface-low dark:hover:bg-ve-surface-high disabled:opacity-30">
                          <MSIcon name="chevron_right" className="text-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {MONTHS.map((mon, idx) => {
                          const isFuture = pickerYear > today.getFullYear() || (pickerYear === today.getFullYear() && idx > today.getMonth());
                          const targetOffset = (pickerYear - today.getFullYear()) * 12 + (idx - today.getMonth());
                          const isSelected = targetOffset === monthOffset;
                          return (
                            <button
                              key={mon}
                              disabled={isFuture}
                              onClick={() => { setMonthOffset(targetOffset); setShowMonthPicker(false); }}
                              className={cn(
                                "py-1.5 rounded-lg text-xs font-medium transition-colors",
                                isSelected
                                  ? "bg-ft-primary text-white dark:bg-ve-primary-dim dark:text-ve-background"
                                  : isFuture
                                  ? "text-ft-outline dark:text-ve-outline cursor-not-allowed"
                                  : "text-ft-on-surface dark:text-ve-on-surface hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
                              )}
                            >
                              {mon}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface min-w-[100px] text-center">{getPeriodLabel()}</span>
              )}
              <button onClick={stepForward} disabled={!canGoForward()} className="p-1 rounded-lg hover:bg-ft-surface-low dark:hover:bg-ve-surface-high disabled:opacity-30 transition-colors">
                <MSIcon name="chevron_right" className="text-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
              </button>
            </div>
          )}

          {hasData && <ExportButtons onExportExcel={handleExcelExport} onExportPDF={handlePDFExport} />}
      </div>

      {/* Custom date range */}
      {period === "custom" && (
        <div className="flex items-center gap-3 mb-6 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-3">
          <div className="flex-1">
            <label className="block text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1 font-medium">From</label>
            <input type="date" value={customFrom} max={customTo || today.toISOString().split("T")[0]}
              onChange={e => setCustomFrom(e.target.value)}
              className="w-full text-sm font-medium text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
          </div>
          <span className="text-ft-outline dark:text-ve-outline mt-4">→</span>
          <div className="flex-1">
            <label className="block text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1 font-medium">To</label>
            <input type="date" value={customTo} min={customFrom} max={today.toISOString().split("T")[0]}
              onChange={e => setCustomTo(e.target.value)}
              className="w-full text-sm font-medium text-ft-on-surface dark:text-ve-on-surface bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !hasData ? (
        /* ── Empty state ── */
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-ft-surface-low dark:bg-ve-surface flex items-center justify-center">
            <MSIcon name="account_balance" className="text-4xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface">No data for this period</p>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1">Upload a bank statement to get started</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <MSIcon name="upload" className="text-lg" />
            Upload Statement
          </button>
        </div>
      ) : (
        <>
          {/* ── Metric cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {/* Closing Balance */}
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">Total Balance</p>
                <div className="w-8 h-8 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center">
                  <MSIcon name="account_balance" className="text-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                </div>
              </div>
              <p className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(summary?.closing_balance ?? 0)}</p>
              {summary?.opening_balance != null && (
                <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1">
                  Opening: {formatAED(summary.opening_balance)}
                </p>
              )}
            </div>

            {/* Total Income */}
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">Monthly Income</p>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-ve-surface-high flex items-center justify-center">
                  <MSIcon name="arrow_downward" className="text-lg text-emerald-600 dark:text-ve-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-600 dark:text-ve-primary tabular-nums">+{formatAED(summary?.total_credits ?? 0)}</p>
              {savingsRate !== null && (
                <p className="text-xs text-emerald-600 dark:text-ve-primary mt-1 flex items-center gap-0.5">
                  <MSIcon name="trending_up" className="text-sm" />
                  {savingsRate}% savings rate
                </p>
              )}
            </div>

            {/* Total Expenses */}
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">Monthly Expenses</p>
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-ve-surface-high flex items-center justify-center">
                  <MSIcon name="arrow_upward" className="text-lg text-red-500 dark:text-ve-error" />
                </div>
              </div>
              <p className="text-2xl font-bold text-red-500 dark:text-ve-error tabular-nums">-{formatAED(summary?.total_debits ?? 0)}</p>
              {avgDaily && (
                <p className="text-xs text-red-400 dark:text-ve-error mt-1 flex items-center gap-0.5">
                  <MSIcon name="trending_down" className="text-sm" />
                  {formatAED(avgDaily)} / day avg
                </p>
              )}
            </div>
          </div>

          {/* ── Quick stats ── */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-4 text-center">
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1">Transactions</p>
              <p className="text-xl font-bold text-ft-on-surface dark:text-ve-on-surface">{summary?.transaction_count ?? 0}</p>
            </div>
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-4 text-center">
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1">Savings Rate</p>
              <p className={cn("text-xl font-bold", savingsRate !== null && savingsRate >= 0 ? "text-emerald-600 dark:text-ve-primary" : "text-red-500 dark:text-ve-error")}>
                {savingsRate !== null ? `${savingsRate}%` : "—"}
              </p>
            </div>
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-4 text-center">
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-1">Avg / Day</p>
              <p className="text-xl font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{avgDaily ? formatAED(avgDaily) : "—"}</p>
            </div>
          </div>

          {/* ── Two-column: Category breakdown + Biggest expense / Top places ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Category Breakdown */}
            {breakdown.length > 0 && (
              <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
                <h2 className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">Category Breakdown</h2>
                <div className="space-y-3">
                  {breakdown.slice(0, 6).map((cat: any) => (
                    <div
                      key={cat.category_name}
                      className="cursor-pointer group"
                      onClick={() => {
                        const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo });
                        if (cat.category_id) qs.set("category_id", String(cat.category_id));
                        navigate(`/transactions?${qs}`);
                      }}
                    >
                      <div className="flex justify-between text-xs mb-1">
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-ft-on-surface dark:text-ve-on-surface group-hover:text-ft-primary dark:group-hover:text-ve-primary transition-colors font-medium">{cat.category_name}</span>
                        </span>
                        <span className="text-ft-on-surface dark:text-ve-on-surface font-semibold tabular-nums">
                          {formatAED(cat.total)}
                          <span className="text-ft-on-surface-variant dark:text-ve-on-surface-variant font-normal ml-1">{cat.percentage?.toFixed(0)}%</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-ft-surface-low dark:bg-ve-surface-high rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Places */}
            {places.length > 0 && (
              <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
                <h2 className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">Top Places</h2>
                <div className="space-y-3">
                  {places.map((p: any, i: number) => (
                    <div
                      key={p.merchant_name || i}
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => {
                        const qs = new URLSearchParams({ from: rangeFrom, to: rangeTo, search: p.merchant_name });
                        navigate(`/transactions?${qs}`);
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center text-xs font-bold text-ft-on-surface-variant dark:text-ve-on-surface-variant shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface truncate group-hover:text-ft-primary dark:group-hover:text-ve-primary transition-colors">{p.merchant_name}</p>
                        <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{p.visit_count} visits</p>
                      </div>
                      <p className="font-semibold text-sm text-ft-on-surface dark:text-ve-on-surface tabular-nums shrink-0">{formatAED(p.total_spent)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Biggest expense (shows when no places) */}
            {places.length === 0 && summary?.biggest_expense && (
              <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 bg-red-50 dark:bg-ve-surface-high rounded-xl flex items-center justify-center shrink-0">
                  <MSIcon name="trending_down" className="text-xl text-red-500 dark:text-ve-error" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Biggest expense</p>
                  <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{summary.biggest_expense.description}</p>
                </div>
                <p className="text-red-600 dark:text-ve-error font-bold tabular-nums shrink-0">{formatAED(summary.biggest_expense.amount)}</p>
              </div>
            )}
          </div>

          {/* ── Recent Transactions ── */}
          {recent.length > 0 && (
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface">Recent Transactions</h2>
                <Link
                  to={`/transactions?from=${rangeFrom}&to=${rangeTo}`}
                  className="text-xs font-semibold text-ft-primary dark:text-ve-primary hover:underline"
                >
                  View All
                </Link>
              </div>
              <div className="divide-y divide-ft-outline-variant dark:divide-ve-outline">
                {recent.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-9 h-9 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center shrink-0">
                      <MSIcon name={t.txn_type === "credit" ? "payments" : "shopping_bag"} className="text-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface truncate">{t.merchant_name || t.description}</p>
                      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                        {new Date(t.txn_date).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}
                        {t.category_name && <> · {t.category_name}</>}
                      </p>
                    </div>
                    <span className={cn(
                      "font-semibold text-sm tabular-nums",
                      t.txn_type === "credit" ? "text-emerald-600 dark:text-ve-primary" : "text-ft-on-surface dark:text-ve-on-surface"
                    )}>
                      {t.txn_type === "credit" ? "+" : "-"}{formatAED(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Ask AI FAB ── */}
      <button
        onClick={() => setShowAskAI(true)}
        className="fixed bottom-24 md:bottom-6 right-6 flex items-center gap-2 bg-ft-primary dark:bg-ve-primary text-white dark:text-ve-background px-4 py-3 rounded-2xl shadow-lg hover:opacity-90 transition-all z-40"
      >
        <MSIcon name="smart_toy" className="text-lg" />
        <span className="text-sm font-semibold">Ask AI</span>
      </button>

      <AskAIModal
        open={showAskAI}
        onClose={() => setShowAskAI(false)}
        fromDate={rangeFrom}
        toDate={rangeTo}
      />

      {showUpload && <UploadModal onClose={() => { setShowUpload(false); setRefreshKey(k => k + 1); }} />}
    </div>
  );
}
