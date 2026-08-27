import { useState } from "react";
import { X, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (newText: string) => void;
  onRegenerate: () => void;
  tagId: string;
  englishText: string;
  initialTranslation: string;
  confidenceScore: number; // 0-100
  languageName: string;
  languageDirection: "LTR" | "RTL";
}

export function TranslationReviewModal({
  isOpen,
  onClose,
  onApprove,
  onRegenerate,
  tagId,
  englishText,
  initialTranslation,
  confidenceScore,
  languageName,
  languageDirection
}: ReviewModalProps) {
  const [editedText, setEditedText] = useState(initialTranslation);

  const isLowConfidence = confidenceScore < 85;

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
            className="bg-background-card rounded-lg shadow-lg w-full max-w-2xl flex flex-col max-h-[90vh]"
          >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-main">
          <h2 className="text-xl font-semibold text-main">Review Translation</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-background-selected text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-sm font-medium text-muted">Tag ID:</span>
            <span className="px-2 py-0.5 bg-background-selected text-main text-xs font-mono rounded">{tagId}</span>
          </div>

          <div className="space-y-6">
            {/* English Source */}
            <div>
              <label className="block text-sm font-semibold text-main mb-2">English Source</label>
              <div className="p-4 bg-background-hover border border-main rounded-lg text-main">
                {englishText}
              </div>
            </div>

            {/* AI Translation */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-main">{languageName} Translation</label>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded",
                    isLowConfidence ? "bg-[#FFFAE6] text-warning" : "bg-[#E3FCEF] text-success"
                  )}>
                    {isLowConfidence ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {confidenceScore}% AI Confidence
                  </div>
                  <button 
                    onClick={onRegenerate}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium active:scale-95 transition-transform"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                  </button>
                </div>
              </div>
              <textarea
                dir={languageDirection || "auto"}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full h-32 p-4 bg-background-card border border-main rounded-lg text-main text-lg focus:border-primary-light focus:outline-none resize-none transition-colors"
              />
            </div>
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
              onApprove(editedText);
              onClose();
            }}
            className="px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-hover transition-colors active:scale-95"
          >
            Approve Translation
          </button>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
