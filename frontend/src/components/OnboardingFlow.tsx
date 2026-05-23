/**
 * OnboardingFlow — 3-step first-time user modal.
 *
 * Usage: render in the dashboard when there are no statements yet:
 *
 *   const [showOnboarding, setShowOnboarding] = useState(
 *     () => localStorage.getItem("onboarding_done") !== "1"
 *   );
 *   // pass `open={showOnboarding && statements.length === 0}`
 *   <OnboardingFlow open={showOnboarding && statements.length === 0} onClose={() => setShowOnboarding(false)} />
 */
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
};

const STEPS = [
  {
    title: "Welcome to Expense Tracker",
    body: "Upload your UAE bank statement screenshots and get full financial insights automatically.",
    cta: "Get Started →",
  },
  {
    title: "Upload Your Statement",
    body: "Take a screenshot of your bank statement and upload it. We support FAB, ENBD, ADCB, and more.",
    cta: "Continue →",
  },
  {
    title: "You're all set!",
    body: "Your transactions will be categorized automatically. Visit Analytics to explore your spending.",
    cta: null,
  },
];

export default function OnboardingFlow({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const router = useRouter();

  // Reset to step 0 each time the modal opens
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  function dismiss() {
    localStorage.setItem("onboarding_done", "1");
    onClose();
  }

  function handleCta() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  }

  function goToUpload() {
    dismiss();
    router.push("/upload");
  }

  function goToDashboard() {
    dismiss();
    router.push("/dashboard");
  }

  if (!open) return null;

  const current = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center">
        {/* Skip link */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Skip
        </button>

        {/* Icon area */}
        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6">
          {step === 0 && (
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          )}
          {step === 1 && (
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          )}
          {step === 2 && (
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          )}
        </div>

        {/* Text */}
        <h2 className="text-xl font-bold text-slate-900 mb-3">{current.title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed mb-8">{current.body}</p>

        {/* Actions */}
        {step < 2 ? (
          <button
            onClick={handleCta}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-2xl transition-colors text-sm"
          >
            {current.cta}
          </button>
        ) : (
          <div className="flex gap-3 w-full">
            <button
              onClick={goToUpload}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-2xl transition-colors text-sm"
            >
              Upload Statement
            </button>
            <button
              onClick={goToDashboard}
              className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-slate-700 font-semibold rounded-2xl transition-colors text-sm"
            >
              Explore Dashboard
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex gap-2 mt-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all ${i === step ? "w-5 h-2 bg-emerald-500" : "w-2 h-2 bg-gray-200 hover:bg-gray-300"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
