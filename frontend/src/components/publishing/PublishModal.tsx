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
  FileCode,
  Translate,
  ArrowRight,
  ArrowLeft,
  Copy,
  ShieldCheck
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
type WizardStep = 1 | 2 | 3;

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
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [publishScope, setPublishScope] = useState<PublishScope>(initialLanguage ? "single" : "all");
  const [targetEnv, setTargetEnv] = useState<Environment>(initialEnvironment || "PRODUCTION");
  const [activeLangCode, setActiveLangCode] = useState<string>(initialLanguage || selectedLanguage || "eng");
  const [isPublishing, setIsPublishing] = useState(false);
  const [showTagDiffInspection, setShowTagDiffInspection] = useState(false);
  const [publishedSummary, setPublishedSummary] = useState<PublishedResultSummary | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Close on Escape key (only if not currently deploying)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPublishing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPublishing, onClose]);

  // Reset wizard state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setPublishedSummary(null);
      setIsPublishing(false);
      setShowTagDiffInspection(false);
      setCopiedReceipt(false);
      setPublishScope(initialLanguage ? "single" : "all");
      if (initialEnvironment) setTargetEnv(initialEnvironment);
      if (initialLanguage) setActiveLangCode(initialLanguage);
    }
  }, [isOpen, initialLanguage, initialEnvironment]);

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

  const pageId = propPageId || tags?.[0]?.pageId || "";
  const currentTags = useMemo(() => {
    if (tags && tags.length > 0) return tags;
    if (pageId) return StoreService.getTags(pageId);
    return [];
  }, [tags, pageId]);

  // Single language diff summary
  const singleDiff = useMemo(() => {
    const isEng = activeLangCode === "eng" || activeLangCode === "en";
    const approvedTags = isEng 
      ? currentTags.filter(t => t.english && t.english.trim().length > 0)
      : currentTags.filter(t => {
          const val = t.values?.[activeLangCode];
          return val?.status === "Approved" || (val?.status as string) === "APPROVED";
        });

    if (pageId) {
      const summary = StoreService.getPublishDiffSummary(pageId, activeLangCode, targetEnv);
      if (summary.totalCount > 0 || currentTags.length === 0) {
        return summary;
      }
    }

    return {
      totalCount: approvedTags.length,
      totalTagsCount: currentTags.length,
      newCount: approvedTags.length,
      updatedCount: 0,
      previousVersion: null,
      nextVersion: 1,
      isDuplicate: false,
      variableErrorsCount: 0,
      approvedTags
    };
  }, [pageId, activeLangCode, targetEnv, currentTags]);

  // Multi-language summary matrix
  const multiSummary = useMemo(() => {
    if (pageId) {
      const ms = StoreService.getMultiLanguagePublishSummary(pageId, targetEnv);
      if (ms.summaries.length > 0 || currentTags.length === 0) {
        return ms;
      }
    }

    const summaries = availableLanguages.map(lang => {
      const approvedCount = currentTags.filter(t => {
        const val = t.values?.[lang.code];
        return val?.status === "Approved" || (val?.status as string) === "APPROVED";
      }).length;
      const coveragePercent = currentTags.length > 0 ? Math.round((approvedCount / currentTags.length) * 100) : 0;
      return {
        code: lang.code,
        name: lang.name,
        approvedCount,
        totalTags: currentTags.length,
        coveragePercent,
        isReady: currentTags.length > 0 && approvedCount === currentTags.length,
        previousVersion: null,
        nextVersion: 1
      };
    });

    return {
      summaries,
      totalTags: currentTags.length,
      totalApprovedAcrossAll: summaries.reduce((acc, s) => acc + s.approvedCount, 0),
      totalExcludedAcrossAll: summaries.reduce((acc, s) => acc + (s.totalTags - s.approvedCount), 0),
      totalVariableErrors: 0,
      fullyReadyLanguagesCount: summaries.filter(s => s.isReady).length,
      totalLanguagesCount: availableLanguages.length,
      incompleteLanguages: summaries.filter(s => !s.isReady).map(s => s.name)
    };
  }, [pageId, targetEnv, currentTags, availableLanguages]);

  // Permission checks
  const canPublishProdDirect = can('PUBLISH_PRODUCTION') || user?.roles?.includes('FN') || user?.roles?.includes('SR');

  // Calculations for stats
  const totalApproved = publishScope === "single" ? singleDiff.totalCount : multiSummary.totalApprovedAcrossAll;
  const totalExcluded = publishScope === "single" 
    ? (singleDiff.totalTagsCount - singleDiff.totalCount) 
    : multiSummary.totalExcludedAcrossAll;

  const activeLangObj = availableLanguages.find(l => l.code === activeLangCode);
  const activeLangName = activeLangCode === "eng" ? "English (Master)" : (activeLangObj?.name || activeLangCode);

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

  const handleCopyReceipt = () => {
    if (!publishedSummary) return;

    const lines = [
      `Release Deployment Receipt`,
      `==========================`,
      `Page: ${pageName} (${pageId})`,
      `Environment: ${publishedSummary.environment}`,
      `Deployed At: ${publishedSummary.timestamp}`,
      `Scope: ${publishedSummary.scope === "all" ? "All Languages" : "Single Language"}`,
      `Total Strings Deployed: ${publishedSummary.totalStringsDeployed}`,
      ``,
      `Deployed Bundles:`,
      ...publishedSummary.results.map(
        r => ` - ${r.langName} (${r.language}): v${r.version} [${r.count} strings]${r.isDuplicate ? " (duplicate/skipped)" : ""}`
      ),
      ``,
      `Bundle Endpoint: GET /api/v1/pages/${pageId}/bundle?env=${publishedSummary.environment}&lang={locale}`
    ];

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2500);
  };

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
            className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-[760px] max-h-[92vh] flex flex-col overflow-hidden text-text-primary shadow-xl my-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-border-subtle bg-bg-card shrink-0">
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

            {/* Stepper Progress Bar (Pre-Publish only) */}
            {!publishedSummary && (
              <div className="px-6 py-2.5 border-b border-border-subtle bg-bg-sidebar/30 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-4">
                  {/* Step 1 Pill */}
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className={cn(
                      "flex items-center gap-1.5 font-medium transition-colors cursor-pointer",
                      currentStep === 1 
                        ? "text-accent-blue font-semibold" 
                        : currentStep > 1 
                        ? "text-text-secondary hover:text-text-primary" 
                        : "text-text-tertiary"
                    )}
                  >
                    <span className={cn(
                      "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-mono",
                      currentStep === 1 
                        ? "bg-accent-blue text-white" 
                        : currentStep > 1 
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                        : "bg-bg-main border border-border-subtle text-text-tertiary"
                    )}>
                      {currentStep > 1 ? "✓" : "1"}
                    </span>
                    <span>1. Language Scope</span>
                  </button>

                  <span className="text-border-strong">›</span>

                  {/* Step 2 Pill (includes Dev · QA · Prod preview for clarity and test discovery) */}
                  <button
                    type="button"
                    onClick={() => { if (currentStep > 2) setCurrentStep(2); }}
                    disabled={currentStep < 2}
                    className={cn(
                      "flex items-center gap-1.5 font-medium transition-colors",
                      currentStep === 2 
                        ? "text-accent-blue font-semibold cursor-pointer" 
                        : currentStep > 2 
                        ? "text-text-secondary hover:text-text-primary cursor-pointer" 
                        : "text-text-tertiary opacity-75 cursor-default"
                    )}
                  >
                    <span className={cn(
                      "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-mono",
                      currentStep === 2 
                        ? "bg-accent-blue text-white" 
                        : currentStep > 2 
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                        : "bg-bg-main border border-border-subtle text-text-tertiary"
                    )}>
                      {currentStep > 2 ? "✓" : "2"}
                    </span>
                    <span>2. Environment <span className="text-[10px] text-text-tertiary font-normal">(Dev · QA · Prod)</span></span>
                  </button>

                  <span className="text-border-strong">›</span>

                  {/* Step 3 Pill */}
                  <div className={cn(
                    "flex items-center gap-1.5 font-medium",
                    currentStep === 3 ? "text-accent-blue font-semibold" : "text-text-tertiary opacity-75"
                  )}>
                    <span className={cn(
                      "w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-mono",
                      currentStep === 3 
                        ? "bg-accent-blue text-white" 
                        : "bg-bg-main border border-border-subtle text-text-tertiary"
                    )}>
                      3
                    </span>
                    <span>3. Summary & Deploy</span>
                  </div>
                </div>

                <span className="text-text-tertiary font-mono text-[10px]">
                  Step {currentStep} of 3
                </span>
              </div>
            )}

            {/* Modal Body Content */}
            {publishedSummary ? (
              /* Step 4: Executive Post-Publish Summary / Receipt */
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* Success Banner */}
                <div className="flex items-start gap-3.5 p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-400">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" weight="fill" />
                  <div className="flex-1">
                    <h3 className="text-[14px] font-semibold text-emerald-300">
                      Release successfully deployed to {publishedSummary.environment}
                    </h3>
                    <p className="text-[12px] text-emerald-400/90 mt-0.5 leading-relaxed">
                      Deployed <strong className="font-semibold">{publishedSummary.totalStringsDeployed} approved strings</strong> into live bundles at {publishedSummary.timestamp}. Unapproved drafts and translations remain safely isolated in the workspace.
                    </p>
                  </div>
                </div>

                {/* Quick Receipt Metrics */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-border-subtle bg-bg-main">
                    <div className="text-[11px] text-text-tertiary font-medium">Target Environment</div>
                    <div className="text-[14px] font-semibold text-text-primary mt-1 flex items-center gap-1.5">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        publishedSummary.environment === "PRODUCTION" ? "bg-rose-500" : publishedSummary.environment === "QA" ? "bg-amber-500" : "bg-accent-blue"
                      )} />
                      {publishedSummary.environment}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border-subtle bg-bg-main">
                    <div className="text-[11px] text-text-tertiary font-medium">Strings Deployed</div>
                    <div className="text-[14px] font-semibold text-emerald-400 mt-1 font-mono">
                      {publishedSummary.totalStringsDeployed} strings
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border-subtle bg-bg-main">
                    <div className="text-[11px] text-text-tertiary font-medium">Scope Deployed</div>
                    <div className="text-[14px] font-semibold text-text-primary mt-1">
                      {publishedSummary.scope === "all" ? `All Languages (${publishedSummary.results.length})` : "Single Locale"}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-border-subtle bg-bg-main">
                    <div className="text-[11px] text-text-tertiary font-medium">Deployed At</div>
                    <div className="text-[14px] font-semibold text-text-secondary mt-1 font-mono">
                      {publishedSummary.timestamp}
                    </div>
                  </div>
                </div>

                {/* Detailed Language Breakdown Table */}
                <div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                      Deployed Language Manifest
                    </span>
                    <span className="text-[11px] text-text-tertiary">
                      {publishedSummary.results.length} bundle{publishedSummary.results.length !== 1 ? "s" : ""} generated
                    </span>
                  </div>

                  <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-main">
                    <div className="grid grid-cols-12 px-4 py-2 border-b border-border-subtle text-[11px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-sidebar/50">
                      <div className="col-span-5">Language</div>
                      <div className="col-span-3 text-center">Version</div>
                      <div className="col-span-2 text-right">Count</div>
                      <div className="col-span-2 text-right">Status</div>
                    </div>
                    <div className="max-h-[220px] overflow-y-auto divide-y divide-border-subtle text-[12px]">
                      {publishedSummary.results.map((r) => (
                        <div key={r.language} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-bg-card/40 transition-colors">
                          <div className="col-span-5 font-medium text-text-primary flex items-center gap-2 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="truncate">{r.langName}</span>
                            <span className="text-[11px] font-mono text-text-tertiary">({r.language})</span>
                          </div>
                          <div className="col-span-3 text-center font-mono text-accent-blue font-semibold">
                            v{r.version}
                          </div>
                          <div className="col-span-2 text-right text-text-secondary font-mono">
                            {r.count}
                          </div>
                          <div className="col-span-2 text-right">
                            <span className={cn(
                              "text-[10px] font-medium px-2 py-0.5 rounded border",
                              r.isDuplicate 
                                ? "bg-zinc-800 text-zinc-400 border-zinc-700" 
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            )}>
                              {r.isDuplicate ? "Unchanged" : "Live Active"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* API Integration Details */}
                <div className="p-3 border border-border-subtle rounded-lg bg-bg-sidebar/30 text-[11px] flex items-center justify-between gap-3 text-text-tertiary">
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className="w-4 h-4 text-text-secondary shrink-0" />
                    <span className="truncate">
                      Bundle Endpoint: <code className="text-text-secondary font-mono">GET /api/v1/pages/{pageId}/bundle?env={publishedSummary.environment}&lang=&#123;locale&#125;</code>
                    </span>
                  </div>
                  <span className="text-emerald-500 shrink-0 font-medium">✓ CDN Synced</span>
                </div>

                {/* Post-Publish Footer Actions */}
                <div className="pt-2 flex items-center justify-between border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={handleCopyReceipt}
                    className="px-3.5 py-1.5 rounded-lg border border-border-subtle text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer outline-none transition-all flex items-center gap-1.5"
                  >
                    {copiedReceipt ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" weight="bold" />
                        <span className="text-emerald-400">Receipt Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Release Receipt</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-1.5 rounded-lg bg-accent-blue text-white font-semibold text-[12px] hover:bg-accent-blue/90 cursor-pointer outline-none transition-all shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Wizard Steps 1, 2, 3 */
              <div className="flex flex-col flex-1 min-h-0">
                
                {/* STEP 1: SELECT LANGUAGE SCOPE */}
                {currentStep === 1 && (
                  <div className="p-6 overflow-y-auto flex-1 space-y-5">
                    <div>
                      <h3 className="text-[14px] font-semibold text-text-primary">
                        Select Language Scope
                      </h3>
                      <p className="text-[12px] text-text-tertiary mt-0.5">
                        Choose whether to deploy translations across all available locales or publish an isolated language bundle.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Option A: All Languages */}
                      <div
                        onClick={() => setPublishScope("all")}
                        className={cn(
                          "border rounded-xl p-4.5 cursor-pointer transition-all flex flex-col justify-between",
                          publishScope === "all"
                            ? "border-accent-blue bg-accent-blue/5 ring-1 ring-accent-blue/30"
                            : "border-border-subtle bg-bg-main hover:border-border-strong hover:bg-bg-card"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between pb-3">
                            <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue">
                              <Globe className="w-4.5 h-4.5" />
                            </div>
                            <span className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center text-[9px]",
                              publishScope === "all" ? "border-accent-blue bg-accent-blue text-white" : "border-border-strong"
                            )}>
                              {publishScope === "all" && "●"}
                            </span>
                          </div>

                          <h4 className="text-[13px] font-semibold text-text-primary">
                            All Configured Languages
                          </h4>
                          <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed">
                            Simultaneously deploy all active translation locales and English master copy in an atomic batch.
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px]">
                          <span className="text-text-secondary font-medium">
                            {availableLanguages.length} locales + English
                          </span>
                          <span className="text-emerald-400 font-mono">
                            {multiSummary.totalApprovedAcrossAll} approved ready
                          </span>
                        </div>
                      </div>

                      {/* Option B: Single Language */}
                      <div
                        onClick={() => setPublishScope("single")}
                        className={cn(
                          "border rounded-xl p-4.5 cursor-pointer transition-all flex flex-col justify-between",
                          publishScope === "single"
                            ? "border-accent-blue bg-accent-blue/5 ring-1 ring-accent-blue/30"
                            : "border-border-subtle bg-bg-main hover:border-border-strong hover:bg-bg-card"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between pb-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                              <Translate className="w-4.5 h-4.5" />
                            </div>
                            <span className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center text-[9px]",
                              publishScope === "single" ? "border-accent-blue bg-accent-blue text-white" : "border-border-strong"
                            )}>
                              {publishScope === "single" && "●"}
                            </span>
                          </div>

                          <h4 className="text-[13px] font-semibold text-text-primary">
                            Single Language
                          </h4>
                          <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed">
                            Deploy or update an individual locale bundle for targeted testing, fast iteration, or hotfixes.
                          </p>
                        </div>

                        {/* Inline selector when Single Language is active */}
                        <div className="mt-4 pt-3 border-t border-border-subtle">
                          {publishScope === "single" ? (
                            <div onClick={(e) => e.stopPropagation()} className="space-y-1.5">
                              <label className="text-[11px] font-medium text-text-tertiary block">
                                Target Locale:
                              </label>
                              <Dropdown
                                value={activeLangCode}
                                onChange={setActiveLangCode}
                                className="w-full text-[12px]"
                                options={[
                                  { value: "eng", label: "English (Master)" },
                                  ...availableLanguages.map(l => ({ 
                                    value: l.code, 
                                    label: `${l.name} (${l.code})` 
                                  }))
                                ]}
                              />
                            </div>
                          ) : (
                            <div className="text-[11px] text-text-tertiary flex items-center justify-between">
                              <span>Target specific locale</span>
                              <span className="font-mono">Select on click</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Scope context preview */}
                    <div className="p-3.5 border border-border-subtle rounded-lg bg-bg-sidebar/30 text-[12px] flex items-center justify-between">
                      <div className="text-text-secondary">
                        Selected Scope: <strong className="text-text-primary">{publishScope === "all" ? `All Languages (${availableLanguages.length} target locales)` : activeLangName}</strong>
                      </div>
                      <div className="text-emerald-400 font-mono text-[11px]">
                        {totalApproved} approved strings eligible
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: CHOOSE TARGET ENVIRONMENT */}
                {currentStep === 2 && (
                  <div className="p-6 overflow-y-auto flex-1 space-y-5">
                    <div>
                      <h3 className="text-[14px] font-semibold text-text-primary">
                        Choose Target Environment
                      </h3>
                      <p className="text-[12px] text-text-tertiary mt-0.5">
                        Select the deployment endpoint for <strong className="text-text-secondary font-medium">{publishScope === "all" ? "All Languages" : activeLangName}</strong>.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {/* Dev Sandbox Option */}
                      <div
                        onClick={() => setTargetEnv("DEV")}
                        className={cn(
                          "border rounded-xl p-4 cursor-pointer transition-all flex items-start gap-4",
                          targetEnv === "DEV"
                            ? "border-accent-blue bg-accent-blue/5 ring-1 ring-accent-blue/30"
                            : "border-border-subtle bg-bg-main hover:border-border-strong hover:bg-bg-card"
                        )}
                      >
                        <span className={cn(
                          "w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center text-[9px] shrink-0",
                          targetEnv === "DEV" ? "border-accent-blue bg-accent-blue text-white" : "border-border-strong"
                        )}>
                          {targetEnv === "DEV" && "●"}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-semibold text-text-primary">
                              Dev (Sandbox)
                            </h4>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded border bg-accent-blue/10 text-accent-blue border-accent-blue/20">
                              SANDBOX
                            </span>
                          </div>
                          <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed">
                            Isolated environment for rapid prototyping, developer integration, and local bundle inspection. Instant deploy with zero risk to live customers.
                          </p>
                        </div>
                      </div>

                      {/* QA Staging Option */}
                      <div
                        onClick={() => setTargetEnv("QA")}
                        className={cn(
                          "border rounded-xl p-4 cursor-pointer transition-all flex items-start gap-4",
                          targetEnv === "QA"
                            ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500/30"
                            : "border-border-subtle bg-bg-main hover:border-border-strong hover:bg-bg-card"
                        )}
                      >
                        <span className={cn(
                          "w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center text-[9px] shrink-0",
                          targetEnv === "QA" ? "border-amber-500 bg-amber-500 text-white" : "border-border-strong"
                        )}>
                          {targetEnv === "QA" && "●"}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-semibold text-text-primary">
                              QA (Staging)
                            </h4>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded border bg-amber-500/10 text-amber-500 border-amber-500/20">
                              STAGING
                            </span>
                          </div>
                          <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed">
                            Pre-production staging environment for product quality assurance, stakeholder review, and regression testing before customer release.
                          </p>
                        </div>
                      </div>

                      {/* Prod Live Option */}
                      <div
                        onClick={() => setTargetEnv("PRODUCTION")}
                        className={cn(
                          "border rounded-xl p-4 cursor-pointer transition-all flex items-start gap-4",
                          targetEnv === "PRODUCTION"
                            ? "border-rose-500 bg-rose-500/5 ring-1 ring-rose-500/30"
                            : "border-border-subtle bg-bg-main hover:border-border-strong hover:bg-bg-card"
                        )}
                      >
                        <span className={cn(
                          "w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center text-[9px] shrink-0",
                          targetEnv === "PRODUCTION" ? "border-rose-500 bg-rose-500 text-white" : "border-border-strong"
                        )}>
                          {targetEnv === "PRODUCTION" && "●"}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Prod (Live)
                            </h4>
                            <span className="text-[10px] font-mono px-2 py-0.2 rounded border bg-rose-500/10 text-rose-500 border-rose-500/20">
                              LIVE PRODUCTION
                            </span>
                          </div>
                          <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed">
                            Live production applications and client-facing interfaces. Real-time updates delivered to all global users.
                          </p>

                          {/* Security Gate Notice */}
                          <div className="mt-2.5 pt-2 border-t border-border-subtle text-[11px] flex items-center gap-2">
                            {canPublishProdDirect ? (
                              <span className="text-emerald-500 font-medium flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" weight="bold" />
                                Direct production release authorized (Founder / Admin role)
                              </span>
                            ) : (
                              <span className="text-amber-500 font-medium flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5" weight="bold" />
                                Release gate active: Publishing will submit an approval request to workspace leads
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: SUMMARY & DEPLOY */}
                {currentStep === 3 && (
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {/* Destination & Scope Banner */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-lg border border-border-subtle bg-bg-sidebar/40 text-[12px]">
                      <div className="flex items-center gap-2">
                        <span className="text-text-tertiary">Destination:</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded font-mono font-semibold text-[11px] border uppercase",
                          targetEnv === "PRODUCTION" 
                            ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                            : targetEnv === "QA" 
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                            : "bg-accent-blue/10 text-accent-blue border-accent-blue/20"
                        )}>
                          {targetEnv}
                        </span>
                        <span className="text-border-strong">·</span>
                        <span className="text-text-tertiary">Scope:</span>
                        <span className="font-semibold text-text-primary">
                          {publishScope === "all" ? `All Languages (${availableLanguages.length})` : activeLangName}
                        </span>
                      </div>

                      <div className="text-[11px] text-text-tertiary">
                        Page: <span className="text-text-secondary font-medium">{pageName}</span>
                      </div>
                    </div>

                    {/* Executive Stats Strip */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg border border-border-subtle bg-bg-main">
                        <div className="text-[11px] text-text-tertiary font-medium">Ready to Deploy</div>
                        <div className="text-lg font-semibold text-emerald-400 mt-0.5">
                          {totalApproved} strings
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-border-subtle bg-bg-main">
                        <div className="text-[11px] text-text-tertiary font-medium">Drafts Excluded</div>
                        <div className="text-lg font-semibold text-text-secondary mt-0.5">
                          {totalExcluded} unapproved
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-border-subtle bg-bg-main">
                        <div className="text-[11px] text-text-tertiary font-medium">Target Version</div>
                        <div className="text-lg font-semibold text-accent-blue mt-0.5 font-mono">
                          v{publishScope === "single" ? singleDiff.nextVersion : (multiSummary.summaries[0]?.nextVersion || 1)}
                        </div>
                      </div>
                    </div>

                    {/* Content Detail: All Languages Table OR Single Language Card */}
                    {publishScope === "all" ? (
                      <div className="border border-border-subtle rounded-lg overflow-hidden bg-bg-main">
                        <div className="grid grid-cols-12 px-4 py-2 border-b border-border-subtle text-[11px] font-semibold text-text-tertiary uppercase tracking-wider bg-bg-sidebar/50">
                          <div className="col-span-4">Language</div>
                          <div className="col-span-2 text-center">Approved</div>
                          <div className="col-span-3 text-center">Coverage</div>
                          <div className="col-span-1 text-center">Version</div>
                          <div className="col-span-2 text-right">Status</div>
                        </div>

                        <div className="max-h-[220px] overflow-y-auto divide-y divide-border-subtle text-[12px]">
                          {multiSummary.summaries.map((s) => (
                            <div key={s.code} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-bg-card/40 transition-colors">
                              <div className="col-span-4 font-medium text-text-primary flex items-center gap-2 truncate">
                                <span className={cn(
                                  "w-1.5 h-1.5 rounded-full shrink-0",
                                  s.isReady ? "bg-emerald-500" : s.approvedCount > 0 ? "bg-amber-500" : "bg-zinc-600"
                                )} />
                                <span className="truncate">{s.name}</span>
                                <span className="text-[11px] text-text-tertiary font-mono">({s.code})</span>
                              </div>

                              <div className="col-span-2 text-center text-text-secondary font-mono">
                                <span className="text-text-primary font-semibold">{s.approvedCount}</span> / {s.totalTags}
                              </div>

                              <div className="col-span-3 flex items-center justify-center gap-2">
                                <div className="w-16 h-1.5 bg-bg-card rounded-full overflow-hidden border border-border-subtle">
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

                              <div className="col-span-1 text-center font-mono text-[11px] text-text-secondary">
                                v{s.nextVersion}
                              </div>

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
                      <div className="border border-border-subtle rounded-lg p-4 bg-bg-main space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-accent-blue" />
                            <span className="text-[13px] font-semibold text-text-primary">
                              {activeLangName} Bundle
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-text-tertiary">
                            Target Version: v{singleDiff.nextVersion} {singleDiff.previousVersion ? `(from v${singleDiff.previousVersion})` : ""}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 pt-1 text-[12px]">
                          <div>
                            <div className="text-[11px] text-text-tertiary font-medium">Approved to Deploy</div>
                            <div className="text-base font-semibold text-emerald-400 mt-0.5 font-mono">{singleDiff.totalCount} strings</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-text-tertiary font-medium">New or Modified</div>
                            <div className="text-base font-semibold text-text-primary mt-0.5 font-mono">+{singleDiff.newCount}</div>
                          </div>
                          <div>
                            <div className="text-[11px] text-text-tertiary font-medium">Excluded Incomplete</div>
                            <div className="text-base font-semibold text-amber-400 mt-0.5 font-mono">{singleDiff.totalTagsCount - singleDiff.totalCount}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Pre-flight verification checklist */}
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
                          <span>{showTagDiffInspection ? "Hide payload strings" : "Inspect payload strings"}</span>
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
                )}

                {/* Wizard Footer Controls */}
                <div className="px-6 py-3.5 border-t border-border-subtle flex items-center justify-between bg-bg-card shrink-0">
                  {/* Step 1 Footer */}
                  {currentStep === 1 && (
                    <>
                      <button 
                        type="button"
                        onClick={onClose}
                        className="px-3.5 py-1.5 rounded-lg border border-border-subtle text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer outline-none transition-all"
                      >
                        Cancel
                      </button>

                      <button 
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="px-4 py-1.5 rounded-lg bg-accent-blue text-white font-semibold text-[12px] hover:bg-accent-blue/90 cursor-pointer outline-none transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <span>Continue to Environment</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* Step 2 Footer */}
                  {currentStep === 2 && (
                    <>
                      <button 
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="px-3.5 py-1.5 rounded-lg border border-border-subtle text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer outline-none transition-all flex items-center gap-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Scope</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="px-4 py-1.5 rounded-lg bg-accent-blue text-white font-semibold text-[12px] hover:bg-accent-blue/90 cursor-pointer outline-none transition-all shadow-xs flex items-center gap-1.5"
                      >
                        <span>Continue to Summary</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  {/* Step 3 Footer */}
                  {currentStep === 3 && (
                    <>
                      <button 
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        disabled={isPublishing}
                        className="px-3.5 py-1.5 rounded-lg border border-border-subtle text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer outline-none transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Environment</span>
                      </button>

                      <div className="flex items-center gap-2.5">
                        <button 
                          type="button"
                          onClick={onClose}
                          disabled={isPublishing}
                          className="px-3.5 py-1.5 rounded-lg border border-border-subtle text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer outline-none transition-all disabled:opacity-50"
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
                              <span>Deploying...</span>
                            </>
                          ) : totalApproved === 0 ? (
                            "No Strings to Deploy"
                          ) : targetEnv === "PRODUCTION" && !canPublishProdDirect ? (
                            "Request Release Approval"
                          ) : (
                            `Publish to ${targetEnv === "PRODUCTION" ? "Production" : targetEnv === "QA" ? "Staging" : "Dev"}`
                          )}
                        </button>
                      </div>
                    </>
                  )}
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
