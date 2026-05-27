import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { cn, formatAED, formatShortDate, getMonthRange, getQuarterRange, getYearRange } from "../lib/utils";
import ExportButtons from "../components/ExportButtons";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

type Period = "" | "month" | "quarter" | "year" | "custom";
type SortBy = "date" | "amount";
type SortDir = "asc" | "desc";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

function detectPeriodFromRange(from: string, to: string, today: Date) {
  const d = new Date(from + "T00:00:00");
  const monthRange = getMonthRange(d.getFullYear(), d.getMonth() + 1);
  if (monthRange.from === from && monthRange.to === to) {
    return { period: "month" as Period, monthOffset: (d.getFullYear() - today.getFullYear()) * 12 + (d.getMonth() - today.getMonth()), quarterOffset: 0, yearOffset: 0 };
  }
  const yearRange = getYearRange(d.getFullYear());
  if (yearRange.from === from && yearRange.to === to) {
    return { period: "year" as Period, monthOffset: 0, quarterOffset: 0, yearOffset: d.getFullYear() - today.getFullYear() };
  }
  return { period: "custom" as Period, monthOffset: 0, quarterOffset: 0, yearOffset: 0 };
}

function TransactionsInner() {
  const today = new Date();
  const [searchParams] = useSearchParams();

  const initPeriod = () => {
    const from = searchParams.get("from"); const to = searchParams.get("to");
    return from && to ? detectPeriodFromRange(from, to, today) : { period: "month" as Period, monthOffset: 0, quarterOffset: 0, yearOffset: 0 };
  };
  const init = initPeriod();

  const [period, setPeriod] = useState<Period>(init.period);
  const [monthOffset, setMonthOffset] = useState(init.monthOffset);
  const [quarterOffset, setQuarterOffset] = useState(init.quarterOffset);
  const [yearOffset, setYearOffset] = useState(init.yearOffset);
  const [customFrom, setCustomFrom] = useState(() => searchParams.get("from") ?? "");
  const [customTo, setCustomTo] = useState(() => searchParams.get("to") ?? "");
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [filterType, setFilterType] = useState<"" | "debit" | "credit">("");
  const [filterCat, setFilterCat] = useState<number | "">(() => { const c = searchParams.get("category_id"); return c ? Number(c) : ""; });
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [txns, setTxns] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowMonthPicker(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { api.listCategories().then(c => setCategories(Array.isArray(c) ? c : [])); }, []);

  function getRange(): { from: string; to: string } {
    if (period === "") return { from: "", to: "" };
    if (period === "custom") return { from: customFrom, to: customTo };
    const y = today.getFullYear(); const m = today.getMonth() + 1;
    if (period === "month") { const d = new Date(y, m - 1 + monthOffset, 1); return getMonthRange(d.getFullYear(), d.getMonth() + 1); }
    if (period === "quarter") {
      const baseQ = Math.ceil(m / 3);
      const totalQ = (y * 4 + baseQ - 1) + quarterOffset;
      return getQuarterRange(Math.floor(totalQ / 4), (totalQ % 4) + 1);
    }
    return getYearRange(y + yearOffset);
  }

  function getPeriodLabel() {
    if (period === "") return "All time";
    if (period === "custom") return customFrom && customTo ? `${customFrom} → ${customTo}` : "Custom range";
    if (period === "month") { const d = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1); return d.toLocaleDateString("en-AE", { month: "long", year: "numeric" }); }
    if (period === "quarter") {
      const baseQ = Math.ceil((today.getMonth() + 1) / 3);
      const totalQ = (today.getFullYear() * 4 + baseQ - 1) + quarterOffset;
      return `Q${(totalQ % 4) + 1} ${Math.floor(totalQ / 4)}`;
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
    const params: any = { limit: 500 };
    if (search) params.search = search;
    if (filterType) params.type = filterType;
    if (filterCat) params.category_id = filterCat;
    if (from) params.from = from;
    if (to) params.to = to;
    api.listTransactions(params).then(t => setTxns((t as any)?.content ?? [])).finally(() => setLoading(false));
  }, [search, filterType, filterCat, period, monthOffset, quarterOffset, yearOffset, customFrom, customTo]);

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  function clearAll() {
    setFilterType(""); setFilterCat(""); setSearch("");
    setPeriod("month"); setMonthOffset(0); setQuarterOffset(0); setYearOffset(0);
    setCustomFrom(""); setCustomTo("");
  }

  const sortedTxns = [...txns].sort((a, b) => {
    if (sortBy === "amount") return sortDir === "desc" ? Number(b.amount) - Number(a.amount) : Number(a.amount) - Number(b.amount);
    return sortDir === "desc" ? b.txn_date.localeCompare(a.txn_date) : a.txn_date.localeCompare(b.txn_date);
  });

  const groupByDate = sortBy === "date";
  const dateGroups = groupByDate
    ? Object.entries(sortedTxns.reduce((acc: Record<string, any[]>, t) => { if (!acc[t.txn_date]) acc[t.txn_date] = []; acc[t.txn_date].push(t); return acc; }, {}))
        .sort(([a], [b]) => sortDir === "desc" ? b.localeCompare(a) : a.localeCompare(b))
        .map(([date, items]) => ({ date, items }))
    : [{ date: "", items: sortedTxns }];

  function formatDayHeader(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    const isToday = dateStr === today.toISOString().split("T")[0];
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const isYesterday = dateStr === yest.toISOString().split("T")[0];
    return isToday ? "Today" : isYesterday ? "Yesterday" : d.toLocaleDateString("en-AE", { weekday: "short", day: "numeric", month: "short" });
  }

  const filteredTotal = sortedTxns.filter(t => t.txn_type === "debit").reduce((s, t) => s + Number(t.amount), 0);

  function handleExcelExport() {
    exportToExcel([{
      name: "Transactions",
      columns: [{ header: "Date", key: "txn_date", width: 14 }, { header: "Description", key: "description", width: 30 }, { header: "Merchant", key: "merchant_name", width: 24 }, { header: "Category", key: "category_name", width: 18 }, { header: "Type", key: "txn_type", width: 10 }, { header: "Amount (AED)", key: "amount", width: 14 }, { header: "Balance (AED)", key: "balance_after", width: 14 }],
      rows: txns.map(t => ({ ...t, category_name: t.category_id ? (catMap[t.category_id]?.name ?? "") : "" })),
    }], `transactions_${getPeriodLabel().replace(/\s|→/g, "_")}`);
  }

  function handlePDFExport() {
    exportToPDF([{
      title: undefined,
      columns: ["Date", "Merchant / Description", "Category", "Type", "Amount (AED)"],
      rows: txns.map(t => [t.txn_date, t.merchant_name || t.description, t.category_id ? (catMap[t.category_id]?.name ?? "") : "", t.txn_type === "debit" ? "Expense" : "Income", (t.txn_type === "credit" ? "+" : "-") + Number(t.amount).toFixed(2)]),
    }], `transactions_${getPeriodLabel().replace(/\s|→/g, "_")}`, "Transactions Report", getPeriodLabel());
  }

  return (
    <div className="px-6 pt-6 pb-10 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Transactions Log</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
            Manage and review your recent financial activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(filterType || filterCat || search || period !== "month" || monthOffset !== 0) && (
            <button onClick={clearAll} className="text-xs font-semibold text-ft-primary dark:text-ve-primary flex items-center gap-1 hover:opacity-80">
              <MSIcon name="close" className="text-base" />
              Clear
            </button>
          )}
          {!loading && txns.length > 0 && <ExportButtons onExportExcel={handleExcelExport} onExportPDF={handlePDFExport} />}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4 mb-4 space-y-3">
        {/* Search + period picker + filtered total */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <MSIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-ft-on-surface-variant dark:text-ve-on-surface-variant text-lg" />
            <input
              className="w-full pl-9 pr-4 py-2.5 bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm text-ft-on-surface dark:text-ve-on-surface placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
              placeholder="Search description..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category */}
          <select
            className="px-3 py-2.5 bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm text-ft-on-surface dark:text-ve-on-surface focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
            value={filterCat}
            onChange={e => setFilterCat(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Period */}
          <div className="flex items-center bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl overflow-hidden">
            <MSIcon name="date_range" className="ml-3 text-ft-on-surface-variant dark:text-ve-on-surface-variant text-lg shrink-0" />
            {period !== "" && period !== "custom" && (
              <button onClick={() => {
                if (period === "month") setMonthOffset(o => o - 1);
                else if (period === "quarter") setQuarterOffset(o => o - 1);
                else setYearOffset(o => o - 1);
              }} className="p-2 hover:bg-ft-surface-container dark:hover:bg-ve-surface-high transition-colors">
                <MSIcon name="chevron_left" className="text-base text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
              </button>
            )}
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => { if (period === "month") { setPickerYear(new Date(today.getFullYear(), today.getMonth() + monthOffset, 1).getFullYear()); setShowMonthPicker(v => !v); } }}
                className="px-2 py-2.5 text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface whitespace-nowrap min-w-[100px] text-center"
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
                        <button key={mon} disabled={isFuture} onClick={() => { setMonthOffset(targetOffset); setShowMonthPicker(false); }}
                          className={cn("py-1.5 rounded-lg text-xs font-medium transition-colors",
                            isSelected ? "bg-ft-primary text-white dark:bg-ve-primary-dim dark:text-ve-background"
                              : isFuture ? "text-ft-outline dark:text-ve-outline cursor-not-allowed"
                              : "text-ft-on-surface dark:text-ve-on-surface hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
                          )}>
                          {mon}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {period !== "" && period !== "custom" && (
              <button onClick={() => {
                if (period === "month") setMonthOffset(o => Math.min(o + 1, 0));
                else if (period === "quarter") setQuarterOffset(o => Math.min(o + 1, 0));
                else setYearOffset(o => Math.min(o + 1, 0));
              }} disabled={!canGoForward()} className="p-2 hover:bg-ft-surface-container dark:hover:bg-ve-surface-high disabled:opacity-30 transition-colors">
                <MSIcon name="chevron_right" className="text-base text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
              </button>
            )}
          </div>

          {txns.length > 0 && (
            <div className="flex flex-col justify-center px-3 py-2 bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl text-right shrink-0">
              <p className="text-[10px] text-ft-on-surface-variant dark:text-ve-on-surface-variant">Filtered Total</p>
              <p className="text-sm font-bold text-red-500 dark:text-ve-error tabular-nums">-{formatAED(filteredTotal)}</p>
            </div>
          )}
        </div>

        {/* Type filter + sort */}
        <div className="flex flex-wrap items-center gap-2">
          {(["", "debit", "credit"] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                filterType === t
                  ? "bg-ft-primary text-white dark:bg-ve-primary-dim dark:text-ve-background"
                  : "bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface-variant dark:text-ve-on-surface-variant border border-ft-outline-variant dark:border-ve-outline hover:bg-ft-surface-container dark:hover:bg-ve-surface-highest"
              )}>
              {t === "" ? "All" : t === "debit" ? "Expenses" : "Income"}
            </button>
          ))}
          <div className="w-px h-4 bg-ft-outline-variant dark:bg-ve-outline mx-1" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">Sort:</span>
          {([["date","desc","Newest first"], ["date","asc","Oldest first"], ["amount","desc","Highest amount"], ["amount","asc","Lowest amount"]] as [SortBy, SortDir, string][]).map(([by, dir, label]) => (
            <button key={label} onClick={() => { setSortBy(by); setSortDir(dir); }}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                sortBy === by && sortDir === dir
                  ? "bg-ft-on-surface text-ft-surface dark:bg-ve-on-surface dark:text-ve-background"
                  : "bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface-variant dark:text-ve-on-surface-variant border border-ft-outline-variant dark:border-ve-outline hover:bg-ft-surface-container dark:hover:bg-ve-surface-highest"
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Transaction list ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : txns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <MSIcon name="receipt_long" className="text-5xl text-ft-outline dark:text-ve-outline" />
          <p className="text-ft-on-surface-variant dark:text-ve-on-surface-variant font-medium">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateGroups.map(({ date, items }) => {
            const dayDebits = items.filter(t => t.txn_type === "debit").reduce((s, t) => s + Number(t.amount), 0);
            return (
              <div key={date || "all"}>
                {groupByDate && date && (
                  <div className="flex items-center justify-between px-1 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-ft-on-surface-variant dark:text-ve-on-surface-variant">{formatDayHeader(date)}</span>
                    {dayDebits > 0 && <span className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant tabular-nums">{formatAED(dayDebits)}</span>}
                  </div>
                )}
                <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                  {items.map((t, i) => {
                    const cat = t.category_id ? catMap[t.category_id] : null;
                    return (
                      <div key={t.id} className={cn(
                        "flex items-center gap-4 px-5 py-4",
                        i < items.length - 1 ? "border-b border-ft-outline-variant dark:border-ve-outline" : ""
                      )}>
                        {/* Category icon */}
                        <div
                          className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", !cat && "bg-ft-surface-low dark:bg-ve-surface-high")}
                          style={{ backgroundColor: cat ? cat.color + "20" : undefined }}>
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cat?.color ?? "#9aaa9e" }} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{t.merchant_name || t.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {!groupByDate && <span className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{formatShortDate(t.txn_date)}</span>}
                            {cat && (
                              <>
                                {!groupByDate && <span className="text-ft-outline dark:text-ve-outline text-xs">·</span>}
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: cat.color + "20", color: cat.color }}>
                                  {cat.name}
                                </span>
                              </>
                            )}
                            {t.ref_number && <span className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant font-mono">{t.ref_number}</span>}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right shrink-0">
                          <p className={cn("font-bold text-sm tabular-nums",
                            t.txn_type === "credit" ? "text-emerald-600 dark:text-ve-primary" : "text-ft-on-surface dark:text-ve-on-surface"
                          )}>
                            {t.txn_type === "credit" ? "+" : "-"}{formatAED(t.amount)}
                          </p>
                          {t.balance_after != null && (
                            <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant tabular-nums">{formatAED(t.balance_after)}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-center text-xs text-ft-outline dark:text-ve-on-surface-variant py-2">
            {txns.length} transactions
          </p>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <TransactionsInner />
    </Suspense>
  );
}
