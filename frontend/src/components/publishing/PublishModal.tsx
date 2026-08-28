import { useState, useMemo } from "react";
import { X, Globe, AlertTriangle, ShieldAlert, Sparkles, Languages } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { Environment, Tag, LanguageConfig } from "../../types";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (env: Environment, langCode: string) => void;
  totalTags: number;
  approvedTagsCount?: number;
  pageName: string;
  selectedLanguage?: string;
  initialLanguage?: string;
  availableLanguages?: LanguageConfig[];
  tags?: Tag[];
}

export function PublishModal({
  isOpen,
  onClose,
  onPublish,
  totalTags,
  approvedTagsCount,
  pageName,
  selectedLanguage = "eng",
  initialLanguage,
  availableLanguages = [],
  tags = []
}: PublishModalProps) {
  const [targetEnv, setTargetEnv] = useState<Environment>("MOCK");
  const [activeLangCode, setActiveLangCode] = useState<string>(initialLanguage || selectedLanguage || "eng");
  const [isPublishing, setIsPublishing] = useState(false);

  const isEnglish = activeLangCode === "eng" || activeLangCode === "en";

  const computedApprovedCount = useMemo(() => {
    if (tags && tags.length > 0) {
      if (isEnglish) {
        return tags.filter(t => t.english && t.english.trim().length > 0).length;
      }
      return tags.filter(t => t.values && t.values[activeLangCode]?.status === "Approved").length;
    }
    return approvedTagsCount !== undefined ? approvedTagsCount : totalTags;
  }, [tags, activeLangCode, isEnglish, approvedTagsCount, totalTags]);

  const effectiveTotalTags = tags && tags.length > 0 ? tags.length : totalTags;
  const excludedCount = Math.max(0, effectiveTotalTags - computedApprovedCount);

  const activeLangName = useMemo(() => {
    if (isEnglish) return "English (Master)";
    const found = availableLanguages.find(l => l.code === activeLangCode);
    return found ? found.name : activeLangCode.toUpperCase();
  }, [isEnglish, activeLangCode, availableLanguages]);

  const handlePublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
      onPublish(targetEnv, isEnglish ? "eng" : activeLangCode);
      setIsPublishing(false);
      onClose();
    }, 800);
  };

  const ENV_CONFIGS: { env: Environment; label: string; badge?: string; badgeColor?: string }[] = [
    { env: "MOCK", label: "MOCK UI", badge: "Instant", badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
    { env: "DEV", label: "DEV" },
    { env: "QA", label: "QA" },
    { env: "PRODUCTION", label: "PROD", badge: "Approval", badgeColor: "bg-danger/15 text-danger" }
  ];

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
                  <h2 className="text-base font-semibold text-text-main">Publish Content Bundle</h2>
                  <p className="text-xs text-text-muted">{pageName} · Release Pipeline</p>
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
              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-subtle mb-1.5 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-primary" />
                  Language To Publish
                </label>
                <select
                  value={activeLangCode}
                  onChange={(e) => setActiveLangCode(e.target.value)}
                  className="w-full h-10 px-3 bg-surface border border-border-main rounded-lg text-sm font-semibold text-text-main focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
                >
                  <option value="eng">🇬🇧 English (Master Copies)</option>
                  {availableLanguages.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      🌐 {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Environment Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-subtle mb-1.5">Target Environment</label>
                <div className="grid grid-cols-4 gap-2">
                  {ENV_CONFIGS.map(({ env, label, badge, badgeColor }) => {
                    const isSelected = targetEnv === env;
                    return (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setTargetEnv(env)}
                        className={cn(
                          "p-2.5 rounded-lg border text-sm font-semibold transition-all flex flex-col items-center gap-1 cursor-pointer relative",
                          isSelected 
                            ? "bg-primary/10 border-primary text-primary shadow-xs ring-2 ring-primary/20" 
                            : "bg-surface-hover border-border-main text-text-muted hover:border-text-muted/40 hover:text-text-main",
                          "active:scale-95"
                        )}
                      >
                        <span className="font-bold text-xs">{label}</span>
                        {badge && (
                          <span className={cn(
                            "text-[9px] px-1 py-0.2 rounded font-semibold uppercase tracking-wider",
                            isSelected && badgeColor ? badgeColor : "bg-surface border border-border-main text-text-subtle"
                          )}>
                            {badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Summary Box */}
              <div className="bg-surface-hover border border-border-main rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-subtle">Pre-Publishing Summary</h4>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface border border-border-main text-text-main">
                    {activeLangName}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-sm py-1 border-b border-border-main/60">
                  <span className="text-text-main font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-success ring-4 ring-success/20" />
                    {isEnglish ? "Master English Tags" : "Included (Approved)"}
                  </span>
                  <span className="font-bold text-text-main">{computedApprovedCount}</span>
                </div>
                
                {!isEnglish && (
                  <div className="flex justify-between items-center text-sm py-1">
                    <span className="text-text-muted font-medium flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-warning ring-4 ring-warning/20" />
                      Excluded (Draft / Stale / Untranslated)
                    </span>
                    <span className="font-bold text-text-muted">{excludedCount}</span>
                  </div>
                )}

                {targetEnv === 'MOCK' && (
                  <div className="mt-2 flex items-start gap-2.5 text-xs text-emerald-700 dark:text-emerald-300 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                    <p className="leading-normal">
                      <strong>Mock Mode:</strong> Publishes directly to the Mock Language Service / Playground UI so you can test copy updates in real time without approval reviews.
                    </p>
                  </div>
                )}

                {!isEnglish && excludedCount > 0 && (
                  <div className="mt-2 flex items-start gap-2.5 text-xs text-text-muted p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    <p className="leading-normal">
                      Excluded tags will retain their currently published live values or fallback to English in the target environment.
                    </p>
                  </div>
                )}
                
                {targetEnv === 'PRODUCTION' && (
                  <div className="mt-2 flex items-start gap-2.5 text-xs text-danger p-3 bg-danger/10 border border-danger/20 rounded-lg">
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
                disabled={isPublishing || computedApprovedCount === 0}
                className={cn(
                  "px-5 py-2 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer",
                  targetEnv === 'PRODUCTION' 
                    ? "bg-danger hover:bg-danger/90" 
                    : targetEnv === 'MOCK'
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-primary hover:bg-primary-hover",
                  (isPublishing || computedApprovedCount === 0) ? "opacity-50 cursor-not-allowed" : "active:scale-95"
                )}
              >
                {isPublishing 
                  ? "Publishing..." 
                  : targetEnv === 'PRODUCTION' 
                  ? "Request Approval" 
                  : targetEnv === 'MOCK'
                  ? `Publish ${isEnglish ? 'English' : activeLangName} to Mock UI`
                  : `Publish to ${targetEnv}`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
