"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { BillingUsage, Plan } from "@/types";

const PLAN_ORDER = ["free", "solo", "pro", "business"];

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    solo: "bg-blue-100 text-blue-700",
    pro: "bg-emerald-100 text-emerald-700",
    business: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${colors[plan] ?? "bg-gray-100 text-gray-600"}`}>
      {plan}
    </span>
  );
}

export default function BillingPage() {
  const searchParams = useSearchParams();
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
    return (
      <div className="max-w-2xl mx-auto px-4 pt-16 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  const pct = usage ? Math.min(100, (usage.pages_used / usage.pages_limit) * 100) : 0;
  const barColor = !usage || usage.pages_remaining === 0 ? "bg-red-400" : pct > 80 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-16">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Billing & Usage</h1>

      {/* Success banner */}
      {justUpgraded && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-emerald-700">Plan upgraded successfully! Your new quota is now active.</p>
        </div>
      )}

      {/* Current plan card */}
      {usage && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-slate-900 text-lg capitalize">{usage.plan_label}</span>
                <PlanBadge plan={usage.plan} />
                {usage.status === "past_due" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Past due</span>
                )}
              </div>
              {usage.current_period_end && (
                <p className="text-xs text-slate-400">
                  Resets {new Date(usage.current_period_end).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
            {usage.plan !== "free" && (
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="text-sm font-medium text-slate-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {portalLoading ? "Opening…" : "Manage"}
              </button>
            )}
          </div>

          {/* Pages usage */}
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">Pages used</span>
            <span className={`font-bold ${usage.pages_remaining === 0 ? "text-red-500" : "text-slate-700"}`}>
              {usage.pages_used} / {usage.pages_limit}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 mb-3">
            <div className={`h-2.5 rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-400">
            {usage.pages_remaining > 0
              ? `${usage.pages_remaining} page${usage.pages_remaining !== 1 ? "s" : ""} remaining this period`
              : usage.overage_enabled
              ? "Overage billing active — additional pages charged at $0.10 each"
              : "Quota reached — upgrade to upload more"}
          </p>
        </div>
      )}

      {/* Plan cards */}
      <h2 className="text-base font-bold text-slate-900 mb-3">
        {usage?.plan === "free" ? "Upgrade your plan" : "Change plan"}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {[...plans].sort((a, b) => PLAN_ORDER.indexOf(a.key) - PLAN_ORDER.indexOf(b.key)).map(plan => {
          const isCurrent = usage?.plan === plan.key;
          const isHigher = PLAN_ORDER.indexOf(plan.key) > PLAN_ORDER.indexOf(usage?.plan ?? "free");
          return (
            <div
              key={plan.key}
              className={`bg-white rounded-2xl border p-4 flex flex-col gap-3 ${isCurrent ? "border-emerald-300 ring-1 ring-emerald-200" : "border-gray-100"}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900">{plan.label}</span>
                  {isCurrent && <span className="ml-2 text-xs text-emerald-600 font-semibold">Current</span>}
                </div>
                <div className="text-right">
                  {plan.trial_days > 0 && !isCurrent ? (
                    <>
                      <p className="text-xs font-bold text-emerald-600">{plan.trial_days}d free</p>
                      <p className="text-xs text-slate-400">${plan.price_usd}/mo after</p>
                    </>
                  ) : (
                    <span className="font-bold text-slate-900">
                      {plan.price_usd === 0 ? "Free" : `$${plan.price_usd}/mo`}
                    </span>
                  )}
                </div>
              </div>
              <ul className="space-y-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && plan.key !== "free" && (
                <button
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={checkoutLoading === plan.key}
                  className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors ${isHigher ? "bg-emerald-500 text-white hover:bg-emerald-600" : "border border-gray-200 text-slate-600 hover:bg-gray-50"} disabled:opacity-50`}
                >
                  {checkoutLoading === plan.key
                    ? "Redirecting…"
                    : plan.trial_days > 0 && isHigher
                    ? `Try free for ${plan.trial_days} days`
                    : isHigher ? "Upgrade" : "Switch"}
                </button>
              )}
              {!isCurrent && plan.key === "free" && (
                <p className="text-xs text-slate-400 text-center">Downgrade via billing portal</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Billing portal */}
      {usage?.plan !== "free" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-800 text-sm">Billing portal</p>
            <p className="text-xs text-slate-400">Manage invoices, payment method, and cancellation</p>
          </div>
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="text-sm font-semibold text-emerald-600 hover:underline disabled:opacity-50"
          >
            {portalLoading ? "Opening…" : "Open →"}
          </button>
        </div>
      )}

      {/* Usage history */}
      {usage && usage.usage_logs.length > 0 && (
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-3">Usage history</h2>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Statement</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Pages</th>
                </tr>
              </thead>
              <tbody>
                {usage.usage_logs.map((log, i) => (
                  <tr key={log.id} className={i < usage.usage_logs.length - 1 ? "border-b border-gray-50" : ""}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {log.statement_id ? `Statement #${log.statement_id}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">+{log.pages_consumed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pricing link for non-subscribers */}
      <p className="mt-6 text-center text-xs text-slate-400">
        Comparing plans?{" "}
        <Link href="/pricing" className="text-emerald-600 hover:underline">View full pricing page</Link>
      </p>
    </div>
  );
}
