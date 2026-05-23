"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatAED, formatDate } from "@/lib/utils";
import ExportButtons from "@/components/ExportButtons";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";

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
    if (expanded === name) {
      setExpanded(null);
      return;
    }
    setExpanded(name);
    if (!txns[name]) {
      setTxnLoading(name);
      try {
        const res = await api.getMerchantTransactions(name);
        setTxns((prev) => ({ ...prev, [name]: (res as any).data || [] }));
      } finally {
        setTxnLoading(null);
      }
    }
  }

  const q = search.toLowerCase();
  const filteredFrequent = frequent.filter((p) =>
    p.merchant_name?.toLowerCase().includes(q)
  );
  const filteredMerchants = merchants.filter((m) =>
    (m.merchant_name || "").toLowerCase().includes(q)
  );

  function handleExcelExport() {
    const sheets = [];

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
    const sections = [];

    if (frequent.length > 0) {
      sections.push({
        title: "Frequent Places",
        columns: ["Merchant", "Visits", "Avg Spend (AED)", "Total (AED)"],
        rows: frequent.map((p: any) => [
          p.merchant_name,
          p.visit_count,
          Number(p.avg_spend).toFixed(2),
          Number(p.total_spent).toFixed(2),
        ]) as (string | number)[][],
      });
    }

    sections.push({
      title: "All Merchants",
      columns: ["Merchant", "Visits", "Total Spent (AED)"],
      rows: merchants.map((m: any) => [
        m.merchant_name || "Unknown",
        m.visit_count,
        Number(m.total_spend).toFixed(2),
      ]) as (string | number)[][],
    });

    exportToPDF(sections, "merchants", "Merchants Report");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">Merchants</h1>
        {!loading && merchants.length > 0 && (
          <ExportButtons onExportExcel={handleExcelExport} onExportPDF={handlePDFExport} />
        )}
      </div>

      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Filter merchants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {filteredFrequent.length > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="text-yellow-500">⭐</span> Frequent Places
              </h2>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {filteredFrequent.map((p: any, i: number) => (
                  <div key={i}>
                    <button
                      onClick={() => toggleMerchant(p.merchant_name)}
                      className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors ${i < filteredFrequent.length - 1 || expanded === p.merchant_name ? "border-b border-gray-50" : ""}`}
                    >
                      <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-emerald-600">{p.visit_count}x</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.merchant_name}</p>
                        <p className="text-xs text-slate-400">{p.frequency_reason} · avg {formatAED(p.avg_spend)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{formatAED(p.total_spent)}</p>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded === p.merchant_name ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
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

          {ranking.length > 0 && (
            <div className="mb-6">
              <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span>🏆</span> Top Merchants by Spend
              </h2>
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {ranking.slice(0, 10).map((m: any, i: number) => (
                  <div key={i} className={`flex items-center gap-4 px-5 py-4 ${i < ranking.length - 1 ? "border-b border-gray-50" : ""}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${i === 0 ? "bg-yellow-100 text-yellow-700" : i === 1 ? "bg-slate-100 text-slate-600" : i === 2 ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-slate-400"}`}>
                      {m.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{m.merchant_name}</p>
                      <p className="text-xs text-slate-400">{m.visit_count} visit{m.visit_count !== 1 ? "s" : ""} · avg {formatAED(m.avg_spend)}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 flex-shrink-0">{formatAED(m.total_spend)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="font-semibold text-slate-700 mb-3">All Merchants</h2>
          {filteredMerchants.length > 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {filteredMerchants.map((m: any, i: number) => (
                <div key={i}>
                  <button
                    onClick={() => toggleMerchant(m.merchant_name)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors ${i < filteredMerchants.length - 1 || expanded === m.merchant_name ? "border-b border-gray-50" : ""}`}
                  >
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-slate-500">{(m.merchant_name || "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{m.merchant_name || "Unknown"}</p>
                      <p className="text-xs text-slate-400">{m.visit_count} visit{m.visit_count !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{formatAED(m.total_spend)}</p>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded === m.merchant_name ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  {expanded === m.merchant_name && (
                    <TransactionList name={m.merchant_name} txns={txns[m.merchant_name]} loading={txnLoading === m.merchant_name} />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400">
              {search ? "No merchants match your filter." : "No merchants yet. Upload a statement first."}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TransactionList({ name, txns, loading }: { name: string; txns: any[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="px-5 py-4 flex justify-center">
        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!txns || txns.length === 0) {
    return <div className="px-5 py-3 text-xs text-slate-400">No transactions found.</div>;
  }
  return (
    <div className="bg-slate-50 border-t border-gray-100">
      {txns.map((t: any, i: number) => (
        <div key={i} className={`flex items-center gap-3 px-5 py-3 ${i < txns.length - 1 ? "border-b border-gray-100" : ""}`}>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500 truncate">{t.description || name}</p>
            <p className="text-xs text-slate-400">{formatDate(t.txn_date)}</p>
          </div>
          <p className="text-xs font-semibold text-slate-700">{formatAED(t.amount)}</p>
        </div>
      ))}
    </div>
  );
}
