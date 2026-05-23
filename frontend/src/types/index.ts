export interface User {
  id: number;
  username: string;
  email?: string;
}

export interface Statement {
  id: number;
  filename?: string;
  period_start?: string;
  period_end?: string;
  opening_balance?: number;
  closing_balance?: number;
  verify_status: "pending" | "passed" | "failed" | "flagged";
  verify_errors?: string[];
  confidence?: number;
  ocr_engine: string;
  created_at: string;
}

export interface Transaction {
  id: number;
  statement_id: number;
  txn_date: string;
  ref_number?: string;
  description: string;
  merchant_name?: string;
  amount: number;
  txn_type: "debit" | "credit";
  balance_after?: number;
  category_id?: number;
  is_categorized: boolean;
  created_at: string;
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

export interface Summary {
  total_debits: number;
  total_credits: number;
  net: number;
  transaction_count: number;
  opening_balance?: number;
  closing_balance?: number;
  top_categories: { name: string; amount: number }[];
  biggest_expense?: { description: string; amount: number; date: string };
}

export interface MonthData {
  month: number;
  month_label: string;
  total_debits: number;
  total_credits: number;
  net: number;
  transaction_count: number;
  by_category: Record<string, number>;
}

export interface FrequentPlace {
  merchant_name: string;
  visit_count: number;
  total_spend: number;
  avg_spend: number;
  last_visit: string;
  frequency_reason: string;
}

export interface QAPending {
  merchant_name: string;
  sample_description: string;
  transaction_count: number;
  total_amount: number;
  transaction_ids: number[];
  suggested_category_id?: number;
  suggested_category_name?: string;
  suggested_confidence?: number;
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
