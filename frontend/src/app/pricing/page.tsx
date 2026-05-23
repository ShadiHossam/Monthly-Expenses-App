"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Plan } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

const PLAN_ORDER = ["free", "solo", "pro", "business"];
const POPULAR = "pro";

const FAQS = [
  {
    q: "What counts as a page?",
    a: "Each image file (PNG, JPG) counts as 1 page. PDFs are split by page — a 3-page PDF costs 3 pages from your quota.",
  },
  {
    q: "What happens when I hit my limit?",
    a: "Uploads are blocked until the next billing period (or you upgrade). Business plan users can approve overage charges per-upload at $0.10/page.",
  },
  {
    q: "Do unused pages roll over?",
    a: "No — your quota resets on your billing anniversary each month.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel through the billing portal — you keep access until the end of your paid period, then drop to Free.",
  },
  {
    q: "Which banks are supported?",
    a: "Currently optimized for UAE banks (AED statements). Other formats may work if the layout is similar.",
  },
];

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
    fetch(`${API_BASE}/billing/plans`)
      .then(r => r.json())
      .then(data => setPlans(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.key) - PLAN_ORDER.indexOf(b.key));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-slate-900">Expenses</span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign in</Link>
                <Link href="/register" className="text-sm font-semibold bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-14">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            30-day free trial · No credit card required
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto">
            Pay only for what you process. Each image or PDF page costs one credit from your monthly quota.
          </p>
        </div>

        {/* Plan cards */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14">
            {sorted.map(plan => {
              const isPopular = plan.key === POPULAR;
              const ctaHref = isLoggedIn ? "/billing" : "/register";
              const hasTrial = plan.trial_days > 0;
              const ctaLabel = plan.key === "free"
                ? (isLoggedIn ? "Current plan" : "Get started free")
                : hasTrial
                ? `Try free for ${plan.trial_days} days`
                : isLoggedIn ? "Upgrade" : "Get started";
              return (
                <div
                  key={plan.key}
                  className={`relative bg-white rounded-2xl border flex flex-col p-6 ${isPopular ? "border-emerald-400 shadow-md ring-1 ring-emerald-200" : "border-gray-100"}`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">Most popular</span>
                    </div>
                  )}
                  <div className="mb-4">
                    <h2 className="font-bold text-slate-900 text-lg mb-1">{plan.label}</h2>
                    {plan.trial_days > 0 ? (
                      <>
                        <div className="text-2xl font-extrabold text-emerald-600 mb-0.5">
                          {plan.trial_days} days free
                        </div>
                        <p className="text-sm text-slate-400">then ${plan.price_usd}/month</p>
                        <p className="text-xs text-slate-400 mt-0.5">No credit card required</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-extrabold text-slate-900">
                            {plan.price_usd === 0 ? "Free" : `$${plan.price_usd}`}
                          </span>
                          {plan.price_usd > 0 && <span className="text-sm text-slate-400 mb-1">/month</span>}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{plan.pages} pages/month</p>
                      </>
                    )}
                    {plan.overage && (
                      <p className="text-xs text-slate-400 mt-0.5">+ $0.10 per extra page</p>
                    )}
                  </div>

                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                        <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={ctaHref}
                    className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${isPopular ? "bg-emerald-500 text-white hover:bg-emerald-600" : plan.key === "free" ? "border border-gray-200 text-slate-600 hover:bg-gray-50" : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}
                  >
                    {ctaLabel}
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Feature comparison table */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-14">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-semibold text-slate-600">Feature</th>
                {sorted.map(p => (
                  <th key={p.key} className="text-center px-3 py-3 font-semibold text-slate-600 capitalize">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Pages / month", values: sorted.map(p => p.pages.toLocaleString()) },
                { label: "Concurrent uploads", values: sorted.map(p => String(p.concurrent)) },
                { label: "OCR + AI extraction", values: sorted.map(() => "✓") },
                { label: "AI chat assistant", values: sorted.map(p => p.ai_chat ? "✓" : "—") },
                { label: "Analytics & reports", values: sorted.map(() => "✓") },
                { label: "Overage uploads", values: sorted.map(p => p.overage ? "$0.10/page" : "—") },
                { label: "PWA (installable)", values: sorted.map(() => "✓") },
              ].map((row, ri) => (
                <tr key={row.label} className={ri % 2 === 0 ? "" : "bg-gray-50"}>
                  <td className="px-5 py-3 font-medium text-slate-700">{row.label}</td>
                  {row.values.map((v, vi) => (
                    <td key={vi} className={`text-center px-3 py-3 ${v === "✓" ? "text-emerald-500 font-bold" : v === "—" ? "text-slate-300" : "text-slate-600"}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {FAQS.map(faq => (
              <div key={faq.q} className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-semibold text-slate-900 mb-1.5">{faq.q}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-14 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Ready to get started?</h2>
          <p className="text-slate-500 mb-6 text-sm">Start free — no credit card required.</p>
          <Link href="/register" className="inline-block px-8 py-3.5 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors">
            Create free account
          </Link>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} Expenses &middot; <Link href="/login" className="hover:underline">Sign in</Link>
      </footer>
    </div>
  );
}
