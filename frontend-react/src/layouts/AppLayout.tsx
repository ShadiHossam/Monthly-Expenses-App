import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { ErrorBoundary } from "../components/ErrorBoundary";

const FULL_NAV = [
  { href: "/dashboard",    label: "Home",         icon: "home" },
  { href: "/upload",       label: "Upload",        icon: "upload" },
  { href: "/transactions", label: "Transactions",  icon: "receipt_long" },
  { href: "/analytics",    label: "Analytics",     icon: "bar_chart" },
  { href: "/reports",      label: "Reports",       icon: "summarize" },
  { href: "/merchants",    label: "Merchants",     icon: "storefront" },
  { href: "/statements",   label: "Statements",    icon: "description" },
  { href: "/recurring",    label: "Recurring",     icon: "repeat" },
  { href: "/budget",       label: "Budget",        icon: "account_balance_wallet" },
  { href: "/settings",     label: "Settings",      icon: "settings" },
  { href: "/billing",      label: "Billing",       icon: "credit_card" },
];

const MOBILE_NAV = [
  { href: "/dashboard",    label: "Home",     icon: "home" },
  { href: "/upload",       label: "Upload",   icon: "upload" },
  { href: "/transactions", label: "Txns",     icon: "receipt_long" },
  { href: "/analytics",    label: "Analytics",icon: "bar_chart" },
  { href: "/budget",       label: "Budget",   icon: "account_balance_wallet" },
  { href: "/settings",     label: "Settings", icon: "settings" },
];

function MSIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("material-symbols-outlined select-none", className)}>
      {name}
    </span>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [ready, setReady] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
    } else {
      setReady(true);
    }
  }, [navigate]);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDark() {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  function handleSignOut() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex bg-ft-background dark:bg-ve-background">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-44 flex-col z-20
                        bg-ft-surface dark:bg-ve-surface
                        border-r border-ft-outline-variant dark:border-ve-outline">

        {/* ── Sidebar top: avatar + brand + Add Transaction ── */}
        <div className="flex flex-col gap-3 px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-ft-primary dark:bg-ve-primary flex items-center justify-center text-white dark:text-ve-background font-bold text-sm shrink-0">
              E
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-ft-on-surface dark:text-ve-on-surface leading-tight truncate">Expenses</p>
              <p className="text-[10px] text-ft-on-surface-variant dark:text-ve-on-surface-variant leading-tight truncate">Wealth Management</p>
            </div>
          </div>
          <Link
            to="/upload"
            className="flex items-center justify-center gap-1.5 py-2 rounded-xl
                       bg-ft-primary dark:bg-ve-primary-dim text-white dark:text-ve-background text-xs font-semibold
                       hover:bg-ft-primary-container dark:hover:opacity-90 transition-colors"
          >
            <MSIcon name="add" className="text-base leading-none" />
            Add Transaction
          </Link>
        </div>

        {/* ── Nav items ── */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {FULL_NAV.map(item => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                  isActive
                    ? "bg-ft-surface-low dark:bg-ve-surface-high text-ft-primary dark:text-ve-primary"
                    : "text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-container dark:hover:bg-ve-surface-high"
                )}
              >
                <MSIcon
                  name={item.icon}
                  className={cn(
                    "text-lg leading-none",
                    isActive ? "text-ft-primary dark:text-ve-primary" : "text-ft-on-surface-variant dark:text-ve-on-surface-variant"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* ── Sidebar bottom: theme toggle + sign out ── */}
        <div className="px-4 pb-5 pt-3 border-t border-ft-outline-variant dark:border-ve-outline space-y-1">
          <button
            onClick={toggleDark}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-container dark:hover:bg-ve-surface-high transition-colors"
          >
            <MSIcon name={isDark ? "light_mode" : "dark_mode"} className="text-lg leading-none" />
            {isDark ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-container dark:hover:bg-ve-surface-high transition-colors"
          >
            <MSIcon name="logout" className="text-lg leading-none" />
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 md:ml-44 flex flex-col min-h-screen">

        <main className="flex-1 pb-20 md:pb-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 safe-area-bottom
                      bg-ft-surface dark:bg-ve-surface
                      border-t border-ft-outline-variant dark:border-ve-outline">
        <div className="flex">
          {MOBILE_NAV.map(item => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-ft-primary dark:text-ve-primary"
                    : "text-ft-on-surface-variant dark:text-ve-on-surface-variant"
                )}
              >
                <MSIcon name={item.icon} className={cn("text-2xl leading-none", isActive ? "text-ft-primary dark:text-ve-primary" : "text-ft-on-surface-variant dark:text-ve-on-surface-variant")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
