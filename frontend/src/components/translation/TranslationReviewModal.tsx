import {
  useState,
  useEffect } from "react";
import { X,
  WarningCircle as AlertCircle,
  ArrowsClockwise as RefreshCw,
  Sparkle as Sparkles
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { TranslationLengthGauge } from "./TranslationLengthGauge";
import { CopyButton } from "../ui/CopyButton";

interface TranslationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (newTranslation: string, reviewerComment?: string) => void;
  onReject?: (reason: string) => void;
  onReturnForRevision?: (comment: string) => void;
  onRegenerate: () => void;
  tagId: string;
  englishText: string;
  initialTranslation?: string;
  currentTranslation?: string;
  confidenceScore: number;
  languageName: string;
  languageDirection?: 'ltr' | 'rtl' | 'LTR' | 'RTL';
  stateCause?: string;
  backTranslation?: string;
}

export function TranslationReviewModal({
  isOpen,
  onClose,
  onApprove,
  onReject,
  onReturnForRevision,
  onRegenerate,
  tagId,
  englishText,
  initialTranslation = "",
  currentTranslation,
  confidenceScore,
  languageName,
  languageDirection,
  stateCause,
  backTranslation
}: TranslationReviewModalProps) {
  const effectiveTranslation = currentTranslation !== undefined ? currentTranslation : initialTranslation;
  const [editedText, setEditedText] = useState(effectiveTranslation);
  const [reviewerComment, setReviewerComment] = useState("");
  const [commentError, setCommentError] = useState("");

  useEffect(() => {
    setEditedText(effectiveTranslation);
    setReviewerComment("");
    setCommentError("");
  }, [effectiveTranslation, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const isEdited = editedText.trim() !== effectiveTranslation.trim();

  const handleApprove = () => {
    onApprove(editedText, reviewerComment.trim() || undefined);
    onClose();
  };

  const handleReject = () => {
    if (!reviewerComment.trim()) {
      setCommentError("Rejection reason is mandatory. Please provide feedback.");
      return;
    }
    if (onReject) {
      onReject(reviewerComment.trim());
    }
    onClose();
  };

  const handleReturnForRevision = () => {
    if (onReturnForRevision) {
      onReturnForRevision(reviewerComment.trim() || "Returned for revision by reviewer");
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: "spring", duration: 0.25 }}
            className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden text-text-primary shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-sidebar rounded-t-xl">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-text-primary">Review Translation</h2>
                <span className="px-2 py-0.5 bg-bg-active text-link text-xs font-mono rounded border border-border-subtle">
                  {tagId}
                </span>
              </div>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors cursor-pointer outline-none"
              >
                <X className="w-4 h-4" weight="bold" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto bg-bg-card space-y-4">
              {/* English Source */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-text-tertiary">Master English Source</label>
                  <CopyButton text={englishText} title="Copy English copy" />
                </div>
                <div className="p-3.5 bg-bg-main border border-border-subtle rounded-lg text-text-primary text-[14px] leading-relaxed">
                  {englishText}
                </div>
              </div>

              {/* AI Translation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">{languageName} Translation</label>
                  <div className="flex items-center gap-3">
                    <CopyButton text={editedText} title="Copy translation" />
                    <div className="flex items-center gap-1.5 text-xs font-mono font-medium px-2 py-0.5 rounded border border-border-subtle bg-bg-main text-text-secondary">
                      <Sparkles className="w-3.5 h-3.5 text-accent-blue" />
                      <span>{confidenceScore}% Confidence</span>
                    </div>
                    <button 
                      onClick={onRegenerate}
                      className="inline-flex items-center gap-1 text-[13px] text-link hover:underline font-medium active:scale-95 transition-transform cursor-pointer outline-none"
                    >
                      <RefreshCw className="w-3.5 h-3.5" weight="bold" /> Regenerate
                    </button>
                  </div>
                </div>
                <textarea
                  dir={languageDirection || "auto"}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full h-28 p-3.5 bg-bg-main border border-border-strong rounded-lg text-text-primary text-[14px] focus:border-accent-blue focus:ring-1 focus:ring-accent-blue focus:outline-none resize-none transition-all"
                />
                
                <TranslationLengthGauge 
                  sourceText={englishText}
                  translatedText={editedText}
                />
                
                {stateCause && (
                  <div className="mt-2 text-xs font-medium text-amber-500 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" weight="bold" />
                    <span>Engine Flag: {stateCause}</span>
                  </div>
                )}
                
                {backTranslation && (
                  <details className="mt-3 group">
                    <summary className="text-[13px] font-medium text-link hover:underline cursor-pointer select-none outline-none list-none inline-flex items-center gap-1">
                      <span className="group-open:hidden">Show</span>
                      <span className="hidden group-open:inline">Hide</span>
                      reading aid (back-translation)
                    </summary>
                    <div className="mt-2 p-3 bg-bg-hover border border-border-subtle rounded-md text-text-secondary text-[13px] italic">
                      {backTranslation}
                    </div>
                  </details>
                )}
              </div>

              {/* Reviewer Feedback / Note */}
              <div className="pt-2 border-t border-border-subtle">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                  Reviewer Note / Comment {onReject && <span className="text-text-tertiary font-normal">(Required for Reject)</span>}
                </label>
                <input
                  type="text"
                  placeholder="Add feedback, context, or rejection reason..."
                  value={reviewerComment}
                  onChange={(e) => {
                    setReviewerComment(e.target.value);
                    if (e.target.value.trim()) setCommentError("");
                  }}
                  className="w-full h-9 px-3 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary focus:border-accent-blue outline-none placeholder:text-text-tertiary transition-colors"
                />
                {commentError && (
                  <p className="text-[11px] font-medium text-danger mt-1">{commentError}</p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-3.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2.5 bg-bg-sidebar rounded-b-xl">
              <div className="flex items-center gap-2">
                {onReject && (
                  <button 
                    onClick={handleReject}
                    className="h-8 px-3 text-[12px] font-medium text-text-secondary hover:text-danger hover:bg-danger/10 border border-border-subtle hover:border-danger/30 rounded-md transition-colors cursor-pointer outline-none"
                  >
                    Reject
                  </button>
                )}
                {onReturnForRevision && (
                  <button 
                    onClick={handleReturnForRevision}
                    className="h-8 px-3 text-[12px] font-medium text-text-secondary hover:text-amber-500 hover:bg-amber-500/10 border border-border-subtle hover:border-amber-500/30 rounded-md transition-colors cursor-pointer outline-none"
                  >
                    Return for Revision
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={onClose}
                  className="h-8 px-3.5 text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleApprove}
                  className="h-8 px-4 bg-accent-blue text-white text-[12px] font-medium rounded-md hover:brightness-110 transition-all active:scale-[0.98] cursor-pointer outline-none shadow-xs"
                >
                  {isEdited ? "Edit & Approve" : "Approve Translation"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
