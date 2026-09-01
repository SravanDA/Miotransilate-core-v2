import {
  useState,
  useMemo,
  useEffect
} from "react";
import { X } from "@phosphor-icons/react";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { StoreService } from "../../store/StoreService";
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
  const { user, can } = useAuth();
  const [targetEnv, setTargetEnv] = useState<Environment>("MOCK");
  const [activeLangCode, setActiveLangCode] = useState<string>(initialLanguage || selectedLanguage || "eng");
  const [isPublishing, setIsPublishing] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPublishing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPublishing, onClose]);

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

  // Permission checks
  const canPublishProdDirect = can('PUBLISH_PRODUCTION') || user?.roles?.includes('FN') || user?.roles?.includes('SR');
  const pageId = tags?.[0]?.pageId || "";

  const diffSummary = useMemo(() => {
    if (!pageId) {
      return { totalCount: computedApprovedCount, newCount: computedApprovedCount, updatedCount: 0, previousVersion: null };
    }
    return StoreService.getPublishDiffSummary(pageId, activeLangCode, targetEnv);
  }, [pageId, activeLangCode, targetEnv, computedApprovedCount]);

  const handlePublish = async () => {
    setIsPublishing(true);

    if (targetEnv === "PRODUCTION" && !canPublishProdDirect) {
      // Create approval request
      await StoreService.requestPublishApproval(
        pageId,
        pageName,
        isEnglish ? "eng" : activeLangCode,
        targetEnv,
        computedApprovedCount,
        user?.displayName || "Author"
      );
      setIsPublishing(false);
      onClose();
      return;
    }

    setTimeout(() => {
      onPublish(targetEnv, isEnglish ? "eng" : activeLangCode);
      setIsPublishing(false);
      onClose();
    }, 400);
  };

  const ENV_OPTIONS: { env: Environment; label: string }[] = [
    { env: "MOCK", label: "Mock UI" },
    { env: "DEV", label: "Dev" },
    { env: "QA", label: "QA" },
    { env: "PRODUCTION", label: "Prod" }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget && !isPublishing) onClose(); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div 
            initial={{ scale: 0.97, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="bg-bg-card border border-border-subtle rounded-xl shadow-2xl w-full max-w-[460px] flex flex-col overflow-hidden text-text-primary"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-bg-sidebar rounded-t-xl">
              <div>
                <h2 className="text-[14px] font-semibold text-text-primary tracking-tight">Publish Content Bundle</h2>
                <p className="text-[12px] text-text-tertiary mt-0.5">{pageName} · Release Pipeline</p>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="text-[10px] font-mono text-text-tertiary px-1.5 py-0.5 rounded border border-border-subtle bg-bg-main hidden sm:inline-block">
                  ESC
                </kbd>
                <button 
                  onClick={onClose}
                  disabled={isPublishing}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 cursor-pointer outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-5 space-y-4">
              {/* Language Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Language to publish</label>
                <Dropdown
                  value={activeLangCode}
                  onChange={setActiveLangCode}
                  className="w-full"
                  options={[
                    { value: "eng", label: "English (Master Copy)" },
                    ...availableLanguages.map(lang => ({
                      value: lang.code,
                      label: `${lang.name} (${lang.nativeName})`
                    }))
                  ]}
                />
              </div>

              {/* Target Environment Segmented Switch */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-medium text-text-secondary">Target environment</label>
                <div className="grid grid-cols-4 bg-bg-main p-1 rounded-lg border border-border-subtle gap-1">
                  {ENV_OPTIONS.map(({ env, label }) => {
                    const isSelected = targetEnv === env;
                    return (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setTargetEnv(env)}
                        className={cn(
                          "py-1.5 text-[12px] font-medium rounded-md transition-all text-center cursor-pointer outline-none",
                          isSelected 
                            ? "bg-bg-card text-text-primary shadow-xs border border-border-subtle/80 font-semibold" 
                            : "text-text-tertiary hover:text-text-primary border border-transparent"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Pre-publishing Diff Summary */}
              <div className="p-3 bg-bg-main border border-border-subtle rounded-lg text-[12px] space-y-1.5">
                <div className="font-semibold text-text-primary flex items-center justify-between">
                  <span>Pre-Publish Changes</span>
                  <span className="text-[11px] font-mono text-text-tertiary">
                    {diffSummary.previousVersion ? `Prior: v${diffSummary.previousVersion}` : 'Initial release'}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Approved strings in bundle:</span>
                  <span className="font-mono font-bold text-text-primary">{diffSummary.totalCount}</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>New strings to deploy:</span>
                  <span className="font-mono font-bold">+{diffSummary.newCount}</span>
                </div>
                {excludedCount > 0 && !isEnglish && (
                  <div className="flex justify-between text-warning">
                    <span>Excluded (draft or stale):</span>
                    <span className="font-mono font-bold">{excludedCount}</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-text-tertiary leading-normal pt-0.5">
                {targetEnv === 'MOCK' 
                  ? "Publishes instantly to the mock runtime & playground for live testing." 
                  : targetEnv === 'PRODUCTION' 
                  ? (canPublishProdDirect ? "Production releases create an immutable release audit log." : "Submits this bundle to Support Reviewers / Founders for production approval.")
                  : `Deploys approved bundle to the ${targetEnv} pipeline.`}
              </p>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-border-subtle flex items-center justify-between bg-bg-sidebar rounded-b-xl">
              <span className="text-[11px] text-text-tertiary">
                {computedApprovedCount === 0 ? "No approved strings" : `${computedApprovedCount} strings ready`}
              </span>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={onClose}
                  disabled={isPublishing}
                  className="px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-subtle rounded-md transition-colors disabled:opacity-50 cursor-pointer outline-none"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing || computedApprovedCount === 0}
                  className="px-3.5 py-1.5 bg-[#5e6ad2] hover:bg-[#525ec2] text-white text-[12px] font-medium rounded-md transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer outline-none shadow-xs"
                >
                  {isPublishing 
                    ? "Processing..." 
                    : targetEnv === 'PRODUCTION' && !canPublishProdDirect
                    ? "Request Approval" 
                    : targetEnv === 'MOCK'
                    ? "Publish to Mock UI"
                    : `Publish to ${targetEnv}`}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


