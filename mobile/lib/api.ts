import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { storage } from './storage';
import { authEmitter } from './authEvents';
import type {
  User, Statement, Transaction, PageResponse, Category, MerchantRule,
  MerchantAlias, MerchantSummary, Summary, MonthData, CategoryBreakdown,
  FrequentPlace, RecurringItem, BalanceTrendPoint, MonthComparison,
  QAPending, BillingUsage, Plan, AISettings, BudgetStatus, SavedReport,
} from '../types';

export const API_BASE =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? 'http://localhost:3000/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await storage.getToken();
  const incomingHeaders = (options.headers as Record<string, string>) ?? {};

  // Don't set Content-Type for FormData (browser/RN sets it with boundary)
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = isFormData
    ? { ...incomingHeaders }
    : { 'Content-Type': 'application/json', ...incomingHeaders };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    await storage.deleteToken();
    authEmitter.emit('unauthorized');
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }

  if (res.status === 204) return undefined as T;

  const accept = incomingHeaders['Accept'] ?? '';
  if (accept === 'text/csv' || res.headers.get('content-type')?.startsWith('text/csv')) {
    return res.text() as Promise<unknown> as Promise<T>;
  }
  return res.json();
}

export type FileAsset = { uri: string; name: string; type: string };

export const api = {
  // ─── Auth ───────────────────────────────────────────────────────────────
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string, email?: string) =>
    request<{ token: string; user: User }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ username, password, email }),
    }),
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  updateProfile: (data: { email?: string; currentPassword?: string; newPassword?: string }) =>
    request<User>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (confirmation: string) =>
    request<void>('/auth/profile', { method: 'DELETE', body: JSON.stringify({ confirmation }) }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, newPassword }),
    }),

  // ─── Statements ─────────────────────────────────────────────────────────
  uploadStatement: async (
    asset: FileAsset,
    confirmOverage = false,
  ): Promise<{ data: { statement_id?: number; statement_ids?: number[]; page_count?: number; stream_url?: string } }> => {
    const token = await storage.getToken();
    const formData = new FormData();
    // React Native FormData accepts { uri, name, type } objects
    formData.append('file', { uri: asset.uri, name: asset.name, type: asset.type } as any);
    const url = `${API_BASE}/statements/upload${confirmOverage ? '?confirm_overage=true' : ''}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
      const detail = typeof err.detail === 'string' ? err.detail : 'Upload failed';
      const error = new Error(detail) as Error & { status: number; detail: unknown };
      error.status = res.status;
      error.detail = err.detail;
      throw error;
    }
    return res.json();
  },
  listStatements: () => request<Statement[]>('/statements'),
  getStatement: (id: number) => request<Statement>(`/statements/${id}`),
  deleteStatement: (id: number) => request<void>(`/statements/${id}`, { method: 'DELETE' }),
  reverifyStatement: (id: number) => request<Statement>(`/statements/${id}/reverify`, { method: 'POST' }),
  reverifyAllPending: () => request<{ queued: number }>('/statements/reverify-pending', { method: 'POST' }),

  // ─── Transactions ────────────────────────────────────────────────────────
  listTransactions: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return request<PageResponse<Transaction>>(`/transactions?${qs}`);
  },
  setCategory: (txnId: number, categoryId: number | null) =>
    request<Transaction>(`/transactions/${txnId}/category`, {
      method: 'PATCH', body: JSON.stringify({ category_id: categoryId }),
    }),
  bulkCategorize: (transactionIds: number[], categoryId: number) =>
    request<{ data: { updated: number } }>('/transactions/bulk-categorize', {
      method: 'POST', body: JSON.stringify({ transaction_ids: transactionIds, category_id: categoryId }),
    }),
  deleteTransaction: (id: number) => request<void>(`/transactions/${id}`, { method: 'DELETE' }),
  uncategorized: () => request<Transaction[]>('/transactions/uncategorized'),
  createTransaction: (data: {
    txnDate: string; description: string; amount: number;
    txnType: 'debit' | 'credit'; merchantName?: string; refNumber?: string; categoryId?: number;
  }) => request<Transaction>('/transactions', {
    method: 'POST', body: JSON.stringify({
      txnDate: data.txnDate, description: data.description,
      amount: data.amount, txnType: data.txnType,
      merchantName: data.merchantName || undefined,
      refNumber: data.refNumber || undefined,
      categoryId: data.categoryId || undefined,
    }),
  }),
  exportCSV: async (from?: string, to?: string): Promise<void> => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const token = await storage.getToken();
    const res = await fetch(`${API_BASE}/transactions/export/csv?${qs}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'text/csv',
      },
    });
    const text = await res.text();
    const uri = `${FileSystem.cacheDirectory}expenses_${from ?? 'all'}_${to ?? 'all'}.csv`;
    await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Export Transactions' });
  },

  // ─── Categories ──────────────────────────────────────────────────────────
  listCategories: () => request<Category[]>('/categories'),
  createCategory: (name: string, color: string, icon: string) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify({ name, color, icon }) }),
  updateCategory: (id: number, data: Partial<Pick<Category, 'name' | 'color' | 'icon'>>) =>
    request<Category>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),
  aiSuggestCategory: (merchant_name: string, description?: string) =>
    request<{ name: string; color: string; icon: string; reason: string }>('/categories/ai-suggest', {
      method: 'POST', body: JSON.stringify({ merchant_name, description: description || '' }),
    }),

  // ─── Merchant rules ──────────────────────────────────────────────────────
  listRules: () => request<MerchantRule[]>('/merchant-rules'),
  createRule: (data: Omit<MerchantRule, 'id'>) =>
    request<MerchantRule>('/merchant-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id: number, data: Partial<Omit<MerchantRule, 'id'>>) =>
    request<MerchantRule>(`/merchant-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRule: (id: number) => request<void>(`/merchant-rules/${id}`, { method: 'DELETE' }),
  testRule: (pattern: string, pattern_type: string) =>
    request<{ matched: string[] }>('/merchant-rules/test', {
      method: 'POST', body: JSON.stringify({ pattern, pattern_type }),
    }),

  // ─── Merchant aliases ────────────────────────────────────────────────────
  listAliases: () => request<MerchantAlias[]>('/merchant-aliases'),
  createAlias: (raw_name: string, display_name: string) =>
    request<MerchantAlias>('/merchant-aliases', {
      method: 'POST', body: JSON.stringify({ raw_name, display_name }),
    }),
  updateAlias: (id: number, display_name: string) =>
    request<MerchantAlias>(`/merchant-aliases/${id}`, {
      method: 'PATCH', body: JSON.stringify({ display_name }),
    }),
  deleteAlias: (id: number) => request<void>(`/merchant-aliases/${id}`, { method: 'DELETE' }),

  // ─── Q&A ─────────────────────────────────────────────────────────────────
  getQAPending: (statementId?: number) =>
    request<QAPending[]>(`/qa/pending${statementId ? `?statement_id=${statementId}` : ''}`),
  answerQA: (merchant_name: string, category_id: number, apply_rule: boolean, transaction_ids?: number[]) =>
    request<{ updated: number }>('/qa/answer', {
      method: 'POST', body: JSON.stringify({ merchant_name, category_id, apply_rule, transaction_ids }),
    }),
  skipQA: (merchant_name: string, transaction_ids?: number[]) =>
    request<{ skipped: number }>('/qa/skip', {
      method: 'POST', body: JSON.stringify({ merchant_name, transaction_ids }),
    }),
  answerBatchQA: (items: { merchant_name: string; category_id: number; apply_rule: boolean; transaction_ids?: number[] }[]) =>
    request<{ updated: number }>('/qa/answer-batch', {
      method: 'POST', body: JSON.stringify(items),
    }),
  unanswerQA: (transactionIds: number[]) =>
    request<{ reset: number }>('/qa/unanswer', {
      method: 'POST', body: JSON.stringify({ transaction_ids: transactionIds }),
    }),

  // ─── Analytics ───────────────────────────────────────────────────────────
  getSummary: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return request<Summary>(`/analytics/summary?${qs}`);
  },
  getMonthly: (year?: number) =>
    request<MonthData[]>(`/analytics/monthly${year ? `?year=${year}` : ''}`),
  getCategoryBreakdown: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return request<CategoryBreakdown[]>(`/analytics/category-breakdown?${qs}`);
  },
  getFrequentPlaces: (from?: string, to?: string) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return request<FrequentPlace[]>(`/analytics/frequent-places?${qs}`);
  },
  getBalanceTrend: () => request<BalanceTrendPoint[]>('/analytics/balance-trend'),
  getRecurring: () => request<RecurringItem[]>('/analytics/recurring'),
  getMonthComparison: (months?: number) =>
    request<MonthComparison[]>(`/analytics/month-comparison${months ? `?months=${months}` : ''}`),

  // ─── Savings Goals ───────────────────────────────────────────────────────
  listSavingsGoals: () => request<any[]>('/savings-goals'),
  createSavingsGoal: (data: { name: string; targetAmount: number; targetDate: string; color?: string }) =>
    request<any>('/savings-goals', { method: 'POST', body: JSON.stringify(data) }),
  deleteSavingsGoal: (id: number) => request<void>(`/savings-goals/${id}`, { method: 'DELETE' }),

  // ─── Recurring rules (manual) ────────────────────────────────────────────
  listRecurringRules: () => request<any[]>('/recurring-rules'),
  createRecurringRule: (data: { label: string; merchantPattern?: string; expectedAmount?: number; frequencyDays?: number; nextExpectedDate?: string }) =>
    request<any>('/recurring-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRecurringRule: (id: number, data: Partial<{ label: string; active: boolean; expectedAmount: number; nextExpectedDate: string }>) =>
    request<any>(`/recurring-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRecurringRule: (id: number) => request<void>(`/recurring-rules/${id}`, { method: 'DELETE' }),

  // ─── Merchants ───────────────────────────────────────────────────────────
  listMerchants: () => request<MerchantSummary[]>('/merchants'),
  getFrequent: () => request<MerchantSummary[]>('/merchants/frequent'),
  getMerchantTransactions: (name: string) =>
    request<Transaction[]>(`/merchants/${encodeURIComponent(name)}/transactions`),
  getMerchantRanking: (from?: string, to?: string, limit?: number) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from_date', from);
    if (to) qs.set('to_date', to);
    if (limit) qs.set('limit', String(limit));
    return request<MerchantSummary[]>(`/merchants/ranking?${qs}`);
  },

  // ─── Reports ─────────────────────────────────────────────────────────────
  generateReport: (from: string, to: string) =>
    request<{ data: SavedReport }>(`/reports/generate?from_date=${from}&to_date=${to}`, { method: 'POST' }),
  listSavedReports: () => request<SavedReport[]>('/reports/saved'),
  saveReport: (name: string, from_date: string, to_date: string) =>
    request<SavedReport>('/reports/saved', {
      method: 'POST', body: JSON.stringify({ name, from_date, to_date }),
    }),
  deleteSavedReport: (id: number) => request<void>(`/reports/saved/${id}`, { method: 'DELETE' }),

  // ─── AI ──────────────────────────────────────────────────────────────────
  getAISettings: () => request<AISettings>('/settings/ai'),
  saveAISettings: (data: Partial<AISettings> & { groq_api_key?: string; openrouter_api_key?: string; anthropic_api_key?: string }) =>
    request<AISettings>('/settings/ai', { method: 'PUT', body: JSON.stringify(data) }),
  askAI: (question: string, from_date?: string, to_date?: string) =>
    request<{ answer: string }>('/ai/chat', {
      method: 'POST', body: JSON.stringify({ question, from_date, to_date }),
    }),

  // ─── Budgets ─────────────────────────────────────────────────────────────
  listBudgets: (params?: { year?: number; month?: number }) => {
    const qs = params
      ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()
      : '';
    return request<BudgetStatus[]>(`/budgets/status${qs ? `?${qs}` : ''}`);
  },
  createBudget: (category_id: number, monthly_limit: number) =>
    request<BudgetStatus>('/budgets', { method: 'POST', body: JSON.stringify({ category_id, monthly_limit }) }),
  updateBudget: (id: number, data: { monthly_limit?: number; enabled?: boolean }) =>
    request<BudgetStatus>(`/budgets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBudget: (id: number) => request<void>(`/budgets/${id}`, { method: 'DELETE' }),

  // ─── Billing ─────────────────────────────────────────────────────────────
  getBillingUsage: () => request<BillingUsage>('/billing/usage'),
  getPlans: () => request<Plan[]>('/billing/plans'),
  createCheckout: (plan: string) =>
    request<{ checkout_url: string }>('/billing/checkout', {
      method: 'POST', body: JSON.stringify({ plan }),
    }),
  createPortal: () => request<{ portal_url: string }>('/billing/portal', { method: 'POST' }),
};
