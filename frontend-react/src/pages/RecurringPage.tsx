import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { cn, formatAED } from "../lib/utils";

interface RecurringItem {
  merchant_name: string;
  amount: number;
  occurrences: number;
  months_seen: number;
  last_date: string;
  category_name: string;
  category_color: string;
  transactions: { id: number; txn_date: string; amount: number }[];
}

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function RecurringPage() {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getRecurring()
      .then(res => {
        const data = Array.isArray(res) ? res : (res as any).data ?? [];
        setItems([...data].sort((a: RecurringItem, b: RecurringItem) => b.months_seen - a.months_seen));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(key: string) {
    setExpanded(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  if (loading) {
    return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="px-6 pt-6 pb-10 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Recurring</h1>
        <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Subscriptions &amp; repeat charges detected automatically</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-16 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center">
            <MSIcon name="repeat" className="text-4xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          </div>
          <div>
            <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface">No recurring transactions detected yet.</p>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1 max-w-xs">
              We securely analyze your statements to identify subscriptions and regular payments. Upload your recent financial documents to begin auto-discovery.
            </p>
          </div>
          <div className="flex gap-3">
            <Link to="/upload"
              className="flex items-center gap-2 px-5 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
              <MSIcon name="description" className="text-lg" />
              Upload Statements
            </Link>
            <button className="px-5 py-2.5 border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant text-sm font-semibold rounded-xl hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
              View Manual Setup
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const key = item.merchant_name;
            const isOpen = expanded.has(key);
            return (
              <div key={key} className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                <button className="w-full text-left p-5" onClick={() => toggleExpand(key)}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: (item.category_color || "#94a3b8") + "20" }}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.category_color || "#94a3b8" }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{item.merchant_name}</p>
                        <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Last: {formatDate(item.last_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(item.amount)}</p>
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
                          {item.months_seen} month{item.months_seen !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <MSIcon name={isOpen ? "expand_less" : "expand_more"} className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                    </div>
                  </div>
                  <div className="mt-2">
                    <span
                      className={cn("text-xs px-2 py-0.5 rounded-full font-medium", !item.category_color && "bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface-variant dark:text-ve-on-surface-variant")}
                      style={{ backgroundColor: item.category_color ? `${item.category_color}20` : undefined, color: item.category_color || undefined }}>
                      {item.category_name || "Uncategorized"}
                    </span>
                  </div>
                </button>
                {isOpen && item.transactions?.length > 0 && (
                  <div className="border-t border-ft-outline-variant dark:border-ve-outline px-5 pb-4">
                    <p className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wider pt-3 mb-2">Transaction history</p>
                    <div className="space-y-1">
                      {item.transactions.map(txn => (
                        <div key={txn.id} className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">{formatDate(txn.txn_date)}</span>
                          <span className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(txn.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
