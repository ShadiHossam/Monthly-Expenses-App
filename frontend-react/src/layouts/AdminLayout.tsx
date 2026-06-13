import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import AdminNav from "../components/AdminNav";
import { api } from "../lib/api";
import "../styles/admin.css";

interface AdminUser { username: string; email?: string; role?: string }

export default function AdminLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.me()
      .then((u) => {
        if (u.role !== "admin") {
          navigate("/admin/login", { replace: true });
        } else {
          setUser(u as unknown as AdminUser);
          setReady(true);
        }
      })
      .catch(() => navigate("/admin/login", { replace: true }));
  }, [navigate]);

  if (!ready) return null;

  const initials = (user!.email || user!.username || "A").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await api.logout().catch(() => {});
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">E</div>
          <div>
            <div className="sidebar-logo-text">Expenses</div>
            <div className="sidebar-logo-sub">Admin Panel</div>
          </div>
        </div>

        <AdminNav />

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email">{user!.email || user!.username}</div>
              <div className="sidebar-user-role">Administrator</div>
            </div>
          </div>
          <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <Link
              to="/dashboard"
              className="a-btn a-btn-ghost a-btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              View App
            </Link>
            <button
              onClick={handleSignOut}
              className="a-btn a-btn-ghost a-btn-sm"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
