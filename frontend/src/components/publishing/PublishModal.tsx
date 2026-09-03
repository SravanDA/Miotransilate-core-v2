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
  Info,
  Sparkle,
  LockKey
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

  const ENV_CONFIGS: { 
    env: Environment; 
    label: string; 
    tag: string; 
    badgeClass: string; 
    desc: string; 
  }[] = [
    { 
      env: "DEV", 
      label: "Development", 
      tag: "Sandbox", 
      badgeClass: "bg-accent-blue/10 text-accent-blue border-accent-blue/20", 
      desc: "For local testing and engineering verification." 
    },
    { 
      env: "QA", 
      label: "Staging / QA", 
      tag: "Testing", 
      badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20", 
      desc: "Pre-release testing and team sign-off environment." 
    },
    { 
      env: "PRODUCTION", 
      label: "Production", 
      tag: "Live Users", 
      badgeClass: "bg-rose-500/10 text-rose-500 border-rose-500/20", 
      desc: "Live customer-facing salon terminals and client portal." 
    }
  ];

  // Calculations for stats
  const totalApproved = publishScope === "single" ? singleDiff.totalCount : multiSummary.totalApprovedAcrossAll;
  const totalExcluded = publishScope === "single" 
    ? (singleDiff.totalTagsCount - singleDiff.totalCount) 
    : multiSummary.totalExcludedAcrossAll;
  const targetVersionDisplay = publishScope === "single" 
    ? (singleDiff.previousVersion ? `v${singleDiff.previousVersion} → v${singleDiff.nextVersion}` : `v1 (Initial)`)
    : `${multiSummary.summaries.filter(s => s.approvedCount > 0).length} bundles updated`;

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget && !isPublishing) onClose(); }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 sm:p-6 backdrop-blur-xs overflow-hidden"
        >
          <motion.div 
            initial={{ scale: 0.98, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="bg-bg-card border border-border-subtle rounded-2xl w-full max-w-[880px] max-h-[92vh] flex flex-col overflow-hidden text-text-primary shadow-2xl my-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-sidebar/90 rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 text-accent-blue flex items-center justify-center border border-accent-blue/25 shadow-xs">
                  <RocketLaunch className="w-5 h-5" weight="duotone" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-[16px] font-bold text-text-primary tracking-tight">
                      Release Control Center
                    </h2>
                    <span className={cn(
                      "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                      targetEnv === "PRODUCTION"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/25"
                        : targetEnv === "QA"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/25"
                        : "bg-accent-blue/10 text-accent-blue border-accent-blue/25"
                    )}>
                      {targetEnv}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-tertiary mt-0.5 font-medium">
                    <span className="text-text-secondary font-semibold">{pageName}</span> ({pageId}) · Targeted Release Pipeline
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <kbd className="text-[11px] font-mono text-text-tertiary px-2 py-0.5 rounded-md border border-border-subtle bg-bg-main hidden sm:inline-block">
                  ESC
                </kbd>
                <button 
                  onClick={onClose}
                  disabled={isPublishing}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors disabled:opacity-50 cursor-pointer outline-none"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {publishedSummary ? (
              /* Post-Publish Executive Receipt */
              <div className="p-8 space-y-6 overflow-y-auto">
                <div className="flex items-start gap-4 p-5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-400">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-6 h-6 text-emerald-400" weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-emerald-300">
                      Release Deployed Successfully to {publishedSummary.environment}!
                    </h3>
                    <p className="text-[12px] text-emerald-400/90 mt-1 leading-relaxed">
                      Deployed <strong className="text-white font-mono">{publishedSummary.totalStringsDeployed} approved strings</strong> into live application bundles at <span className="font-mono">{publishedSummary.timestamp}</span>. Unapproved or draft strings remain safely isolated in the workspace.
                    </p>
                  </div>
                </div>

                {/* Deployed Versions Breakdown */}
                <div>
                  <h4 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-3">
                    Deployed Bundle Manifest
                  </h4>
                  <div className="border border-border-subtle rounded-xl overflow-hidden bg-bg-main">
                    <div className="grid grid-cols-12 px-4 py-2.5 border-b border-border-subtle text-[11px] font-bold text-text-tertiary uppercase">
                      <div className="col-span-5">Language</div>
                      <div className="col-span-4 text-center">Release Version</div>
                      <div className="col-span-3 text-right">Deployed Strings</div>
                    </div>
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-border-subtle">
                      {publishedSummary.results.map((r) => (
                        <div key={r.language} className="grid grid-cols-12 px-4 py-3 text-[13px] items-center hover:bg-bg-card/40 transition-colors">
                          <div className="col-span-5 font-semibold text-text-primary flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>{r.langName}</span>
                            <span className="text-[11px] font-mono text-text-tertiary">({r.language})</span>
                          </div>
                          <div className="col-span-4 text-center font-mono text-[12px] text-accent-blue font-bold">
                            v{r.version}
                          </div>
                          <div className="col-span-3 text-right font-mono text-[12px] text-text-secondary font-medium">
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
                    className="px-5 py-2.5 rounded-lg bg-accent-blue text-white font-semibold text-[13px] hover:bg-accent-blue/90 cursor-pointer outline-none transition-all shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Pre-Publish Configuration & Safety Checks */
              <div className="p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
                
                {/* 1. UPFRONT PLAIN-ENGLISH PRIMER (Education / Trust) */}
                <div className="p-4 bg-bg-sidebar/80 border border-border-subtle rounded-xl flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-accent-blue/10 text-accent-blue shrink-0 mt-0.5">
                    <Info className="w-4 h-4" weight="bold" />
                  </div>
                  <div className="text-[12px] leading-relaxed">
                    <span className="font-semibold text-text-primary">How Publishing Works: </span>
                    <span className="text-text-secondary">
                      Publishing packages verified translations for this screen and deploys them to your selected environment. 
                      Only <strong className="text-text-primary font-semibold">Approved</strong> translations go live into production bundles. 
                      Incomplete drafts, pending reviews, and empty strings stay safely in the workspace and will never display broken UI to live users.
                    </span>
                  </div>
                </div>

                {/* 2. UPFRONT SELECTION CONTROLS (2 Columns: Scope & Target Environment) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  
                  {/* Left Column: Scope Selection */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                        1. Select Release Scope
                      </label>
                      <span className="text-[11px] text-text-tertiary">
                        {publishScope === "all" ? `${availableLanguages.length} active languages` : "1 targeted language"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* All Languages Card */}
                      <button
                        type="button"
                        onClick={() => setPublishScope("all")}
                        className={cn(
                          "p-3.5 rounded-xl border text-left transition-all cursor-pointer outline-none flex flex-col justify-between gap-2 relative",
                          publishScope === "all"
                            ? "bg-accent-blue/5 border-accent-blue text-text-primary shadow-xs ring-1 ring-accent-blue/30"
                            : "bg-bg-sidebar/50 border-border-subtle hover:border-border-strong hover:bg-bg-hover text-text-secondary"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            publishScope === "all" ? "bg-accent-blue text-white" : "bg-bg-main text-text-tertiary"
                          )}>
                            <RocketLaunch className="w-4 h-4" weight="bold" />
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-bold uppercase">
                            Recommended
                          </span>
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-text-primary">
                            All Languages
                          </div>
                          <div className="text-[11px] text-text-tertiary mt-0.5 leading-snug">
                            Deploy all approved copy across all active languages.
                          </div>
                        </div>
                      </button>

                      {/* Single Language Card */}
                      <button
                        type="button"
                        onClick={() => setPublishScope("single")}
                        className={cn(
                          "p-3.5 rounded-xl border text-left transition-all cursor-pointer outline-none flex flex-col justify-between gap-2",
                          publishScope === "single"
                            ? "bg-accent-blue/5 border-accent-blue text-text-primary shadow-xs ring-1 ring-accent-blue/30"
                            : "bg-bg-sidebar/50 border-border-subtle hover:border-border-strong hover:bg-bg-hover text-text-secondary"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                            publishScope === "single" ? "bg-accent-blue text-white" : "bg-bg-main text-text-tertiary"
                          )}>
                            <Globe className="w-4 h-4" weight="bold" />
                          </div>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-main text-text-tertiary border border-border-subtle">
                            Granular
                          </span>
                        </div>
                        <div>
                          <div className="text-[13px] font-bold text-text-primary">
                            Single Language
                          </div>
                          <div className="text-[11px] text-text-tertiary mt-0.5 leading-snug">
                            Deploy only one language independently.
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Single Language Dropdown Picker */}
                    {publishScope === "single" && (
                      <motion.div 
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="pt-1"
                      >
                        <label className="text-[11px] font-semibold text-text-tertiary mb-1 block">
                          Choose Language to Release
                        </label>
                        <Dropdown
                          value={activeLangCode}
                          onChange={(code) => setActiveLangCode(code)}
                          options={[
                            { value: "eng", label: "English (Master Reference Copy)" },
                            ...availableLanguages.map(lang => ({
                              value: lang.code,
                              label: `${lang.name} · ${lang.nativeName} (${lang.code})`
                            }))
                          ]}
                          className="w-full h-9 text-[12px]"
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Right Column: Target Environment Selection */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                        2. Select Target Environment
                      </label>
                      <span className={cn(
                        "text-[11px] font-mono font-bold",
                        targetEnv === "PRODUCTION" ? "text-rose-500" : targetEnv === "QA" ? "text-amber-500" : "text-accent-blue"
                      )}>
                        {targetEnv === "PRODUCTION" ? "⚠️ Live Release" : "Test Environment"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {ENV_CONFIGS.map(({ env, label, tag, desc }) => {
                        const isSelected = targetEnv === env;
                        return (
                          <button
                            key={env}
                            type="button"
                            onClick={() => setTargetEnv(env)}
                            className={cn(
                              "p-3 rounded-xl border text-left transition-all cursor-pointer outline-none flex flex-col justify-between gap-1.5",
                              isSelected
                                ? env === "PRODUCTION"
                                  ? "bg-rose-500/10 border-rose-500/40 text-text-primary shadow-xs ring-1 ring-rose-500/30"
                                  : env === "QA"
                                  ? "bg-amber-500/10 border-amber-500/40 text-text-primary shadow-xs ring-1 ring-amber-500/30"
                                  : "bg-accent-blue/10 border-accent-blue/40 text-text-primary shadow-xs ring-1 ring-accent-blue/30"
                                : "bg-bg-sidebar/50 border-border-subtle hover:border-border-strong hover:bg-bg-hover text-text-secondary"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className={cn(
                                "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                env === "PRODUCTION" 
                                  ? "bg-rose-500/20 text-rose-400" 
                                  : env === "QA" 
                                  ? "bg-amber-500/20 text-amber-400" 
                                  : "bg-accent-blue/20 text-accent-blue"
                              )}>
                                {tag}
                              </span>
                              {isSelected && (
                                <Check className={cn(
                                  "w-3.5 h-3.5 font-bold",
                                  env === "PRODUCTION" ? "text-rose-400" : env === "QA" ? "text-amber-400" : "text-accent-blue"
                                )} weight="bold" />
                              )}
                            </div>
                            <div>
                              <div className="text-[13px] font-bold text-text-primary">
                                {label}
                              </div>
                              <div className="text-[10px] text-text-tertiary mt-0.5 line-clamp-2 leading-tight">
                                {desc}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. IMPACT METRIC STRIP (3 High-Level Glance Cards) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Card 1: Approved & Ready */}
                  <div className="p-3.5 rounded-xl border border-border-subtle bg-bg-main flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" weight="fill" />
                      Approved & Ready
                    </span>
                    <div className="mt-2">
                      <div className="text-2xl font-bold font-mono text-emerald-400">
                        {totalApproved}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">
                        Strings ready to package & deploy
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Safely Excluded */}
                  <div className="p-3.5 rounded-xl border border-border-subtle bg-bg-main flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <LockKey className="w-3.5 h-3.5 text-text-tertiary" />
                      Safely Excluded
                    </span>
                    <div className="mt-2">
                      <div className="text-2xl font-bold font-mono text-text-primary">
                        {totalExcluded}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">
                        Drafts or pending review (not deployed)
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Target Version */}
                  <div className="p-3.5 rounded-xl border border-border-subtle bg-bg-main flex flex-col justify-between">
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkle className="w-3.5 h-3.5 text-accent-blue" weight="fill" />
                      Release Version
                    </span>
                    <div className="mt-2">
                      <div className="text-lg font-bold font-mono text-accent-blue truncate">
                        {targetVersionDisplay}
                      </div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">
                        {publishScope === "single" ? "Target version bump" : "Synchronized build"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. SELECTIVE RELEASE SAFEGUARD NOTICE (If incomplete languages) */}
                {publishScope === "all" && multiSummary.incompleteLanguages.length > 0 && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[12px] flex items-start gap-3 text-amber-300">
                    <Warning className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" weight="bold" />
                    <div>
                      <div className="font-bold text-amber-200 text-[13px]">
                        Selective Release Safeguard Active ({multiSummary.incompleteLanguages.length} Incomplete Languages)
                      </div>
                      <p className="text-[12px] text-amber-300/90 mt-1 leading-relaxed">
                        Only verified strings marked as <strong>Approved</strong> will be packaged into the release bundle. Incomplete drafts and pending reviews ({multiSummary.totalExcludedAcrossAll} strings across all locales) will remain safely in the workspace and will <strong>not</strong> be published to {targetEnv}.
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. LANGUAGE READINESS MATRIX (BREATHABLE TABLE) */}
                {publishScope === "all" ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[12px] font-bold text-text-primary uppercase tracking-wider">
                        Language Readiness & Coverage Breakdown
                      </h4>
                      <span className="text-[11px] text-text-tertiary">
                        {multiSummary.summaries.filter(s => s.isReady).length} of {multiSummary.summaries.length} languages 100% complete
                      </span>
                    </div>

                    <div className="border border-border-subtle rounded-xl overflow-hidden bg-bg-main">
                      <div className="grid grid-cols-12 px-4 py-2.5 border-b border-border-subtle text-[11px] font-bold text-text-tertiary uppercase">
                        <div className="col-span-4">Language</div>
                        <div className="col-span-2 text-center">Status</div>
                        <div className="col-span-2 text-center">Approved / Total</div>
                        <div className="col-span-2 text-center">Coverage</div>
                        <div className="col-span-2 text-right">Target Version</div>
                      </div>

                      <div className="max-h-[220px] overflow-y-auto divide-y divide-border-subtle">
                        {multiSummary.summaries.map((s) => (
                          <div key={s.code} className="grid grid-cols-12 px-4 py-3 text-[13px] items-center hover:bg-bg-card/40 transition-colors">
                            {/* Language Name */}
                            <div className="col-span-4 font-medium text-text-primary flex items-center gap-2 truncate">
                              <span className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                s.isReady ? "bg-emerald-500" : s.approvedCount > 0 ? "bg-amber-500" : "bg-zinc-600"
                              )} />
                              <span className="truncate font-semibold">{s.name}</span>
                              <span className="text-[11px] text-text-tertiary font-mono">({s.code})</span>
                            </div>

                            {/* Status Pill */}
                            <div className="col-span-2 text-center">
                              <span className={cn(
                                "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                                s.isReady 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : s.approvedCount > 0 
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
                              )}>
                                {s.isReady ? "100% Ready" : s.approvedCount > 0 ? "Partial" : "No Trans"}
                              </span>
                            </div>

                            {/* Approved / Total */}
                            <div className="col-span-2 text-center font-mono text-[12px] text-text-secondary">
                              <span className="text-text-primary font-bold">{s.approvedCount}</span> / {s.totalTags}
                            </div>

                            {/* Coverage Bar & % */}
                            <div className="col-span-2 flex flex-col items-center gap-1">
                              <div className="w-16 h-1.5 bg-bg-card rounded-full overflow-hidden border border-border-subtle">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    s.coveragePercent === 100 ? "bg-emerald-500" : s.coveragePercent > 0 ? "bg-amber-500" : "bg-zinc-700"
                                  )}
                                  style={{ width: `${s.coveragePercent}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-text-tertiary font-bold">
                                {s.coveragePercent}%
                              </span>
                            </div>

                            {/* Target Version */}
                            <div className="col-span-2 text-right font-mono text-[12px]">
                              {s.previousVersion ? (
                                <span className="text-text-tertiary">
                                  v{s.previousVersion} <span className="text-accent-blue font-bold">→ v{s.nextVersion}</span>
                                </span>
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
                  /* SINGLE LANGUAGE DETAIL CARD */
                  <div className="p-4 bg-bg-main border border-border-subtle rounded-xl space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-accent-blue" />
                        <span className="text-[13px] font-bold text-text-primary">
                          Single Language Bundle: {availableLanguages.find(l => l.code === activeLangCode)?.name || activeLangCode}
                        </span>
                      </div>
                      <span className="text-[12px] font-mono text-text-tertiary">
                        {singleDiff.previousVersion ? `v${singleDiff.previousVersion} → v${singleDiff.nextVersion}` : 'Initial bundle release (v1)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-1">
                      <div className="flex flex-col">
                        <span className="text-[11px] text-text-tertiary uppercase font-bold">Approved to Deploy</span>
                        <span className="text-xl font-mono font-bold text-emerald-400 mt-1">{singleDiff.totalCount} strings</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-text-tertiary uppercase font-bold">Modified / Added</span>
                        <span className="text-xl font-mono font-bold text-text-primary mt-1">+{singleDiff.newCount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-text-tertiary uppercase font-bold">Excluded Incomplete</span>
                        <span className="text-xl font-mono font-bold text-amber-400 mt-1">{singleDiff.totalTagsCount - singleDiff.totalCount}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. PRE-FLIGHT SAFETY CHECKS (AEROSPACE GRADE TRUST) */}
                <div className="p-4 bg-bg-sidebar/80 border border-border-subtle rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-accent-blue" weight="bold" />
                      Pre-Flight Automated Safety Checks
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      PASSED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
                    <div className="p-2.5 rounded-lg bg-bg-main border border-border-subtle flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" weight="bold" />
                      <div>
                        <div className="font-semibold text-text-primary text-[11px]">Placeholder Integrity</div>
                        <div className="text-[10px] text-text-tertiary mt-0.5">All variables match English source</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-bg-main border border-border-subtle flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" weight="bold" />
                      <div>
                        <div className="font-semibold text-text-primary text-[11px]">Zero-Flicker Bundling</div>
                        <div className="text-[10px] text-text-tertiary mt-0.5">Drafts excluded to prevent missing UI</div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-bg-main border border-border-subtle flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" weight="bold" />
                      <div>
                        <div className="font-semibold text-text-primary text-[11px]">Release Authorization</div>
                        <div className="text-[10px] text-text-tertiary mt-0.5">
                          {targetEnv === "PRODUCTION" 
                            ? (canPublishProdDirect ? "Direct Deploy (Founder/Admin)" : "Requires Founder Approval") 
                            : "Standard Environment Deploy"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 7. INSPECT INCLUDED STRINGS (COLLAPSIBLE DRAWER) */}
                <div className="border border-border-subtle rounded-xl overflow-hidden bg-bg-main">
                  <button
                    type="button"
                    onClick={() => setShowTagDiffInspection(!showTagDiffInspection)}
                    className="w-full px-4 py-3 text-[12px] font-semibold text-text-secondary hover:text-text-primary flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-text-tertiary" />
                      <span>Inspect Strings Included in this Bundle</span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-bg-card border border-border-subtle text-text-primary font-bold">
                        {totalApproved} strings
                      </span>
                    </span>
                    {showTagDiffInspection ? <CaretDown className="w-4 h-4 text-text-tertiary" /> : <CaretRight className="w-4 h-4 text-text-tertiary" />}
                  </button>

                  {showTagDiffInspection && (
                    <div className="p-4 border-t border-border-subtle max-h-[160px] overflow-y-auto space-y-2 text-[12px] bg-bg-sidebar/30">
                      {singleDiff.approvedTags.length === 0 ? (
                        <div className="text-[12px] text-text-tertiary text-center py-3 italic">
                          No approved strings to show. Strings must be marked Approved in the workspace before they appear in this payload.
                        </div>
                      ) : (
                        singleDiff.approvedTags.slice(0, 15).map(tag => (
                          <div key={tag.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle/50 last:border-0">
                            <code className="font-mono text-text-primary font-semibold text-[11px]">{tag.id}</code>
                            <span className="text-text-tertiary truncate max-w-[450px] font-serif italic text-[12px]">
                              "{tag.values?.[activeLangCode]?.text || tag.english}"
                            </span>
                          </div>
                        ))
                      )}
                      {singleDiff.approvedTags.length > 15 && (
                        <div className="text-[11px] text-text-tertiary text-center pt-2 font-mono">
                          + {singleDiff.approvedTags.length - 15} more approved strings in payload
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Modal Footer */}
            {!publishedSummary && (
              <div className="px-6 py-4 border-t border-border-subtle flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-bg-sidebar/90 rounded-b-2xl shrink-0">
                <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <Tooltip content="Only strings with Approved status are bundled and deployed into live customer applications.">
                    <span className="inline-flex items-center cursor-help text-text-tertiary hover:text-text-primary transition-colors">
                      <Info className="w-4 h-4" />
                    </span>
                  </Tooltip>
                  <span>
                    Deploying <strong className="text-text-primary font-bold">{totalApproved} approved strings</strong> to <strong className="text-text-primary font-bold">{targetEnv}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3 justify-end">
                  <button 
                    type="button"
                    onClick={onClose}
                    disabled={isPublishing}
                    className="px-4 py-2 rounded-lg border border-border-subtle text-[13px] font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-hover cursor-pointer outline-none transition-all"
                  >
                    Cancel
                  </button>

                  <button 
                    type="button"
                    onClick={handleExecutePublish}
                    disabled={isPublishing || totalApproved === 0}
                    className={cn(
                      "px-5 py-2 rounded-lg font-semibold text-[13px] flex items-center gap-2 cursor-pointer outline-none transition-all shadow-sm",
                      totalApproved === 0
                        ? "bg-bg-hover text-text-tertiary cursor-not-allowed border border-border-subtle opacity-60"
                        : targetEnv === "PRODUCTION"
                        ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20"
                        : "bg-accent-blue hover:bg-accent-blue/90 text-white shadow-accent-blue/20"
                    )}
                  >
                    {isPublishing ? (
                      <>
                        <ArrowClockwise className="w-4 h-4 animate-spin" />
                        <span>Packaging & Deploying...</span>
                      </>
                    ) : totalApproved === 0 ? (
                      <span>No Approved Strings to Deploy</span>
                    ) : targetEnv === 'PRODUCTION' && !canPublishProdDirect ? (
                      <span>Request Production Approval</span>
                    ) : publishScope === "all" ? (
                      <>
                        <RocketLaunch className="w-4 h-4" weight="bold" />
                        <span>Deploy All to {targetEnv}</span>
                      </>
                    ) : (
                      <>
                        <RocketLaunch className="w-4 h-4" weight="bold" />
                        <span>Deploy to {targetEnv}</span>
                      </>
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
