import { useState, useEffect } from "react";
import { X, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface TranslationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (newTranslation: string) => void;
  onRegenerate: () => void;
  tagId: string;
  englishText: string;
  initialTranslation?: string;
  currentTranslation?: string;
  confidenceScore: number;
  languageName: string;
  languageDirection?: 'ltr' | 'rtl' | 'LTR' | 'RTL';
}

export function TranslationReviewModal({
  isOpen,
  onClose,
  onApprove,
  onRegenerate,
  tagId,
  englishText,
  initialTranslation = "",
  currentTranslation,
  confidenceScore,
  languageName,
  languageDirection = 'ltr'
}: TranslationReviewModalProps) {
  const effectiveTranslation = currentTranslation !== undefined ? currentTranslation : initialTranslation;
  const [editedText, setEditedText] = useState(effectiveTranslation);

  useEffect(() => {
    setEditedText(effectiveTranslation);
  }, [effectiveTranslation]);

  const isLowConfidence = confidenceScore < 85;

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
            className="bg-surface border border-border-main rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden text-text-main"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-main bg-surface">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-main">Review Translation</h2>
                <span className="px-2 py-0.5 bg-surface-active text-primary text-xs font-mono rounded border border-primary/20">
                  {tagId}
                </span>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto bg-surface space-y-5">
              {/* English Source */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-subtle mb-2">Master English Source</label>
                <div className="p-3.5 bg-surface-hover border border-border-main rounded-lg text-text-main text-sm leading-relaxed">
                  {englishText}
                </div>
              </div>

              {/* AI Translation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-subtle">{languageName} Translation</label>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded border",
                      isLowConfidence 
                        ? "bg-amber-500/10 text-warning border-amber-500/20" 
                        : "bg-emerald-500/10 text-success border-emerald-500/20"
                    )}>
                      {isLowConfidence ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      {confidenceScore}% Confidence
                    </div>
                    <button 
                      onClick={onRegenerate}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium active:scale-95 transition-transform cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                    </button>
                  </div>
                </div>
                <textarea
                  dir={languageDirection || "auto"}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full h-32 p-3.5 bg-surface border border-border-main rounded-lg text-text-main text-base focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none transition-all"
                />
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
                  onApprove(editedText);
                  onClose();
                }}
                className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover transition-colors active:scale-95 shadow-xs cursor-pointer"
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
