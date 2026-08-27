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
    // Simulate network delay
    setTimeout(() => {
      onPublish(targetEnv, selectedLanguage);
      setIsPublishing(false);
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091E42]/50"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="bg-background-card rounded-lg shadow-lg w-full max-w-lg flex flex-col"
          >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-main">
          <div className="flex items-center gap-2 text-main">
            <Globe className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Publish Content</h2>
          </div>
          <button 
            onClick={onClose}
            disabled={isPublishing}
            className="p-1 rounded hover:bg-background-selected text-muted transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-muted mb-6">
            Select the target environment to publish the approved <strong>{selectedLanguage.toUpperCase()}</strong> tags for <strong>{pageName}</strong>. 
            Only "Approved" translations are included in the publish bundle.
          </p>

          {/* Environment Selector */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {(['DEV', 'QA', 'PRODUCTION'] as Environment[]).map((env) => (
              <button
                key={env}
                onClick={() => setTargetEnv(env)}
                className={cn(
                  "p-3 rounded-lg border text-sm font-semibold transition-colors flex flex-col items-center gap-1",
                  targetEnv === env 
                    ? "bg-[#E6FCFF] border-primary-hover text-primary" 
                    : "bg-background-card border-main text-muted hover:bg-background-hover",
                  "active:scale-95"
                )}
              >
                {env}
                {env === 'PRODUCTION' && targetEnv === env && (
                  <span className="text-[10px] bg-[#FFEBE6] text-[#BF2600] px-1.5 py-0.5 rounded font-bold uppercase mt-1">
                    Approval Required
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Summary Box */}
          <div className="bg-background-hover border border-main rounded-lg p-4">
            <h4 className="text-sm font-semibold text-main mb-3">Pre-Publishing Summary</h4>
            
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-success font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#36B37E]" />
                Included (Approved)
              </span>
              <span className="font-semibold text-main">{approvedTagsCount}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-warning font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FFAB00]" />
                Excluded (Draft / Pending)
              </span>
              <span className="font-semibold text-main">{excludedCount}</span>
            </div>

            {excludedCount > 0 && (
              <div className="mt-4 flex items-start gap-2 text-xs text-muted p-2 bg-[#FFFAE6] rounded">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <p>
                  Excluded tags will continue to show their currently published translations (if any) or fallback to English in the target environment.
                </p>
              </div>
            )}
            
            {targetEnv === 'PRODUCTION' && (
              <div className="mt-3 flex items-start gap-2 text-xs text-[#BF2600] p-2 bg-[#FFEBE6] rounded">
                <ShieldAlert className="w-4 h-4 text-[#BF2600] flex-shrink-0" />
                <p>
                  Publishing to Production requires an Approval Request. This will queue the bundle for the Support Reviewer or Founder.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-main flex items-center justify-end gap-3 bg-background-hover rounded-b-[4px]">
          <button 
            onClick={onClose}
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-muted hover:bg-background-selected rounded-lg transition-colors disabled:opacity-50 active:scale-95"
          >
            Cancel
          </button>
          <button 
            onClick={handlePublish}
            disabled={isPublishing || approvedTagsCount === 0}
            className={cn(
              "px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2",
              targetEnv === 'PRODUCTION' 
                ? "bg-[#FF5630] hover:bg-danger" 
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
