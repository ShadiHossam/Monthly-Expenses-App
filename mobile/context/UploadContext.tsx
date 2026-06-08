import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, type FileAsset } from '../lib/api';
import { fetchSSEMobile } from '../lib/fetchSSE';
import type { Category, QAPending } from '../types';

const STEPS = ['preprocessing', 'ocr', 'parsing', 'verifying', 'categorizing'];
export { STEPS };

export type FileStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'error';

export type OveragePending = {
  asset: FileAsset;
  entryId: string;
  overage_pages: number;
  overage_cost_usd: number;
};

export type FileEntry = {
  asset: FileAsset;
  id: string;
  status: FileStatus;
  progress?: { step: string; pct: number; message: string };
  error?: string;
  statementId?: number;
  uncategorizedCount?: number;
};

export type QAItem = QAPending & {
  suggested_category_name?: string;
  suggested_new_category_obj?: { name: string; color: string; icon: string } | null;
};

export type UploadNotification = { filename: string; txnCount: number };

interface UploadContextType {
  entries: FileEntry[];
  addFiles: (assets: FileAsset[]) => void;
  updateEntry: (id: string, patch: Partial<FileEntry>) => void;
  processFile: (entry: FileEntry, confirmOverage?: boolean) => Promise<void>;
  reset: () => void;
  hasActiveUploads: boolean;
  notifications: UploadNotification[];
  clearNotifications: () => void;
  qaItems: QAItem[];
  setQaItems: React.Dispatch<React.SetStateAction<QAItem[]>>;
  qaIndex: number;
  setQaIndex: React.Dispatch<React.SetStateAction<number>>;
  allDone: boolean;
  setAllDone: React.Dispatch<React.SetStateAction<boolean>>;
  overlapWarnings: Array<{ file: string; period: string }>;
  setOverlapWarnings: React.Dispatch<React.SetStateAction<Array<{ file: string; period: string }>>>;
  overagePending: OveragePending | null;
  setOveragePending: React.Dispatch<React.SetStateAction<OveragePending | null>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function useUploadContext() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUploadContext must be used inside UploadProvider');
  return ctx;
}

