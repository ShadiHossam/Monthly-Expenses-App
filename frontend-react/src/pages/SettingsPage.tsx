import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

type AISettings = {
  groq_api_key_set: boolean;
  openrouter_api_key_set: boolean;
  anthropic_api_key_set: boolean;
  ai_provider: string;
  concurrent_processing: number;
};

type KeyField = "groq" | "openrouter" | "anthropic";

const PROVIDERS = [
  { value: "auto",       label: "Auto (try all in order)" },
  { value: "anthropic",  label: "Claude (Anthropic)" },
  { value: "groq",       label: "Groq" },
  { value: "openrouter", label: "OpenRouter" },
];

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function SettingsPage() {
  const navigate = useNavigate();
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
    api.getAISettings().then(s => {
      setAISettings(s);
      setProvider(s.ai_provider);
      setConcurrentLimit((s as any).concurrent_processing ?? 2);
    }).catch(() => {});
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload: any = { ai_provider: provider, concurrent_processing: concurrentLimit };
      if (keys.groq !== "")        payload.groq_api_key = keys.groq;
      if (keys.openrouter !== "")  payload.openrouter_api_key = keys.openrouter;
      if (keys.anthropic !== "")   payload.anthropic_api_key = keys.anthropic;
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
    setShowKey(prev => ({ ...prev, [field]: !prev[field] }));
  }

  const KeyInput = ({ field, label, placeholder, isSet }: { field: KeyField; label: string; placeholder: string; isSet: boolean }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">{label}</label>
        {isSet && <span className="text-xs font-semibold text-ft-primary dark:text-ve-primary">Key saved</span>}
      </div>
      <div className="relative">
        <input
          type={showKey[field] ? "text" : "password"}
          value={keys[field]}
          onChange={e => setKeys(prev => ({ ...prev, [field]: e.target.value }))}
          placeholder={isSet ? "Enter new key to replace…" : placeholder}
          className="w-full text-sm font-mono bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 pr-10 text-ft-on-surface dark:text-ve-on-surface placeholder-ft-on-surface-variant dark:placeholder-ve-on-surface-variant focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary"
        />
        <button type="button" onClick={() => toggleShow(field)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:text-ft-on-surface dark:hover:text-ve-on-surface transition-colors">
          <MSIcon name={showKey[field] ? "visibility_off" : "visibility"} className="text-lg" />
        </button>
      </div>
      {isSet && keys[field] === "" && (
        <button type="button" onClick={() => setKeys(prev => ({ ...prev, [field]: " " }))}
          className="text-xs text-red-500 dark:text-ve-error hover:underline">
          Clear saved key
        </button>
      )}
    </div>
  );

  return (
    <div className="px-6 pt-6 pb-10 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Preferences</h1>
        <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Manage your account and AI configuration</p>
      </div>

      {/* ── Account ── */}
      <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden mb-4">
        <div className="px-5 py-4 border-b border-ft-outline-variant dark:border-ve-outline flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ft-primary/10 dark:bg-ve-primary/10 flex items-center justify-center shrink-0">
            <MSIcon name="person" className="text-xl text-ft-primary dark:text-ve-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-ft-on-surface dark:text-ve-on-surface truncate">{user?.username ?? "—"}</p>
            {user?.email && <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant truncate">{user.email}</p>}
          </div>
        </div>
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">User ID</span>
          <span className="text-xs font-mono text-ft-on-surface dark:text-ve-on-surface">#{user?.id}</span>
        </div>
      </div>

      {/* ── AI Configuration ── */}
      <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-4 space-y-5">
        <p className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wider">AI Configuration</p>

        {/* Provider preference */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant block">Preferred Provider</label>
          <select value={provider} onChange={e => setProvider(e.target.value)}
            className="w-full text-sm bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-ft-on-surface dark:text-ve-on-surface focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary">
            {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
            Auto tries Claude → Groq → OpenRouter in order, skipping missing keys.
          </p>
        </div>

        {/* Concurrency slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">Concurrent Processing</label>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface">{concurrentLimit}</span>
          </div>
          <input type="range" min={1} max={10} value={concurrentLimit}
            onChange={e => setConcurrentLimit(Number(e.target.value))}
            className="w-full accent-ft-primary dark:accent-ve-primary" />
          <div className="flex justify-between text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
            <span>1 (safest)</span>
            <span>10 (fastest)</span>
          </div>
          <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
            How many uploads process in parallel. Lower values prevent Groq rate limits.
          </p>
        </div>

        {/* API Keys */}
        <div className="border-t border-ft-outline-variant dark:border-ve-outline pt-4 space-y-4">
          <KeyInput field="anthropic" label="Anthropic API Key (Claude)" placeholder="sk-ant-…" isSet={aiSettings?.anthropic_api_key_set ?? false} />
          <KeyInput field="groq"      label="Groq API Key"              placeholder="gsk_…"    isSet={aiSettings?.groq_api_key_set ?? false} />
          <KeyInput field="openrouter" label="OpenRouter API Key"       placeholder="sk-or-…"  isSet={aiSettings?.openrouter_api_key_set ?? false} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-500 dark:text-ve-error">
            <MSIcon name="error" className="text-base" />
            {error}
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          className={cn(
            "w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50",
            saved
              ? "bg-ft-primary/10 dark:bg-ve-primary/10 text-ft-primary dark:text-ve-primary"
              : "bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background hover:opacity-90"
          )}>
          {saving ? "Saving…" : saved ? "Saved!" : "Save Settings"}
        </button>

        <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
          Keys are stored securely on the server and never exposed to the browser.
        </p>
      </div>

      {/* ── Install PWA ── */}
      <div className="bg-ft-primary/5 dark:bg-ve-primary/10 border border-ft-primary/20 dark:border-ve-primary/20 rounded-2xl p-5 mb-4">
        <div className="flex items-start gap-3">
          <MSIcon name="install_mobile" className="text-xl text-ft-primary dark:text-ve-primary mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-ft-primary dark:text-ve-primary mb-1">Install on iPhone</p>
            <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">Open in Safari → tap the Share button → "Add to Home Screen"</p>
          </div>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl overflow-hidden mb-4">
        <a href="/analytics"
          className="flex items-center gap-3 px-5 py-4 border-b border-ft-outline-variant dark:border-ve-outline hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
          <MSIcon name="download" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          <span className="text-sm text-ft-on-surface dark:text-ve-on-surface">Export all data (CSV)</span>
          <MSIcon name="chevron_right" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant ml-auto" />
        </a>
        <a href="/upload"
          className="flex items-center gap-3 px-5 py-4 hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors">
          <MSIcon name="upload" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant" />
          <span className="text-sm text-ft-on-surface dark:text-ve-on-surface">Upload statement</span>
          <MSIcon name="chevron_right" className="text-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant ml-auto" />
        </a>
      </div>

      {/* ── Log out ── */}
      <button onClick={logout}
        className="w-full py-3 flex items-center justify-center gap-2 bg-red-50 dark:bg-ve-error/10 text-red-600 dark:text-ve-error border border-red-100 dark:border-ve-error/20 rounded-2xl text-sm font-semibold hover:bg-red-100 dark:hover:bg-ve-error/20 transition-colors">
        <MSIcon name="logout" className="text-lg" />
        Log Out
      </button>
    </div>
  );
}
