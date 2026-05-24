export interface User {
  id: number;
  username: string;
  email?: string;
}

export interface Statement {
  id: number;
  user_id: number;
  filename?: string;
  image_path?: string;
  period_start?: string;
  period_end?: string;
  opening_balance?: number;
  closing_balance?: number;
  verify_status: "pending" | "passed" | "failed" | "flagged";
  verify_errors?: string[];
  confidence?: number;
  ocr_engine: string;
  created_at: string;
  transaction_count: number;
}

export interface Transaction {
  id: number;
  user_id: number;
  statement_id: number;
  txn_date: string;
  ref_number?: string;
  description: string;
  merchant_name?: string;
  amount: number;
  txn_type: "debit" | "credit";
  balance_after?: number;
  category_id?: number;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  is_categorized: boolean;
  created_at: string;
}

export interface PageResponse<T> {
  content: T[];
  total_elements: number;
  total_pages: number;
  size: number;
  number: number;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_system: boolean;
  transaction_count?: number;
}

export interface MerchantRule {
  id: number;
  pattern: string;
  pattern_type: "contains" | "startswith" | "regex";
  category_id: number;
  priority: number;
}

export interface MerchantAlias {
  id: number;
  raw_name: string;
  display_name: string;
}

export interface MerchantSummary {
  merchant_name: string;
  visit_count: number;
  total_spend: number;
}

export interface Summary {
  total_debits: number;
  total_credits: number;
  net: number;
  closing_balance?: number;
  transaction_count: number;
  biggest_expense?: {
    merchant_name: string;
    amount: number;
    date: string;
  };
}

export interface MonthData {
  month: number;
  month_name: string;
  year: number;
  debits: number;
  credits: number;
}

export interface CategoryBreakdown {
  category_id: number | null;
  category_name: string;
  category_color: string;
  total: number;
  percentage: number;
  transaction_count: number;
}

export interface FrequentPlace {
  merchant_name: string;
  visit_count: number;
  total_spend: number;
}

export interface RecurringItem {
  merchant_name: string;
  frequency: string;
  occurrence_count: number;
  avg_amount: number;
  last_date: string;
}

export interface BalanceTrendPoint {
  date: string;
  balance: number;
}

export interface MonthComparison {
  month: number;
  year: number;
  month_name: string;
  debits: number;
  credits: number;
}

export interface QAPending {
  merchant_name: string;
  transaction_count: number;
  total_amount: number;
  transaction_ids: number[];
  suggested_category_id?: number;
  suggested_new_category?: string | null;
  confidence: number;
}

export interface UsageLog {
  id: number;
  statement_id?: number;
  pages_consumed: number;
  action: string;
  created_at: string;
}

export interface BillingUsage {
  plan: string;
  plan_label: string;
  status: "active" | "past_due" | "canceled";
  pages_used: number;
  pages_limit: number;
  pages_remaining: number;
  overage_enabled: boolean;
  current_period_start?: string;
  current_period_end?: string;
  usage_logs: UsageLog[];
}

export interface Plan {
  key: string;
  label: string;
  price_usd: number;
  pages: number;
  concurrent: number;
  overage: boolean;
  overage_price_usd?: number;
  ai_chat: boolean;
  trial_days: number;
  features: string[];
}

export interface QuotaError {
  message: string;
  plan: string;
  pages_used: number;
  pages_limit: number;
  pages_needed: number;
  upgrade_url: string;
}

export interface OverageConfirmation {
  message: string;
  overage_confirmation_required: true;
  overage_pages: number;
  overage_cost_usd: number;
  plan: string;
}

export interface AISettings {
  groq_api_key_set: boolean;
  openrouter_api_key_set: boolean;
  anthropic_api_key_set: boolean;
  ai_provider: string;
  concurrent_processing: number;
}

export interface BudgetStatus {
  id: number;
  category_id: number;
  category_name: string;
  category_color: string;
  monthly_limit: number;
  current_spend: number;
  percentage: number;
  enabled: boolean;
}

export interface SavedReport {
  id: number;
  name: string;
  from_date: string;
  to_date: string;
  created_at: string;
}
