import { cn } from "../lib/utils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ft-background dark:bg-ve-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 bg-ft-primary dark:bg-ve-primary-dim rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <MSIcon name="explore_off" className="text-3xl text-white dark:text-ve-background" />
        </div>
        <h1 className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Page not found</h1>
        <p className="text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1 text-sm mb-6">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-ft-primary dark:bg-ve-primary-dim hover:opacity-90 text-white dark:text-ve-background font-semibold py-3 px-6 rounded-xl transition-opacity text-sm"
        >
          <MSIcon name="home" className="text-lg" />
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