function formatVerifyErrors(errs: string | string[] | undefined): string | undefined {
  if (!errs) return undefined;
  if (Array.isArray(errs)) return errs.length ? errs.join('; ') : undefined;
  return errs || undefined;
}

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [qaItems, setQaItems] = useState<QAItem[]>([]);
  const [qaIndex, setQaIndex] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [overlapWarnings, setOverlapWarnings] = useState<Array<{ file: string; period: string }>>([]);
  const [overagePending, setOveragePending] = useState<OveragePending | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notifications, setNotifications] = useState<UploadNotification[]>([]);

  const clearNotifications = useCallback(() => setNotifications([]), []);
  const processingRef = useRef(false);
  const abortControllersRef = useRef<AbortController[]>([]);

  useEffect(() => {
    return () => { abortControllersRef.current.forEach(ac => ac.abort()); };
  }, []);

  const updateEntry = useCallback((id: string, patch: Partial<FileEntry>) =>
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e)), []);

  const processFile = useCallback(async (entry: FileEntry, confirmOverage = false) => {
    updateEntry(entry.id, { status: 'uploading', progress: { step: 'preprocessing', pct: 5, message: 'Uploading…' } });
    try {
      const res = await api.uploadStatement(entry.asset, confirmOverage);
      const statementIds: number[] = res.data.statement_ids ?? (res.data.statement_id ? [res.data.statement_id] : []);
      const pageCount = res.data.page_count ?? 1;
      const primaryId = statementIds[0];
      updateEntry(entry.id, {
        statementId: primaryId,
        status: 'processing',
        progress: { step: 'preprocessing', pct: 10, message: pageCount > 1 ? `Processing ${pageCount} pages…` : 'Processing…' },
      });

      const waitPage = (sid: number): Promise<number> => new Promise((resolve, reject) => {
        const ac = new AbortController();
        abortControllersRef.current.push(ac);
        (async () => {
          let receivedTerminal = false;
          try {
            for await (const { event, data } of fetchSSEMobile(`/statements/${sid}/progress`, ac.signal)) {
              const d = data as Record<string, unknown>;
              if (event === 'progress' && sid === primaryId) {
                updateEntry(entry.id, { progress: { step: (d.step as string) ?? '', pct: (d.percentage as number) ?? 0, message: (d.message as string) ?? '' } });
              } else if (event === 'complete') {
                receivedTerminal = true;
                if (d.overlap_warning) {
                  setOverlapWarnings(prev => [...prev, { file: entry.asset.name, period: (d.overlap_warning as { period: string }).period }]);
                }
                resolve((d.transaction_count as number) ?? 0); return;
              } else if (event === 'error') {
                receivedTerminal = true;
                reject(new Error((d.message as string) ?? 'Processing failed')); return;
              }
            }
            if (!receivedTerminal) {
              try {
                const stmt = await api.getStatement(sid);
                if (stmt.verify_status === 'passed') { resolve(stmt.transaction_count ?? 0); return; }
                if (stmt.verify_status === 'failed') { reject(new Error(formatVerifyErrors(stmt.verify_errors) ?? 'Processing failed')); return; }
                reject(new Error('Processing is still pending — refresh in a moment.')); return;
              } catch {
                reject(new Error('Lost connection while processing.')); return;
              }
            }
            resolve(0);
          } catch (err) {
            if ((err as Error).name === 'AbortError') { resolve(0); return; }
            try {
              const stmt = await api.getStatement(sid);
              if (stmt.verify_status === 'passed') { resolve(stmt.transaction_count ?? 0); return; }
              if (stmt.verify_status === 'failed') { reject(new Error(formatVerifyErrors(stmt.verify_errors) ?? (err as Error).message)); return; }
            } catch {}
            reject(err);
          } finally {
            abortControllersRef.current = abortControllersRef.current.filter(a => a !== ac);
          }
        })();
      });

      const counts = await Promise.all(statementIds.map(waitPage));
      const txnCount = counts.reduce((a, b) => a + b, 0);
      updateEntry(entry.id, { status: 'done', progress: { step: 'done', pct: 100, message: 'Done!' }, uncategorizedCount: txnCount });
      setNotifications(prev => [...prev, { filename: entry.asset.name, txnCount }]);
    } catch (err: unknown) {
      const apiErr = err as Error & { status?: number; detail?: { overage_confirmation_required?: boolean; overage_pages?: number; overage_cost_usd?: number } };
      if (apiErr.status === 402 && apiErr.detail?.overage_confirmation_required) {
        updateEntry(entry.id, { status: 'queued', progress: undefined });
        setOveragePending({ asset: entry.asset, entryId: entry.id, overage_pages: apiErr.detail.overage_pages ?? 0, overage_cost_usd: apiErr.detail.overage_cost_usd ?? 0 });
        return;
      }
      updateEntry(entry.id, {
        status: 'error',
        error: apiErr.status === 402
          ? 'Page quota exceeded — upgrade your plan to continue.'
          : apiErr.message || 'Upload failed',
      });
    }
    api.getBillingUsage().catch(() => {});
  }, [updateEntry]);

  const runQueue = useCallback(async (queue: FileEntry[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    for (const entry of queue) await processFile(entry).catch(() => {});
    processingRef.current = false;
    setEntries(prev => {
      const doneEntries = prev.filter(e => e.status === 'done');
      if (doneEntries.length === 0) return prev;
      const successIds = doneEntries.filter(e => (e.uncategorizedCount ?? 0) > 0).map(e => e.statementId!);
      if (successIds.length === 0) { setAllDone(true); return prev; }
      Promise.all([Promise.all(successIds.map(sid => api.getQAPending(sid))), api.listCategories()])
        .then(([qaResults, cats]) => {
          const merged = qaResults.flat().filter(Boolean);
          const seen = new Set<string>();
          const unique = merged.filter((q): q is QAPending => {
            if (seen.has(q.merchant_name)) return false;
            seen.add(q.merchant_name); return true;
          });
          setCategories(cats);
          if (unique.length > 0) { setQaItems(unique); setQaIndex(0); }
          else { setAllDone(true); }
        });
      return prev;
    });
  }, [processFile]);

  const addFiles = useCallback((assets: FileAsset[]) => {
    if (!assets.length) return;
    const newEntries: FileEntry[] = assets.map(a => ({
      asset: a,
      id: `${a.name}-${Date.now()}-${Math.random()}`,
      status: 'queued',
    }));
    setEntries(prev => {
      const updated = [...prev, ...newEntries];
      if (!processingRef.current) setTimeout(() => runQueue(newEntries), 0);
      return updated;
    });
  }, [runQueue]);

  const reset = useCallback(() => {
    abortControllersRef.current.forEach(ac => ac.abort());
    abortControllersRef.current = [];
    setEntries([]);
    setQaItems([]);
    setQaIndex(0);
    setCategories([]);
    setAllDone(false);
    setOverlapWarnings([]);
    setOveragePending(null);
    processingRef.current = false;
  }, []);

  const hasActiveUploads = entries.some(e => e.status === 'uploading' || e.status === 'processing' || e.status === 'queued');

  return (
    <UploadContext.Provider value={{
      entries, addFiles, updateEntry, processFile, reset, hasActiveUploads,
      notifications, clearNotifications,
      qaItems, setQaItems, qaIndex, setQaIndex,
      allDone, setAllDone,
      overlapWarnings, setOverlapWarnings,
      overagePending, setOveragePending,
      categories, setCategories,
    }}>
      {children}
    </UploadContext.Provider>
  );
}
