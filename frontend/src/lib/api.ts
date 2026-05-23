const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const incomingHeaders = (options.headers as Record<string, string>) ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...incomingHeaders,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }

  if (res.status === 204) return undefined as T;

  const accept = incomingHeaders["Accept"] ?? "";
  if (accept === "text/csv" || res.headers.get("content-type")?.startsWith("text/csv")) {
    return res.blob() as Promise<unknown> as Promise<T>;
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string, email?: string) =>
    request<{ token: string; user: any }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, email }),
    }),
  me: () => request<{ id: number; username: string }>("/auth/me"),

  // Statements
  uploadStatement: async (
    file: File,
    confirmOverage = false,
  ): Promise<{ data: { statement_id?: number; statement_ids?: number[]; page_count?: number; stream_url?: string } }> => {
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    const url = `${API_BASE}/statements/upload${confirmOverage ? "?confirm_overage=true" : ""}`;
    const res = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      // Attach the raw detail so callers can inspect quota / overage fields
      const error: any = new Error(
        typeof err.detail === "string" ? err.detail : err.detail?.message || "Upload failed",
      );
      error.status = res.status;
      error.detail = err.detail;
      throw error;
    }
    return res.json();
  },
  listStatements: () => request<any[]>("/statements"),
  getStatement: (id: number) => request<any>(`/statements/${id}`),
  deleteStatement: (id: number) => request<void>(`/statements/${id}`, { method: "DELETE" }),
  reverifyStatement: (id: number) => request<any>(`/statements/${id}/reverify`, { method: "POST" }),

  // Transactions
  listTransactions: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return request<any[]>(`/transactions?${qs}`);
  },
  setCategory: (txnId: number, categoryId: number) =>
    request<any>(`/transactions/${txnId}/category`, {
      method: "PATCH",
      body: JSON.stringify({ category_id: categoryId }),
    }),
  bulkCategorize: (transactionIds: number[], categoryId: number) =>
    request<any>("/transactions/bulk-categorize", {
      method: "POST",
      body: JSON.stringify({ transaction_ids: transactionIds, category_id: categoryId }),
    }),
  uncategorized: () => request<any[]>("/transactions/uncategorized"),

  // Categories
  listCategories: () => request<any[]>("/categories"),
  createCategory: (name: string, color: string, icon: string) =>
    request<any>("/categories", { method: "POST", body: JSON.stringify({ name, color, icon }) }),
  updateCategory: (id: number, data: any) =>
    request<any>(`/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: "DELETE" }),

  // Merchant rules
  listRules: () => request<any[]>("/merchant-rules"),
  createRule: (data: any) => request<any>("/merchant-rules", { method: "POST", body: JSON.stringify(data) }),
  deleteRule: (id: number) => request<void>(`/merchant-rules/${id}`, { method: "DELETE" }),

  // Q&A
  getQAPending: (statementId?: number) =>
    request<any[]>(`/qa/pending${statementId ? `?statement_id=${statementId}` : ""}`),
  answerQA: (merchant_name: string, category_id: number, apply_rule: boolean, transaction_ids?: number[]) =>
    request<any>("/qa/answer", { method: "POST", body: JSON.stringify({ merchant_name, category_id, apply_rule, transaction_ids }) }),
  skipQA: (merchant_name: string, transaction_ids?: number[]) =>
    request<any>("/qa/skip", { method: "POST", body: JSON.stringify({ merchant_name, transaction_ids }) }),

  // Analytics
  getSummary: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return request<{ data: any }>(`/analytics/summary?${qs}`);
  },
  getMonthly: (year?: number) => request<{ data: any[] }>(`/analytics/monthly${year ? `?year=${year}` : ""}`),
  getQuarterly: (year?: number) => request<{ data: any[] }>(`/analytics/quarterly${year ? `?year=${year}` : ""}`),
  getCategoryBreakdown: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return request<{ data: any[] }>(`/analytics/category-breakdown?${qs}`);
  },
  getFrequentPlaces: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    return request<{ data: any[] }>(`/analytics/frequent-places?${qs}`);
  },
  exportCSV: async (from?: string, to?: string): Promise<void> => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const blob = await request<Blob>(`/analytics/export/csv?${qs}`, { headers: { Accept: "text/csv" } });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${from ?? "all"}_${to ?? "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Merchants
  listMerchants: () => request<{ data: any[] }>("/merchants"),
  getFrequent: () => request<{ data: any[] }>("/merchants/frequent"),
  getMerchantTransactions: (name: string) =>
    request<{ data: any[] }>(`/merchants/${encodeURIComponent(name)}/transactions`),

  // Reports
  generateReport: (from: string, to: string) =>
    request<{ data: any }>(`/reports/generate?from_date=${from}&to_date=${to}`),
  listSavedReports: () => request<{ data: any[] }>("/reports/saved"),
  saveReport: (name: string, from_date: string, to_date: string) =>
    request<{ data: any }>("/reports/saved", {
      method: "POST",
      body: JSON.stringify({ name, from_date, to_date }),
    }),
  deleteSavedReport: (id: number) =>
    request<void>(`/reports/saved/${id}`, { method: "DELETE" }),

  // AI Settings
  getAISettings: () =>
    request<{ groq_api_key_set: boolean; openrouter_api_key_set: boolean; anthropic_api_key_set: boolean; ai_provider: string }>("/settings/ai"),
  saveAISettings: (data: { groq_api_key?: string; openrouter_api_key?: string; anthropic_api_key?: string; ai_provider: string }) =>
    request<{ groq_api_key_set: boolean; openrouter_api_key_set: boolean; anthropic_api_key_set: boolean; ai_provider: string }>("/settings/ai", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // AI
  askAI: (question: string, from_date?: string, to_date?: string) =>
    request<{ data: { answer: string } }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ question, from_date, to_date }),
    }),
  aiSuggestCategory: (merchant_name: string, description?: string) =>
    request<{ data: { name: string; color: string; icon: string; reason: string } }>("/categories/ai-suggest", {
      method: "POST",
      body: JSON.stringify({ merchant_name, description: description || "" }),
    }),

  // Budget Alerts
  listBudgets: () => request<{ data: any[] }>("/budgets/status"),
  createBudget: (category_id: number, monthly_limit: number) =>
    request<{ data: any }>("/budgets", { method: "POST", body: JSON.stringify({ category_id, monthly_limit }) }),
  updateBudget: (id: number, data: { monthly_limit?: number; enabled?: boolean }) =>
    request<{ data: any }>(`/budgets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteBudget: (id: number) => request<void>(`/budgets/${id}`, { method: "DELETE" }),

  // New analytics
  getBalanceTrend: () => request<{ data: any[] }>("/analytics/balance-trend"),
  getRecurring: () => request<{ data: any[] }>("/analytics/recurring"),
  getMonthComparison: (months?: number) =>
    request<{ data: any[] }>(`/analytics/month-comparison${months ? `?months=${months}` : ""}`),

  // Merchant ranking
  getMerchantRanking: (from?: string, to?: string, limit?: number) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from_date", from);
    if (to) qs.set("to_date", to);
    if (limit) qs.set("limit", String(limit));
    return request<{ data: any[] }>(`/merchants/ranking?${qs}`);
  },

  // Billing
  getBillingUsage: () => request<any>("/billing/usage"),
  getPlans: () => request<any[]>("/billing/plans"),
  createCheckout: (plan: string) =>
    request<{ checkout_url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
  createPortal: () =>
    request<{ portal_url: string }>("/billing/portal", { method: "POST" }),
};
