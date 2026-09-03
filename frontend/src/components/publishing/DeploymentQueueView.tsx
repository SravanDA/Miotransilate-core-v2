import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  RocketLaunch, 
  MagnifyingGlass as Search, 
  Check, 
  ArrowSquareOut as ExternalLink,
  ClockCounterClockwise,
  CaretDown,
  CaretUp,
  SquaresFour
} from "@phosphor-icons/react";
import { StatusInProgress, StatusDone, StatusBacklog } from "../ui/LinearIcons";
import { EmptyStateGraphic } from "../ui/EmptyStateGraphic";
import { Tooltip } from "../ui/Tooltip";
import { StoreService } from "../../store/StoreService";
import type { 
  PageReleasePipelineItem, 
  DeploymentRecord, 
  PublishApprovalRequest 
} from "../../types";

interface DeploymentQueueViewProps {
  canPublish: boolean;
  canApprovePublish: boolean;
  onDeployPage: (pageId: string, pageName: string, langCode?: string) => void;
  publishRequests: PublishApprovalRequest[];
  onReviewPublish: (requestId: string, action: "APPROVE" | "REJECT") => void;
}

function getRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

export function DeploymentQueueView({
  canPublish,
  canApprovePublish,
  onDeployPage,
  publishRequests,
  onReviewPublish
}: DeploymentQueueViewProps) {
  const [activeFilter, setActiveFilter] = useState<"needs_release" | "synced" | "all" | "history" | "gates">("needs_release");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null);

  const [pipelineItems, setPipelineItems] = useState<PageReleasePipelineItem[]>(() => 
    StoreService.getPageReleasePipeline()
  );
  const [deployments, setDeployments] = useState<DeploymentRecord[]>(() => 
    StoreService.getDeployments()
  );

  useEffect(() => {
    const load = () => {
      setPipelineItems(StoreService.getPageReleasePipeline());
      setDeployments(StoreService.getDeployments());
    };
    load();
    return StoreService.subscribe(load);
  }, []);

  const needsReleaseItems = useMemo(() => {
    return pipelineItems.filter(p => p.pipelineState === "NEEDS_RELEASE" || p.hasProductionChanges);
  }, [pipelineItems]);

  const syncedItems = useMemo(() => {
    return pipelineItems.filter(p => p.pipelineState === "IN_SYNC");
  }, [pipelineItems]);

  // If user opens view and 0 items need release, default to "all"
  useEffect(() => {
    if (needsReleaseItems.length === 0 && activeFilter === "needs_release" && syncedItems.length > 0) {
      setActiveFilter("all");
    }
  }, [needsReleaseItems.length, syncedItems.length]);

  const displayedPipeline = useMemo(() => {
    let list: PageReleasePipelineItem[] = [];
    if (activeFilter === "needs_release") {
      list = needsReleaseItems;
    } else if (activeFilter === "synced") {
      list = syncedItems;
    } else {
      list = pipelineItems;
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(p => 
      p.pageName.toLowerCase().includes(q) || 
      p.pageId.toLowerCase().includes(q) || 
      p.module.toLowerCase().includes(q)
    );
  }, [activeFilter, needsReleaseItems, syncedItems, pipelineItems, searchQuery]);

  const filteredHistory = useMemo(() => {
    return deployments
      .filter(d => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return d.pageName.toLowerCase().includes(q) || d.language.toLowerCase().includes(q) || d.environment.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [deployments, searchQuery]);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full">
      {/* Linear Sub-Segmented Control: Power-User Release Pipeline Switcher */}
      <div className="px-4 py-2 bg-bg-sidebar/70 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {/* 1. Unpublished (Pending changes to move through pipeline) */}
          <button
            onClick={() => setActiveFilter("needs_release")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeFilter === "needs_release"
                ? "bg-bg-card text-text-primary border-border-strong font-semibold shadow-xs"
                : "bg-transparent text-text-tertiary border-transparent hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <StatusInProgress className="w-3.5 h-3.5 text-amber-500" />
            <span>Unpublished</span>
            {needsReleaseItems.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                {needsReleaseItems.length}
              </span>
            )}
          </button>

          {/* 2. Published (All in sync, user doesn't have to worry) */}
          <button
            onClick={() => setActiveFilter("synced")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeFilter === "synced"
                ? "bg-bg-card text-text-primary border-border-strong font-semibold shadow-xs"
                : "bg-transparent text-text-tertiary border-transparent hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <StatusDone className="w-3.5 h-3.5 text-emerald-500" />
            <span>Published</span>
            <span className="text-[11px] font-mono text-text-tertiary">
              ({syncedItems.length})
            </span>
          </button>

          {/* 3. All Pages (Full cross-environment matrix) */}
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeFilter === "all"
                ? "bg-bg-card text-text-primary border-border-strong font-semibold shadow-xs"
                : "bg-transparent text-text-tertiary border-transparent hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <SquaresFour className="w-3.5 h-3.5 text-text-secondary" />
            <span>All Pages</span>
            <span className="text-[11px] font-mono text-text-tertiary">
              ({pipelineItems.length})
            </span>
          </button>

          {/* 4. Release History */}
          <button
            onClick={() => setActiveFilter("history")}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap shrink-0 ${
              activeFilter === "history"
                ? "bg-bg-card text-text-primary border-border-strong font-semibold shadow-xs"
                : "bg-transparent text-text-tertiary border-transparent hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            <ClockCounterClockwise className="w-3.5 h-3.5 text-text-secondary" />
            <span>Release History</span>
            <span className="text-[11px] font-mono text-text-tertiary">
              ({deployments.length})
            </span>
          </button>

          {/* 5. Production Approval Gates (if any) */}
          {publishRequests.length > 0 && (
            <button
              onClick={() => setActiveFilter("gates")}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap shrink-0 ${
                activeFilter === "gates"
                  ? "bg-bg-card text-text-primary border-border-strong font-semibold shadow-xs"
                  : "bg-transparent text-text-tertiary border-transparent hover:text-text-primary hover:bg-bg-hover"
              }`}
            >
              <RocketLaunch className="w-3.5 h-3.5 text-accent-blue" />
              <span>Approval Gates</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-accent-blue/15 text-accent-blue font-bold">
                {publishRequests.length}
              </span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-56 shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" weight="bold" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by page or module..."
            className="w-full h-7 pl-8 pr-2.5 bg-bg-main border border-border-subtle rounded-md text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent-blue outline-none transition-colors"
          />
        </div>
      </div>

      {/* Main Table Content */}
      <div className="flex-1 overflow-auto scrollbar-none w-full">
        {activeFilter === "history" ? (
          /* History View */
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead className="bg-bg-sidebar border-b border-border-subtle sticky top-0 z-20">
              <tr>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[160px] shrink-0 bg-bg-sidebar">
                  Released At
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[220px] max-w-[220px] shrink-0 bg-bg-sidebar">
                  Page & Module
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[140px] shrink-0 bg-bg-sidebar">
                  Language
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[120px] shrink-0 bg-bg-sidebar">
                  Environment
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[120px] shrink-0 bg-bg-sidebar">
                  Version
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-right w-36 bg-bg-sidebar sticky right-0 z-30 border-l border-border-subtle shrink-0">
                  Published By
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => {
                  const envStyle = item.environment === "PRODUCTION"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : item.environment === "QA"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                    : "bg-accent-blue/10 text-accent-blue border-accent-blue/20";

                  return (
                    <tr key={item.id} className="group hover:bg-bg-hover transition-colors cursor-default">
                      <td className="px-4 py-2.5 text-[12px] text-text-secondary font-mono w-[160px] shrink-0">
                        <Tooltip content={new Date(item.publishedAt).toLocaleString()}>
                          <span className="cursor-help">
                            {getRelativeTime(item.publishedAt)}
                          </span>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-text-primary w-[220px] max-w-[220px] shrink-0">
                        <Link to={`/pages/${item.pageId}`} className="hover:underline truncate block" title={item.pageName}>
                          {item.pageName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-text-secondary w-[140px] shrink-0">
                        {item.language.toUpperCase()}
                      </td>
                      <td className="px-4 py-2.5 w-[120px] shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${envStyle}`}>
                          {item.environment}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-text-primary w-[120px] shrink-0">
                        <span className="font-bold">v{item.version}</span>
                        <span className="text-[11px] text-text-tertiary ml-1.5">({item.tagCount} str)</span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] font-medium text-text-secondary w-36 text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 border-l border-border-subtle transition-colors shrink-0">
                        <span className="truncate block" title={item.publishedBy}>
                          {item.publishedBy}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-24 text-center">
                    <div className="flex flex-col items-center justify-center py-16 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
                      <RocketLaunch className="w-7 h-7 opacity-40 mb-2" />
                      <h3 className="text-[14px] font-bold text-text-primary mb-1">No Releases Found</h3>
                      <p className="text-[12px] max-w-sm text-balance text-text-secondary">
                        Deployments to DEV, QA, and PRODUCTION will appear here chronologically.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : activeFilter === "gates" ? (
          /* Production Approval Gates */
          <table className="w-full min-w-[760px] text-left border-collapse">
            <thead className="bg-bg-sidebar border-b border-border-subtle sticky top-0 z-20">
              <tr>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[240px] max-w-[240px] shrink-0 bg-bg-sidebar">
                  Page & Target Environment
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[200px] bg-bg-sidebar">
                  Language & Payload
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[180px] bg-bg-sidebar">
                  Requested By
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-right w-44 bg-bg-sidebar sticky right-0 z-30 border-l border-border-subtle shrink-0">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {publishRequests.length > 0 ? (
                publishRequests.map((req) => (
                  <tr key={req.id} className="group hover:bg-bg-hover transition-colors cursor-default">
                    <td className="px-4 py-2.5 align-top w-[240px] max-w-[240px] shrink-0">
                      <div className="text-[13px] font-bold text-text-primary mb-1 truncate" title={req.pageName}>
                        {req.pageName}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-medium rounded border border-emerald-500/20">
                          {req.environment}
                        </span>
                        <span className="text-[11px] text-text-tertiary">Production Gate</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-top min-w-[200px]">
                      <div className="text-[13px] font-semibold text-text-primary">{req.language.toUpperCase()}</div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">{req.tagCount} approved string{req.tagCount === 1 ? '' : 's'}</div>
                    </td>
                    <td className="px-4 py-2.5 align-top min-w-[180px]">
                      <div className="text-[13px] font-medium text-text-primary truncate">{req.requestedBy}</div>
                      <div className="text-[11px] text-text-tertiary mt-0.5">{new Date(req.requestedAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-2.5 align-top text-right w-44 bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 border-l border-border-subtle transition-colors shrink-0">
                      {canApprovePublish ? (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => onReviewPublish(req.id, "REJECT")} className="btn-danger py-1 px-2.5 text-[12px]">
                            Reject
                          </button>
                          <button onClick={() => onReviewPublish(req.id, "APPROVE")} className="btn-primary py-1 px-2.5 text-[12px] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" weight="bold" />
                            <span>Approve</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-text-tertiary italic">Requires Support Reviewer</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-5 py-24 text-center">
                    <div className="flex flex-col items-center justify-center py-16 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
                      <EmptyStateGraphic className="mb-4 opacity-80" />
                      <h3 className="text-[14px] font-bold text-text-primary mb-1">No Pending Release Gates</h3>
                      <p className="text-[12px] max-w-sm text-balance text-text-secondary">
                        No production releases are currently waiting for approval sign-off.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          /* Release Pipeline Matrix Table (Needs Release, Live & Synced, All Pages) */
          <table className="w-full min-w-[840px] text-left border-collapse">
            <thead className="bg-bg-sidebar border-b border-border-subtle sticky top-0 z-20">
              <tr>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[220px] max-w-[220px] shrink-0 bg-bg-sidebar">
                  Module & Page
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[100px] shrink-0 bg-bg-sidebar">
                  DEV
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[100px] shrink-0 bg-bg-sidebar">
                  QA
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[130px] shrink-0 bg-bg-sidebar">
                  PRODUCTION
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[200px] bg-bg-sidebar">
                  Pipeline Status
                </th>
                <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-right w-32 bg-bg-sidebar sticky right-0 z-30 border-l border-border-subtle shrink-0">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {displayedPipeline.length > 0 ? (
                displayedPipeline.map((item) => {
                  const isExpanded = expandedPageId === item.pageId;
                  const isSynced = item.pipelineState === "IN_SYNC";
                  const needsRelease = item.pipelineState === "NEEDS_RELEASE" || item.hasProductionChanges;

                  return (
                    <React.Fragment key={item.pageId}>
                      <tr className="group hover:bg-bg-hover transition-colors cursor-default">
                        {/* Module & Page */}
                        <td className="px-4 py-2.5 align-top w-[220px] max-w-[220px] shrink-0">
                          <div className="font-semibold text-[13px] text-text-primary mb-1 truncate">
                            <Link
                              to={`/pages/${item.pageId}`}
                              title={item.pageName}
                              className="text-link hover:underline transition-colors inline-flex items-center gap-1.5 group/link outline-none truncate block max-w-full"
                            >
                              <span className="truncate">{item.pageName}</span>
                              <ExternalLink className="w-3 h-3 text-text-tertiary group-hover/link:text-link transition-colors shrink-0" />
                            </Link>
                          </div>
                          <div className="text-[11px] text-text-tertiary font-medium flex items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.2 rounded bg-bg-card border border-border-subtle text-[10px] font-mono">
                              {item.module}
                            </span>
                            <span>•</span>
                            <span>{item.totalTags} strings</span>
                          </div>
                        </td>

                        {/* DEV Environment Column */}
                        <td className="px-4 py-2.5 align-top w-[100px] shrink-0 font-mono text-[12px]">
                          {item.dev.version ? (
                            <span className="px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20 font-bold">
                              v{item.dev.version}
                            </span>
                          ) : (
                            <span className="text-text-tertiary">—</span>
                          )}
                        </td>

                        {/* QA Environment Column */}
                        <td className="px-4 py-2.5 align-top w-[100px] shrink-0 font-mono text-[12px]">
                          {item.qa.version ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold">
                              v{item.qa.version}
                            </span>
                          ) : (
                            <span className="text-text-tertiary">—</span>
                          )}
                        </td>

                        {/* PRODUCTION Environment Column */}
                        <td className="px-4 py-2.5 align-top w-[130px] shrink-0 font-mono text-[12px]">
                          {item.production.version ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold">
                                v{item.production.version}
                              </span>
                              {item.production.hasUnpublishedChanges && (
                                <Tooltip content="Unpublished updates pending release">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse cursor-help inline-block" />
                                </Tooltip>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-mono text-text-tertiary">Unreleased</span>
                          )}
                        </td>

                        {/* Pipeline Status Column */}
                        <td className="px-4 py-2.5 align-top min-w-[200px]">
                          <div className="flex flex-col gap-0.5">
                            {isSynced ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-500">
                                <StatusDone className="w-3.5 h-3.5" />
                                <span>Published & Synced ✓</span>
                              </span>
                            ) : needsRelease ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-500">
                                <StatusInProgress className="w-3.5 h-3.5 text-amber-500" />
                                <span>Unpublished Updates</span>
                              </span>
                            ) : item.pipelineState === "NEEDS_QA" ? (
                              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-blue">
                                <StatusInProgress className="w-3.5 h-3.5 text-accent-blue" />
                                <span>Needs QA Promotion</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-tertiary">
                                <StatusBacklog className="w-3.5 h-3.5" />
                                <span>Unreleased Draft</span>
                              </span>
                            )}
                            <span className="text-[11px] text-text-tertiary">
                              {item.pendingChangesSummary}
                            </span>
                          </div>
                        </td>

                        {/* Action Column */}
                        <td className="px-4 py-2.5 align-top text-right w-32 bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 border-l border-border-subtle transition-colors shrink-0">
                          <div className="flex items-center justify-end gap-1.5">
                            {canPublish && (
                              <Tooltip content="Open release dialog for this page">
                                <button
                                  onClick={() => onDeployPage(item.pageId, item.pageName)}
                                  className="btn-primary py-1 px-2.5 text-[12px] inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RocketLaunch className="w-3 h-3" weight="fill" />
                                  <span>Deploy</span>
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip content={isExpanded ? "Collapse languages" : "View per-language breakdown"}>
                              <button
                                onClick={() => setExpandedPageId(isExpanded ? null : item.pageId)}
                                className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                              >
                                {isExpanded ? <CaretUp className="w-3.5 h-3.5" /> : <CaretDown className="w-3.5 h-3.5" />}
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Per-Language Sub-Row */}
                      {isExpanded && (
                        <tr className="bg-bg-card/60">
                          <td colSpan={6} className="px-6 py-3 border-b border-border-subtle">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
                              Language Breakdown for {item.pageName}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {item.languages.map(lang => (
                                <div
                                  key={lang.code}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono border flex items-center gap-2 ${
                                    lang.hasChanges
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      : lang.lastPublishedVersion
                                      ? "bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                      : "bg-bg-main text-text-tertiary border-border-subtle"
                                  }`}
                                >
                                  <span className="font-bold">{lang.code.toUpperCase()}</span>
                                  <span>{lang.approvedCount}/{lang.totalTags} app</span>
                                  <span className="text-[10px] opacity-75">
                                    {lang.lastPublishedVersion ? `v${lang.lastPublishedVersion}` : 'unreleased'}
                                  </span>
                                  {lang.hasChanges && (
                                    <Tooltip content="Updates pending for this language">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 cursor-help inline-block" />
                                    </Tooltip>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-24 text-center">
                    <div className="flex flex-col items-center justify-center py-16 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
                      {activeFilter === "needs_release" ? (
                        <>
                          <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mb-2.5">
                            <Check className="w-4 h-4" weight="bold" />
                          </div>
                          <h3 className="text-[14px] font-bold text-text-primary mb-1">
                            All Pages are Published & Synced!
                          </h3>
                          <p className="text-[12px] max-w-sm text-balance text-text-secondary mb-3">
                            No unpublished updates pending. All approved translations are live across environments.
                          </p>
                          <button
                            onClick={() => setActiveFilter("all")}
                            className="btn-secondary py-1 px-3 text-[12px] cursor-pointer"
                          >
                            View All Pages
                          </button>
                        </>
                      ) : (
                        <>
                          <Search className="w-6 h-6 opacity-40 mb-2" />
                          <h3 className="text-[14px] font-bold text-text-primary mb-1">No Pages Found</h3>
                          <p className="text-[12px] max-w-sm text-balance text-text-secondary">
                            Try adjusting your search filter.
                          </p>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
