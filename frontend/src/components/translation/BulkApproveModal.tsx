import { useEffect } from "react";
import {
  X,
  CheckCircle,
  WarningCircle as AlertCircle
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";

interface BulkApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalPending: number;
  eligibleCount: number;
  lowConfidenceCount: number;
  threshold?: number;
}

export function BulkApproveModal({
  isOpen,
  onClose,
  onConfirm,
  totalPending,
  eligibleCount,
  lowConfidenceCount,
  threshold = 95
}: BulkApproveModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <motion.div 
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", duration: 0.25 }}
            className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-md flex flex-col overflow-hidden text-text-primary shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-sidebar rounded-t-xl">
              <h2 className="text-base font-semibold text-text-primary">Bulk Approve Translations</h2>
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
                Reviewing <strong className="text-text-primary">{totalPending}</strong> pending translations against the configured confidence gate (≥{threshold}%).
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-bg-main border border-border-subtle rounded-lg">
                  <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" weight="bold" />
                  <div>
                    <h4 className="text-[13px] font-medium text-text-primary">
                      {eligibleCount} High-Confidence Translations Ready
                    </h4>
                    <p className="text-[12px] text-text-secondary mt-0.5">
                      These meet or exceed the {threshold}% confidence gate and will be marked as "Approved".
                    </p>
                  </div>
                </div>

                {lowConfidenceCount > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-bg-main border border-border-subtle rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" weight="bold" />
                    <div>
                      <h4 className="text-[13px] font-medium text-text-primary">
                        {lowConfidenceCount} Low-Confidence Item{lowConfidenceCount === 1 ? '' : 's'} Protected
                      </h4>
                      <p className="text-[12px] text-text-secondary mt-0.5">
                        Translations below {threshold}% confidence will be kept in "Pending Review" for individual verification.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-border-subtle flex items-center justify-end gap-2.5 bg-bg-sidebar rounded-b-xl">
              <button 
                onClick={onClose}
                className="h-8 px-3.5 text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                disabled={eligibleCount === 0}
                className="h-8 px-4 bg-accent-blue text-white text-[13px] font-medium rounded-md hover:brightness-110 transition-all active:scale-[0.98] cursor-pointer outline-none shadow-xs disabled:opacity-50 disabled:pointer-events-none"
              >
                Approve {eligibleCount} Strings
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

