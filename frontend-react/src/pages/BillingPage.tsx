import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import type { BillingUsage, Plan } from "../types";

const PLAN_ORDER = ["free", "solo", "pro", "business"];

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

function PlanBadge({ plan }: { plan: string }) {
  const cls: Record<string, string> = {
    free:     "bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface-variant dark:text-ve-on-surface-variant",
    solo:     "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    pro:      "bg-ft-primary/10 dark:bg-ve-primary/10 text-ft-primary dark:text-ve-primary",
    business: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  };
  return (
    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full capitalize", cls[plan] ?? cls.free)}>
      {plan}
    </span>
  );
}

export default function BillingPage() {
  const [searchParams] = useSearchParams();
  const [usage, setUsage] = useState<BillingUsage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const justUpgraded = searchParams.get("success") === "1";

  useEffect(() => {
    Promise.all([api.getBillingUsage(), api.getPlans()])
      .then(([u, p]) => { setUsage(u); setPlans(p); })
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(planKey: string) {
    setCheckoutLoading(planKey);
    try {
      const { checkout_url } = await api.createCheckout(planKey);
      window.location.href = checkout_url;
    } catch (e: any) {
      alert(e.message || "Failed to start checkout");
      setCheckoutLoading(null);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const { portal_url } = await api.createPortal();
      window.location.href = portal_url;
    } catch (e: any) {
      alert(e.message || "Could not open billing portal");
      setPortalLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-24"><div className="w-8 h-8 border-4 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const pct = usage ? Math.min(100, (usage.pages_used / usage.pages_limit) * 100) : 0;
  const barColor = !usage || usage.pages_remaining === 0
    ? "bg-red-500 dark:bg-ve-error"
    : pct > 80
    ? "bg-amber-400"
    : "bg-ft-primary dark:bg-ve-primary-dim";

  return (
    <div className="px-6 pt-6 pb-10 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Billing &amp; Usage</h1>
        <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Manage your plan and track page usage</p>
      </div>

      {/* ── Success banner ── */}
      {justUpgraded && (
        <div className="mb-5 bg-ft-primary/5 dark:bg-ve-primary/10 border border-ft-primary/20 dark:border-ve-primary/20 rounded-2xl p-4 flex items-center gap-3">
          <MSIcon name="check_circle" className="text-xl text-ft-primary dark:text-ve-primary shrink-0" />
          <p className="text-sm font-medium text-ft-primary dark:text-ve-primary">Plan upgraded successfully! Your new quota is now active.</p>
        </div>
      )}

      {/* ── Current plan card ── */}
      {usage && (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-bold text-lg text-ft-on-surface dark:text-ve-on-surface capitalize">{usage.plan_label}</span>
                <PlanBadge plan={usage.plan} />
                {usage.status === "past_due" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-ve-error/10 text-red-600 dark:text-ve-error">Past due</span>
                )}
              </div>
              {usage.current_period_end && (
                <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                  Resets {new Date(usage.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
            {usage.plan !== "free" && (
              <button onClick={handlePortal} disabled={portalLoading}
                className="text-sm font-semibold px-3.5 py-2 rounded-xl border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high disabled:opacity-50 transition-colors">
                {portalLoading ? "Opening…" : "Manage"}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-ft-on-surface dark:text-ve-on-surface">Pages used</span>
            <span className={cn("text-sm font-bold tabular-nums", usage.pages_remaining === 0 ? "text-red-500 dark:text-ve-error" : "text-ft-on-surface dark:text-ve-on-surface")}>
              {usage.pages_used} / {usage.pages_limit}
            </span>
          </div>
          <div className="h-2 bg-ft-surface-low dark:bg-ve-surface-high rounded-full overflow-hidden mb-2">
            <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
            {usage.pages_remaining > 0
              ? `${usage.pages_remaining} page${usage.pages_remaining !== 1 ? "s" : ""} remaining this period`
              : usage.overage_enabled
              ? "Overage billing active — additional pages charged at $0.10 each"
              : "Quota reached — upgrade to upload more"}
          </p>
        </div>
      )}

      {/* ── Plan cards ── */}
      <h2 className="text-base font-bold text-ft-on-surface dark:text-ve-on-surface mb-3">
        {usage?.plan === "free" ? "Upgrade your plan" : "Change plan"}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {[...plans].sort((a, b) => PLAN_ORDER.indexOf(a.key) - PLAN_ORDER.indexOf(b.key)).map(plan => {
          const isCurrent = usage?.plan === plan.key;
          const isHigher = PLAN_ORDER.indexOf(plan.key) > PLAN_ORDER.indexOf(usage?.plan ?? "free");
          return (
            <div key={plan.key} className={cn(
              "bg-ft-surface dark:bg-ve-surface border rounded-2xl p-4 flex flex-col gap-3",
              isCurrent
                ? "border-ft-primary dark:border-ve-primary ring-1 ring-ft-primary/20 dark:ring-ve-primary/20"
                : "border-ft-outline-variant dark:border-ve-outline"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ft-on-surface dark:text-ve-on-surface">{plan.label}</span>
                  {isCurrent && <span className="text-xs font-semibold text-ft-primary dark:text-ve-primary">Current</span>}
                </div>
                <div className="text-right">
                  {plan.trial_days > 0 && !isCurrent ? (
                    <>
                      <p className="text-xs font-bold text-ft-primary dark:text-ve-primary">{plan.trial_days}d free</p>
                      <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">${plan.price_usd}/mo after</p>
                    </>
                  ) : (
                    <span className="font-bold text-ft-on-surface dark:text-ve-on-surface">
                      {plan.price_usd === 0 ? "Free" : `$${plan.price_usd}/mo`}
                    </span>
                  )}
                </div>
              </div>
              <ul className="space-y-1.5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                    <MSIcon name="check" className="text-sm text-ft-primary dark:text-ve-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && plan.key !== "free" && (
                <button onClick={() => handleUpgrade(plan.key)} disabled={checkoutLoading === plan.key}
                  className={cn(
                    "w-full py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50",
                    isHigher
                      ? "bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background hover:opacity-90"
                      : "border border-ft-outline-variant dark:border-ve-outline text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high"
                  )}>
                  {checkoutLoading === plan.key
                    ? "Redirecting…"
                    : plan.trial_days > 0 && isHigher
                    ? `Try free for ${plan.trial_days} days`
                    : isHigher ? "Upgrade" : "Switch"}
                </button>
              )}
              {!isCurrent && plan.key === "free" && (
                <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant text-center">Downgrade via billing portal</p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Billing portal ── */}
      {usage?.plan !== "free" && (
        <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <MSIcon name="credit_card" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
            <div>
              <p className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">Billing portal</p>
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Manage invoices, payment method, and cancellation</p>
            </div>
          </div>
          <button onClick={handlePortal} disabled={portalLoading}
            className="text-sm font-semibold text-ft-primary dark:text-ve-primary hover:underline disabled:opacity-50 shrink-0">
            {portalLoading ? "Opening…" : "Open →"}
          </button>
        </div>
      )}

      {/* ── Usage history ── */}
      {usage && usage.usage_logs.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-ft-on-surface dark:text-ve-on-surface mb-3">Usage history</h2>
          <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ft-outline-variant dark:border-ve-outline">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wide">Statement</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wide">Pages</th>
                </tr>
              </thead>
              <tbody>
                {usage.usage_logs.map((log, i) => (
                  <tr key={log.id} className={i < usage.usage_logs.length - 1 ? "border-b border-ft-outline-variant dark:border-ve-outline" : ""}>
                    <td className="px-4 py-3 text-ft-on-surface-variant dark:text-ve-on-surface-variant whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3 text-ft-on-surface dark:text-ve-on-surface">
                      {log.statement_id ? `Statement #${log.statement_id}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ft-on-surface dark:text-ve-on-surface tabular-nums">+{log.pages_consumed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
        Comparing plans?{" "}
        <Link to="/pricing" className="text-ft-primary dark:text-ve-primary hover:underline">View full pricing page</Link>
      </p>
    </div>
  );
}
