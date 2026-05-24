import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatAED, formatShortDate, getMonthRange, getQuarterRange, getYearRange } from "../lib/utils";
import ExportButtons from "../components/ExportButtons";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

type Period = "" | "month" | "quarter" | "year" | "custom";
type SortBy = "date" | "amount";
type SortDir = "asc" | "desc";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function detectPeriodFromRange(from: string, to: string, today: Date): { period: Period; monthOffset: number; quarterOffset: number; yearOffset: number } {
  const d = new Date(from + "T00:00:00");
  const monthRange = getMonthRange(d.getFullYear(), d.getMonth() + 1);
  if (monthRange.from === from && monthRange.to === to) {
    const offset = (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth());
    return { period: "month", monthOffset: offset, quarterOffset: 0, yearOffset: 0 };
  }
  const yearRange = getYearRange(d.getFullYear());
  if (yearRange.from === from && yearRange.to === to) {
    return { period: "year", monthOffset: 0, quarterOffset: 0, yearOffset: d.getFullYear() - today.getFullYear() };
  }
  return { period: "custom", monthOffset: 0, quarterOffset: 0, yearOffset: 0 };
}

function TransactionsInner() {
  const today = new Date();
  const [searchParams] = useSearchParams();

  // Period navigation
  const [period, setPeriod] = useState<Period>(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) return detectPeriodFromRange(from, to, today).period;
    return "month";
  });
  const [monthOffset, setMonthOffset] = useState(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) return detectPeriodFromRange(from, to, today).monthOffset;
    return 0;
  });
  const [quarterOffset, setQuarterOffset] = useState(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) return detectPeriodFromRange(from, to, today).quarterOffset;
    return 0;
  });
  const [yearOffset, setYearOffset] = useState(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to) return detectPeriodFromRange(from, to, today).yearOffset;
    return 0;
  });
  const [customFrom, setCustomFrom] = useState(() => searchParams.get("from") ?? "");
  const [customTo, setCustomTo] = useState(() => searchParams.get("to") ?? "");
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  // Filters
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [filterType, setFilterType] = useState<"" | "debit" | "credit">("");
  const [filterCat, setFilterCat] = useState<number | "">(() => {
    const c = searchParams.get("category_id");
    return c ? Number(c) : "";
  });

  // Sort
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [txns, setTxns] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    api.listCategories().then(c => setCategories(Array.isArray(c) ? c : []));
  }, []);

  function getRange(): { from: string; to: string } {
    if (period === "" ) return { from: "", to: "" };
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
    if (period === "") return "All time";
    if (period === "custom") return customFrom && customTo ? `${customFrom} → ${customTo}` : "Custom range";
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

  function goBack() {
    if (period === "month") setMonthOffset(o => o - 1);
    else if (period === "quarter") setQuarterOffset(o => o - 1);
    else if (period === "year") setYearOffset(o => o - 1);
  }

  function goForward() {
    if (period === "month") setMonthOffset(o => Math.min(o + 1, 0));
    else if (period === "quarter") setQuarterOffset(o => Math.min(o + 1, 0));
    else if (period === "year") setYearOffset(o => Math.min(o + 1, 0));
  }

  useEffect(() => {
    if (period === "custom" && (!customFrom || !customTo)) return;
    setLoading(true);
    const { from, to } = getRange();
    const params: any = { limit: 500 };
    if (search) params.search = search;
    if (filterType) params.type = filterType;
    if (filterCat) params.category_id = filterCat;
    if (from) params.from = from;
    if (to) params.to = to;
    api.listTransactions(params)
      .then(t => setTxns(Array.isArray(t) ? t : []))
      .finally(() => setLoading(false));
  }, [search, filterType, filterCat, period, monthOffset, quarterOffset, yearOffset, customFrom, customTo]);

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const activeFilterCount = [
    filterType !== "",
    filterCat !== "",
    period !== "month" || monthOffset !== 0,
  ].filter(Boolean).length;

  function clearAll() {
    setFilterType("");
    setFilterCat("");
    setSearch("");
    setPeriod("month");
    setMonthOffset(0);
    setQuarterOffset(0);
    setYearOffset(0);
    setCustomFrom("");
    setCustomTo("");
  }

  // Sort + group
  const sortedTxns = [...txns].sort((a, b) => {
    if (sortBy === "amount") {
      return sortDir === "desc" ? Number(b.amount) - Number(a.amount) : Number(a.amount) - Number(b.amount);
    }
    return sortDir === "desc"
      ? b.txn_date.localeCompare(a.txn_date)
      : a.txn_date.localeCompare(b.txn_date);
  });

  // When sorting by amount show flat list; by date show grouped by date
  const groupByDate = sortBy === "date";
  const dateGroups: { date: string; items: any[] }[] = groupByDate
    ? Object.entries(
        sortedTxns.reduce((acc: Record<string, any[]>, t) => {
          if (!acc[t.txn_date]) acc[t.txn_date] = [];
          acc[t.txn_date].push(t);
          return acc;
        }, {})
      )
        .sort(([a], [b]) => sortDir === "desc" ? b.localeCompare(a) : a.localeCompare(b))
        .map(([date, items]) => ({ date, items }))
    : [{ date: "", items: sortedTxns }];

  function formatDayHeader(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const isToday = dateStr === today.toISOString().split("T")[0];
    const isYesterday = (() => {
      const y = new Date(today); y.setDate(today.getDate() - 1);
      return dateStr === y.toISOString().split("T")[0];
    })();
    const label = isToday ? "Today" : isYesterday ? "Yesterday" : d.toLocaleDateString("en-AE", { weekday: "short", day: "numeric", month: "short" });
    return label;
  }

  function buildFilename() {
    return `transactions_${getPeriodLabel().replace(/\s|→/g, "_")}`;
  }

  function handleExcelExport() {
    exportToExcel(
      [{
        name: "Transactions",
        columns: [
          { header: "Date", key: "txn_date", width: 14 },
          { header: "Description", key: "description", width: 30 },
          { header: "Merchant", key: "merchant_name", width: 24 },
          { header: "Category", key: "category_name", width: 18 },
          { header: "Type", key: "txn_type", width: 10 },
          { header: "Amount (AED)", key: "amount", width: 14 },
          { header: "Balance (AED)", key: "balance_after", width: 14 },
        ],
        rows: txns.map(t => ({ ...t, category_name: t.category_id ? (catMap[t.category_id]?.name ?? "") : "" })),
      }],
      buildFilename()
    );
  }

  function handlePDFExport() {
    exportToPDF(
      [{
        title: undefined,
        columns: ["Date", "Merchant / Description", "Category", "Type", "Amount (AED)"],
        rows: txns.map(t => [
          t.txn_date,
          t.merchant_name || t.description,
          t.category_id ? (catMap[t.category_id]?.name ?? "") : "",
          t.txn_type === "debit" ? "Expense" : "Income",
          (t.txn_type === "credit" ? "+" : "-") + Number(t.amount).toFixed(2),
        ]),
      }],
      buildFilename(),
      "Transactions Report",
      getPeriodLabel()
    );
  }

  const SortBtn = ({ by, dir, label }: { by: SortBy; dir: SortDir; label: string }) => (
    <button
      onClick={() => { setSortBy(by); setSortDir(dir); }}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${sortBy === by && sortDir === dir ? "bg-slate-800 text-white border-slate-800" : "bg-white border-gray-200 text-slate-600 hover:border-slate-300"}`}>
      {label}
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Transactions</h1>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button onClick={clearAll} className="text-xs text-emerald-600 font-medium flex items-center gap-1 hover:text-emerald-700">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Clear
            </button>
          )}
          {!loading && txns.length > 0 && (
            <ExportButtons onExportExcel={handleExcelExport} onExportPDF={handlePDFExport} />
          )}
        </div>
      </div>

      {/* Period navigator */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 gap-1">
          {([["", "All"], ["month", "Month"], ["quarter", "Quarter"], ["year", "Year"]] as [Period, string][]).map(([p, label]) => (
            <button key={p} onClick={() => { setPeriod(p); setShowMonthPicker(false); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${period === p ? "bg-emerald-500 text-white" : "text-slate-600 hover:bg-gray-100"}`}>
              {label}
            </button>
          ))}
        </div>

        {period !== "" && period !== "custom" && (
          <div className="flex items-center gap-1">
            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

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

            <button onClick={goForward} disabled={!canGoForward()} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        )}

        {period === "custom" && customFrom && customTo && (
          <span className="text-sm font-semibold text-slate-700">{customFrom} → {customTo}</span>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="Search transactions…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {["", "debit", "credit"].map(t => (
            <button key={t} onClick={() => setFilterType(t as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${filterType === t ? "bg-emerald-500 text-white" : "bg-white border border-gray-200 text-slate-600"}`}>
              {t === "" ? "All" : t === "debit" ? "Expenses" : "Income"}
            </button>
          ))}
          <select className="px-3 py-2 rounded-xl text-sm border border-gray-200 bg-white text-slate-600 focus:outline-none"
            value={filterCat} onChange={e => setFilterCat(e.target.value ? Number(e.target.value) : "")}>
            <option value="">All categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <span className="text-xs text-slate-400 font-medium shrink-0">Sort:</span>
        <SortBtn by="date" dir="desc" label="Newest first" />
        <SortBtn by="date" dir="asc" label="Oldest first" />
        <SortBtn by="amount" dir="desc" label="Highest amount" />
        <SortBtn by="amount" dir="asc" label="Lowest amount" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : txns.length === 0 ? (
        <div className="text-center py-20 text-slate-400">No transactions found</div>
      ) : (
        <div className="space-y-4">
          {dateGroups.map(({ date, items }) => {
            const dayDebits = items.filter(t => t.txn_type === "debit").reduce((s, t) => s + Number(t.amount), 0);
            return (
              <div key={date || "all"}>
                {groupByDate && date && (
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{formatDayHeader(date)}</span>
                    {dayDebits > 0 && <span className="text-xs font-medium text-slate-400">{formatAED(dayDebits)}</span>}
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {items.map((t, i) => {
                    const cat = t.category_id ? catMap[t.category_id] : null;
                    return (
                      <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i < items.length - 1 ? "border-b border-gray-50" : ""}`}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: cat ? cat.color + "20" : "#f1f5f9" }}>
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat?.color ?? "#94a3b8" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{t.merchant_name || t.description}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            {!groupByDate && <span>{formatShortDate(t.txn_date)}</span>}
                            {cat && <><span>·</span><span>{cat.name}</span></>}
                            {t.ref_number && <><span>·</span><span className="font-mono">{t.ref_number}</span></>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold text-sm ${t.txn_type === "credit" ? "text-emerald-600" : "text-slate-900"}`}>
                            {t.txn_type === "credit" ? "+" : "-"}{formatAED(t.amount)}
                          </p>
                          {t.balance_after !== null && t.balance_after !== undefined && (
                            <p className="text-xs text-slate-400">{formatAED(t.balance_after)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-center text-xs text-slate-300 py-2">{txns.length} transactions</p>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <TransactionsInner />
    </Suspense>
  );
}
