import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  // Profile state
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [gmailStatus, setGmailStatus] = useState<{
    connected: boolean;
    gmail_email: string | null;
    sync_days: string;
    senders: { id: number; sender_email: string }[];
  } | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailSyncResult, setGmailSyncResult] = useState<string | null>(null);
  const [newSender, setNewSender] = useState("");

  const loadGmailStatus = async () => {
    try {
      const s = await api.getGmailStatus();
      setGmailStatus(s);
    } catch { /* not critical */ }
  };

  useEffect(() => {
    api.me().then(u => { setUser(u); setProfileEmail(u.email ?? ""); }).catch(() => {});
    loadGmailStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      setGmailSyncResult("Gmail connected successfully!");
      window.history.replaceState({}, "", "/settings");
    } else if (params.get("gmail") === "error") {
      setGmailSyncResult("Gmail connection failed. Please try again.");
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  async function handleProfileSave() {
    setProfileSaving(true); setProfileError(""); setProfileSaved(false);
    try {
      const payload: any = {};
      if (profileEmail !== user?.email) payload.email = profileEmail;
      if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }
      await api.updateProfile(payload);
      setProfileSaved(true);
      setCurrentPassword(""); setNewPassword("");
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    try {
      await api.deleteAccount("DELETE");
      navigate("/login");
    } catch (err: any) {
      setProfileError(err.message);
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    navigate("/login");
  }

  const handleGmailConnect = async () => {
    setGmailLoading(true);
    try {
      const { url } = await api.getGmailConnectUrl();
      window.location.href = url;
    } finally {
      setGmailLoading(false);
    }
  };

  const handleGmailDisconnect = async () => {
    setGmailLoading(true);
    try {
      await api.disconnectGmail();
      await loadGmailStatus();
    } finally {
      setGmailLoading(false);
    }
  };

  const handleGmailSync = async () => {
    setGmailSyncing(true);
    setGmailSyncResult(null);
    try {
      const { imported } = await api.syncGmail();
      setGmailSyncResult(
        imported > 0 ? `Imported ${imported} statement(s)!` : "No new statements found."
      );
      if (imported > 0) loadGmailStatus();
    } catch (e: any) {
      setGmailSyncResult("Sync failed: " + (e.message || "unknown error"));
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleAddSender = async () => {
    if (!newSender.trim()) return;
    await api.addGmailSender(newSender.trim());
    setNewSender("");
    await loadGmailStatus();
  };

  const handleRemoveSender = async (id: number) => {
    await api.removeGmailSender(id);
    await loadGmailStatus();
  };

  return (
    <div className="px-6 pt-6 pb-10 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Preferences</h1>
        <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-0.5">Manage your account</p>
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

      {/* ── Profile Edit ── */}
      <div className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 mb-4 space-y-4">
        <p className="text-xs font-semibold text-ft-on-surface-variant dark:text-ve-on-surface-variant uppercase tracking-wider">Change Credentials</p>
        {profileError && <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{profileError}</p>}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant block">Email</label>
          <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)}
            className="w-full text-sm bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-ft-on-surface dark:text-ve-on-surface focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant block">Current password</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
            placeholder="Required to change password"
            className="w-full text-sm bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-ft-on-surface dark:text-ve-on-surface focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant block">New password</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            placeholder="Leave blank to keep current"
            className="w-full text-sm bg-ft-surface-low dark:bg-ve-surface-high border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2.5 text-ft-on-surface dark:text-ve-on-surface focus:outline-none focus:ring-2 focus:ring-ft-primary dark:focus:ring-ve-primary" />
        </div>
        <button onClick={handleProfileSave} disabled={profileSaving}
          className="px-4 py-2 bg-ft-primary dark:bg-ve-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
          {profileSaving ? "Saving…" : profileSaved ? "Saved!" : "Save changes"}
        </button>
        <hr className="border-ft-outline-variant dark:border-ve-outline" />
        <button onClick={() => setShowDeleteModal(true)}
          className="text-red-500 dark:text-red-400 text-sm underline">
          Delete account
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ft-surface dark:bg-ve-surface rounded-2xl p-6 max-w-sm w-full mx-4 border border-ft-outline-variant dark:border-ve-outline">
            <h3 className="font-bold text-lg text-ft-on-surface dark:text-ve-on-surface mb-2">Delete account?</h3>
            <p className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mb-4">
              This permanently deletes all your data. Type <strong>DELETE</strong> to confirm.
            </p>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full border border-ft-outline-variant dark:border-ve-outline rounded-xl px-3 py-2 text-sm mb-4 bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface" />
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}
                className="flex-1 border border-ft-outline-variant dark:border-ve-outline rounded-xl py-2 text-sm text-ft-on-surface dark:text-ve-on-surface">Cancel</button>
              <button onClick={handleDeleteAccount} disabled={deleteConfirm !== "DELETE"}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-40">Delete</button>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Gmail Auto-Import ── */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">mail</span>
          <h2 className="font-semibold text-zinc-800 dark:text-zinc-100">Gmail Auto-Import</h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Connect your Gmail to automatically import bank statement attachments.
        </p>

        {gmailSyncResult && (
          <p className="text-sm text-green-600 dark:text-green-400">{gmailSyncResult}</p>
        )}

        {!gmailStatus?.connected ? (
          <button
            onClick={handleGmailConnect}
            disabled={gmailLoading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {gmailLoading ? "Redirecting…" : "Connect Gmail"}
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Connected as <span className="font-medium">{gmailStatus.gmail_email}</span>
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Bank sender addresses</p>
              {gmailStatus.senders.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800 px-3 py-2 rounded-lg">
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{s.sender_email}</span>
                  <button
                    onClick={() => handleRemoveSender(s.id)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newSender}
                  onChange={e => setNewSender(e.target.value)}
                  placeholder="e.g. statements@enbd.com"
                  className="flex-1 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={handleAddSender}
                  className="px-3 py-2 rounded-lg bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-sm font-medium hover:opacity-80"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleGmailSync}
                disabled={gmailSyncing}
                className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:opacity-80 disabled:opacity-50"
              >
                {gmailSyncing ? "Syncing…" : "Sync Now"}
              </button>
              <button
                onClick={handleGmailDisconnect}
                disabled={gmailLoading}
                className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Disconnect Gmail
              </button>
            </div>
          </div>
        )}
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
