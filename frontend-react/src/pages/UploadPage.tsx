import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { api, fetchSSE } from "../lib/api";
import { formatAED } from "../lib/utils";
import type { BillingUsage, Category, QAPending } from "../types";

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

export default function UploadPage() {
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
  const inputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  // Track abort controllers so we can cancel SSE streams on unmount
  const abortControllersRef = useRef<AbortController[]>([]);

  useEffect(() => {
    api.getBillingUsage().then(setUsage).catch(() => {});
  }, []);

  // Clean up all SSE streams on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach(ac => ac.abort());
    };
  }, []);

  const updateEntry = (id: string, patch: Partial<FileEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  const processFile = useCallback(async (entry: FileEntry, confirmOverage = false) => {
    updateEntry(entry.id, { status: "uploading", progress: { step: "preprocessing", pct: 5, message: "Uploading…" } });

    try {
      const res = await api.uploadStatement(entry.file, confirmOverage);

      const statementIds: number[] = res.data.statement_ids ?? (res.data.statement_id ? [res.data.statement_id] : []);
      const pageCount = res.data.page_count ?? 1;
      const primaryId = statementIds[0];

      updateEntry(entry.id, {
        statementId: primaryId,
        status: "processing",
        progress: { step: "preprocessing", pct: 10, message: pageCount > 1 ? `Processing ${pageCount} pages…` : "Processing…" },
      });

      // Use fetch-based SSE (supports Authorization header, token never in URL)
      const waitPage = (sid: number): Promise<number> => new Promise((resolve, reject) => {
        const ac = new AbortController();
        abortControllersRef.current.push(ac);

        (async () => {
          try {
            for await (const { event, data } of fetchSSE(`/statements/${sid}/progress`, ac.signal)) {
              const d = data as Record<string, unknown>;
              if (event === "progress" && sid === primaryId) {
                updateEntry(entry.id, {
                  progress: {
                    step: (d.step as string) ?? "",
                    pct: (d.percentage as number) ?? 0,
                    message: (d.message as string) ?? "",
                  },
                });
              } else if (event === "complete") {
                if (d.overlap_warning) {
                  const ow = d.overlap_warning as { period: string };
                  setOverlapWarnings(prev => [...prev, { file: entry.file.name, period: ow.period }]);
                }
                resolve((d.uncategorized_count as number) ?? 0);
                return;
              } else if (event === "error") {
                reject(new Error((d.message as string) ?? "Processing failed"));
                return;
              }
            }
            resolve(0);
          } catch (err) {
            if ((err as Error).name === "AbortError") {
              resolve(0);
            } else {
              reject(err);
            }
          } finally {
            abortControllersRef.current = abortControllersRef.current.filter(a => a !== ac);
          }
        })();
      });

      const counts = await Promise.all(statementIds.map(waitPage));
      const totalUncategorized = counts.reduce((a, b) => a + b, 0);

      updateEntry(entry.id, {
        status: "done",
        progress: { step: "done", pct: 100, message: "Done!" },
        uncategorizedCount: totalUncategorized,
      });
    } catch (err: unknown) {
      const apiErr = err as Error & { status?: number; detail?: { overage_confirmation_required?: boolean; overage_pages?: number; overage_cost_usd?: number } };
      if (apiErr.status === 402 && apiErr.detail?.overage_confirmation_required) {
        updateEntry(entry.id, { status: "queued", progress: undefined });
        setOveragePending({
          file: entry.file,
          entryId: entry.id,
          overage_pages: apiErr.detail.overage_pages ?? 0,
          overage_cost_usd: apiErr.detail.overage_cost_usd ?? 0,
        });
        return;
      }
      updateEntry(entry.id, {
        status: "error",
        error: apiErr.status === 402
          ? "Page quota exceeded — upgrade your plan to continue."
          : apiErr.message || "Upload failed",
      });
    }
    api.getBillingUsage().then(setUsage).catch(() => {});
  }, []);

  const runQueue = useCallback(async (queue: FileEntry[]) => {
    if (processingRef.current) return;
    processingRef.current = true;

    for (const entry of queue) {
      await processFile(entry).catch(() => {});
    }

    processingRef.current = false;

    setEntries(prev => {
      const doneEntries = prev.filter(e => e.status === "done");
      if (doneEntries.length === 0) return prev;

      const successIds = doneEntries.filter(e => (e.uncategorizedCount ?? 0) > 0).map(e => e.statementId!);
      if (successIds.length === 0) {
        setAllDone(true);
        return prev;
      }
      Promise.all([
        Promise.all(successIds.map(sid => api.getQAPending(sid))),
        api.listCategories(),
      ]).then(([qaResults, cats]) => {
        const merged = qaResults.flat().filter(Boolean);
        const seen = new Set<string>();
        const unique = merged.filter((q): q is QAPending => {
          if (seen.has(q.merchant_name)) return false;
          seen.add(q.merchant_name);
          return true;
        });
        setCategories(cats);
        if (unique.length > 0) {
          setQaItems(unique);
          setQaIndex(0);
          setSelectedCat(unique[0].suggested_category_id ?? null);
        } else {
          setAllDone(true);
        }
      });
      return prev;
    });
  }, [processFile]);

  const addFiles = useCallback((files: File[]) => {
    const images = files.filter(f =>
      f.type.startsWith("image/") || f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (!images.length) return;
    const newEntries: FileEntry[] = images.map(f => ({
      file: f,
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      status: "queued",
    }));
    setEntries(prev => {
      const updated = [...prev, ...newEntries];
      if (!processingRef.current) {
        // Use a ref-stable callback via setTimeout so state is flushed first
        setTimeout(() => runQueue(newEntries), 0);
      }
      return updated;
    });
  }, [runQueue]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles]);

  async function handleQAAnswer() {
    if (!selectedCat) return;
    const item = qaItems[qaIndex];
    await api.answerQA(item.merchant_name, selectedCat, applyRule, item.transaction_ids);
    const next = qaIndex + 1;
    setShowNewCatForm(false);
    setNewCatName("");
    if (next >= qaItems.length) {
      setAllDone(true);
    } else {
      setQaIndex(next);
      setSelectedCat(qaItems[next].suggested_category_id ?? null);
    }
  }

  async function handleAddAndUseNewCategory(suggestion: { name: string; color: string; icon: string }) {
    setCreatingNewCat(true);
    try {
      const newCat = await api.createCategory(suggestion.name, suggestion.color, suggestion.icon || "tag");
      const freshCats = await api.listCategories();
      setCategories(freshCats);
      setSelectedCat(newCat.id);
    } finally {
      setCreatingNewCat(false);
    }
  }

  async function handleCreateNewCat() {
    if (!newCatName.trim()) return;
    setCreatingNewCat(true);
    try {
      const newCat = await api.createCategory(newCatName.trim(), newCatColor, "tag");
      const freshCats = await api.listCategories();
      setCategories(freshCats);
      setSelectedCat(newCat.id);
      setShowNewCatForm(false);
      setNewCatName("");
    } finally {
      setCreatingNewCat(false);
    }
  }

  async function handleQASkip() {
    const item = qaItems[qaIndex];
    await api.skipQA(item.merchant_name, item.transaction_ids);
    const next = qaIndex + 1;
    setShowNewCatForm(false);
    setNewCatName("");
    if (next >= qaItems.length) {
      setAllDone(true);
    } else {
      setQaIndex(next);
      setSelectedCat(qaItems[next].suggested_category_id ?? null);
    }
  }

  function reset() {
    abortControllersRef.current.forEach(ac => ac.abort());
    abortControllersRef.current = [];
    setEntries([]);
    setQaItems([]);
    setQaIndex(0);
    setCategories([]);
    setSelectedCat(null);
    setAllDone(false);
    setOverlapWarnings([]);
    processingRef.current = false;
  }

  // All done — success screen
  if (allDone) {
    return (
      <div className="max-w-md mx-auto px-4 pt-20 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {entries.filter(e => e.status === "done").length === 1 ? "Statement processed!" : `${entries.filter(e => e.status === "done").length} statements processed!`}
        </h2>
        <p className="text-slate-500 mb-8">Your transactions are ready to view.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-6 py-3 border border-gray-200 rounded-xl text-slate-700 font-medium hover:bg-gray-50">
            Upload more
          </button>
          <a href="/dashboard" className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium">
            View dashboard
          </a>
        </div>
      </div>
    );
  }

  // QA flow
  if (qaItems.length > 0 && qaIndex < qaItems.length) {
    const item = qaItems[qaIndex];
    const suggestedNewCat = (item as QAItem).suggested_new_category_obj;
    return (
      <div className="max-w-md mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {qaIndex > 0 && (
              <button
                onClick={() => {
                  setShowNewCatForm(false);
                  setNewCatName("");
                  setQaIndex(qaIndex - 1);
                  setSelectedCat(qaItems[qaIndex - 1].suggested_category_id ?? null);
                }}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 text-slate-500 hover:bg-gray-50"
              >
                ‹
              </button>
            )}
            <h1 className="text-xl font-bold text-slate-900">Categorize Merchants</h1>
          </div>
          <span className="text-sm text-slate-400">{qaIndex + 1} of {qaItems.length}</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-4">
          <h2 className="text-xl font-bold text-slate-900 mb-1">{item.merchant_name}</h2>
          <div className="flex gap-4 text-sm text-slate-500 mb-6">
            <span>{item.transaction_count} transaction{item.transaction_count > 1 ? "s" : ""}</span>
            <span>•</span>
            <span>{formatAED(item.total_amount)} total</span>
          </div>

          {suggestedNewCat && (
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 mb-4">
              <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ backgroundColor: suggestedNewCat.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-violet-700 font-medium">AI suggests a new category</p>
                <p className="text-sm font-semibold text-violet-900 truncate">{suggestedNewCat.name}</p>
              </div>
              <button
                onClick={() => handleAddAndUseNewCategory(suggestedNewCat)}
                disabled={creatingNewCat}
                className="text-xs font-medium text-white bg-violet-500 hover:bg-violet-600 px-3 py-1.5 rounded-lg disabled:opacity-50 flex-shrink-0"
              >
                {creatingNewCat ? "Adding…" : "Add & Use"}
              </button>
            </div>
          )}

          {!suggestedNewCat && item.suggested_category_id && (
            <p className="text-xs text-slate-400 mb-3">
              AI suggestion: <span className="text-emerald-600 font-medium">
                {categories.find(c => c.id === item.suggested_category_id)?.name ?? ""}
              </span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 mb-3">
            {categories.filter(c => c.name !== "Uncategorized").map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                className={`p-3 rounded-xl border-2 text-center text-xs font-medium transition-all ${selectedCat === cat.id ? "border-emerald-500 bg-emerald-50" : "border-gray-100 hover:border-gray-200"}`}>
                <div className="w-6 h-6 rounded-full mx-auto mb-1.5" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </button>
            ))}
            <button onClick={() => { setShowNewCatForm(true); setSelectedCat(null); }}
              className="p-3 rounded-xl border-2 border-dashed border-gray-200 text-center text-xs font-medium text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-all">
              <div className="w-6 h-6 rounded-full mx-auto mb-1.5 flex items-center justify-center bg-gray-100 hover:bg-emerald-50 text-base leading-none">+</div>
              New
            </button>
          </div>

          {showNewCatForm && (
            <div className="bg-gray-50 rounded-xl p-4 mb-3 border border-gray-100">
              <p className="text-xs font-medium text-slate-500 mb-3">New category</p>
              <div className="flex gap-2 mb-3">
                <input
                  autoFocus
                  type="text"
                  placeholder="Category name"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCreateNewCat(); if (e.key === "Escape") setShowNewCatForm(false); }}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-emerald-400"
                />
                <input
                  type="color"
                  value={newCatColor}
                  onChange={e => setNewCatColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNewCatForm(false)}
                  className="flex-1 py-2 text-xs border border-gray-200 rounded-lg text-slate-500 hover:bg-gray-100">
                  Cancel
                </button>
                <button onClick={handleCreateNewCat} disabled={!newCatName.trim() || creatingNewCat}
                  className="flex-1 py-2 text-xs bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50">
                  {creatingNewCat ? "Creating…" : "Create & select"}
                </button>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-600 mb-5 cursor-pointer">
            <input type="checkbox" checked={applyRule} onChange={e => setApplyRule(e.target.checked)}
              className="rounded accent-emerald-500" />
            Always categorize "{item.merchant_name}" as this
          </label>

          <div className="flex gap-3">
            <button onClick={handleQASkip} className="flex-1 py-3 border border-gray-200 rounded-xl text-slate-600 font-medium hover:bg-gray-50">Skip</button>
            <button onClick={handleQAAnswer} disabled={!selectedCat}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-medium disabled:opacity-50">Confirm ✓</button>
          </div>
        </div>

        <div className="flex justify-center gap-1.5">
          {qaItems.map((q, i) => (
            <div key={q.merchant_name} className={`w-2 h-2 rounded-full ${i === qaIndex ? "bg-emerald-500" : i < qaIndex ? "bg-emerald-200" : "bg-gray-200"}`} />
          ))}
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
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-slate-900 mb-4">Upload Statement</h1>

      {/* Quota bar */}
      {usage && (
        <div className="mb-5 bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">{usage.plan_label} plan</span>
            <span className={`text-sm font-semibold ${usage.pages_remaining === 0 ? "text-red-500" : "text-slate-600"}`}>
              {usage.pages_remaining} page{usage.pages_remaining !== 1 ? "s" : ""} remaining
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all ${usage.pages_remaining === 0 ? "bg-red-400" : usage.pages_used / usage.pages_limit > 0.8 ? "bg-amber-400" : "bg-emerald-500"}`}
              style={{ width: `${Math.min(100, (usage.pages_used / usage.pages_limit) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{usage.pages_used} of {usage.pages_limit} used</span>
            {usage.pages_remaining === 0 && (
              <Link to="/billing" className="text-xs font-semibold text-emerald-600 hover:underline">Upgrade plan →</Link>
            )}
          </div>
        </div>
      )}

      {/* Overage confirmation modal */}
      {overagePending && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Overage charge</h3>
            <p className="text-sm text-slate-500 mb-4">
              You've used all your included pages. Processing this file will use{" "}
              <span className="font-semibold text-slate-700">{overagePending.overage_pages} extra page{overagePending.overage_pages !== 1 ? "s" : ""}</span>{" "}
              billed at{" "}
              <span className="font-semibold text-slate-700">${overagePending.overage_cost_usd.toFixed(2)}</span>{" "}
              on your next invoice.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setOveragePending(null);
                  updateEntry(overagePending.entryId, { status: "error", error: "Cancelled — page quota exceeded." });
                }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmOverage}
                className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600"
              >
                Confirm &amp; process
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quota exhausted banner */}
      {quotaExhausted && !hasEntries && (
        <div className="mb-5 bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
          <p className="font-semibold text-red-700 mb-1">Page quota reached</p>
          <p className="text-sm text-red-500 mb-4">You've used all {usage!.pages_limit} pages on your {usage!.plan_label} plan.</p>
          <Link to="/billing" className="inline-block px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600">
            Upgrade plan
          </Link>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragEnter={() => !quotaExhausted && setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); if (!quotaExhausted) { setDragging(false); addFiles(Array.from(e.dataTransfer.files)); } }}
        onClick={() => !quotaExhausted && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors mb-5 ${quotaExhausted ? "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50" : dragging ? "border-emerald-400 bg-emerald-50 cursor-pointer" : hasEntries ? "border-gray-200 hover:border-emerald-300 py-6 cursor-pointer" : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50 cursor-pointer"}`}
      >
        <input ref={inputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" disabled={!!quotaExhausted}
          onChange={e => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
        <div className={`${hasEntries ? "flex items-center justify-center gap-3" : ""}`}>
          <div className={`bg-emerald-50 rounded-2xl flex items-center justify-center ${hasEntries ? "w-10 h-10 flex-shrink-0" : "w-16 h-16 mx-auto mb-4"}`}>
            <svg className={`text-emerald-500 ${hasEntries ? "w-5 h-5" : "w-8 h-8"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          {hasEntries ? (
            <span className="text-slate-600 font-medium text-sm">Add more files</span>
          ) : (
            <>
              <p className="text-slate-700 font-semibold mb-1">Tap to upload or drag &amp; drop</p>
              <p className="text-sm text-slate-400">PNG, JPG or PDF (multi-page) — select multiple at once</p>
            </>
          )}
        </div>
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map(entry => (
            <FileCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Overlap warnings */}
      {overlapWarnings.length > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-1">Possible duplicate data</p>
          {overlapWarnings.map((w, i) => (
            <p key={`${w.file}-${i}`} className="text-xs text-amber-700">
              "{w.file}" overlaps existing statement for {w.period}
            </p>
          ))}
          <p className="text-xs text-amber-600 mt-1">Duplicate transactions are skipped automatically.</p>
        </div>
      )}

      {/* Summary when all done but QA not triggered yet */}
      {allFinished && !qaItems.length && (
        <div className="mt-5 text-center">
          <p className="text-sm text-slate-400">
            {entries.filter(e => e.status === "done").length} processed,{" "}
            {entries.filter(e => e.status === "error").length} failed
          </p>
          {entries.every(e => e.status === "error") && (
            <p className="mt-2 text-xs text-slate-400">
              Add valid API keys in Settings to enable AI-powered OCR.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface FileCardProps { entry: FileEntry }

function FileCard({ entry }: FileCardProps) {
  const currentStepIndex = STEPS.indexOf(entry.progress?.step ?? "");

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-3 mb-3">
        <StatusIcon status={entry.status} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 text-sm truncate">{entry.file.name}</p>
          <p className="text-xs text-slate-400">
            {entry.status === "queued" && "Waiting…"}
            {(entry.status === "uploading" || entry.status === "processing") && (entry.progress?.message ?? "Processing…")}
            {entry.status === "done" && "Done"}
            {entry.status === "error" && (entry.error ?? "Failed")}
          </p>
        </div>
        {entry.status === "done" && (
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {entry.status === "error" && (
          <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      {(entry.status === "uploading" || entry.status === "processing") && (
        <>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${entry.progress?.pct ?? 5}%` }} />
          </div>
          <div className="flex gap-3">
            {STEPS.map((step, i) => {
              const isDone = i < currentStepIndex || entry.progress?.step === "done";
              const isActive = step === entry.progress?.step;
              return (
                <div key={step} className={`flex items-center gap-1 text-xs ${isDone ? "text-emerald-500" : isActive ? "text-slate-700 font-medium" : "text-slate-300"}`}>
                  {isDone ? "✓" : isActive ? <span className="inline-block w-2 h-2 border border-emerald-500 border-t-transparent rounded-full animate-spin" /> : "○"}
                  <span className="capitalize">{step === "ocr" ? "OCR" : step}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {entry.status === "error" && (
        <div className="mt-2 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
          {entry.error}
        </div>
      )}
    </div>
  );
}

interface StatusIconProps { status: FileStatus }

function StatusIcon({ status }: StatusIconProps) {
  if (status === "queued") return (
    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
  if (status === "uploading" || status === "processing") return (
    <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (status === "done") return (
    <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
      </svg>
    </div>
  );
  return (
    <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}
