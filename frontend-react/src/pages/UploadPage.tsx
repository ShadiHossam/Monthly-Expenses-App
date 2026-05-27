import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api, fetchSSE } from "../lib/api";
import { cn, formatAED } from "../lib/utils";
import type { BillingUsage, Category, QAPending } from "../types";
import AddTransactionModal from "../components/AddTransactionModal";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

const STEPS = ["preprocessing", "ocr", "parsing", "verifying", "categorizing"];

type FileStatus = "queued" | "uploading" | "processing" | "done" | "error";

type OveragePending = {
  file: File;
  entryId: string;
  overage_pages: number;
  overage_cost_usd: number;
};

type FileEntry = {
  file: File;
  id: string;
  status: FileStatus;
  progress?: { step: string; pct: number; message: string };
  error?: string;
  statementId?: number;
  uncategorizedCount?: number;
};

type QAItem = QAPending & {
  suggested_category_name?: string;
  suggested_new_category_obj?: { name: string; color: string; icon: string } | null;
};

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function UploadPage({ onClose }: { onClose?: () => void } = {}) { // eslint-disable-line
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [qaIndex, setQaIndex] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [applyRule, setApplyRule] = useState(true);
  const [allDone, setAllDone] = useState(false);
  const [creatingNewCat, setCreatingNewCat] = useState(false);
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [overagePending, setOveragePending] = useState<OveragePending | null>(null);
  const [overlapWarnings, setOverlapWarnings] = useState<Array<{ file: string; period: string }>>([]);
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const abortControllersRef = useRef<AbortController[]>([]);

  useEffect(() => { api.getBillingUsage().then(setUsage).catch(() => {}); }, []);
  useEffect(() => { return () => { abortControllersRef.current.forEach(ac => ac.abort()); }; }, []);

  const updateEntry = (id: string, patch: Partial<FileEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const processFile = useCallback(async (entry: FileEntry, confirmOverage = false) => {
    updateEntry(entry.id, { status: "uploading", progress: { step: "preprocessing", pct: 5, message: "Uploading…" } });
    try {
      const res = await api.uploadStatement(entry.file, confirmOverage);
      const statementIds: number[] = res.data.statement_ids ?? (res.data.statement_id ? [res.data.statement_id] : []);
      const pageCount = res.data.page_count ?? 1;
      const primaryId = statementIds[0];
      updateEntry(entry.id, { statementId: primaryId, status: "processing", progress: { step: "preprocessing", pct: 10, message: pageCount > 1 ? `Processing ${pageCount} pages…` : "Processing…" } });

      const waitPage = (sid: number): Promise<number> => new Promise((resolve, reject) => {
        const ac = new AbortController();
        abortControllersRef.current.push(ac);
        (async () => {
          try {
            for await (const { event, data } of fetchSSE(`/statements/${sid}/progress`, ac.signal)) {
              const d = data as Record<string, unknown>;
              if (event === "progress" && sid === primaryId) {
                updateEntry(entry.id, { progress: { step: (d.step as string) ?? "", pct: (d.percentage as number) ?? 0, message: (d.message as string) ?? "" } });
              } else if (event === "complete") {
                if (d.overlap_warning) setOverlapWarnings(prev => [...prev, { file: entry.file.name, period: (d.overlap_warning as { period: string }).period }]);
                resolve((d.transaction_count as number) ?? 0); return;
              } else if (event === "error") {
                reject(new Error((d.message as string) ?? "Processing failed")); return;
              }
            }
            resolve(0);
          } catch (err) {
            if ((err as Error).name === "AbortError") resolve(0); else reject(err);
          } finally {
            abortControllersRef.current = abortControllersRef.current.filter(a => a !== ac);
          }
        })();
      });

      const counts = await Promise.all(statementIds.map(waitPage));
      updateEntry(entry.id, { status: "done", progress: { step: "done", pct: 100, message: "Done!" }, uncategorizedCount: counts.reduce((a, b) => a + b, 0) });
    } catch (err: unknown) {
      const apiErr = err as Error & { status?: number; detail?: { overage_confirmation_required?: boolean; overage_pages?: number; overage_cost_usd?: number } };
      if (apiErr.status === 402 && apiErr.detail?.overage_confirmation_required) {
        updateEntry(entry.id, { status: "queued", progress: undefined });
        setOveragePending({ file: entry.file, entryId: entry.id, overage_pages: apiErr.detail.overage_pages ?? 0, overage_cost_usd: apiErr.detail.overage_cost_usd ?? 0 });
        return;
      }
      updateEntry(entry.id, { status: "error", error: apiErr.status === 402 ? "Page quota exceeded — upgrade your plan to continue." : apiErr.message || "Upload failed" });
    }
    api.getBillingUsage().then(setUsage).catch(() => {});
  }, []);

  const runQueue = useCallback(async (queue: FileEntry[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    for (const entry of queue) await processFile(entry).catch(() => {});
    processingRef.current = false;
    setEntries(prev => {
      const doneEntries = prev.filter(e => e.status === "done");
      if (doneEntries.length === 0) return prev;
      const successIds = doneEntries.filter(e => (e.uncategorizedCount ?? 0) > 0).map(e => e.statementId!);
      if (successIds.length === 0) { setAllDone(true); return prev; }
      Promise.all([Promise.all(successIds.map(sid => api.getQAPending(sid))), api.listCategories()]).then(([qaResults, cats]) => {
        const merged = qaResults.flat().filter(Boolean);
        const seen = new Set<string>();
        const unique = merged.filter((q): q is QAPending => { if (seen.has(q.merchant_name)) return false; seen.add(q.merchant_name); return true; });
        setCategories(cats);
        if (unique.length > 0) { setQaItems(unique); setQaIndex(0); setSelectedCat(unique[0].suggested_category_id ?? null); } else { setAllDone(true); }
      });
      return prev;
    });
  }, [processFile]);

  const addFiles = useCallback((files: File[]) => {
    const images = files.filter(f => f.type.startsWith("image/") || f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!images.length) return;
    const newEntries: FileEntry[] = images.map(f => ({ file: f, id: `${f.name}-${Date.now()}-${Math.random()}`, status: "queued" }));
    setEntries(prev => { const updated = [...prev, ...newEntries]; if (!processingRef.current) setTimeout(() => runQueue(newEntries), 0); return updated; });
  }, [runQueue]);

  async function handleQAAnswer() {
    if (!selectedCat) return;
    const item = qaItems[qaIndex];
    await api.answerQA(item.merchant_name, selectedCat, applyRule, item.transaction_ids);
    const next = qaIndex + 1;
    setShowNewCatForm(false); setNewCatName("");
    if (next >= qaItems.length) { setAllDone(true); } else { setQaIndex(next); setSelectedCat(qaItems[next].suggested_category_id ?? null); }
  }

  async function handleAddAndUseNewCategory(suggestion: { name: string; color: string; icon: string }) {
    setCreatingNewCat(true);
    try {
      const newCat = await api.createCategory(suggestion.name, suggestion.color, suggestion.icon || "tag");
      setCategories(await api.listCategories()); setSelectedCat(newCat.id);
    } finally { setCreatingNewCat(false); }
  }

  async function handleCreateNewCat() {
    if (!newCatName.trim()) return;
    setCreatingNewCat(true);
    try {
      const newCat = await api.createCategory(newCatName.trim(), newCatColor, "tag");
      setCategories(await api.listCategories()); setSelectedCat(newCat.id); setShowNewCatForm(false); setNewCatName("");
    } finally { setCreatingNewCat(false); }
  }

  async function handleQASkip() {
    const item = qaItems[qaIndex];
    await api.skipQA(item.merchant_name, item.transaction_ids);
    const next = qaIndex + 1;
    setShowNewCatForm(false); setNewCatName("");
    if (next >= qaItems.length) { setAllDone(true); } else { setQaIndex(next); setSelectedCat(qaItems[next].suggested_category_id ?? null); }
  }

  function reset() {
    abortControllersRef.current.forEach(ac => ac.abort()); abortControllersRef.current = [];
    setEntries([]); setQaItems([]); setQaIndex(0); setCategories([]); setSelectedCat(null); setAllDone(false); setOverlapWarnings([]); processingRef.current = false;
  }

  // ── All done screen ──
  if (allDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-ve-surface flex items-center justify-center mb-6">
          <MSIcon name="check_circle" className="text-5xl text-emerald-500 dark:text-ve-primary" />
        </div>
        <h2 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface mb-2">
          {entries.filter(e => e.status === "done").length === 1 ? "Statement processed!" : `${entries.filter(e => e.status === "done").length} statements processed!`}
        </h2>
        <p className="text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-8 text-center">Your transactions are ready to explore.</p>
        <div className="flex gap-3">
          <button onClick={reset} className="px-6 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
            Upload more
          </button>
          {onClose ? (
            <button onClick={onClose} className="px-6 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Done
            </button>
          ) : (
            <Link to="/dashboard" className="px-6 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              View dashboard
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── QA categorization flow ──
  if (qaItems.length > 0 && qaIndex < qaItems.length) {
    const item = qaItems[qaIndex];
    const suggestedNewCat = (item as QAItem).suggested_new_category_obj;
    return (
      <div className="max-w-lg mx-auto px-6 pt-6 pb-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {qaIndex > 0 && (
              <button onClick={() => { setShowNewCatForm(false); setNewCatName(""); setQaIndex(qaIndex - 1); setSelectedCat(qaItems[qaIndex - 1].suggested_category_id ?? null); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
                <MSIcon name="chevron_left" className="text-xl" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-ft-on-surface dark:text-ve-on-surface">Categorize Merchants</h1>
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{qaIndex + 1} of {qaItems.length}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {qaItems.map((_, i) => (
              <div key={i} className={cn("w-2 h-2 rounded-full transition-colors",
                i === qaIndex ? "bg-ft-primary dark:bg-ve-primary" : i < qaIndex ? "bg-emerald-200 dark:bg-ve-outline" : "bg-ft-outline-variant dark:bg-ve-outline"
              )} />
            ))}
          </div>
        </div>

        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-bold text-ft-on-surface dark:text-ve-on-surface mb-1">{item.merchant_name}</h2>
          <div className="flex gap-4 text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-5">
            <span>{item.transaction_count} transaction{item.transaction_count > 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{formatAED(item.total_amount)} total</span>
          </div>

          {suggestedNewCat && (
            <div className="flex items-center gap-3 bg-violet-50 dark:bg-ve-surface-high border border-violet-100 dark:border-ve-outline rounded-xl px-4 py-3 mb-4">
              <div className="w-7 h-7 rounded-full shrink-0" style={{ backgroundColor: suggestedNewCat.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-violet-700 dark:text-ve-primary">AI suggests a new category</p>
                <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{suggestedNewCat.name}</p>
              </div>
              <button onClick={() => handleAddAndUseNewCategory(suggestedNewCat)} disabled={creatingNewCat}
                className="text-xs font-semibold text-white bg-violet-500 hover:bg-violet-600 px-3 py-1.5 rounded-lg disabled:opacity-50 shrink-0">
                {creatingNewCat ? "Adding…" : "Add & Use"}
              </button>
            </div>
          )}

          {!suggestedNewCat && item.suggested_category_id && (
            <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3">
              AI suggestion: <span className="text-ft-primary dark:text-ve-primary font-medium">{categories.find(c => c.id === item.suggested_category_id)?.name ?? ""}</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 mb-3">
            {categories.filter(c => c.name !== "Uncategorized").map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                className={cn("p-3 rounded-xl border-2 text-center text-xs font-medium transition-all",
                  selectedCat === cat.id
                    ? "border-ft-primary dark:border-ve-primary bg-ft-surface-low dark:bg-ve-surface-high"
                    : "border-ft-outline-variant dark:border-ve-outline hover:border-ft-outline dark:hover:border-ve-outline"
                )}>
                <div className="w-5 h-5 rounded-full mx-auto mb-1.5" style={{ backgroundColor: cat.color }} />
                <span className="text-ft-on-surface dark:text-ve-on-surface">{cat.name}</span>
              </button>
            ))}
            <button onClick={() => { setShowNewCatForm(true); setSelectedCat(null); }}
              className="p-3 rounded-xl border-2 border-dashed border-ft-outline-variant dark:border-ve-outline text-center text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:border-ft-primary dark:hover:border-ve-primary transition-all">
              <div className="w-5 h-5 rounded-full mx-auto mb-1.5 bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center">
                <MSIcon name="add" className="text-base leading-none" />
              </div>
              New
            </button>
          </div>

          {showNewCatForm && (
            <div className="bg-ft-surface-low dark:bg-ve-surface-high rounded-xl p-4 mb-3 border border-ft-outline-variant dark:border-ve-outline">
              <p className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-3">New category</p>
              <div className="flex gap-2 mb-3">
                <input autoFocus type="text" placeholder="Category name" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreateNewCat(); if (e.key === "Escape") setShowNewCatForm(false); }}
                  className="flex-1 text-sm border border-ft-outline-variant dark:border-ve-outline rounded-lg px-3 py-2 bg-ft-surface dark:bg-ve-surface text-ft-on-surface dark:text-ve-on-surface outline-none focus:border-ft-primary dark:focus:border-ve-primary" />
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="w-10 h-10 rounded-lg border border-ft-outline-variant dark:border-ve-outline cursor-pointer p-0.5 bg-transparent" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewCatForm(false)} className="flex-1 py-2 text-xs border border-ft-outline-variant dark:border-ve-outline rounded-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-container dark:hover:bg-ve-surface-highest">Cancel</button>
                <button onClick={handleCreateNewCat} disabled={!newCatName.trim() || creatingNewCat}
                  className="flex-1 py-2 text-xs bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-lg font-semibold disabled:opacity-50">
                  {creatingNewCat ? "Creating…" : "Create & select"}
                </button>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2.5 text-sm text-ft-on-surface dark:text-ve-on-surface mb-5 cursor-pointer">
            <input type="checkbox" checked={applyRule} onChange={e => setApplyRule(e.target.checked)} className="rounded accent-ft-primary dark:accent-ve-primary" />
            Always categorize "{item.merchant_name}" as this
          </label>

          <div className="flex gap-3">
            <button onClick={handleQASkip} className="flex-1 py-3 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">Skip</button>
            <button onClick={handleQAAnswer} disabled={!selectedCat}
              className="flex-1 py-3 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity">
              Confirm ✓
            </button>
          </div>
        </div>
      </div>
    );
  }

  const confirmOverage = async () => {
    if (!overagePending) return;
    const { file, entryId } = overagePending;
    setOveragePending(null);
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;
    await processFile({ ...entry, file }, true);
  };

  const hasEntries = entries.length > 0;
  const allFinished = entries.length > 0 && entries.every(e => e.status === "done" || e.status === "error");
  const quotaExhausted = usage && usage.pages_remaining === 0 && !usage.overage_enabled;

  return (
    <div className="px-6 pt-6 pb-10 max-w-2xl mx-auto">

      {/* ── Header ── */}
      {!onClose && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Statement Upload</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
            Upload your latest bank statements to keep your financial dashboard synchronized. We process PDF, CSV, and GIF formats securely.
          </p>
        </div>
      )}

      {/* ── Quota bar ── */}
      {usage && (
        <div className="mb-5 bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">{usage.plan_label} plan</span>
            <span className={cn("text-sm font-bold tabular-nums", usage.pages_remaining === 0 ? "text-red-500 dark:text-ve-error" : "text-ft-on-surface-variant dark:text-ve-on-surface-variant")}>
              {usage.pages_remaining} page{usage.pages_remaining !== 1 ? "s" : ""} remaining
            </span>
          </div>
          <div className="w-full bg-ft-surface-low dark:bg-ve-surface-high rounded-full h-1.5 mb-2">
            <div className={cn("h-1.5 rounded-full transition-all", usage.pages_remaining === 0 ? "bg-red-400 dark:bg-ve-error" : usage.pages_used / usage.pages_limit > 0.8 ? "bg-amber-400" : "bg-ft-primary dark:bg-ve-primary-dim")}
              style={{ width: `${Math.min(100, (usage.pages_used / usage.pages_limit) * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">{usage.pages_used} of {usage.pages_limit} used</span>
            {usage.pages_remaining === 0 && (
              <Link to="/billing" className="text-xs font-semibold text-ft-primary dark:text-ve-primary hover:underline">Upgrade plan →</Link>
            )}
          </div>
        </div>
      )}

      {/* ── Overage modal ── */}
      {overagePending && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-ft-on-surface dark:text-ve-on-surface mb-2">Overage charge</h3>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-4">
              You've used all your included pages. Processing this file will use{" "}
              <span className="font-semibold text-ft-on-surface dark:text-ve-on-surface">{overagePending.overage_pages} extra page{overagePending.overage_pages !== 1 ? "s" : ""}</span>{" "}
              billed at <span className="font-semibold text-ft-on-surface dark:text-ve-on-surface">${overagePending.overage_cost_usd.toFixed(2)}</span> on your next invoice.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setOveragePending(null); updateEntry(overagePending.entryId, { status: "error", error: "Cancelled — page quota exceeded." }); }}
                className="flex-1 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
                Cancel
              </button>
              <button onClick={confirmOverage}
                className="flex-1 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
                Confirm &amp; process
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quota exhausted banner ── */}
      {quotaExhausted && !hasEntries && (
        <div className="mb-5 bg-red-50 dark:bg-ve-surface border border-red-100 dark:border-ve-error rounded-2xl p-5 text-center">
          <p className="font-semibold text-red-700 dark:text-ve-error mb-1">Page quota reached</p>
          <p className="text-sm text-red-500 dark:text-ve-on-surface-variant mb-4">You've used all {usage!.pages_limit} pages on your {usage!.plan_label} plan.</p>
          <Link to="/billing" className="inline-flex items-center gap-2 px-5 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
            <MSIcon name="upgrade" className="text-lg" />
            Upgrade plan
          </Link>
        </div>
      )}

      {/* ── Drop zone ── */}
      <div
        onDragEnter={() => !quotaExhausted && setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (!quotaExhausted) { setDragging(false); addFiles(Array.from(e.dataTransfer.files)); } }}
        onClick={() => !quotaExhausted && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-2xl text-center transition-all mb-5",
          quotaExhausted ? "border-ft-outline-variant dark:border-ve-outline opacity-50 cursor-not-allowed py-10" :
          dragging ? "border-ft-primary dark:border-ve-primary bg-ft-surface-low dark:bg-ve-surface-high cursor-pointer py-10" :
          hasEntries ? "border-ft-outline-variant dark:border-ve-outline hover:border-ft-primary dark:hover:border-ve-primary py-6 cursor-pointer" :
          "border-ft-outline-variant dark:border-ve-outline hover:border-ft-primary dark:hover:border-ve-primary hover:bg-ft-surface-low dark:hover:bg-ve-surface-high cursor-pointer py-14"
        )}
      >
        <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" disabled={!!quotaExhausted}
          onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        {hasEntries ? (
          <div className="flex items-center justify-center gap-2 px-4">
            <MSIcon name="add_circle" className="text-2xl text-ft-primary dark:text-ve-primary" />
            <span className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">Add more files</span>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-ft-surface-low dark:bg-ve-surface mx-auto mb-4 flex items-center justify-center">
              <MSIcon name="cloud_upload" className="text-4xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
            </div>
            <p className="text-base font-bold text-ft-on-surface dark:text-ve-on-surface mb-1">Drag &amp; Drop Documents</p>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-4">Upload your monthly statements to automatically reconcile transactions. Supported formats: .pdf, .csv, .xls</p>
            <button className="px-5 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
              Browse Files
            </button>
            <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-4 flex items-center justify-center gap-1.5">
              <MSIcon name="lock" className="text-sm" />
              Bank-grade encryption · Max file size 50MB
            </p>
          </>
        )}
      </div>

      {/* ── Manual entry link ── */}
      {manualSuccessMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high text-ft-primary dark:text-ve-primary text-sm mb-1">
          <MSIcon name="check_circle" className="text-base" />
          Transaction added successfully.
        </div>
      )}
      <button
        type="button"
        onClick={() => { setManualSuccessMsg(false); setShowAddManual(true); }}
        className="w-full text-center text-sm text-ft-outline dark:text-ve-on-surface-variant hover:text-ft-primary dark:hover:text-ve-primary transition-colors py-1 mb-1"
      >
        Or add a transaction manually →
      </button>

      {/* ── File list ── */}
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map(entry => (
            <FileCard
              key={entry.id}
              entry={entry}
              onRetry={entry.status === "error" ? () => {
                updateEntry(entry.id, { status: "queued", error: undefined, progress: undefined });
                processFile({ ...entry, status: "queued", error: undefined, progress: undefined });
              } : undefined}
            />
          ))}
        </div>
      )}

      {/* ── Overlap warnings ── */}
      {overlapWarnings.length > 0 && (
        <div className="mt-4 bg-amber-50 dark:bg-ve-surface border border-amber-200 dark:border-ve-outline rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-ve-on-surface mb-1">Possible duplicate data</p>
          {overlapWarnings.map((w, i) => (
            <p key={`${w.file}-${i}`} className="text-xs text-amber-700 dark:text-ve-on-surface-variant">"{w.file}" overlaps existing statement for {w.period}</p>
          ))}
          <p className="text-xs text-amber-600 dark:text-ve-on-surface-variant mt-1">Duplicate transactions are skipped automatically.</p>
        </div>
      )}

      {allFinished && !qaItems.length && (
        <p className="mt-5 text-center text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">
          {entries.filter(e => e.status === "done").length} processed, {entries.filter(e => e.status === "error").length} failed
        </p>
      )}

      <AddTransactionModal
        open={showAddManual}
        onClose={() => setShowAddManual(false)}
        onSuccess={() => {
          setManualSuccessMsg(true);
          setTimeout(() => setManualSuccessMsg(false), 4000);
        }}
      />
    </div>
  );
}

function FileCard({ entry, onRetry }: { entry: FileEntry; onRetry?: () => void }) {
  const currentStepIndex = STEPS.indexOf(entry.progress?.step ?? "");
  return (
    <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <FileStatusIcon status={entry.status} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface text-sm truncate">{entry.file.name}</p>
          <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
            {entry.status === "queued" && "Waiting…"}
            {(entry.status === "uploading" || entry.status === "processing") && (entry.progress?.message ?? "Processing…")}
            {entry.status === "done" && "Done"}
            {entry.status === "error" && "Upload failed"}
          </p>
        </div>
        {entry.status === "done" && <span className="material-symbols-outlined text-emerald-500 dark:text-ve-primary text-xl shrink-0">check_circle</span>}
        {entry.status === "error" && <span className="material-symbols-outlined text-red-400 dark:text-ve-error text-xl shrink-0">error</span>}
      </div>

      {(entry.status === "uploading" || entry.status === "processing") && (
        <>
          <div className="h-1.5 bg-ft-surface-low dark:bg-ve-surface-high rounded-full overflow-hidden mb-3">
            <div className="h-full bg-ft-primary dark:bg-ve-primary-dim rounded-full transition-all duration-500" style={{ width: `${entry.progress?.pct ?? 5}%` }} />
          </div>
          <div className="flex gap-3">
            {STEPS.map((step, i) => {
              const isDone = i < currentStepIndex || entry.progress?.step === "done";
              const isActive = step === entry.progress?.step;
              return (
                <div key={step} className={cn("flex items-center gap-1 text-xs",
                  isDone ? "text-ft-primary dark:text-ve-primary" : isActive ? "text-ft-on-surface dark:text-ve-on-surface font-medium" : "text-ft-outline dark:text-ve-outline"
                )}>
                  {isDone ? "✓" : isActive ? <span className="inline-block w-2 h-2 border border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /> : "○"}
                  <span className="capitalize">{step === "ocr" ? "OCR" : step}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {entry.status === "error" && (
        <div className="mt-2 bg-red-50 dark:bg-ve-surface-high border border-red-100 dark:border-ve-error/30 px-3 py-2.5 rounded-lg flex items-start justify-between gap-3">
          <p className="text-xs text-red-600 dark:text-ve-error flex-1">{entry.error ?? "Something went wrong. Please try again."}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-ve-error hover:text-red-800 dark:hover:text-ve-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-sm leading-none">refresh</span>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FileStatusIcon({ status }: { status: FileStatus }) {
  const base = "w-9 h-9 rounded-xl flex items-center justify-center shrink-0";
  if (status === "queued") return <div className={cn(base, "bg-ft-surface-low dark:bg-ve-surface-high")}><span className="material-symbols-outlined text-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant">schedule</span></div>;
  if (status === "uploading" || status === "processing") return <div className={cn(base, "bg-ft-surface-low dark:bg-ve-surface-high")}><div className="w-4 h-4 border-2 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (status === "done") return <div className={cn(base, "bg-emerald-50 dark:bg-ve-surface-high")}><span className="material-symbols-outlined text-lg text-emerald-500 dark:text-ve-primary">check</span></div>;
  return <div className={cn(base, "bg-red-50 dark:bg-ve-surface-high")}><span className="material-symbols-outlined text-lg text-red-400 dark:text-ve-error">warning</span></div>;
}
