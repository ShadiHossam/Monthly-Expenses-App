import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { Category } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

export default function AddTransactionModal({ open, onClose, onSuccess }: Props) {
  const [txnDate, setTxnDate] = useState(today());
  const [description, setDescription] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [txnType, setTxnType] = useState<"debit" | "credit">("debit");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [refNumber, setRefNumber] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      api.listCategories().then(setCategories).catch(() => {});
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount || !txnDate) return;
    setLoading(true);
    setError("");
    try {
      await api.createTransaction({
        txnDate,
        description: description.trim(),
        merchantName: merchantName.trim() || undefined,
        amount: parseFloat(amount),
        txnType,
        refNumber: refNumber.trim() || undefined,
        categoryId: categoryId !== "" ? (categoryId as number) : undefined,
      });
      resetForm();
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add transaction");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTxnDate(today());
    setDescription("");
    setMerchantName("");
    setAmount("");
    setTxnType("debit");
    setCategoryId("");
    setRefNumber("");
    setError("");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-ft-surface dark:bg-ve-surface w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-ft-outline-variant dark:border-ve-outline">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-ft-surface-low dark:bg-ve-surface-high rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-ft-primary dark:text-ve-primary text-xl">
                add_card
              </span>
            </div>
            <div>
              <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface text-sm">
                Add Transaction
              </p>
              <p className="text-xs text-ft-outline dark:text-ve-on-surface-variant">
                Manual entry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors"
          >
            <span className="material-symbols-outlined text-ft-outline dark:text-ve-on-surface-variant text-xl">
              close
            </span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5 overflow-y-auto">
          {/* Debit / Credit toggle */}
          <div className="flex rounded-xl overflow-hidden border border-ft-outline-variant dark:border-ve-outline">
            <button
              type="button"
              onClick={() => setTxnType("debit")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                txnType === "debit"
                  ? "bg-ft-primary dark:bg-ve-primary text-white dark:text-ve-background"
                  : "text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
              }`}
            >
              Debit (expense)
            </button>
            <button
              type="button"
              onClick={() => setTxnType("credit")}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                txnType === "credit"
                  ? "bg-ft-primary dark:bg-ve-primary text-white dark:text-ve-background"
                  : "text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
              }`}
            >
              Credit (income)
            </button>
          </div>

          {/* Amount + Date row */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                Amount (AED) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                Date *
              </label>
              <input
                type="date"
                required
                value={txnDate}
                onChange={e => setTxnDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
              Description *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Grocery run, Coffee, Salary…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
            />
          </div>

          {/* Merchant */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
              Merchant name <span className="text-ft-outline dark:text-ve-on-surface-variant font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Carrefour, Starbucks…"
              value={merchantName}
              onChange={e => setMerchantName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
              Category <span className="text-ft-outline dark:text-ve-on-surface-variant font-normal">(optional)</span>
            </label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : "")}
              className="w-full px-3 py-2.5 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
            >
              <option value="">Uncategorized</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reference number */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
              Reference # <span className="text-ft-outline dark:text-ve-on-surface-variant font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. TXN123456"
              value={refNumber}
              onChange={e => setRefNumber(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
            />
          </div>

          {error && (
            <p className="text-sm text-ft-error dark:text-ve-error bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant text-sm font-medium hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !description.trim() || !amount}
              className="flex-1 py-3 rounded-xl bg-ft-primary dark:bg-ve-primary text-white dark:text-ve-background text-sm font-semibold hover:bg-ft-primary-container dark:hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Saving…" : "Add transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
