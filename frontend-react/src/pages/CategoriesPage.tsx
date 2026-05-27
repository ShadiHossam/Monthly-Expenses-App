import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { exportToExcel, exportToPDF } from "../lib/exportUtils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6b7280"];

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
      const s = (res as any).data ?? res;
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

  function handleExcelExport() {
    exportToExcel([{
      name: "Categories",
      columns: [
        { header: "Name", key: "name", width: 22 },
        { header: "Color", key: "color", width: 12 },
        { header: "Transactions", key: "transaction_count", width: 14 },
        { header: "System", key: "is_system", width: 10 },
      ],
      rows: categories.map(c => ({ name: c.name, color: c.color, transaction_count: c.transaction_count ?? 0, is_system: c.is_system ? "Yes" : "No" })),
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
    }], "categories");
  }

  function handlePDFExport() {
    exportToPDF([{
      title: "Categories",
      columns: ["Name", "Transactions", "System"],
      rows: categories.map(c => [c.name, c.transaction_count ?? 0, c.is_system ? "Yes" : "No"]) as (string | number)[][],
    }, ...(rules.length > 0 ? [{
      title: "Auto-Rules",
      columns: ["Pattern", "→ Category"],
      rows: rules.map(r => [`"${r.pattern}"`, categories.find(c => c.id === r.category_id)?.name ?? "Unknown"]) as (string | number)[][],
    }] : [])], "categories", "Categories & Rules");
  }

  return (
    <div className="px-6 pt-6 pb-10 max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Categories</h1>
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Organize transactions with custom categories and rules</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && categories.length > 0 && (
            <>
              <button onClick={handleExcelExport}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
                <MSIcon name="table_view" className="text-base" />Excel
              </button>
              <button onClick={handlePDFExport}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
                <MSIcon name="picture_as_pdf" className="text-base" />PDF
              </button>
            </>
          )}
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity">
            <MSIcon name="add" className="text-lg" />Add
          </button>
        </div>
      </div>

      {/* ── Add category form ── */}
      {showAdd && (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5">
          <p className="text-sm font-bold text-ft-on-surface dark:text-ve-on-surface mb-4">New Category</p>

          {/* AI Suggest */}
          <div className="flex gap-2 mb-3">
            <input
              className="flex-1 px-3 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
              placeholder="Merchant name — AI will suggest a category…"
              value={aiMerchantInput}
              onChange={e => setAiMerchantInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && getAISuggestion()}
            />
            <button onClick={getAISuggestion} disabled={aiSuggesting || !aiMerchantInput.trim()}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-ft-secondary dark:bg-ve-primary/20 text-white dark:text-ve-primary rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0">
              {aiSuggesting
                ? <span className="w-4 h-4 border-2 border-white dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
                : <MSIcon name="smart_toy" className="text-base" />}
              AI Suggest
            </button>
          </div>
          {aiSuggestionReason && (
            <div className="flex items-start gap-2 text-xs text-ft-secondary dark:text-ve-primary bg-ft-secondary/5 dark:bg-ve-primary/10 px-3 py-2 rounded-xl mb-3">
              <MSIcon name="info" className="text-base shrink-0 mt-0.5" />
              {aiSuggestionReason}
            </div>
          )}

          <input
            className="w-full px-3 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary mb-4"
            placeholder="Category name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />

          <div className="flex gap-2 flex-wrap mb-4">
            {COLORS.map(c => (
              <button key={c} onClick={() => setNewColor(c)}
                className={cn("w-8 h-8 rounded-full transition-transform", newColor === c ? "scale-125 ring-2 ring-offset-2 ring-ft-on-surface dark:ring-ve-on-surface" : "")}
                style={{ backgroundColor: c }} />
            ))}
            {newColor && !COLORS.includes(newColor) && (
              <button className="w-8 h-8 rounded-full scale-125 ring-2 ring-offset-2 ring-ft-primary dark:ring-ve-primary" style={{ backgroundColor: newColor }} title={`AI color: ${newColor}`} />
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setAiMerchantInput(""); setAiSuggestionReason(""); }}
              className="flex-1 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
              Cancel
            </button>
            <button onClick={addCategory}
              className="flex-1 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Create
            </button>
          </div>
        </div>
      )}

      {/* ── Categories list ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden mb-6">
          {categories.map((cat, i) => (
            <div key={cat.id} className={cn(
              "flex items-center gap-3 px-5 py-4",
              i < categories.length - 1 && "border-b border-ft-outline-variant dark:border-ve-outline"
            )}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: (cat.color || "#94a3b8") + "20" }}>
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color || "#94a3b8" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">{cat.name}</p>
                <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">
                  {cat.transaction_count ?? 0} transactions{cat.is_system ? " · system" : ""}
                </p>
              </div>
              {!cat.is_system && (
                <button onClick={() => deleteCategory(cat.id)}
                  className="text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-red-500 dark:hover:text-ve-error transition-colors p-1">
                  <MSIcon name="delete" className="text-lg" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Auto-Rules ── */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-ft-on-surface dark:text-ve-on-surface">Auto-Rules</h2>
        <button onClick={() => setShowRuleForm(v => !v)}
          className="flex items-center gap-1 text-sm font-semibold text-ft-primary dark:text-ve-primary hover:underline">
          <MSIcon name="add" className="text-base" />Add Rule
        </button>
      </div>
      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-4">
        When a transaction description contains a pattern, auto-assign its category on future uploads.
      </p>

      {showRuleForm && (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-4 space-y-3">
          <input
            className="w-full px-3 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
            placeholder="Pattern (e.g. Brands for Less)"
            value={rulePattern}
            onChange={e => setRulePattern(e.target.value)}
          />
          <select
            className="w-full px-3 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
            value={ruleCatId}
            onChange={e => setRuleCatId(Number(e.target.value))}>
            <option value="">Select category…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => setShowRuleForm(false)}
              className="flex-1 py-2.5 border border-ft-outline-variant dark:border-ve-outline rounded-xl text-sm font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
              Cancel
            </button>
            <button onClick={addRule}
              className="flex-1 py-2.5 bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Save Rule
            </button>
          </div>
        </div>
      )}

      {rules.length > 0 ? (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
          {rules.map((rule, i) => {
            const cat = categories.find(c => c.id === rule.category_id);
            return (
              <div key={rule.id} className={cn(
                "flex items-center gap-3 px-5 py-4",
                i < rules.length - 1 && "border-b border-ft-outline-variant dark:border-ve-outline"
              )}>
                <MSIcon name="rule" className="text-lg text-ft-on-surface-variant dark:text-ve-on-surface-variant shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface">"{rule.pattern}"</p>
                  <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">→ {cat?.name ?? "Unknown"}</p>
                </div>
                <button onClick={() => deleteRule(rule.id)}
                  className="text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-red-500 dark:hover:text-ve-error transition-colors p-1">
                  <MSIcon name="close" className="text-lg" />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-10 text-center">
          <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">No auto-rules yet. Add one to auto-categorize future uploads.</p>
        </div>
      )}
    </div>
  );
}
