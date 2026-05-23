"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type AISettings = {
  groq_api_key_set: boolean;
  openrouter_api_key_set: boolean;
  anthropic_api_key_set: boolean;
  ai_provider: string;
  concurrent_processing: number;
};

type KeyField = "groq" | "openrouter" | "anthropic";

const PROVIDERS = [
  { value: "auto", label: "Auto (try all in order)" },
  { value: "anthropic", label: "Claude (Anthropic)" },
  { value: "groq", label: "Groq" },
  { value: "openrouter", label: "OpenRouter" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [aiSettings, setAISettings] = useState<AISettings | null>(null);
  const [keys, setKeys] = useState({ groq: "", openrouter: "", anthropic: "" });
  const [provider, setProvider] = useState("auto");
  const [concurrentLimit, setConcurrentLimit] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState<Record<KeyField, boolean>>({ groq: false, openrouter: false, anthropic: false });

  useEffect(() => {
    const u = localStorage.getItem("user");
    if (u) setUser(JSON.parse(u));
    api.getAISettings().then((s) => {
      setAISettings(s);
      setProvider(s.ai_provider);
      setConcurrentLimit(s.concurrent_processing ?? 2);
    }).catch(() => {});
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload: any = { ai_provider: provider, concurrent_processing: concurrentLimit };
      if (keys.groq !== "") payload.groq_api_key = keys.groq;
      if (keys.openrouter !== "") payload.openrouter_api_key = keys.openrouter;
      if (keys.anthropic !== "") payload.anthropic_api_key = keys.anthropic;
      const updated = await api.saveAISettings(payload);
      setAISettings(updated);
      setKeys({ groq: "", openrouter: "", anthropic: "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function toggleShow(field: KeyField) {
    setShowKey((prev) => ({ ...prev, [field]: !prev[field] }));
  }

  const KeyInput = ({
    field,
    label,
    placeholder,
    isSet,
  }: {
    field: KeyField;
    label: string;
    placeholder: string;
    isSet: boolean;
  }) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-slate-600">{label}</label>
        {isSet && (
          <span className="text-xs text-emerald-500 font-medium">Key saved</span>
        )}
      </div>
      <div className="relative">
        <input
          type={showKey[field] ? "text" : "password"}
          value={keys[field]}
          onChange={(e) => setKeys((prev) => ({ ...prev, [field]: e.target.value }))}
          placeholder={isSet ? "Enter new key to replace…" : placeholder}
          className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:border-slate-400 font-mono"
        />
        <button
          type="button"
          onClick={() => toggleShow(field)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {showKey[field] ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
      {isSet && keys[field] === "" && (
        <button
          type="button"
          onClick={() => setKeys((prev) => ({ ...prev, [field]: " " }))}
          className="mt-1 text-xs text-red-400 hover:text-red-600"
        >
          Clear saved key
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-slate-900 mb-6">Settings</h1>

      {/* Account */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Account</p>
          <p className="text-sm font-semibold text-slate-900">{user?.username}</p>
          {user?.email && <p className="text-xs text-slate-400">{user.email}</p>}
        </div>
        <div className="px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">User ID</p>
          <p className="text-sm font-mono text-slate-600">#{user?.id}</p>
        </div>
      </div>

      {/* AI Configuration */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-4">AI Configuration</p>

        {/* Provider preference */}
        <div className="mb-5">
          <label className="text-xs font-medium text-slate-600 block mb-1">Preferred Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-slate-400"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Auto tries Claude → Groq → OpenRouter in order, skipping missing keys.
          </p>
        </div>

        {/* Concurrent processing limit */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-600">Concurrent Processing</label>
            <span className="text-xs font-semibold text-slate-700 bg-gray-100 px-2 py-0.5 rounded-lg">{concurrentLimit}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={concurrentLimit}
            onChange={e => setConcurrentLimit(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>1 (safest, slowest)</span>
            <span>10 (fastest, rate-limit risk)</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            How many uploads process in parallel. Lower values prevent Groq rate limits when uploading many images at once.
          </p>
        </div>

        <div className="border-t border-gray-50 pt-4">
          <KeyInput
            field="anthropic"
            label="Anthropic API Key (Claude)"
            placeholder="sk-ant-…"
            isSet={aiSettings?.anthropic_api_key_set ?? false}
          />
          <KeyInput
            field="groq"
            label="Groq API Key"
            placeholder="gsk_…"
            isSet={aiSettings?.groq_api_key_set ?? false}
          />
          <KeyInput
            field="openrouter"
            label="OpenRouter API Key"
            placeholder="sk-or-…"
            isSet={aiSettings?.openrouter_api_key_set ?? false}
          />
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
            saved
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-900 text-white hover:bg-slate-700"
          } disabled:opacity-50`}
        >
          {saving ? "Saving…" : saved ? "Saved!" : "Save AI Settings"}
        </button>

        <p className="text-xs text-slate-400 mt-3">
          Keys are stored securely on the server and never exposed to the browser. Your keys take priority over server defaults.
        </p>
      </div>

      {/* Install PWA */}
      <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 mb-4">
        <p className="text-sm font-semibold text-emerald-800 mb-2">Install on iPhone</p>
        <p className="text-xs text-emerald-700">Open this app in Safari → tap the Share button → "Add to Home Screen"</p>
      </div>

      {/* Data */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <a href="/analytics" className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 hover:bg-gray-50">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          <span className="text-sm text-slate-700">Export all data (CSV)</span>
        </a>
        <a href="/upload" className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          <span className="text-sm text-slate-700">Upload statement</span>
        </a>
      </div>

      <button onClick={logout}
        className="w-full py-3.5 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold hover:bg-red-100 transition-colors">
        Log Out
      </button>
    </div>
  );
}
