import { X, CheckCircle, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface BulkApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  totalTags: number;
  lowConfidenceCount: number;
}

export function BulkApproveModal({
  isOpen,
  onClose,
  onConfirm,
  totalTags,
  lowConfidenceCount
}: BulkApproveModalProps) {
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
            className="bg-surface border border-border-main rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden text-text-main"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-main bg-surface">
              <h2 className="text-base font-semibold text-text-main">Bulk Approve Translations</h2>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 bg-surface space-y-4">
              <p className="text-sm text-text-muted leading-relaxed">
                You are about to approve <strong className="text-text-main">{totalTags}</strong> translations for this page. They will be marked as "Approved" and included in future release bundles.
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-success">High Confidence Translations</h4>
                    <p className="text-xs text-text-muted mt-0.5">{totalTags - lowConfidenceCount} tags have a confidence score of 85% or higher.</p>
                  </div>
                </div>

                {lowConfidenceCount > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-warning">Low Confidence Warning</h4>
                      <p className="text-xs text-text-muted mt-0.5">
                        {lowConfidenceCount} tags have a confidence score below 85%. It is recommended to review these manually.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border-main flex items-center justify-end gap-3 bg-surface-hover">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-main hover:bg-surface border border-border-main rounded-lg transition-colors active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover transition-colors active:scale-95 shadow-xs cursor-pointer"
              >
                Approve All
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
