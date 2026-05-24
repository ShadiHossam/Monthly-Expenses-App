import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatAED } from "../lib/utils";

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

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function RecurringPage() {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .getRecurring()
      .then((res) => {
        const data = Array.isArray(res) ? res : (res as any).data ?? [];
        setItems([...data].sort((a: RecurringItem, b: RecurringItem) => b.months_seen - a.months_seen));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Recurring</h1>
        <p className="text-slate-400 text-sm mt-1">Subscriptions &amp; repeat charges detected automatically</p>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <svg className="mx-auto mb-4 text-slate-300" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <p className="text-slate-500 font-medium">No recurring transactions detected yet.</p>
          <p className="text-slate-400 text-sm mt-1">Upload more statements to detect patterns.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const key = item.merchant_name;
            const isOpen = expanded.has(key);
            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  className="w-full text-left p-5"
                  onClick={() => toggleExpand(key)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="flex-shrink-0 w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.category_color || "#94a3b8" }}
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{item.merchant_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Last: {formatDate(item.last_date)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatAED(item.amount)}</p>
                        <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 mt-0.5">
                          {item.months_seen} month{item.months_seen !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  <div className="mt-2">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: item.category_color ? `${item.category_color}20` : "#f1f5f9",
                        color: item.category_color || "#64748b",
                      }}
                    >
                      {item.category_name || "Uncategorized"}
                    </span>
                  </div>
                </button>

                {isOpen && item.transactions?.length > 0 && (
                  <div className="border-t border-gray-100 px-5 pb-4">
                    <p className="text-xs font-medium text-slate-400 pt-3 mb-2">Transaction history</p>
                    <div className="space-y-1">
                      {item.transactions.map((txn) => (
                        <div key={txn.id} className="flex items-center justify-between py-1.5">
                          <span className="text-sm text-slate-600">{formatDate(txn.txn_date)}</span>
                          <span className="text-sm font-medium text-slate-900">{formatAED(txn.amount)}</span>
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
