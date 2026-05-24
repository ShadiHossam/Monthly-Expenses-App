import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { api } from "../lib/api";
import { formatAED, getMonthRange, getQuarterRange, getYearRange } from "../lib/utils";
import ExportButtons from "../components/ExportButtons";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

type Tab = "month" | "quarter" | "year";

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
      setMonthlyData((m as any).data || []);
      setBreakdown((b as any).data || []);
      setFrequent((f as any).data || []);
      setBalanceTrend((bt as any).data || []);
      setMonthComparison((mc as any).data || []);
    }).finally(() => setLoading(false));
  }, [tab, monthOffset]);

  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

  function handleExcelExport() {
    const label = getLabel();
    const sheets = [];

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
    const sections = [];

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
        rows: breakdown.map((c: any) => [
          c.category_name,
          Number(c.total).toFixed(2),
          `${c.percentage?.toFixed(1)}%`,
        ]) as (string | number)[][],
      });
    }

    if (frequent.length > 0) {
      sections.push({
        title: "Frequent Places",
        columns: ["Merchant", "Visits", "Avg Spend (AED)", "Total (AED)"],
        rows: frequent.map((p: any) => [
          p.merchant_name,
          p.visit_count,
          Number(p.avg_spend).toFixed(2),
          Number(p.total_spend).toFixed(2),
        ]) as (string | number)[][],
      });
    }

    exportToPDF(sections, `analytics_${label.replace(/\s/g, "_")}`, "Analytics Report", label);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
            {(["month", "quarter", "year"] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setMonthOffset(0); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${tab === t ? "bg-emerald-500 text-white" : "text-slate-600"}`}>
                {t}
              </button>
            ))}
          </div>
          {!loading && <ExportButtons onExportExcel={handleExcelExport} onExportPDF={handlePDFExport} />}
        </div>
      </div>

      {tab === "month" && (
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => setMonthOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <span className="text-sm font-medium text-slate-700 flex-1 text-center">{getLabel()}</span>
          <button onClick={() => setMonthOffset(o => Math.min(o + 1, 0))} disabled={monthOffset >= 0} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Monthly bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <h2 className="font-semibold text-slate-900 mb-4">Income vs Expenses</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barGap={4}>
                <XAxis dataKey="month_label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: any) => formatAED(v)} />
                <Bar dataKey="total_credits" fill="#10b981" radius={[4, 4, 0, 0]} name="Income" />
                <Bar dataKey="total_debits" fill="#fee2e2" radius={[4, 4, 0, 0]} name="Spent" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category pie */}
          {breakdown.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="font-semibold text-slate-900 mb-4">Spending by Category</h2>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <PieChart width={160} height={160}>
                  <Pie data={breakdown} cx={75} cy={75} innerRadius={45} outerRadius={75} dataKey="total">
                    {breakdown.map((entry, i) => (
                      <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="flex-1 space-y-2 w-full">
                  {breakdown.slice(0, 6).map((cat: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color || COLORS[i % COLORS.length] }} />
                        <span className="text-slate-700 truncate max-w-[120px]">{cat.category_name}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-medium text-slate-900">{formatAED(cat.total)}</span>
                        <span className="text-slate-400 ml-2">{cat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Frequent places */}
          {frequent.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="font-semibold text-slate-900 mb-4">Frequent Places</h2>
              <div className="space-y-3">
                {frequent.map((place: any, i: number) => (
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

          {/* Balance Trend */}
          {balanceTrend.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="font-semibold text-slate-900 mb-4">Balance Trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={balanceTrend}>
                  <XAxis dataKey="period_label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v: any) => formatAED(v)} />
                  <Line type="monotone" dataKey="closing_balance" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} name="Balance" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Month-over-Month Spending */}
          {monthComparison.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="font-semibold text-slate-900 mb-4">Month-over-Month Spending</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthComparison} barGap={4}>
                  <XAxis dataKey="month_label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v: any) => formatAED(v)} />
                  <Bar dataKey="total_debits" fill="#ef4444" radius={[4, 4, 0, 0]} name="Spending" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </>
      )}
    </div>
  );
}
