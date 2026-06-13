import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api";

type Stats = {
  totalUsers: number;
  totalTransactions: number;
  totalStatements: number;
  newUsersThisWeek: number;
  signupsLast30Days: { date: string; count: number }[];
};

type AdminUser = {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  role: string;
  transactionCount: number;
  statementCount: number;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="a-stat-card">
      <div className="a-stat-label">{label}</div>
      <div className="a-stat-value">{value}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.adminStats(), api.adminUsers()])
      .then(([s, u]) => {
        setStats(s);
        setUsers(u.slice(0, 8));
      })
      .catch((e) => setError(e.message));
  }, []);

  // Build full 30-day chart data (fill missing days with 0)
  const chartData = (() => {
    if (!stats) return [];
    const map: Record<string, number> = {};
    for (const d of stats.signupsLast30Days) map[d.date] = d.count;
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const dt = new Date(Date.now() - i * 86400000);
      const key = dt.toISOString().split("T")[0];
      const label = dt.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      result.push({ date: label, signups: map[key] ?? 0 });
    }
    return result;
  })();

  if (error) {
    return (
      <>
        <div className="admin-topbar"><span className="topbar-title">Dashboard</span></div>
        <div className="admin-content" style={{ color: "var(--danger)" }}>Error: {error}</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-topbar">
        <span className="topbar-title">Dashboard</span>
      </div>
    <div className="admin-content">

      {/* Stat cards */}
      <div className="a-grid-4 a-mb-6">
        <StatCard label="Total Users" value={stats?.totalUsers ?? "—"} />
        <StatCard label="Total Transactions" value={stats?.totalTransactions ?? "—"} />
        <StatCard label="Total Statements" value={stats?.totalStatements ?? "—"} />
        <StatCard label="New Users This Week" value={stats?.newUsersThisWeek ?? "—"} />
      </div>

      {/* 30-day bar chart */}
      <div className="a-card a-mb-6">
        <div className="a-card-header">
          <div>
            <div className="a-card-title">User Signups — Last 30 Days</div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{ background: "#1e2a40", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, color: "#e2e8f0" }}
              cursor={{ fill: "rgba(0,227,253,0.06)" }}
            />
            <Bar dataKey="signups" fill="rgba(0,227,253,0.7)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent users table */}
      <div className="a-card">
        <div className="a-card-header">
          <div>
            <div className="a-card-title">Recent Users</div>
            <div className="a-card-sub">Last 8 registrations</div>
          </div>
          <Link to="/admin/users" className="a-btn a-btn-secondary a-btn-sm">
            View All →
          </Link>
        </div>
        <div className="a-table-wrap">
          <table className="a-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Transactions</th>
                <th>Statements</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td className="a-text-muted a-text-sm">{u.email || "—"}</td>
                  <td>{u.transactionCount.toLocaleString()}</td>
                  <td>{u.statementCount}</td>
                  <td>
                    <span className={`a-badge ${u.role === "admin" ? "a-badge-admin" : "a-badge-user"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="a-text-muted a-text-xs">{timeAgo(u.createdAt)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-dim)", padding: "2rem" }}>
                    {stats ? "No users yet" : "Loading…"}
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
