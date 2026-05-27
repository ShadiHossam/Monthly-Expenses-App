import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../lib/api";
import { cn, formatAED, getMonthRange, getQuarterRange, getYearRange } from "../lib/utils";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

type Tab = "month" | "quarter" | "year";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

const CHART_COLORS = ["#005e26", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const DARK_CHART_COLORS = ["#95d4b3", "#ffb3b3", "#fcd34d", "#93c5fd", "#c4b5fd", "#f9a8d4", "#67e8f9", "#fed7aa"];

export default function AnalyticsPage() {
  const today = new Date();
  const [tab, setTab] = useState<Tab>("month");
  const [monthOffset, setMonthOffset] = useState(0);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [frequent, setFrequent] = useState<any[]>([]);
  const [balanceTrend, setBalanceTrend] = useState<any[]>([]);
  const [monthComparison, setMonthComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  function getRange() {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    if (tab === "month") {
      const d = new Date(y, m - 1 + monthOffset, 1);
      return getMonthRange(d.getFullYear(), d.getMonth() + 1);
    }
    if (tab === "quarter") return getQuarterRange(y, Math.ceil(m / 3));
    return getYearRange(y);
  }

  function getLabel() {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    if (tab === "month") {
      const d = new Date(y, m - 1 + monthOffset, 1);
      return d.toLocaleDateString("en-AE", { month: "long", year: "numeric" });
    }
    if (tab === "quarter") return `Q${Math.ceil(m / 3)} ${y}`;
    return String(y);
  }

  useEffect(() => {
    setLoading(true);
    const { from, to } = getRange();
    const y = today.getFullYear();
    Promise.all([
      api.getMonthly(y),
      api.getCategoryBreakdown(from, to),
      api.getFrequentPlaces(from, to),
      api.getBalanceTrend(),
      api.getMonthComparison(6),
    ]).then(([m, b, f, bt, mc]) => {
      setMonthlyData(Array.isArray(m) ? m : []);
      setBreakdown(Array.isArray(b) ? b : []);
      setFrequent(Array.isArray(f) ? f : []);
      setBalanceTrend(Array.isArray(bt) ? bt : []);
      setMonthComparison(Array.isArray(mc) ? mc : []);
    }).finally(() => setLoading(false));
  }, [tab, monthOffset]);

  function handleExcelExport() {
    const label = getLabel();
    const sheets: any[] = [];
    if (monthlyData.length > 0) {
      sheets.push({
        name: "Monthly Overview",
        columns: [
          { header: "Month", key: "month_label", width: 14 },
          { header: "Income (AED)", key: "total_credits", width: 16 },
          { header: "Expenses (AED)", key: "total_debits", width: 16 },
          { header: "Net (AED)", key: "net", width: 14 },
        ],
        rows: monthlyData.map((m: any) => ({
          month_label: m.month_label,
          total_credits: Number(m.total_credits ?? 0).toFixed(2),
          total_debits: Number(m.total_debits ?? 0).toFixed(2),
          net: Number((m.total_credits ?? 0) - (m.total_debits ?? 0)).toFixed(2),
        })),
      });
    }
    if (breakdown.length > 0) {
      sheets.push({
        name: "By Category",
        columns: [
          { header: "Category", key: "category_name", width: 22 },
          { header: "Total (AED)", key: "total", width: 16 },
          { header: "% of Spend", key: "percentage", width: 12 },
        ],
        rows: breakdown.map((c: any) => ({
          category_name: c.category_name,
          total: Number(c.total).toFixed(2),
          percentage: `${c.percentage?.toFixed(1)}%`,
        })),
      });
    }
    if (frequent.length > 0) {
      sheets.push({
        name: "Frequent Places",
        columns: [
          { header: "Merchant", key: "merchant_name", width: 28 },
          { header: "Visits", key: "visit_count", width: 10 },
          { header: "Avg Spend (AED)", key: "avg_spend", width: 16 },
          { header: "Total Spent (AED)", key: "total_spend", width: 16 },
        ],
        rows: frequent.map((p: any) => ({
          merchant_name: p.merchant_name,
          visit_count: p.visit_count,
          avg_spend: Number(p.avg_spend).toFixed(2),
          total_spend: Number(p.total_spent).toFixed(2),
        })),
      });
    }
    exportToExcel(sheets, `analytics_${label.replace(/\s/g, "_")}`);
  }

  function handlePDFExport() {
    const label = getLabel();
    const sections: any[] = [];
    if (monthlyData.length > 0) {
      sections.push({
        title: "Monthly Overview",
        columns: ["Month", "Income (AED)", "Expenses (AED)", "Net (AED)"],
        rows: monthlyData.map((m: any) => [
          m.month_label,
          Number(m.total_credits ?? 0).toFixed(2),
          Number(m.total_debits ?? 0).toFixed(2),
          Number((m.total_credits ?? 0) - (m.total_debits ?? 0)).toFixed(2),
        ]) as (string | number)[][],
      });
    }
    if (breakdown.length > 0) {
      sections.push({
        title: "Spending by Category",
        columns: ["Category", "Total (AED)", "% of Spend"],
        rows: breakdown.map((c: any) => [c.category_name, Number(c.total).toFixed(2), `${c.percentage?.toFixed(1)}%`]) as (string | number)[][],
      });
    }
    if (frequent.length > 0) {
      sections.push({
        title: "Frequent Places",
        columns: ["Merchant", "Visits", "Avg Spend (AED)", "Total (AED)"],
        rows: frequent.map((p: any) => [p.merchant_name, p.visit_count, Number(p.avg_spend).toFixed(2), Number(p.total_spend).toFixed(2)]) as (string | number)[][],
      });
    }
    exportToPDF(sections, `analytics_${label.replace(/\s/g, "_")}`, "Analytics Report", label);
  }

  return (
    <div className="px-6 pt-6 pb-10 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Analytics</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Spending trends and category insights</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period tabs */}
          <div className="flex bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl p-1 gap-1">
            {(["month", "quarter", "year"] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setMonthOffset(0); }}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                  tab === t ? "bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background" : "text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-ft-on-surface dark:hover:text-ve-on-surface")}>
                {t}
              </button>
            ))}
          </div>
          {/* Export buttons */}
          {!loading && (
            <>
              <button onClick={handleExcelExport}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
                <MSIcon name="table_view" className="text-base" />Excel
              </button>
              <button onClick={handlePDFExport}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
                <MSIcon name="picture_as_pdf" className="text-base" />PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Month nav ── */}
      {tab === "month" && (
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => setMonthOffset(o => o - 1)}
            className="p-2 rounded-xl hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
            <MSIcon name="chevron_left" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          </button>
          <span className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface flex-1 text-center">{getLabel()}</span>
          <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} disabled={monthOffset >= 0}
            className="p-2 rounded-xl hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors disabled:opacity-30">
            <MSIcon name="chevron_right" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Income vs Expenses bar chart ── */}
          <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
            <h2 className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Income vs Expenses</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barGap={4}>
                <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: "var(--color-on-surface-variant, #3f4a3e)" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: any) => formatAED(v)}
                  contentStyle={{ background: "var(--color-surface, #fff)", border: "1px solid var(--color-outline-variant, #becabb)", borderRadius: 12, fontSize: 12 }}
                />
                <Bar dataKey="total_credits" fill="#005e26" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="total_debits" fill="#becabb" radius={[4, 4, 0, 0]} name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Spending by Category ── */}
          {breakdown.length > 0 && (
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <h2 className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Spending by Category</h2>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <PieChart width={160} height={160}>
                  <Pie data={breakdown} cx={75} cy={75} innerRadius={45} outerRadius={75} dataKey="total">
                    {breakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="flex-1 space-y-2 w-full">
                  {breakdown.slice(0, 6).map((cat: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color || CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-ft-on-surface dark:text-ve-on-surface truncate max-w-[130px]">{cat.category_name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="font-semibold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(cat.total)}</span>
                        <span className="text-ft-on-surface-variant dark:text-ve-on-surface-variant ml-1.5 tabular-nums">{cat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Frequent Places ── */}
          {frequent.length > 0 && (
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <h2 className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Frequent Places</h2>
              <div className="space-y-3">
                {frequent.map((place: any, i: number) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-ft-primary/10 dark:bg-ve-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-ft-primary dark:text-ve-primary">{place.visit_count}x</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{place.merchant_name}</p>
                      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">{place.frequency_reason} · avg {formatAED(place.avg_spend)}</p>
                    </div>
                    <span className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums shrink-0">{formatAED(place.total_spent)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Balance Trend ── */}
          {balanceTrend.length > 1 && (
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <h2 className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Balance Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={balanceTrend}>
                  <XAxis dataKey="period_label" tick={{ fontSize: 11, fill: "var(--color-on-surface-variant, #3f4a3e)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: any) => formatAED(v)}
                    contentStyle={{ background: "var(--color-surface, #fff)", border: "1px solid var(--color-outline-variant, #becabb)", borderRadius: 12, fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="closing_balance" stroke="#005e26" strokeWidth={2} dot={{ r: 3, fill: "#005e26" }} name="Balance" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Month-over-Month Spending ── */}
          {monthComparison.length > 1 && (
            <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5">
              <h2 className="font-semibold text-ft-on-surface dark:text-ve-on-surface mb-4">Month-over-Month Spending</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthComparison} barGap={4}>
                  <XAxis dataKey="month_label" tick={{ fontSize: 11, fill: "var(--color-on-surface-variant, #3f4a3e)" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: any) => formatAED(v)}
                    contentStyle={{ background: "var(--color-surface, #fff)", border: "1px solid var(--color-outline-variant, #becabb)", borderRadius: 12, fontSize: 12 }}
                  />
                  <Bar dataKey="total_debits" fill="#005e26" radius={[4, 4, 0, 0]} name="Spending" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
