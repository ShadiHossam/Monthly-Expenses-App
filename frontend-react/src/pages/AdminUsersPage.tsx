import { useEffect, useState } from "react";
import { api } from "../lib/api";

type AdminUser = {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  role: string;
  transactionCount: number;
  statementCount: number;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminUsers()
      .then(setUsers)
      .catch((e) => setError(e.message));
  }, []);

  const filtered = users.filter(
    (u) =>
      !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (error) {
    return (
      <>
        <div className="admin-topbar"><span className="topbar-title">Users</span></div>
        <div className="admin-content" style={{ color: "var(--danger)" }}>Error: {error}</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-topbar">
        <span className="topbar-title">Users</span>
        <div className="topbar-actions">
          <span className="a-text-muted a-text-sm">{users.length} total</span>
        </div>
      </div>
    <div className="admin-content">
      <div className="a-card">
        {/* Search */}
        <div style={{ marginBottom: "1rem" }}>
          <input
            className="a-form-input"
            type="search"
            placeholder="Search by username or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Transactions</th>
                <th>Statements</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{u.username}</span>
                    <div className="a-text-xs a-text-muted">#{u.id}</div>
                  </td>
                  <td className="a-text-sm a-text-muted">{u.email || "—"}</td>
                  <td>
                    <span className={`a-badge ${u.role === "admin" ? "a-badge-admin" : "a-badge-user"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.transactionCount.toLocaleString()}</td>
                  <td>{u.statementCount}</td>
                  <td className="a-text-xs a-text-muted">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-dim)", padding: "2rem" }}>
                    {users.length === 0 ? "Loading…" : "No users match your search"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </>
  );
}
