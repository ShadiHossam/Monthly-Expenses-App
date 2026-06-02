import { useEffect } from "react";
import UploadPage from "../pages/UploadPage";
import { cn } from "../lib/utils";
import { useUploadContext } from "../context/UploadContext";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined select-none", className)}>{name}</span>;
}

export default function UploadModal({ onClose }: { onClose: () => void }) {
  const { hasActiveUploads } = useUploadContext();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={hasActiveUploads ? undefined : onClose}
      />
      <div className="relative w-full sm:max-w-2xl max-h-[90dvh] overflow-y-auto bg-ft-background dark:bg-ve-background rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col">
        <div className="sticky top-0 z-10 bg-ft-background dark:bg-ve-background border-b border-ft-outline-variant dark:border-ve-outline">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-lg font-bold text-ft-on-surface dark:text-ve-on-surface">Upload Statement</h2>
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">PDF, image, or CSV formats</p>
            </div>
            <button
              onClick={onClose}
              title={hasActiveUploads ? "Minimize — uploads continue in background" : "Close"}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-ft-on-surface-variant dark:text-ve-on-surface-variant hover:bg-ft-surface-low dark:hover:bg-ve-surface-high transition-colors"
            >
              {hasActiveUploads
                ? <><MSIcon name="minimize" className="text-xl" /><span className="text-xs font-medium hidden sm:inline">Minimize</span></>
                : <MSIcon name="close" className="text-xl" />
              }
            </button>
          </div>
          {hasActiveUploads && (
            <div className="flex items-center gap-2 px-6 py-2 bg-ft-surface-low dark:bg-ve-surface-high border-t border-ft-outline-variant dark:border-ve-outline">
              <div className="w-3 h-3 shrink-0 border-2 border-ft-primary dark:border-ve-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                Uploading — you can minimize this and use the rest of the app. Progress will show at the bottom of the screen.
              </p>
            </div>
          )}
        </div>
        <div className="flex-1">
          <UploadPage onClose={onClose} />
        </div>
      </div>
    </div>
  );
}
