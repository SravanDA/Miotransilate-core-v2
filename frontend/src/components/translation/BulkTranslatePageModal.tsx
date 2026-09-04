import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
   Sparkle as Sparkles, 
   Check, 
   X, 
   CircleNotch, 
   CheckCircle, 
   WarningCircle, 
   Globe,
   FileText,
   Translate
} from "@phosphor-icons/react";
import { StoreService } from "../../store/StoreService";
import { engine } from "../../engine/TranslationEngine";
import { useToast } from "../../contexts/ToastContext";

interface BulkTranslatePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  pageName: string;
  onComplete?: () => void;
}

interface LanguageRunStatus {
  code: string;
  name: string;
  status: "idle" | "in-progress" | "complete" | "no-eligible" | "failed";
  translated?: number;
  total?: number;
  needsAttention?: number;
  error?: string;
}

export function BulkTranslatePageModal({
  isOpen,
  onClose,
  pageId,
  pageName,
  onComplete
}: BulkTranslatePageModalProps) {
  const { toast } = useToast();
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
  const [selectedLangs, setSelectedLangs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunningLang, setCurrentRunningLang] = useState<string | null>(null);
  const [langStatuses, setLangStatuses] = useState<Record<string, LanguageRunStatus>>({});
  const [completedCount, setCompletedCount] = useState(0);
  const [totalTranslatedStrings, setTotalTranslatedStrings] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const tags = StoreService.getTags(pageId);
  const validEnglishCount = tags.filter(t => t.english && t.english.trim().length > 0).length;
  const missingEnglishCount = tags.length - validEnglishCount;

  useEffect(() => {
    if (isOpen) {
      const langs = StoreService.getActiveLanguages();
      setActiveLangs(langs);
      setSelectedLangs(langs.map(l => l.code));
      setIsRunning(false);
      setCurrentRunningLang(null);
      setIsFinished(false);
      setCompletedCount(0);
      setTotalTranslatedStrings(0);

      const initialStatuses: Record<string, LanguageRunStatus> = {};
      langs.forEach(l => {
        initialStatuses[l.code] = {
          code: l.code,
          name: l.name,
          status: "idle"
        };
      });
      setLangStatuses(initialStatuses);
    }
  }, [isOpen, pageId]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleToggleLang = (code: string) => {
    if (isRunning) return;
    setSelectedLangs(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleToggleAll = () => {
    if (isRunning) return;
    if (selectedLangs.length === activeLangs.length) {
      setSelectedLangs([]);
    } else {
      setSelectedLangs(activeLangs.map(l => l.code));
    }
  };

  const handleStartBulkTranslation = async () => {
    if (selectedLangs.length === 0) return;
    setIsRunning(true);
    setIsFinished(false);
    setCompletedCount(0);
    setTotalTranslatedStrings(0);

    const statuses = { ...langStatuses };
    selectedLangs.forEach(code => {
      if (statuses[code]) {
        statuses[code] = { ...statuses[code], status: "idle", error: undefined };
      }
    });
    setLangStatuses(statuses);

    try {
      const result = await engine.translatePageAllLanguages(
        pageId,
        selectedLangs,
        (progress) => {
          setCurrentRunningLang(progress.currentLang);
          setCompletedCount(progress.completedLangs);

          if (progress.langResult) {
            setLangStatuses(prev => {
              const prevItem = prev[progress.currentLang];
              const res = progress.langResult!;
              let st: LanguageRunStatus["status"] = "complete";
              if (res.status === "FAILED") st = "failed";
              else if (res.status === "NO_ELIGIBLE_TAGS") st = "no-eligible";

              return {
                ...prev,
                [progress.currentLang]: {
                  ...prevItem,
                  status: st,
                  translated: res.translated,
                  total: res.total,
                  needsAttention: res.needsAttention,
                  error: res.error
                }
              };
            });
          } else {
            setLangStatuses(prev => ({
              ...prev,
              [progress.currentLang]: {
                ...prev[progress.currentLang],
                status: "in-progress"
              }
            }));
          }
        }
      );

      setTotalTranslatedStrings(result.totalTranslated);
      setIsFinished(true);
      toast(`✨ Bulk translation complete: Generated ${result.totalTranslated} strings across ${selectedLangs.length} languages!`, { type: "success" });
      if (onComplete) onComplete();
    } catch (e: any) {
      console.error("Bulk translate execution error", e);
      toast("Error during bulk translation execution", { type: "error" });
    } finally {
      setIsRunning(false);
      setCurrentRunningLang(null);
    }
  };

  const progressPercent = selectedLangs.length > 0 
    ? Math.round((completedCount / selectedLangs.length) * 100) 
    : 0;

  return createPortal(
    <div 
      onClick={(e) => { if (e.target === e.currentTarget && !isRunning) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-hidden"
    >
      <div className="bg-bg-card border border-border-subtle rounded-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] my-auto text-text-primary">
        {/* Modal Header */}
        <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-bg-sidebar">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-blue/15 flex items-center justify-center text-accent-blue ">
              <Sparkles className="w-4 h-4" weight="fill" />
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-text-primary tracking-tight">Bulk Translate Page</h2>
              <p className="text-[11px] text-text-tertiary">Translate all tags on &quot;{pageName}&quot; across target languages</p>
            </div>
          </div>
          {!isRunning && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none"
            >
              <X className="w-4 h-4" weight="bold" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          {/* Readiness Banner */}
          <div className="p-3 bg-bg-sidebar border border-border-subtle rounded-xl flex items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-text-tertiary" weight="bold" />
              <span className="text-text-secondary font-medium">Source English Strings:</span>
              <strong className="text-text-primary font-semibold tabular-nums">{validEnglishCount} of {tags.length}</strong>
            </div>
            {missingEnglishCount > 0 ? (
              <span className="text-[11px] text-warning font-medium">
                {missingEnglishCount} missing English
              </span>
            ) : (
              <span className="text-[11px] text-emerald-500 font-semibold inline-flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" weight="fill" /> 100% Ready
              </span>
            )}
          </div>

          {/* Progress Tracker when running or finished */}
          {(isRunning || isFinished) && (
            <div className="p-3.5 bg-bg-sidebar border border-accent-blue/25 rounded-xl flex flex-col gap-2 ">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-text-primary">
                  {isFinished ? "Translation Completed" : `Translating ${currentRunningLang || "..."}`}
                </span>
                <span className="font-mono text-accent-blue font-bold tabular-nums">
                  {completedCount}/{selectedLangs.length} ({progressPercent}%)
                </span>
              </div>
              <div className="w-full bg-bg-card rounded-full h-2 overflow-hidden border border-border-subtle">
                <div 
                  className="h-full bg-accent-blue transition-all duration-300 ease-out" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Languages Selector List */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                Select Target Languages ({selectedLangs.length}/{activeLangs.length})
              </span>
              {!isRunning && (
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="text-[11px] font-semibold text-accent-blue hover:underline cursor-pointer outline-none"
                >
                  {selectedLangs.length === activeLangs.length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            <div className="border border-border-subtle rounded-xl overflow-hidden divide-y divide-border-subtle bg-bg-card">
              {activeLangs.map((lang) => {
                const isSelected = selectedLangs.includes(lang.code);
                const status = langStatuses[lang.code];
                const isCurrentlyActive = currentRunningLang === lang.code;

                return (
                  <div
                    key={lang.code}
                    onClick={() => handleToggleLang(lang.code)}
                    className={`px-3 py-2.5 flex items-center justify-between transition-colors ${
                      isRunning ? "cursor-default" : "cursor-pointer hover:bg-bg-hover"
                    } ${isSelected ? "bg-bg-card" : "opacity-50"}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isRunning}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 accent-accent-blue rounded cursor-pointer"
                      />
                      <Globe className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                      <span className="text-[13px] font-medium text-text-primary truncate">
                        {lang.name}
                      </span>
                      <span className="font-mono text-[10px] uppercase font-bold text-text-tertiary bg-bg-sidebar px-1.5 py-0.5 rounded border border-border-subtle">
                        {lang.code}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isCurrentlyActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-blue animate-pulse">
                          <CircleNotch className="w-3 h-3 animate-spin" /> Translating...
                        </span>
                      ) : status?.status === "complete" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                          <CheckCircle className="w-3.5 h-3.5" weight="fill" /> 
                          {status.translated !== undefined ? `${status.translated} tags` : "Done"}
                        </span>
                      ) : status?.status === "no-eligible" ? (
                        <span className="text-[11px] text-text-tertiary">Up to date</span>
                      ) : status?.status === "failed" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger">
                          <WarningCircle className="w-3.5 h-3.5" weight="fill" /> Failed
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-border-subtle flex items-center justify-between bg-bg-sidebar">
          <div className="text-[11px] text-text-tertiary">
            {isFinished ? (
              <span className="text-text-primary font-medium">Generated {totalTranslatedStrings} translations</span>
            ) : (
              <span>Translates unapproved tags preserving existing approvals</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRunning}
              onClick={onClose}
              className="h-8 px-3 rounded-lg border border-border-subtle text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer outline-none transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {isFinished ? "Close" : "Cancel"}
            </button>
            {!isFinished ? (
              <button
                type="button"
                disabled={isRunning || selectedLangs.length === 0 || validEnglishCount === 0}
                onClick={handleStartBulkTranslation}
                className="h-8 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold transition-all shadow-xs outline-none bg-accent-blue hover:bg-accent-blue/90 text-white cursor-pointer active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isRunning ? (
                  <>
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" />
                    <span>Translating...</span>
                  </>
                ) : (
                  <>
                    <Translate className="w-3.5 h-3.5" weight="bold" />
                    <span>
                      {selectedLangs.length > 0
                        ? `Translate ${selectedLangs.length} Language${selectedLangs.length > 1 ? "s" : ""}`
                        : "Translate Languages"}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-4 inline-flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold transition-all shadow-xs outline-none bg-accent-blue hover:bg-accent-blue/90 text-white cursor-pointer active:scale-[0.98] whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5" weight="bold" />
                <span>Done</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
