import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, WarningCircle as AlertCircle, CaretRight, CheckCircle } from "@phosphor-icons/react";
import { StoreService } from "../../store/StoreService";
import { cn } from "../../lib/utils";

interface LengthConflictsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LengthConflictsModal({ isOpen, onClose }: LengthConflictsModalProps) {
  const [conflicts, setConflicts] = useState<ReturnType<typeof StoreService.getLengthConflicts>>([]);

  useEffect(() => {
    if (isOpen) {
      setConflicts(StoreService.getLengthConflicts());
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", duration: 0.25 }}
            className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden text-text-primary shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-card shrink-0 rounded-t-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-4 h-4 text-amber-500" weight="bold" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">UI Length Conflicts</h2>
                  <p className="text-[12px] text-text-tertiary mt-0.5">
                    Translations that exceed &gt;25% of their source English length and risk UI clipping.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none"
              >
                <X className="w-4 h-4" weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-bg-main p-6 scrollbar-none">
              {conflicts.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-10 h-10 text-success/60 mx-auto mb-3" weight="bold" />
                  <p className="text-[14px] font-semibold text-text-primary">No Length Conflicts</p>
                  <p className="text-[12px] text-text-tertiary mt-1">All translations fit comfortably within standard layout budgets.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conflicts.map((conflict, idx) => {
                    const isSevere = conflict.diffPercentage > 50;
                    return (
                      <div
                        key={`${conflict.tagId}-${conflict.languageCode}-${idx}`}
                        className="bg-bg-card border border-border-subtle rounded-xl p-4 transition-all hover:border-border-strong group shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[13px] font-bold text-text-primary font-mono">{conflict.tagId}</span>
                              <span className="px-1.5 py-0.5 bg-bg-main border border-border-subtle text-text-secondary text-[10px] font-medium rounded">
                                {conflict.pageName}
                              </span>
                              <span className="px-1.5 py-0.5 bg-accent-blue/10 text-accent-blue text-[10px] font-medium rounded border border-accent-blue/20">
                                {conflict.languageName}
                              </span>
                              {conflict.status === "Pending Review" && (
                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium rounded border border-amber-500/20">
                                  Draft
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[12px]">
                              <span className="text-text-tertiary">English: {conflict.englishText.length} chars</span>
                              <span className="text-border-subtle">•</span>
                              <span className="text-text-tertiary">Translated: {conflict.translatedText.length} chars</span>
                              <span className="text-border-subtle">•</span>
                              <span className={cn(isSevere ? "text-rose-500 font-semibold" : "text-amber-500 font-semibold")}>
                                +{conflict.diffPercentage}% length
                              </span>
                            </div>
                          </div>
                          
                          <Link
                            to={`/pages/${conflict.pageId}/tags/${conflict.tagId}`}
                            onClick={onClose}
                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-bg-main hover:bg-bg-hover border border-border-subtle hover:border-border-strong rounded-md text-[12px] font-medium text-text-primary transition-colors outline-none"
                          >
                            Review
                            <CaretRight className="w-3 h-3 text-text-tertiary group-hover:text-text-primary transition-colors" weight="bold" />
                          </Link>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
                          <div className="p-3 bg-bg-main border border-border-subtle rounded-lg">
                            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Source</p>
                            <p className="text-text-secondary line-clamp-2 leading-relaxed" title={conflict.englishText}>{conflict.englishText}</p>
                          </div>
                          <div className={cn(
                            "p-3 border rounded-lg",
                            isSevere ? "bg-rose-500/5 border-rose-500/20" : "bg-amber-500/5 border-amber-500/20"
                          )}>
                            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Translation</p>
                            <p className={cn(
                              "line-clamp-2 leading-relaxed",
                              isSevere ? "text-rose-600 dark:text-rose-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"
                            )} title={conflict.translatedText}>{conflict.translatedText}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-border-subtle bg-bg-sidebar flex justify-between items-center shrink-0 rounded-b-xl">
              <div className="text-[12px] font-medium text-text-tertiary">
                Showing <strong className="text-text-primary">{conflicts.length}</strong> total {conflicts.length === 1 ? 'conflict' : 'conflicts'}
              </div>
              <button
                onClick={onClose}
                className="h-8 px-4 bg-bg-card border border-border-subtle hover:border-border-strong hover:bg-bg-hover rounded-md text-[13px] font-medium text-text-primary transition-colors outline-none cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
