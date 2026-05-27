import { useEffect } from "react";
import UploadPage from "../pages/UploadPage";
import { cn } from "../lib/utils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function UploadModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-2xl max-h-[90dvh] overflow-y-auto bg-ft-background dark:bg-ve-background rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-ft-background dark:bg-ve-background border-b border-ft-outline-variant dark:border-ve-outline">
          <div>
            <h2 className="text-lg font-bold text-ft-on-surface dark:text-ve-on-surface">Upload Statement</h2>
            <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">PDF, image, or CSV formats</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors"
          >
            <MSIcon name="close" className="text-xl" />
          </button>
        </div>
        <div className="flex-1">
          <UploadPage onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
