import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import "../styles/admin.css";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username, password);
      if ((res.user as any).role !== "admin") {
        // Login already set the session cookie server-side — it must be torn down
        // before we tell the user "Access denied", or a non-admin ends up silently
        // signed into the regular app behind an error message. Retry logout since
        // a transient failure here would otherwise leave that stale session.
        let loggedOut = false;
        for (let attempt = 0; attempt < 3 && !loggedOut; attempt++) {
          try {
            await api.logout();
            loggedOut = true;
          } catch {
            // retry
          }
        }
        setError(
          loggedOut
            ? "Access denied. Admin accounts only."
            : "Access denied. Admin accounts only. (Could not confirm sign-out — please clear cookies for this site before trying again.)"
        );
        return;
      }
      navigate("/admin", { replace: true });
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="admin-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "#0a0f1a",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #00e3fd, #006875)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem",
              fontWeight: 800,
              fontSize: "1.25rem",
              color: "#0a0f1a",
            }}
          >
            E
          </div>
          <div style={{ fontWeight: 800, fontSize: "1.25rem", color: "#e2e8f0" }}>
            Expenses Admin
          </div>
          <div style={{ color: "#64748b", fontSize: "0.8125rem", marginTop: 4 }}>
            Sign in to the admin panel
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "1.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#f87171",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                fontSize: "0.8125rem",
              }}
            >
              {error}
            </div>
          )}

          <div className="a-form-group">
            <label className="a-form-label">Username</label>
            <input
              className="a-form-input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="admin username"
              required
            />
          </div>

          <div className="a-form-group">
            <label className="a-form-label">Password</label>
            <input
              className="a-form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="a-btn a-btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
