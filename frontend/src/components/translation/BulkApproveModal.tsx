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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#091E42]/50"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="bg-background-card rounded-lg shadow-lg w-full max-w-md flex flex-col"
          >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-main">
          <h2 className="text-xl font-semibold text-main">Bulk Approve Translations</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-background-selected text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-main mb-6">
            You are about to approve <strong>{totalTags}</strong> translations for this page. They will be marked as "Approved" and will be included in the next deployment cycle.
          </p>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-[#E3FCEF] border border-[#36B37E] rounded-lg">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-success">High Confidence Translations</h4>
                <p className="text-xs text-success mt-1">{totalTags - lowConfidenceCount} tags have a confidence score of 85% or higher.</p>
              </div>
            </div>

            {lowConfidenceCount > 0 && (
              <div className="flex items-start gap-3 p-3 bg-[#FFFAE6] border border-[#FFE380] rounded-lg">
                <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-warning">Low Confidence Warning</h4>
                  <p className="text-xs text-warning mt-1">
                    {lowConfidenceCount} tags have a confidence score below 85%. It is recommended to review these manually.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-main flex items-center justify-end gap-3 bg-background-hover rounded-b-[4px]">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted hover:bg-background-selected rounded-lg transition-colors active:scale-95"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-hover transition-colors active:scale-95"
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
