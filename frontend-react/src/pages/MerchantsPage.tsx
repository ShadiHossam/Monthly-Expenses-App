import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { cn, formatAED, formatDate } from "../lib/utils";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [frequent, setFrequent] = useState<any[]>([]);
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [txns, setTxns] = useState<Record<string, any[]>>({});
  const [txnLoading, setTxnLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listMerchants(), api.getFrequent(), api.getMerchantRanking()])
      .then(([m, f, r]) => {
        setMerchants((m as any).data || []);
        setFrequent((f as any).data || []);
        setRanking((r as any).data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleMerchant(name: string) {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    if (!txns[name]) {
      setTxnLoading(name);
      try {
        const res = await api.getMerchantTransactions(name);
        setTxns(prev => ({ ...prev, [name]: (res as any).data || [] }));
      } finally { setTxnLoading(null); }
    }
  }

  const q = search.toLowerCase();
  const filteredFrequent = frequent.filter(p => p.merchant_name?.toLowerCase().includes(q));
  const filteredMerchants = merchants.filter(m => (m.merchant_name || "").toLowerCase().includes(q));

  function handleExcelExport() {
    const sheets: any[] = [];
    if (frequent.length > 0) {
      sheets.push({
        name: "Frequent Places",
        columns: [
          { header: "Merchant", key: "merchant_name", width: 28 },
          { header: "Visits", key: "visit_count", width: 10 },
          { header: "Avg Spend (AED)", key: "avg_spend", width: 16 },
          { header: "Total Spent (AED)", key: "total_spent", width: 16 },
        ],
        rows: frequent.map((p: any) => ({
          merchant_name: p.merchant_name,
          visit_count: p.visit_count,
          avg_spend: Number(p.avg_spend).toFixed(2),
          total_spent: Number(p.total_spent).toFixed(2),
        })),
      });
    }
    sheets.push({
      name: "All Merchants",
      columns: [
        { header: "Merchant", key: "merchant_name", width: 28 },
        { header: "Visits", key: "visit_count", width: 10 },
        { header: "Total Spent (AED)", key: "total_spend", width: 16 },
      ],
      rows: merchants.map((m: any) => ({
        merchant_name: m.merchant_name || "Unknown",
        visit_count: m.visit_count,
        total_spend: Number(m.total_spend).toFixed(2),
      })),
    });
    exportToExcel(sheets, "merchants");
  }

  function handlePDFExport() {
    const sections: any[] = [];
    if (frequent.length > 0) {
      sections.push({
        title: "Frequent Places",
        columns: ["Merchant", "Visits", "Avg Spend (AED)", "Total (AED)"],
        rows: frequent.map((p: any) => [p.merchant_name, p.visit_count, Number(p.avg_spend).toFixed(2), Number(p.total_spent).toFixed(2)]),
      });
    }
    sections.push({
      title: "All Merchants",
      columns: ["Merchant", "Visits", "Total Spent (AED)"],
      rows: merchants.map((m: any) => [m.merchant_name || "Unknown", m.visit_count, Number(m.total_spend).toFixed(2)]),
    });
    exportToPDF(sections, "merchants", "Merchants Report");
  }

  if (loading) {
    return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const hasAny = merchants.length > 0 || frequent.length > 0;

  return (
    <div className="px-6 pt-6 pb-10 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Merchants</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">All detected merchants and spending patterns</p>
        </div>
        {hasAny && (
          <div className="flex items-center gap-2">
            <button onClick={handleExcelExport}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
              <MSIcon name="table_view" className="text-base" />
              Excel
            </button>
            <button onClick={handlePDFExport}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
              <MSIcon name="picture_as_pdf" className="text-base" />
              PDF
            </button>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div className="relative mb-6">
        <MSIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant pointer-events-none" />
        <input
          type="text"
          placeholder="Search merchants…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface dark:bg-ve-surface text-sm text-ft-on-surface dark:text-ve-on-surface placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
        />
      </div>

      {!hasAny ? (
        /* ── Empty state ── */
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-16 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center">
            <MSIcon name="storefront" className="text-4xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          </div>
          <div>
            <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface">No merchants detected yet</p>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1 max-w-xs">
              Upload a bank statement to automatically discover merchants and spending patterns.
            </p>
          </div>
          <Link to="/upload"
            className="flex items-center gap-2 px-5 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
            <MSIcon name="upload" className="text-lg" />
            Upload Statement
          </Link>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Frequent Places ── */}
          {filteredFrequent.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MSIcon name="star" className="text-base text-amber-500" />
                Frequent Places
              </p>
              <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                {filteredFrequent.map((p: any, i: number) => (
                  <div key={p.merchant_name}>
                    <button
                      onClick={() => toggleMerchant(p.merchant_name)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors",
                        i < filteredFrequent.length - 1 && "border-b border-ft-outline-variant dark:border-ve-outline"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-ft-primary/10 dark:bg-ve-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-ft-primary dark:text-ve-primary">{p.visit_count}x</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{p.merchant_name}</p>
                        <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
                          {p.frequency_reason} · avg {formatAED(p.avg_spend)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(p.total_spent)}</span>
                        <MSIcon name={expanded === p.merchant_name ? "expand_less" : "expand_more"} className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                      </div>
                    </button>
                    {expanded === p.merchant_name && (
                      <TransactionList name={p.merchant_name} txns={txns[p.merchant_name]} loading={txnLoading === p.merchant_name} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top by Spend ── */}
          {ranking.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <MSIcon name="emoji_events" className="text-base text-amber-500" />
                Top Merchants by Spend
              </p>
              <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                {ranking.slice(0, 10).map((m: any, i: number) => (
                  <div key={i} className={cn(
                    "flex items-center gap-3 px-5 py-4",
                    i < Math.min(ranking.length, 10) - 1 && "border-b border-ft-outline-variant dark:border-ve-outline"
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                      i === 0 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        : i === 1 ? "bg-slate-100 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400"
                        : i === 2 ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                        : "bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface-variant dark:text-ve-on-surface-variant"
                    )}>
                      {m.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{m.merchant_name}</p>
                      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
                        {m.visit_count} visit{m.visit_count !== 1 ? "s" : ""} · avg {formatAED(m.avg_spend)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums shrink-0">{formatAED(m.total_spend)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── All Merchants ── */}
          <div>
            <p className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wider mb-3">
              All Merchants
            </p>
            {filteredMerchants.length > 0 ? (
              <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
                {filteredMerchants.map((m: any, i: number) => (
                  <div key={i}>
                    <button
                      onClick={() => toggleMerchant(m.merchant_name)}
                      className={cn(
                        "w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors",
                        i < filteredMerchants.length - 1 && "border-b border-ft-outline-variant dark:border-ve-outline"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-ft-surface-low dark:bg-ve-surface-high flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                          {(m.merchant_name || "?")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{m.merchant_name || "Unknown"}</p>
                        <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
                          {m.visit_count} visit{m.visit_count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(m.total_spend)}</span>
                        <MSIcon name={expanded === m.merchant_name ? "expand_less" : "expand_more"} className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                      </div>
                    </button>
                    {expanded === m.merchant_name && (
                      <TransactionList name={m.merchant_name} txns={txns[m.merchant_name]} loading={txnLoading === m.merchant_name} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-10 flex flex-col items-center text-center gap-2">
                <MSIcon name="search_off" className="text-3xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
                <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                  {search ? "No merchants match your search." : "No merchants found."}
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

function TransactionList({ name, txns, loading }: { name: string; txns: any[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="border-t border-ft-outline-variant dark:border-ve-outline px-5 py-4 flex justify-center bg-ft-surface-low dark:bg-ve-surface-high">
        <div className="w-5 h-5 border-2 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!txns || txns.length === 0) {
    return (
      <div className="border-t border-ft-outline-variant dark:border-ve-outline px-5 py-3 bg-ft-surface-low dark:bg-ve-surface-high">
        <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">No transactions found.</p>
      </div>
    );
  }
  return (
    <div className="border-t border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high">
      <p className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wider px-5 pt-3 mb-1">Transaction history</p>
      {txns.map((t: any, i: number) => (
        <div key={i} className={cn(
          "flex items-center gap-3 px-5 py-2.5",
          i < txns.length - 1 && "border-b border-ft-outline-variant/50 dark:border-ve-outline/50"
        )}>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ft-on-surface dark:text-ve-on-surface truncate">{t.description || name}</p>
            <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">{formatDate(t.txn_date)}</p>
          </div>
          <span className="text-xs font-semibold text-ft-on-surface dark:text-ve-on-surface tabular-nums">{formatAED(t.amount)}</span>
        </div>
      ))}
    </div>
  );
}
