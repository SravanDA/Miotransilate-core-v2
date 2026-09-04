import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  CheckCircle,
  Globe
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import type { LanguageConfig, Tag } from "../../types";

interface LanguagePendingInfo {
  code: string;
  name: string;
  pendingCount: number;
  eligibleCount: number;
}

interface BulkApproveAllLanguagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  languages: LanguagePendingInfo[];
  threshold?: number;
}

export function BulkApproveAllLanguagesModal({
  isOpen,
  onClose,
  onConfirm,
  languages,
  threshold = 80
}: BulkApproveAllLanguagesModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  const totalPending = languages.reduce((sum, l) => sum + l.pendingCount, 0);
  const totalEligible = languages.reduce((sum, l) => sum + l.eligibleCount, 0);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-hidden"
        >
          <motion.div 
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", duration: 0.25 }}
            className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden text-text-primary my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-sidebar rounded-t-xl">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-accent-blue" weight="bold" />
                <h2 className="text-base font-semibold text-text-primary">Approve {languages.length} Languages</h2>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer outline-none"
              >
                <X className="w-4 h-4" weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 bg-bg-card space-y-4">
              <p className="text-[13px] text-text-secondary leading-relaxed">
                Approve pending translations across <strong className="text-text-primary">{languages.length} languages</strong> in one action. 
                Translations meeting the confidence gate (≥{threshold}%) will be marked as Approved.
              </p>

              <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-main">
                <div className="grid grid-cols-12 px-4 py-2 border-b border-border-subtle text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                  <div className="col-span-7">Language</div>
                  <div className="col-span-5 text-right">Pending</div>
                </div>
                <div className="max-h-[200px] overflow-y-auto divide-y divide-border-subtle text-[12px]">
                  {languages.map((lang) => (
                    <div key={lang.code} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-bg-card/40 transition-colors">
                      <div className="col-span-7 font-medium text-text-primary flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>{lang.name}</span>
                        <span className="text-[11px] font-mono text-text-tertiary">({lang.code})</span>
                      </div>
                      <div className="col-span-5 text-right text-text-secondary tabular-nums">
                        {lang.eligibleCount > 0 && lang.eligibleCount < lang.pendingCount ? (
                          <span>
                            <span className="text-text-primary font-semibold">{lang.eligibleCount}</span>
                            <span className="text-text-tertiary"> / {lang.pendingCount}</span>
                          </span>
                        ) : (
                          <span className="text-text-primary font-semibold">{lang.pendingCount} strings</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-2 text-[12px] text-text-tertiary">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" weight="bold" />
                <span>
                  {totalEligible > 0 && totalEligible < totalPending
                    ? `${totalEligible} of ${totalPending} translations meet the ≥${threshold}% confidence gate and will be approved. Low-confidence items are kept for manual review.`
                    : `${totalPending} translations across ${languages.length} languages will be approved.`
                  }
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-border-subtle flex items-center justify-end gap-2 bg-bg-sidebar rounded-b-xl">
              <button 
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                disabled={totalPending === 0}
                className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold transition-all shadow-xs outline-none bg-[#4CB782] hover:bg-[#43a575] text-white cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve {languages.length} Languages
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Helper to compute per-language pending info from tags and active languages */
export function computeLanguagePendingInfo(
  tags: Tag[],
  activeLangs: LanguageConfig[],
  threshold: number
): LanguagePendingInfo[] {
  return activeLangs
    .map(lang => {
      const pending = tags.filter(t => {
        const val = t.values[lang.code];
        return val && val.text && val.text.trim().length > 0 && val.status !== "Approved";
      });
      const eligible = pending.filter(t => (t.values[lang.code]?.confidence || 0) >= threshold);
      return {
        code: lang.code,
        name: lang.name,
        pendingCount: pending.length,
        eligibleCount: eligible.length
      };
    })
    .filter(l => l.pendingCount > 0);
}
