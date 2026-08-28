import { useState } from "react";
import { X, Globe, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Environment } from "../../types";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (env: Environment, langCode: string) => void;
  totalTags: number;
  approvedTagsCount: number;
  pageName: string;
  selectedLanguage: string;
}

export function PublishModal({
  isOpen,
  onClose,
  onPublish,
  totalTags,
  approvedTagsCount,
  pageName,
  selectedLanguage
}: PublishModalProps) {
  const [targetEnv, setTargetEnv] = useState<Environment>("DEV");
  const [isPublishing, setIsPublishing] = useState(false);

  const excludedCount = totalTags - approvedTagsCount;

  const handlePublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
      onPublish(targetEnv, selectedLanguage);
      setIsPublishing(false);
      onClose();
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", duration: 0.25 }}
            className="bg-surface border border-border-main rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden text-text-main"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-main bg-surface">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-main">Publish Content</h2>
                  <p className="text-xs text-text-muted">Target environment release bundle</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                disabled={isPublishing}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 bg-surface space-y-5">
              <div className="text-sm text-text-muted leading-relaxed">
                Select the target environment to publish approved <strong className="text-text-main uppercase font-semibold">{selectedLanguage}</strong> translations for <strong className="text-text-main">{pageName}</strong>.
              </div>

              {/* Environment Selector */}
              <div className="grid grid-cols-3 gap-3">
                {(['DEV', 'QA', 'PRODUCTION'] as Environment[]).map((env) => {
                  const isSelected = targetEnv === env;
                  return (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setTargetEnv(env)}
                      className={cn(
                        "p-3.5 rounded-lg border text-sm font-semibold transition-all flex flex-col items-center gap-1.5 cursor-pointer relative",
                        isSelected 
                          ? "bg-primary/10 border-primary text-primary shadow-xs ring-2 ring-primary/20" 
                          : "bg-surface-hover border-border-main text-text-muted hover:border-text-muted/40 hover:text-text-main",
                        "active:scale-95"
                      )}
                    >
                      <span className="font-bold">{env}</span>
                      {env === 'PRODUCTION' && (
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider",
                          isSelected ? "bg-danger/15 text-danger" : "bg-surface border border-border-main text-text-subtle"
                        )}>
                          Approval
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Summary Box */}
              <div className="bg-surface-hover border border-border-main rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Pre-Publishing Summary</h4>
                
                <div className="flex justify-between items-center text-sm py-1 border-b border-border-main/60">
                  <span className="text-text-main font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-success ring-4 ring-success/20" />
                    Included (Approved)
                  </span>
                  <span className="font-bold text-text-main">{approvedTagsCount}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm py-1">
                  <span className="text-text-muted font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-warning ring-4 ring-warning/20" />
                    Excluded (Draft / Stale / Untranslated)
                  </span>
                  <span className="font-bold text-text-muted">{excludedCount}</span>
                </div>

                {excludedCount > 0 && (
                  <div className="mt-3 flex items-start gap-2.5 text-xs text-text-muted p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <p className="leading-normal">
                      Excluded tags will retain their currently published live values or fallback to English in the target environment.
                    </p>
                  </div>
                )}
                
                {targetEnv === 'PRODUCTION' && (
                  <div className="mt-3 flex items-start gap-2.5 text-xs text-danger p-3 bg-danger/10 border border-danger/20 rounded-lg">
                    <ShieldAlert className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
                    <p className="leading-normal">
                      Production releases require an Approval Request review by an authorized admin or support reviewer.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border-main flex items-center justify-end gap-3 bg-surface-hover">
              <button 
                type="button"
                onClick={onClose}
                disabled={isPublishing}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main hover:bg-surface border border-border-main rounded-lg transition-colors disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || approvedTagsCount === 0}
                className={cn(
                  "px-5 py-2 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer",
                  targetEnv === 'PRODUCTION' 
                    ? "bg-danger hover:bg-danger/90" 
                    : "bg-primary hover:bg-primary-hover",
                  (isPublishing || approvedTagsCount === 0) ? "opacity-50 cursor-not-allowed" : "active:scale-95"
                )}
              >
                {isPublishing ? "Processing..." : targetEnv === 'PRODUCTION' ? "Request Approval" : `Publish to ${targetEnv}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
