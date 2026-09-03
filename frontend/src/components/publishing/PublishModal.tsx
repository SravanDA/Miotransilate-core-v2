import {
  useState,
  useMemo,
  useEffect
} from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Globe, 
  CheckCircle, 
  CaretDown, 
  CaretRight, 
  ArrowClockwise,
  Check,
  FileCode
} from "@phosphor-icons/react";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { StoreService } from "../../store/StoreService";
import type { Environment, Tag, LanguageConfig } from "../../types";

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId?: string;
  onPublish: (env: Environment, langCode: string) => void;
  onPublishAll?: (env: Environment, languages: string[]) => void;
  totalTags: number;
  approvedTagsCount?: number;
  pageName: string;
  selectedLanguage?: string;
  initialLanguage?: string;
  initialEnvironment?: Environment;
  availableLanguages?: LanguageConfig[];
  tags?: Tag[];
}

type PublishScope = "single" | "all";

interface PublishedResultSummary {
  environment: Environment;
  timestamp: string;
  scope: PublishScope;
  results: {
    language: string;
    langName: string;
    version: number;
    count: number;
    isDuplicate: boolean;
  }[];
  totalStringsDeployed: number;
}

export function PublishModal({
  isOpen,
  onClose,
  pageId: propPageId,
  onPublish,
  onPublishAll,
  totalTags: _totalTags = 0,
  approvedTagsCount: _approvedTagsCount,
  pageName,
  selectedLanguage = "eng",
  initialLanguage,
  initialEnvironment,
  availableLanguages = [],
  tags = []
}: PublishModalProps) {
  const { user, can } = useAuth();
  const [publishScope, setPublishScope] = useState<PublishScope>(initialLanguage ? "single" : "all");
  const [targetEnv, setTargetEnv] = useState<Environment>(initialEnvironment || "PRODUCTION");
  const [activeLangCode, setActiveLangCode] = useState<string>(initialLanguage || selectedLanguage || "eng");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showTagDiffInspection, setShowTagDiffInspection] = useState(false);
  const [publishedSummary, setPublishedSummary] = useState<PublishedResultSummary | null>(null);

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

  // Reset summary when modal opens
  useEffect(() => {
    if (isOpen) {
      setPublishedSummary(null);
      setIsPublishing(false);
      setShowTagDiffInspection(false);
      setPublishScope(initialLanguage ? "single" : "all");
      if (initialEnvironment) setTargetEnv(initialEnvironment);
      if (initialLanguage) setActiveLangCode(initialLanguage);
    }
  }, [isOpen, initialLanguage, initialEnvironment]);

  const pageId = propPageId || tags?.[0]?.pageId || "";
  const currentTags = useMemo(() => {
    if (tags && tags.length > 0) return tags;
    if (pageId) return StoreService.getTags(pageId);
    return [];
  }, [tags, pageId]);

  // Single language diff summary
  const singleDiff = useMemo(() => {
    if (!pageId) {
      const isEng = activeLangCode === "eng" || activeLangCode === "en";
      const approvedCount = isEng 
        ? currentTags.filter(t => t.english && t.english.trim().length > 0).length
        : currentTags.filter(t => t.values?.[activeLangCode]?.status === "Approved").length;
      return {
        totalCount: approvedCount,
        totalTagsCount: currentTags.length,
        newCount: approvedCount,
        updatedCount: 0,
        previousVersion: null,
        nextVersion: 1,
        isDuplicate: false,
        variableErrorsCount: 0,
        approvedTags: isEng ? currentTags : currentTags.filter(t => t.values?.[activeLangCode]?.status === "Approved")
      };
    }
    return StoreService.getPublishDiffSummary(pageId, activeLangCode, targetEnv);
  }, [pageId, activeLangCode, targetEnv, currentTags]);

  // Multi-language summary matrix
  const multiSummary = useMemo(() => {
    if (!pageId) {
      return {
        summaries: [],
        totalTags: currentTags.length,
        totalApprovedAcrossAll: 0,
        totalExcludedAcrossAll: 0,
        totalVariableErrors: 0,
        fullyReadyLanguagesCount: 0,
        totalLanguagesCount: availableLanguages.length,
        incompleteLanguages: []
      };
    }
    return StoreService.getMultiLanguagePublishSummary(pageId, targetEnv);
  }, [pageId, targetEnv, currentTags.length, availableLanguages.length]);

  // Permission checks
  const canPublishProdDirect = can('PUBLISH_PRODUCTION') || user?.roles?.includes('FN') || user?.roles?.includes('SR');

  const handleExecutePublish = async () => {
    setIsPublishing(true);

    if (targetEnv === "PRODUCTION" && !canPublishProdDirect) {
      // Production approval flow
      if (publishScope === "single") {
        await StoreService.requestPublishApproval(
          pageId,
          pageName,
          activeLangCode,
          targetEnv,
          singleDiff.totalCount,
          user?.displayName || "Author"
        );
      } else {
        for (const lang of availableLanguages) {
          const langDiff = StoreService.getPublishDiffSummary(pageId, lang.code, targetEnv);
          if (langDiff.totalCount > 0) {
            await StoreService.requestPublishApproval(
              pageId,
              pageName,
              lang.code,
              targetEnv,
              langDiff.totalCount,
              user?.displayName || "Author"
            );
          }
        }
      }
      setIsPublishing(false);
      onClose();
      return;
    }

    if (publishScope === "single") {
      const res = await StoreService.publish(
        pageId,
        pageName,
        activeLangCode,
        targetEnv,
        singleDiff.totalCount,
        user?.displayName || "System User"
      );

      const activeLangObj = availableLanguages.find(l => l.code === activeLangCode);
      const langName = activeLangCode === "eng" ? "English" : (activeLangObj?.name || activeLangCode);

      setPublishedSummary({
        environment: targetEnv,
        timestamp: new Date().toLocaleTimeString(),
        scope: "single",
        results: [{
          language: activeLangCode,
          langName,
          version: res.version,
          count: singleDiff.totalCount,
          isDuplicate: res.isDuplicate
        }],
        totalStringsDeployed: singleDiff.totalCount
      });

      onPublish(targetEnv, activeLangCode);
      setIsPublishing(false);
    } else {
      // All active languages + English master
      const languagesToPublish = ["eng", ...availableLanguages.map(l => l.code).filter(c => c !== "eng")];
      const res = await StoreService.publishMultiLanguage(
        pageId,
        pageName,
        languagesToPublish,
        targetEnv,
        user?.displayName || "System User"
      );

      const summaryResults = res.results.map(r => {
        const langObj = availableLanguages.find(l => l.code === r.language);
        return {
          language: r.language,
          langName: langObj ? `${langObj.name} (${langObj.nativeName})` : r.language,
          version: r.version,
          count: r.count,
          isDuplicate: r.isDuplicate
        };
      });

      setPublishedSummary({
        environment: targetEnv,
        timestamp: new Date().toLocaleTimeString(),
        scope: "all",
        results: summaryResults,
        totalStringsDeployed: res.totalStringsDeployed
      });

      if (onPublishAll) {
        onPublishAll(targetEnv, languagesToPublish);
      } else {
        onPublish(targetEnv, activeLangCode);
      }
      setIsPublishing(false);
    }
  };

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Calculations for stats
  const totalApproved = publishScope === "single" ? singleDiff.totalCount : multiSummary.totalApprovedAcrossAll;
  const totalExcluded = publishScope === "single" 
    ? (singleDiff.totalTagsCount - singleDiff.totalCount) 
    : multiSummary.totalExcludedAcrossAll;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget && !isPublishing) onClose(); }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-xs overflow-hidden"
        >
          <motion.div 
            initial={{ scale: 0.98, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 6 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-[780px] max-h-[90vh] flex flex-col overflow-hidden text-text-primary shadow-xl my-auto"
          >
            {/* Clean Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-card shrink-0">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[15px] font-semibold text-text-primary tracking-tight">
                    Release Control Center
                  </h2>
                  <span className={cn(
                    "text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase tracking-wide",
                    targetEnv === "PRODUCTION"
                      ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                      : targetEnv === "QA"
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                      : "bg-accent-blue/10 text-accent-blue border-accent-blue/20"
                  )}>
                    {targetEnv}
                  </span>
                </div>
                <p className="text-[12px] text-text-tertiary mt-0.5">
                  Deploy verified copy for <span className="text-text-secondary font-medium">{pageName}</span> ({pageId})
                </p>
              </div>

              <div className="flex items-center gap-2">
                <kbd className="text-[10px] font-mono text-text-tertiary px-1.5 py-0.5 rounded border border-border-subtle bg-bg-main hidden sm:inline-block">
                  ESC
                </kbd>
                <button 
                  onClick={onClose}
                  disabled={isPublishing}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 cursor-pointer outline-none"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Post-Publish Executive Receipt */}
            {publishedSummary ? (
              <div className="p-6 space-y-5 overflow-y-auto">
                <div className="flex items-start gap-3.5 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" weight="fill" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-emerald-300">
                      Release deployed successfully to {publishedSummary.environment}
                    </h3>
                    <p className="text-[12px] text-emerald-400/90 mt-0.5 leading-relaxed">
                      Deployed <strong className="font-semibold">{publishedSummary.totalStringsDeployed} approved strings</strong> into live bundles at {publishedSummary.timestamp}. Unapproved drafts remain safely in the workspace.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-main">
                    <div className="grid grid-cols-12 px-4 py-2 border-b border-border-subtle text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                      <div className="col-span-5">Language</div>
                      <div className="col-span-4 text-center">Version</div>
                      <div className="col-span-3 text-right">Deployed Strings</div>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto divide-y divide-border-subtle text-[12px]">
                      {publishedSummary.results.map((r) => (
                        <div key={r.language} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-bg-card/40 transition-colors">
                          <div className="col-span-5 font-medium text-text-primary flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>{r.langName}</span>
                            <span className="text-[11px] font-mono text-text-tertiary">({r.language})</span>
                          </div>
                          <div className="col-span-4 text-center font-mono text-accent-blue font-semibold">
                            v{r.version}
                          </div>
                          <div className="col-span-3 text-right text-text-secondary">
                            {r.count} strings
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 rounded-lg bg-accent-blue text-white font-semibold text-[12px] hover:bg-accent-blue/90 cursor-pointer outline-none transition-all shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Pre-Publish Configuration */
              <div className="flex flex-col flex-1 min-h-0">
                
                {/* Clean Integrated Controls Bar */}
                <div className="px-6 py-3 border-b border-border-subtle bg-bg-sidebar/40 flex flex-wrap items-center justify-between gap-3">
                  
                  {/* Target Environment Segmented Control */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Environment:</span>
                    <div className="inline-flex p-0.5 rounded-lg bg-bg-main border border-border-subtle text-[12px]">
                      <button 
                        type="button"
                        onClick={() => setTargetEnv("DEV")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer",
                          targetEnv === "DEV" ? "bg-bg-card text-text-primary shadow-xs font-semibold" : "text-text-tertiary hover:text-text-secondary"
                        )}
                      >
                        Dev (Sandbox)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setTargetEnv("QA")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer",
                          targetEnv === "QA" ? "bg-bg-card text-text-primary shadow-xs font-semibold" : "text-text-tertiary hover:text-text-secondary"
                        )}
                      >
                        QA (Staging)
                      </button>
                      <button 
                        type="button"
                        onClick={() => setTargetEnv("PRODUCTION")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5",
                          targetEnv === "PRODUCTION" ? "bg-bg-card text-rose-500 shadow-xs font-semibold" : "text-text-tertiary hover:text-text-secondary"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Prod (Live)
                      </button>
                    </div>
                  </div>

                  {/* Scope Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Scope:</span>
                    <div className="inline-flex p-0.5 rounded-lg bg-bg-main border border-border-subtle text-[12px]">
                      <button
                        type="button"
                        onClick={() => setPublishScope("all")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer",
                          publishScope === "all" ? "bg-bg-card text-text-primary shadow-xs font-semibold" : "text-text-tertiary hover:text-text-secondary"
                        )}
                      >
                        All Languages ({availableLanguages.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublishScope("single")}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer",
                          publishScope === "single" ? "bg-bg-card text-text-primary shadow-xs font-semibold" : "text-text-tertiary hover:text-text-secondary"
                        )}
                      >
                        Single Language
                      </button>
                    </div>

                    {publishScope === "single" && (
                      <Dropdown
                        value={activeLangCode}
                        onChange={setActiveLangCode}
                        className="w-48 text-[12px]"
                        options={[
                          { value: "eng", label: "English (Master)" },
                          ...availableLanguages.map(l => ({ value: l.code, label: `${l.name} (${l.code})` }))
                        ]}
                      />
                    )}
                  </div>
                </div>

                {/* Scannable Summary Tally Strip */}
                <div className="px-6 py-3 flex items-center justify-between text-[12px] bg-bg-card border-b border-border-subtle/60">
                  <div className="flex items-center gap-3 text-text-secondary">
                    <span>
                      <strong className="text-text-primary font-semibold">{totalApproved}</strong> of {totalApproved + totalExcluded} strings ready to deploy
                    </span>
                    <span className="text-border-strong">·</span>
                    <span className="text-text-tertiary">
                      {totalExcluded} draft or in-review excluded
                    </span>
                  </div>

                  {totalExcluded > 0 && (
                    <span className="text-[11px] text-amber-500/90 font-medium">
                      Incomplete strings remain isolated in workspace
                    </span>
                  )}
                </div>

                {/* Language Table as Centerpiece */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                  {publishScope === "all" ? (
                    <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-main">
                      <div className="grid grid-cols-12 px-4 py-2.5 border-b border-border-subtle text-[11px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-sidebar/50">
                        <div className="col-span-4">Language</div>
                        <div className="col-span-2 text-center">Approved</div>
                        <div className="col-span-3 text-center">Coverage</div>
                        <div className="col-span-1 text-center">Version</div>
                        <div className="col-span-2 text-right">Status</div>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto divide-y divide-border-subtle text-[12px]">
                        {multiSummary.summaries.map((s) => (
                          <div key={s.code} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-bg-card/40 transition-colors">
                            {/* Language Name */}
                            <div className="col-span-4 font-medium text-text-primary flex items-center gap-2 truncate">
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                s.isReady ? "bg-emerald-500" : s.approvedCount > 0 ? "bg-amber-500" : "bg-zinc-600"
                              )} />
                              <span className="truncate">{s.name}</span>
                              <span className="text-[11px] text-text-tertiary font-mono">({s.code})</span>
                            </div>

                            {/* Approved Count */}
                            <div className="col-span-2 text-center text-text-secondary font-mono">
                              <span className="text-text-primary font-semibold">{s.approvedCount}</span> / {s.totalTags}
                            </div>

                            {/* Progress bar */}
                            <div className="col-span-3 flex items-center justify-center gap-2">
                              <div className="w-20 h-1.5 bg-bg-card rounded-full overflow-hidden border border-border-subtle">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    s.coveragePercent === 100 ? "bg-emerald-500" : s.coveragePercent > 0 ? "bg-amber-500" : "bg-zinc-700"
                                  )}
                                  style={{ width: `${s.coveragePercent}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-text-tertiary w-7 text-right">
                                {s.coveragePercent}%
                              </span>
                            </div>

                            {/* Target Version */}
                            <div className="col-span-1 text-center font-mono text-[11px] text-text-secondary">
                              v{s.nextVersion}
                            </div>

                            {/* Status */}
                            <div className="col-span-2 text-right">
                              <span className={cn(
                                "text-[10px] font-medium px-2 py-0.5 rounded border",
                                s.isReady 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : s.approvedCount > 0 
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                                  : "bg-zinc-800/40 text-zinc-400 border-zinc-700/50"
                              )}>
                                {s.isReady ? "100% Ready" : s.approvedCount > 0 ? "Partial" : "No Trans"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Single Language View */
                    <div className="border border-border-subtle rounded-lg p-4 bg-bg-main space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-accent-blue" />
                          <span className="text-[13px] font-semibold text-text-primary">
                            {availableLanguages.find(l => l.code === activeLangCode)?.name || activeLangCode} Bundle
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-text-tertiary">
                          Target Release: v{singleDiff.nextVersion}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 pt-1 text-[12px]">
                        <div>
                          <div className="text-[11px] text-text-tertiary font-medium">Approved to Deploy</div>
                          <div className="text-lg font-semibold text-emerald-400 mt-0.5">{singleDiff.totalCount} strings</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-text-tertiary font-medium">New or Modified</div>
                          <div className="text-lg font-semibold text-text-primary mt-0.5">+{singleDiff.newCount}</div>
                        </div>
                        <div>
                          <div className="text-[11px] text-text-tertiary font-medium">Excluded Incomplete</div>
                          <div className="text-lg font-semibold text-amber-400 mt-0.5">{singleDiff.totalTagsCount - singleDiff.totalCount}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Compact Verification Strip & Payload Inspector */}
                  <div className="pt-2 border-t border-border-subtle/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-tertiary">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 text-emerald-500 font-medium">
                        <Check className="w-3.5 h-3.5" weight="bold" /> Syntax verified
                      </span>
                      <span className="flex items-center gap-1 text-emerald-500 font-medium">
                        <Check className="w-3.5 h-3.5" weight="bold" /> Zero-flicker bundle
                      </span>
                      <span className="flex items-center gap-1 text-emerald-500 font-medium">
                        <Check className="w-3.5 h-3.5" weight="bold" />
                        {canPublishProdDirect ? "Direct deploy authorized" : "Approval gate active"}
                      </span>
                    </div>

                    {singleDiff.approvedTags.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setShowTagDiffInspection(!showTagDiffInspection)} 
                        className="text-link hover:underline cursor-pointer font-medium flex items-center gap-1"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>{showTagDiffInspection ? "Hide payload" : "Inspect payload strings"}</span>
                        {showTagDiffInspection ? <CaretDown className="w-3 h-3" /> : <CaretRight className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Collapsible Payload Drawer */}
                  {showTagDiffInspection && (
                    <div className="border border-border-subtle rounded-lg p-3 bg-bg-sidebar/30 max-h-[140px] overflow-y-auto space-y-1.5 text-[11px]">
                      {singleDiff.approvedTags.slice(0, 15).map(tag => (
                        <div key={tag.id} className="flex items-center justify-between py-1 border-b border-border-subtle/40 last:border-0">
                          <code className="font-mono text-text-primary font-medium">{tag.id}</code>
                          <span className="text-text-tertiary truncate max-w-[420px] italic">
                            "{tag.values?.[activeLangCode]?.text || tag.english}"
                          </span>
                        </div>
                      ))}
                      {singleDiff.approvedTags.length > 15 && (
                        <div className="text-[10px] text-text-tertiary text-center pt-1 font-mono">
                          + {singleDiff.approvedTags.length - 15} more strings
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* High-Clarity Footer */}
                <div className="px-6 py-3.5 border-t border-border-subtle flex items-center justify-between bg-bg-card shrink-0">
                  <div className="text-[12px] text-text-tertiary">
                    {totalApproved === 0 ? (
                      <span>No strings eligible to deploy</span>
                    ) : (
                      <span>
                        Deploying <strong className="text-text-primary font-semibold">{totalApproved} approved strings</strong> to <strong className="text-text-secondary uppercase">{targetEnv}</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button 
                      type="button"
                      onClick={onClose}
                      disabled={isPublishing}
                      className="px-3.5 py-1.5 rounded-lg border border-border-subtle text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer outline-none transition-all"
                    >
                      Cancel
                    </button>

                    <button 
                      type="button"
                      onClick={handleExecutePublish}
                      disabled={isPublishing || totalApproved === 0}
                      className={cn(
                        "px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all shadow-xs flex items-center gap-2",
                        totalApproved === 0
                          ? "bg-bg-main border border-border-subtle text-text-tertiary cursor-not-allowed"
                          : targetEnv === "PRODUCTION"
                          ? "bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                          : "bg-accent-blue hover:bg-accent-blue/90 text-white cursor-pointer"
                      )}
                    >
                      {isPublishing ? (
                        <>
                          <ArrowClockwise className="w-3.5 h-3.5 animate-spin" />
                          <span>Publishing...</span>
                        </>
                      ) : totalApproved === 0 ? (
                        "No Approved Strings to Deploy"
                      ) : targetEnv === "PRODUCTION" && !canPublishProdDirect ? (
                        "Request Release Approval"
                      ) : (
                        `Publish to ${targetEnv === "PRODUCTION" ? "Production" : targetEnv === "QA" ? "Staging" : "Development"}`
                      )}
                    </button>
                  </div>
                </div>

              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
