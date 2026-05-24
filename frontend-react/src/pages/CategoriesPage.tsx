import { useEffect, useState } from "react";
import { api } from "../lib/api";
import ExportButtons from "../components/ExportButtons";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#10b981");
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [rulePattern, setRulePattern] = useState("");
  const [ruleCatId, setRuleCatId] = useState<number | "">("");
  const [aiMerchantInput, setAiMerchantInput] = useState("");
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggestionReason, setAiSuggestionReason] = useState("");

  async function load() {
    const [cats, rls] = await Promise.all([api.listCategories(), api.listRules()]);
    setCategories(Array.isArray(cats) ? cats : []);
    setRules(Array.isArray(rls) ? rls : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addCategory() {
    if (!newName.trim()) return;
    await api.createCategory(newName.trim(), newColor, "tag");
    setNewName(""); setShowAdd(false); setAiMerchantInput(""); setAiSuggestionReason("");
    load();
  }

  async function deleteCategory(id: number) {
    if (!confirm("Delete this category? Transactions will move to Uncategorized.")) return;
    await api.deleteCategory(id);
    load();
  }

  async function getAISuggestion() {
    if (!aiMerchantInput.trim()) return;
    setAiSuggesting(true);
    setAiSuggestionReason("");
    try {
      const res = await api.aiSuggestCategory(aiMerchantInput.trim());
      const s = res.data;
      setNewName(s.name);
      const matchedColor = COLORS.find(c => c.toLowerCase() === s.color.toLowerCase());
      setNewColor(matchedColor || (COLORS.includes(s.color) ? s.color : s.color));
      setAiSuggestionReason(s.reason || "");
    } finally {
      setAiSuggesting(false);
    }
  }

  async function addRule() {
    if (!rulePattern.trim() || !ruleCatId) return;
    await api.createRule({ pattern: rulePattern.trim(), pattern_type: "contains", category_id: ruleCatId, priority: 0 });
    setRulePattern(""); setRuleCatId(""); setShowRuleForm(false);
    load();
  }

  async function deleteRule(id: number) {
    await api.deleteRule(id);
    load();
  }

  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6b7280"];

  function handleExcelExport() {
    exportToExcel(
      [{
        name: "Categories",
        columns: [
          { header: "Name", key: "name", width: 22 },
          { header: "Color", key: "color", width: 12 },
          { header: "Transactions", key: "transaction_count", width: 14 },
          { header: "System", key: "is_system", width: 10 },
        ],
        rows: categories.map(c => ({
          name: c.name,
          color: c.color,
          transaction_count: c.transaction_count ?? 0,
          is_system: c.is_system ? "Yes" : "No",
        })),
      }, {
        name: "Auto-Rules",
        columns: [
          { header: "Pattern", key: "pattern", width: 28 },
          { header: "Category", key: "category_name", width: 22 },
          { header: "Type", key: "pattern_type", width: 12 },
        ],
        rows: rules.map(r => ({
          pattern: r.pattern,
          category_name: categories.find(c => c.id === r.category_id)?.name ?? "",
          pattern_type: r.pattern_type,
        })),
      }],
      "categories"
    );
  }

  function handlePDFExport() {
    exportToPDF(
      [
        {
          title: "Categories",
          columns: ["Name", "Transactions", "System"],
          rows: categories.map(c => [c.name, c.transaction_count ?? 0, c.is_system ? "Yes" : "No"]) as (string | number)[][],
        },
        ...(rules.length > 0 ? [{
          title: "Auto-Rules",
          columns: ["Pattern", "→ Category"],
          rows: rules.map(r => [
            `"${r.pattern}"`,
            categories.find(c => c.id === r.category_id)?.name ?? "Unknown",
          ]) as (string | number)[][],
        }] : []),
      ],
      "categories",
      "Categories & Rules"
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-900">Categories</h1>
        <div className="flex items-center gap-2">
          {!loading && categories.length > 0 && (
            <ExportButtons onExportExcel={handleExcelExport} onExportPDF={handlePDFExport} />
          )}
          <button onClick={() => setShowAdd(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium">+ Add</button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <h3 className="font-semibold text-slate-900 mb-4">New Category</h3>

          {/* AI Suggest row */}
          <div className="flex gap-2 mb-4">
            <input
              className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="Type a merchant name for AI to suggest…"
              value={aiMerchantInput}
              onChange={e => setAiMerchantInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && getAISuggestion()}
            />
            <button
              onClick={getAISuggestion}
              disabled={aiSuggesting || !aiMerchantInput.trim()}
              className="px-3 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
            >
              {aiSuggesting ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              )}
              AI Suggest
            </button>
          </div>
          {aiSuggestionReason && (
            <p className="text-xs text-violet-600 mb-3 bg-violet-50 px-3 py-2 rounded-lg">{aiSuggestionReason}</p>
          )}

          <input className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="Category name" value={newName} onChange={e => setNewName(e.target.value)} />
          <div className="flex gap-2 mb-4 flex-wrap">
            {COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${newColor === c ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : ""}`}
                style={{ backgroundColor: c }} />
            ))}
            {/* Show AI-suggested color if not in presets */}
            {newColor && !COLORS.includes(newColor) && (
              <button
                className="w-8 h-8 rounded-full scale-125 ring-2 ring-offset-1 ring-violet-400"
                style={{ backgroundColor: newColor }}
                title={`AI color: ${newColor}`}
              />
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setShowAdd(false); setAiMerchantInput(""); setAiSuggestionReason(""); }} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-slate-600">Cancel</button>
            <button onClick={addCategory} className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium">Create</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          {categories.map((cat, i) => (
            <div key={cat.id} className={`flex items-center gap-4 px-5 py-4 ${i < categories.length - 1 ? "border-b border-gray-50" : ""}`}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.color + "20" }}>
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: cat.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{cat.name}</p>
                <p className="text-xs text-slate-400">{cat.transaction_count} transactions {cat.is_system && "· system"}</p>
              </div>
              {!cat.is_system && (
                <button onClick={() => deleteCategory(cat.id)} className="text-slate-300 hover:text-red-500 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Auto-rules */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-900">Auto-Rules</h2>
        <button onClick={() => setShowRuleForm(true)} className="text-sm text-emerald-600 font-medium">+ Add Rule</button>
      </div>
      <p className="text-xs text-slate-400 mb-4">When a transaction description contains a pattern, auto-assign its category on future uploads.</p>

      {showRuleForm && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
          <input className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Pattern (e.g. Brands for Less)" value={rulePattern} onChange={e => setRulePattern(e.target.value)} />
          <select className="w-full px-4 py-3 border border-gray-200 rounded-xl mb-3 text-sm focus:outline-none"
            value={ruleCatId} onChange={e => setRuleCatId(Number(e.target.value))}>
            <option value="">Select category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-3">
            <button onClick={() => setShowRuleForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-slate-600">Cancel</button>
            <button onClick={addRule} className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium">Save Rule</button>
          </div>
        </div>
      )}

      {rules.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {rules.map((rule, i) => {
            const cat = categories.find(c => c.id === rule.category_id);
            return (
              <div key={rule.id} className={`flex items-center gap-4 px-5 py-4 ${i < rules.length - 1 ? "border-b border-gray-50" : ""}`}>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">"{rule.pattern}"</p>
                  <p className="text-xs text-slate-400">→ {cat?.name ?? "Unknown"}</p>
                </div>
                <button onClick={() => deleteRule(rule.id)} className="text-slate-300 hover:text-red-500 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400 text-sm">No auto-rules yet. Add one to auto-categorize future uploads.</div>
      )}
    </div>
  );
}
