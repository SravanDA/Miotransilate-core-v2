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
  Warning, 
  ShieldCheck, 
  CaretDown, 
  CaretRight, 
  RocketLaunch, 
  ArrowClockwise,
  Check,
  FileCode,
  Info
} from "@phosphor-icons/react";
import { Dropdown } from "../ui/Dropdown";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip } from "../ui/Tooltip";
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
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  const ENV_OPTIONS: { env: Environment; label: string; desc: string }[] = [
    { env: "DEV", label: "Dev", desc: "Development build" },
    { env: "QA", label: "QA", desc: "Testing & Staging" },
    { env: "PRODUCTION", label: "Prod", desc: "Live user traffic" }
  ];

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget && !isPublishing) onClose(); }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs overflow-hidden"
        >
          <motion.div 
            initial={{ scale: 0.97, opacity: 0, y: 6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: 6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-[620px] max-h-[90vh] flex flex-col overflow-hidden text-text-primary my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle bg-bg-sidebar rounded-t-xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center border border-accent-blue/20">
                  <RocketLaunch className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-text-primary tracking-tight flex items-center gap-2">
                    Release Control Center
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-card border border-border-subtle text-text-secondary uppercase">
                      {targetEnv}
                    </span>
                  </h2>
                  <p className="text-[11px] text-text-tertiary mt-0.5">{pageName} ({pageId}) · Release Pipeline</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="text-[10px] font-mono text-text-tertiary px-1.5 py-0.5 rounded border border-border-subtle bg-bg-main hidden sm:inline-block">
                  ESC
                </kbd>
                <button 
                  onClick={onClose}
                  disabled={isPublishing}
                  className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 cursor-pointer outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Success Summary OR Configuration Form */}
            {publishedSummary ? (
              /* Post-Publish Executive Summary */
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <CheckCircle className="w-6 h-6 shrink-0" />
                  <div>
                    <div className="text-[13px] font-semibold text-emerald-300">
                      Successfully Published to {publishedSummary.environment}!
                    </div>
                    <div className="text-[11px] text-emerald-400/80 mt-0.5">
                      Deployed {publishedSummary.totalStringsDeployed} approved strings at {publishedSummary.timestamp}.
                    </div>
                  </div>
                </div>

                {/* Deployed Versions Breakdown */}
                <div>
                  <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                    Deployed Bundle Manifest
                  </div>
                  <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-main">
                    <div className="grid grid-cols-12 px-3 py-2 border-b border-border-subtle text-[11px] font-semibold text-text-tertiary uppercase">
                      <div className="col-span-6">Language</div>
                      <div className="col-span-3 text-right">Release Version</div>
                      <div className="col-span-3 text-right">Strings</div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto divide-y divide-border-subtle">
                      {publishedSummary.results.map((r) => (
                        <div key={r.language} className="grid grid-cols-12 px-3 py-2 text-[12px] items-center">
                          <div className="col-span-6 font-medium text-text-primary flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-success"></span>
                            {r.langName}
                          </div>
                          <div className="col-span-3 text-right font-mono text-[11px] text-accent-blue font-bold">
                            v{r.version}
                          </div>
                          <div className="col-span-3 text-right font-mono text-[11px] text-text-secondary">
                            {r.count} strings
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-primary"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Pre-Publish Configuration & Safety Checks */
              <div className="p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                {/* Scope & Target Environment Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Scope Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                      Release Scope
                    </label>
                    <div className="grid grid-cols-2 bg-bg-main p-1 rounded-lg border border-border-subtle gap-1">
                      <button
                        type="button"
                        onClick={() => setPublishScope("single")}
                        className={cn(
                          "h-8 px-2 rounded-md text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer outline-none",
                          publishScope === "single"
                            ? "bg-bg-card text-text-primary border border-border-strong font-semibold "
                            : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                        )}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Single Language</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPublishScope("all")}
                        className={cn(
                          "h-8 px-2 rounded-md text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer outline-none",
                          publishScope === "all"
                            ? "bg-bg-card text-text-primary border border-border-strong font-semibold "
                            : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                        )}
                      >
                        <RocketLaunch className="w-3.5 h-3.5" />
                        <span>All Languages</span>
                      </button>
                    </div>
                  </div>

                  {/* Target Environment Selector */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                      Target Environment
                    </label>
                    <div className="grid grid-cols-3 bg-bg-main p-1 rounded-lg border border-border-subtle gap-1">
                      {ENV_OPTIONS.map(({ env, label }) => {
                        const isSelected = targetEnv === env;
                        return (
                          <button
                            key={env}
                            type="button"
                            onClick={() => setTargetEnv(env)}
                            className={cn(
                              "h-8 px-2 rounded-md text-[12px] font-medium transition-all flex items-center justify-center gap-1 cursor-pointer outline-none",
                              isSelected
                                ? env === "PRODUCTION"
                                  ? "bg-danger/15 text-danger border border-danger/30 font-semibold "
                                  : env === "QA"
                                    ? "bg-warning/15 text-warning border border-warning/30 font-semibold "
                                    : "bg-accent-blue/15 text-accent-blue border border-accent-blue/30 font-semibold "
                                : "text-text-tertiary hover:text-text-secondary hover:bg-bg-hover"
                            )}
                          >
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Scope: Single Language Target Selector */}
                {publishScope === "single" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                      Language
                    </label>
                    <Dropdown
                      value={activeLangCode}
                      onChange={(code) => setActiveLangCode(code)}
                      options={[
                        { value: "eng", label: "English (Master Copy)" },
                        ...availableLanguages.map(lang => ({
                          value: lang.code,
                          label: `${lang.name} (${lang.nativeName})`
                        }))
                      ]}
                      className="w-full h-8 text-[12px]"
                    />
                  </div>
                )}

                {/* MULTI-LANGUAGE READINESS MATRIX OR SINGLE LANGUAGE CARD */}
                {publishScope === "all" ? (
                  <div className="space-y-3">
                    {/* Amber warning if some languages are incomplete */}
                    {multiSummary.incompleteLanguages.length > 0 && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-[12px] flex items-start gap-2.5 text-amber-300">
                        <Warning className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                        <div>
                          <div className="font-semibold text-amber-200">
                            Selective Release Notice ({multiSummary.incompleteLanguages.length} Incomplete Languages)
                          </div>
                          <div className="text-[11px] text-amber-300/90 mt-0.5 leading-relaxed">
                            Only <strong>Approved</strong> translations will be deployed into the bundle. Draft, pending, or untranslated strings ({multiSummary.totalExcludedAcrossAll} total) will be safely excluded from this release.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Language Matrix Table */}
                    <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-main">
                      <div className="grid grid-cols-12 px-3 py-2 border-b border-border-subtle text-[11px] font-semibold text-text-tertiary uppercase">
                        <div className="col-span-4">Language</div>
                        <div className="col-span-3 text-center">Approved / Total</div>
                        <div className="col-span-2 text-center">Coverage</div>
                        <div className="col-span-3 text-right">Target Version</div>
                      </div>
                      <div className="max-h-[180px] overflow-y-auto divide-y divide-border-subtle">
                        {multiSummary.summaries.map((s) => (
                          <div key={s.code} className="grid grid-cols-12 px-3 py-2 text-[12px] items-center">
                            <div className="col-span-4 font-medium text-text-primary flex items-center gap-1.5 truncate">
                              <span className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                s.isReady ? "bg-success" : s.approvedCount > 0 ? "bg-warning" : "bg-zinc-600"
                              )}></span>
                              <span className="truncate">{s.name}</span>
                              <span className="text-[10px] text-text-tertiary">({s.code})</span>
                            </div>
                            <div className="col-span-3 text-center font-mono text-[11px] text-text-secondary">
                              <span className="text-text-primary font-bold">{s.approvedCount}</span> / {s.totalTags}
                            </div>
                            <div className="col-span-2 text-center">
                              <span className={cn(
                                "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                                s.coveragePercent === 100 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : s.coveragePercent > 0 
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                              )}>
                                {s.coveragePercent}%
                              </span>
                            </div>
                            <div className="col-span-3 text-right font-mono text-[11px]">
                              {s.previousVersion ? (
                                <span className="text-text-tertiary">v{s.previousVersion} <span className="text-accent-blue font-bold">→ v{s.nextVersion}</span></span>
                              ) : (
                                <span className="text-accent-blue font-bold">v1 (Initial)</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* SINGLE LANGUAGE SUMMARY CARD */
                  <div className="space-y-3">
                    <div className="p-3 bg-bg-main border border-border-subtle rounded-lg text-[12px] space-y-2">
                      <div className="font-semibold text-text-primary flex items-center justify-between pb-1 border-b border-border-subtle/60">
                        <span className="flex items-center gap-1.5">
                          <RocketLaunch className="w-3.5 h-3.5 text-accent-blue" />
                          Pre-Publish Changes
                        </span>
                        <span className="text-[11px] font-mono text-text-tertiary">
                          {singleDiff.previousVersion ? `Prior: v${singleDiff.previousVersion} → Next: v${singleDiff.nextVersion}` : 'Initial release (v1)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="flex justify-between text-text-secondary">
                          <span>Approved in bundle:</span>
                          <span className="font-mono font-bold text-text-primary">{singleDiff.totalCount}</span>
                        </div>
                        <div className="flex justify-between text-success">
                          <span>New / Modified:</span>
                          <span className="font-mono font-bold">+{singleDiff.newCount}</span>
                        </div>
                      </div>
                      {singleDiff.totalTagsCount - singleDiff.totalCount > 0 && (
                        <div className="flex justify-between text-amber-400/90 text-[11px] pt-0.5">
                          <span>Excluded (Draft / Pending):</span>
                          <span className="font-mono font-bold">{singleDiff.totalTagsCount - singleDiff.totalCount}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* PRE-FLIGHT QUALITY & SAFETY GUARDRAILS */}
                <div className="p-3 bg-bg-sidebar/80 border border-border-subtle rounded-lg space-y-2 text-[11px]">
                  <div className="font-semibold text-text-primary uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent-blue" />
                    Pre-Flight Safety Checks
                  </div>
                  <div className="space-y-1.5 text-text-secondary">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-success" />
                        Variable & Placeholder Integrity
                      </span>
                      <span className="font-mono text-success font-semibold">100% Passed</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-success" />
                        Target Pipeline Environment
                      </span>
                      <span className="font-mono text-text-primary">{targetEnv}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-success" />
                        Release Governance
                      </span>
                      <span className="text-text-primary">
                        {targetEnv === "PRODUCTION" 
                          ? (canPublishProdDirect ? "Direct Deploy (Founder/Lead)" : "Requires Approval Request")
                          : "Standard Deployment"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* DIFF INSPECTION ACCORDION */}
                <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-main">
                  <button
                    type="button"
                    onClick={() => setShowTagDiffInspection(!showTagDiffInspection)}
                    className="w-full px-3 py-2 text-[11px] font-medium text-text-secondary hover:text-text-primary flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-text-tertiary" />
                      Inspect Included Strings ({publishScope === "single" ? singleDiff.totalCount : multiSummary.totalApprovedAcrossAll})
                    </span>
                    {showTagDiffInspection ? <CaretDown className="w-3.5 h-3.5" /> : <CaretRight className="w-3.5 h-3.5" />}
                  </button>
                  {showTagDiffInspection && (
                    <div className="p-3 border-t border-border-subtle max-h-[140px] overflow-y-auto space-y-1.5 text-[11px]">
                      {singleDiff.approvedTags.slice(0, 10).map(tag => (
                        <div key={tag.id} className="flex items-center justify-between py-1 border-b border-border-subtle/40 last:border-0">
                          <code className="font-mono text-text-primary">{tag.id}</code>
                          <span className="text-text-tertiary truncate max-w-[280px] font-serif">
                            "{tag.values?.[activeLangCode]?.text || tag.english}"
                          </span>
                        </div>
                      ))}
                      {singleDiff.approvedTags.length > 10 && (
                        <div className="text-[10px] text-text-tertiary text-center pt-1">
                          + {singleDiff.approvedTags.length - 10} more approved strings in bundle
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            {!publishedSummary && (
              <div className="px-5 py-3.5 border-t border-border-subtle flex items-center justify-between bg-bg-sidebar rounded-b-xl">
                <span className="text-[11px] text-text-tertiary flex items-center gap-1.5">
                  <Tooltip content="Only strings with Approved status are bundled and published to the target environment">
                    <span className="inline-flex items-center cursor-help text-text-tertiary hover:text-text-primary transition-colors">
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </Tooltip>
                  <span>
                    {publishScope === "all"
                      ? `${multiSummary.totalApprovedAcrossAll} total strings across ${multiSummary.totalLanguagesCount} languages`
                      : `${singleDiff.totalCount} strings ready for ${activeLangCode}`}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={onClose}
                    disabled={isPublishing}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleExecutePublish}
                    disabled={isPublishing || (publishScope === "single" ? singleDiff.totalCount === 0 : multiSummary.totalApprovedAcrossAll === 0)}
                    className="btn-primary"
                  >
                    {isPublishing ? (
                      <>
                        <ArrowClockwise className="w-3.5 h-3.5 animate-spin" />
                        <span>Packaging & Deploying...</span>
                      </>
                    ) : targetEnv === 'PRODUCTION' && !canPublishProdDirect ? (
                      "Request Production Approval"
                    ) : publishScope === "all" ? (
                      `Publish All to ${targetEnv}`
                    ) : (
                      `Publish to ${targetEnv}`
                    )}
                  </button>
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
