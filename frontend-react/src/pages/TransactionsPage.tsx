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
  const [filterType, setFilterType] = useState<"" | "debit" | "credit">(() => { const t = searchParams.get("type"); return (t === "debit" || t === "credit") ? t : ""; });
  const [filterCat, setFilterCat] = useState<number | "">(() => { const c = searchParams.get("category_id"); return c ? Number(c) : ""; });
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [txns, setTxns] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCatTxnId, setEditingCatTxnId] = useState<number | null>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#10b981");
  const [savingCat, setSavingCat] = useState(false);
  const [merchantRulePrompt, setMerchantRulePrompt] = useState<{ merchantName: string; categoryId: number; categoryName: string } | null>(null);
  const hasAutoSwitched = useRef(false);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowMonthPicker(false);
      if (editRef.current && !editRef.current.contains(e.target as Node)) { setEditingCatTxnId(null); setAddingCat(false); setNewCatName(""); setNewCatColor("#10b981"); }
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
    let autoSwitched = false;
    api.listTransactions(params).then(t => {
      const items = (t as any)?.content ?? [];
      // Auto-switch to "All time" on first load if the current month has no transactions.
      if (period === "month" && monthOffset === 0 && !search && !filterType && !filterCat && items.length === 0 && !hasAutoSwitched.current) {
        hasAutoSwitched.current = true;
        autoSwitched = true;
        setPeriod("");
        return;
      }
      setTxns(items);
    }).finally(() => { if (!autoSwitched) setLoading(false); });
  }, [search, filterType, filterCat, period, monthOffset, quarterOffset, yearOffset, customFrom, customTo]);

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  async function handleCategoryChange(txnId: number, categoryId: number) {
    const txn = txns.find(t => t.id === txnId);
    await api.setCategory(txnId, categoryId);
    setTxns(prev => prev.map(t => t.id === txnId ? { ...t, category_id: categoryId } : t));
    setEditingCatTxnId(null);
    if (txn?.merchant_name) {
      const cat = categories.find(c => c.id === categoryId);
      setMerchantRulePrompt({ merchantName: txn.merchant_name, categoryId, categoryName: cat?.name ?? "" });
    }
  }

  async function handleMerchantRuleAnswer(always: boolean) {
    if (always && merchantRulePrompt) {
      await api.createRule({ pattern: merchantRulePrompt.merchantName, pattern_type: "contains", category_id: merchantRulePrompt.categoryId, priority: 10 });
    }
    setMerchantRulePrompt(null);
  }

  async function handleCreateCategory(txnId: number) {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      const created = await api.createCategory(newCatName.trim(), newCatColor, "tag") as any;
      const refreshed = await api.listCategories();
      setCategories(Array.isArray(refreshed) ? refreshed : []);
      setAddingCat(false);
      setNewCatName("");
      setNewCatColor("#10b981");
      if (created?.id) await handleCategoryChange(txnId, created.id);
    } finally {
      setSavingCat(false);
    }
  }

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
                <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl">
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
                          {cat
                            ? <MSIcon name={cat.icon || "label"} className="text-[18px] leading-none" style={{ color: cat.color }} />
                            : <MSIcon name="label_off" className="text-[18px] leading-none text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                          }
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{t.merchant_name || t.description}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {!groupByDate && <span className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{formatShortDate(t.txn_date)}</span>}
                            {!groupByDate && <span className="text-ft-outline dark:text-ve-outline text-xs">·</span>}
                            <div className="relative" ref={editingCatTxnId === t.id ? editRef : null}>
                              <button
                                onClick={() => { setEditingCatTxnId(prev => prev === t.id ? null : t.id); setAddingCat(false); setNewCatName(""); setNewCatColor("#10b981"); }}
                                title="Edit category"
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 hover:opacity-80 transition-opacity",
                                  !cat && "border border-dashed border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant"
                                )}
                                style={cat ? { backgroundColor: cat.color + "20", color: cat.color } : undefined}
                              >
                                {cat ? cat.name : "Uncategorized"}
                                <MSIcon name="keyboard_arrow_down" className="text-[11px] leading-none" />
                              </button>
                              {editingCatTxnId === t.id && (
                                <div className="absolute top-full left-0 mt-1 z-50 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-xl shadow-xl overflow-hidden min-w-[180px] max-h-72 overflow-y-auto">
                                  {categories.map(c => (
                                    <button
                                      key={c.id}
                                      onClick={() => handleCategoryChange(t.id, c.id)}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
                                    >
                                      <MSIcon name={c.icon || "label"} className="text-[14px] leading-none shrink-0" style={{ color: c.color }} />
                                      <span className="text-ft-on-surface dark:text-ve-on-surface">{c.name}</span>
                                      {t.category_id === c.id && <MSIcon name="check" className="text-[11px] ml-auto text-ft-primary dark:text-ve-primary" />}
                                    </button>
                                  ))}
                                  <div className="border-t border-ft-outline-variant dark:border-ve-outline">
                                    {!addingCat ? (
                                      <button
                                        onClick={() => setAddingCat(true)}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-ft-primary dark:text-ve-primary hover:bg-ft-surface-low dark:hover:bg-ve-surface-high font-medium"
                                      >
                                        <MSIcon name="add" className="text-[14px]" />
                                        New category
                                      </button>
                                    ) : (
                                      <div className="p-2.5 flex flex-col gap-2">
                                        <input
                                          autoFocus
                                          value={newCatName}
                                          onChange={e => setNewCatName(e.target.value)}
                                          onKeyDown={e => { if (e.key === "Enter") handleCreateCategory(t.id); if (e.key === "Escape") setAddingCat(false); }}
                                          placeholder="Category name"
                                          className="w-full text-xs px-2 py-1.5 rounded-lg border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface placeholder:text-ft-on-surface-variant dark:placeholder:text-ve-on-surface-variant outline-none focus:border-ft-primary dark:focus:border-ve-primary"
                                        />
                                        <div className="flex gap-1 flex-wrap">
                                          {["#10b981","#ef4444","#f59e0b","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316","#6b7280"].map(color => (
                                            <button
                                              key={color}
                                              onClick={() => setNewCatColor(color)}
                                              className={cn("w-4 h-4 rounded-full transition-transform", newCatColor === color && "ring-2 ring-offset-1 ring-ft-primary dark:ring-ve-primary scale-125")}
                                              style={{ backgroundColor: color }}
                                            />
                                          ))}
                                        </div>
                                        <div className="flex gap-1.5">
                                          <button
                                            onClick={() => handleCreateCategory(t.id)}
                                            disabled={!newCatName.trim() || savingCat}
                                            className="flex-1 py-1 text-xs font-semibold rounded-lg bg-ft-primary dark:bg-ve-primary text-white disabled:opacity-50"
                                          >
                                            {savingCat ? "…" : "Add"}
                                          </button>
                                          <button
                                            onClick={() => { setAddingCat(false); setNewCatName(""); }}
                                            className="px-2 py-1 text-xs rounded-lg border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
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

      {merchantRulePrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-3 w-[calc(100%-2rem)] max-w-sm">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">Always use this category?</p>
            <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5 truncate">
              "{merchantRulePrompt.merchantName}" → {merchantRulePrompt.categoryName}
            </p>
          </div>
          <button onClick={() => handleMerchantRuleAnswer(false)} className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-ft-on-surface dark:hover:text-ve-on-surface px-3 py-1.5 rounded-lg hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors shrink-0">No</button>
          <button onClick={() => handleMerchantRuleAnswer(true)} className="text-xs font-semibold text-ft-primary dark:text-ve-primary bg-ft-primary/10 dark:bg-ve-primary/10 hover:bg-ft-primary/20 dark:hover:bg-ve-primary/20 px-3 py-1.5 rounded-lg transition-colors shrink-0">Always</button>
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
