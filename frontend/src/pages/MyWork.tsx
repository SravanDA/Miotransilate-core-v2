import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ArrowSquareOut as ExternalLink, Check,
  WarningCircle as AlertCircle, FileText, RocketLaunch, Star, Clock 
} from "@phosphor-icons/react";
import { StoreService } from "../store/StoreService";
import { ApiService } from "../services/ApiService";
import { BookmarkService } from "../services/BookmarkService";
import { RecentlyEditedService } from "../services/RecentlyEditedService";
import { motion, AnimatePresence } from "framer-motion";
import { Dropdown } from "../components/ui/Dropdown";
import { CopyButton } from "../components/ui/CopyButton";
import { ConfidenceBadge } from "../components/translation/ConfidenceBadge";
import { StatusInProgress, StatusBacklog, StatusTodo } from "../components/ui/LinearIcons";
import { EmptyStateGraphic } from "../components/ui/EmptyStateGraphic";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import type { PublishApprovalRequest } from "../types";

export function MyWork() {
  const { user, can } = useAuth();
  const { toast } = useToast();
  const isDev = user?.roles?.includes("DEV");
  const canApprove = can("TRANSLATION_APPROVE") || user?.roles?.includes("FN");
  const canApproveEnglish = can("ENGLISH_APPROVE") || user?.roles?.includes("FN");
  const canResolveEscalation = can("ENGLISH_APPROVE") || user?.roles?.includes("FN");
  const canApprovePublish = can("PUBLISH_PRODUCTION") || user?.roles?.includes("FN") || user?.roles?.includes("SR");

  const [activeTab, setActiveTab] = useState<"pending" | "english" | "publish" | "stale" | "escalations">("pending");
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
  const [selectedLanguage, setSelectedLanguage] = useState("All");
  const [staleSort, setStaleSort] = useState<"age" | "language" | "page">("age");

  const [pendingList, setPendingList] = useState<any[]>([]);
  const [englishList, setEnglishList] = useState<any[]>([]);
  const [publishRequests, setPublishRequests] = useState<PublishApprovalRequest[]>([]);
  const [staleList, setStaleList] = useState<any[]>([]);
  const [escalatedList, setEscalatedList] = useState<import("../types").EscalatedItem[]>([]);

  useEffect(() => {
    StoreService.refreshPages();
    const load = async () => {
      setActiveLangs(StoreService.getActiveLanguages());
      if (isDev) {
        setPendingList([]);
        setEnglishList([]);
        setPublishRequests([]);
        setStaleList([]);
        setEscalatedList([]);
        return;
      }

      setPendingList(StoreService.getPendingReviews(selectedLanguage === "All" ? undefined : selectedLanguage));
      setEnglishList(StoreService.getEnglishPendingReviews());
      setPublishRequests(StoreService.getPublishApprovalRequests().filter(r => r.status === "PENDING"));
      
      const stales = StoreService.getStaleTranslations(selectedLanguage === "All" ? undefined : selectedLanguage);
      if (staleSort === "age") {
        stales.sort((a, b) => b.staleDays - a.staleDays);
      } else if (staleSort === "language") {
        stales.sort((a, b) => a.langName.localeCompare(b.langName));
      } else if (staleSort === "page") {
        stales.sort((a, b) => a.page.localeCompare(b.page));
      }
      setStaleList(stales);
      
      try {
        const escalations = await ApiService.getEscalatedItems();
        setEscalatedList(escalations);
      } catch (err) {
        console.error("Failed to load escalations", err);
      }
    };
    load();
    return StoreService.subscribe(load);
  }, [selectedLanguage, staleSort, isDev]);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleApproveTranslation = async (pageId: string, tagId: string, langCode: string) => {
    if (!canApprove) {
      toast("You don't have permission to approve translations.");
      return;
    }
    const actionKey = `trans-${pageId}-${tagId}-${langCode}`;
    if (actionLoadingId === actionKey) return;
    setActionLoadingId(actionKey);
    try {
      await StoreService.approveTranslation(pageId, tagId, langCode);
      setPendingList(prev => prev.filter(item => !(item.pageId === pageId && item.tag === tagId && item.langCode === langCode)));
      toast("Translation approved successfully");
    } catch (err: any) {
      console.error("Failed to approve translation", err);
      toast("Failed to approve translation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveEnglishDraft = async (pageId: string, tagId: string) => {
    if (!canApproveEnglish) {
      toast("You don't have permission to approve master English copy.");
      return;
    }
    const actionKey = `eng-${pageId}-${tagId}`;
    if (actionLoadingId === actionKey) return;
    setActionLoadingId(actionKey);
    try {
      await StoreService.approveEnglish(pageId, tagId);
      setEnglishList(prev => prev.filter(item => !(item.pageId === pageId && item.tagId === tagId)));
      toast("Master English approved! Translations marked as Stale.");
    } catch (err: any) {
      console.error("Failed to approve English draft", err);
      toast("Failed to approve English draft");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmStaleTranslation = async (pageId: string, tagId: string, langCode: string) => {
    if (!canApprove) {
      toast("You don't have permission to confirm translations.");
      return;
    }
    const actionKey = `stale-${pageId}-${tagId}-${langCode}`;
    if (actionLoadingId === actionKey) return;
    setActionLoadingId(actionKey);
    try {
      await StoreService.confirmStaleTranslation(pageId, tagId, langCode);
      setStaleList(prev => prev.filter(item => !(item.pageId === pageId && item.tag === tagId && item.langCode === langCode)));
      toast("Translation confirmed as valid");
    } catch (err: any) {
      console.error("Failed to confirm stale translation", err);
      toast("Failed to confirm translation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReviewPublish = async (requestId: string, action: "APPROVE" | "REJECT") => {
    if (!canApprovePublish) {
      toast("You don't have permission to review production publishing requests.");
      return;
    }
    const actionKey = `pub-${requestId}-${action}`;
    if (actionLoadingId === actionKey) return;
    setActionLoadingId(actionKey);
    try {
      await StoreService.reviewPublishApproval(requestId, action, user?.displayName || "Support Reviewer");
      toast(`Publishing request ${action === "APPROVE" ? "approved & deployed to Production" : "rejected"}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResolveEscalation = async (tagId: string, commentId: string) => {
    if (!canResolveEscalation) {
      toast("You don't have permission to resolve escalations.");
      return;
    }
    const actionKey = `esc-${tagId}-${commentId}`;
    if (actionLoadingId === actionKey) return;
    setActionLoadingId(actionKey);
    try {
      await ApiService.resolveComment(tagId, commentId);
      const escalations = await ApiService.getEscalatedItems();
      setEscalatedList(escalations);
      toast("Escalation resolved successfully");
    } catch (err) {
      console.error("Failed to resolve escalation", err);
      toast("Failed to resolve escalation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const tabs = [
    { id: "pending", label: "Translations", count: pendingList.length, icon: StatusInProgress, desc: "Awaiting approval" },
    { id: "english", label: "English Copy", count: englishList.length, icon: FileText, desc: "Master review" },
    { id: "publish", label: "Releases", count: publishRequests.length, icon: RocketLaunch, desc: "Prod gates" },
    { id: "stale", label: "Stale", count: staleList.length, icon: StatusBacklog, desc: "Source modified" },
    { id: "escalations", label: "Escalations", count: escalatedList.length, icon: StatusTodo, desc: "Action required" }
  ] as const;

  return (
    <div className="flex flex-col gap-4 w-full pb-12 pt-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight text-text-primary">My Work</h1>
          <p className="text-[13px] text-text-tertiary">
            Unified governance queue: review translations, approve English drafts, and clear release approval gates.
          </p>
        </div>
        
        {/* Language Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Filter:</span>
          <Dropdown
            value={selectedLanguage}
            onChange={setSelectedLanguage}
            className="w-40"
            options={[
              { value: "All", label: "All Languages" },
              ...activeLangs.map(lang => ({ value: lang.code, label: lang.name }))
            ]}
          />
        </div>
      </div>

      {/* Queue Cards (Tabs) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-3.5 rounded-xl text-left flex flex-col gap-2 transition-all duration-150 outline-none cursor-pointer border ${
                isActive 
                  ? "bg-bg-card border-accent-blue/40 shadow-xs ring-1 ring-accent-blue/20" 
                  : "bg-bg-main border-border-subtle hover:bg-bg-card hover:border-border-strong text-text-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 transition-colors duration-150 ${isActive ? "text-accent-blue" : "text-text-tertiary"}`} />
                <span className={`text-[13px] font-semibold truncate transition-colors duration-150 ${isActive ? "text-text-primary" : "text-text-secondary"}`}>{tab.label}</span>
              </div>
              <div className="flex items-baseline justify-between mt-1 gap-2">
                <span className={`text-2xl font-bold tracking-tight transition-colors duration-150 ${isActive ? "text-text-primary" : "text-text-secondary"}`}>{tab.count}</span>
                <span className="text-[11px] font-medium text-text-tertiary truncate">{tab.desc}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Access: Recently Edited & Bookmarks */}
      {(!isDev && (RecentlyEditedService.getRecentEdits().length > 0 || BookmarkService.getBookmarks().length > 0)) && (
        <div className="mb-4 p-3 bg-bg-card border border-border-subtle rounded-xl flex items-center gap-4 overflow-x-auto scrollbar-none text-[12px]">
          {BookmarkService.getBookmarks().length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-warning">
                <Star className="w-3.5 h-3.5" weight="fill" /> Bookmarks:
              </span>
              <div className="flex items-center gap-1.5">
                {BookmarkService.getBookmarks().slice(0, 4).map((b) => (
                  <Link
                    key={b.id}
                    to={b.type === "page" ? `/pages/${b.pageId}` : `/pages/${b.pageId}/tags/${b.tagId}`}
                    className="px-2 py-0.5 bg-bg-main border border-border-subtle hover:border-warning/50 rounded text-text-primary text-[11px] font-mono transition-colors"
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {RecentlyEditedService.getRecentEdits().length > 0 && (
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                <Clock className="w-3.5 h-3.5" /> Recent:
              </span>
              <div className="flex items-center gap-1.5">
                {RecentlyEditedService.getRecentEdits().slice(0, 5).map((r) => (
                  <Link
                    key={r.id}
                    to={r.tagId ? `/pages/${r.pageId}/tags/${r.tagId}` : `/pages/${r.pageId}`}
                    className="px-2 py-0.5 bg-bg-main border border-border-subtle hover:border-accent-blue/50 rounded text-text-primary text-[11px] font-mono transition-colors"
                  >
                    {r.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col"
          >
            {isDev ? (
              <div className="flex flex-col items-center justify-center py-24 text-text-tertiary">
                <EmptyStateGraphic className="mb-4 opacity-80" />
                <h3 className="text-[14px] font-bold text-text-primary mb-1.5">No active queue for Developer role</h3>
                <p className="text-[12px] max-w-md text-center text-text-secondary">
                  Developers have view-only access in MioTranslate and do not participate in review, approval, or publishing workflows.
                </p>
              </div>
            ) : activeTab === "pending" ? (
              <div className="flex-1 overflow-auto scrollbar-none w-full">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead className="bg-bg-sidebar border-b border-border-subtle sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[220px] max-w-[220px] shrink-0 bg-bg-sidebar">Location & Tag</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[240px] bg-bg-sidebar">Master English</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[240px] bg-bg-sidebar">AI Draft Translation</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-right w-28 bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {pendingList.length > 0 ? pendingList.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-bg-hover transition-colors cursor-default">
                        <td className="px-4 py-2.5 align-top w-[220px] max-w-[220px] shrink-0">
                          <div className="font-mono text-[12px] font-semibold text-text-primary mb-1 truncate">
                            <Link to={`/pages/${item.pageId}/tags/${item.tag}`} title={item.tag} className="text-link hover:underline transition-colors inline-flex items-center gap-1.5 group/link outline-none truncate block max-w-full">
                              <span className="truncate">{item.tag}</span>
                              <ExternalLink className="w-3 h-3 text-text-tertiary group-hover/link:text-link transition-colors shrink-0" />
                            </Link>
                          </div>
                          <div className="text-[11px] text-text-tertiary font-medium flex items-center gap-1.5 min-w-0">
                            <span className="truncate" title={item.page}>{item.page}</span>
                            <span className="w-1 h-1 rounded-full bg-border-strong shrink-0" />
                            <span className="shrink-0">{item.langName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top min-w-[240px]">
                          <div className="group/copy flex items-start justify-between gap-2">
                            <div className="text-[13px] text-text-primary leading-relaxed font-medium">
                              {item.english}
                            </div>
                            <CopyButton
                              text={item.english}
                              className="opacity-0 group-hover/copy:opacity-100 group-hover:opacity-100 shrink-0 mt-0.5"
                              title="Copy English copy"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top min-w-[240px]">
                          <div className="group/copy flex items-start justify-between gap-2 mb-2">
                            <div className="text-[13px] text-text-primary leading-relaxed" dir="auto">
                              {item.translatedText}
                            </div>
                            <CopyButton
                              text={item.translatedText}
                              className="opacity-0 group-hover/copy:opacity-100 group-hover:opacity-100 shrink-0 mt-0.5"
                              title="Copy translation"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <ConfidenceBadge confidence={item.conf ?? 95} size="sm" />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top text-right w-28 bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
                          {canApprove ? (
                            <button 
                              onClick={() => handleApproveTranslation(item.pageId, item.tag, item.langCode)}
                              className="h-7 px-3 bg-accent-blue text-white hover:brightness-110 text-[12px] font-medium rounded-md transition-all active:scale-[0.98] inline-flex items-center justify-center gap-1.5 cursor-pointer outline-none shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" weight="bold" />
                              <span>Approve</span>
                            </button>
                          ) : (
                            <Link 
                              to={`/pages/${item.pageId}/tags/${item.tag}`}
                              className="h-7 px-3 bg-bg-main border border-border-subtle hover:border-border-strong text-text-primary text-[12px] font-medium rounded-md transition-all active:scale-[0.98] inline-flex items-center justify-center outline-none"
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-24 text-center">
                          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
                            <EmptyStateGraphic className="mb-4 opacity-80" />
                            <h3 className="text-[14px] font-bold text-text-primary mb-1.5">No Pending Translations</h3>
                            <p className="text-[12px] max-w-sm text-balance">
                              There are no pending translations waiting for review. You're all caught up!
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === "english" ? (
              <div className="flex-1 overflow-auto scrollbar-none w-full">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead className="bg-bg-sidebar border-b border-border-subtle sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[220px] max-w-[220px] shrink-0 bg-bg-sidebar">Location & Tag</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[260px] bg-bg-sidebar">Master English Draft</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[120px] bg-bg-sidebar shrink-0">Target Version</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-right w-28 bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {englishList.length > 0 ? englishList.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-bg-hover transition-colors cursor-default">
                        <td className="px-4 py-2.5 align-top w-[220px] max-w-[220px] shrink-0">
                          <div className="font-mono text-[12px] font-semibold text-text-primary mb-1 truncate">
                            <Link to={`/pages/${item.pageId}/tags/${item.tagId}`} title={item.tagId} className="text-link hover:underline transition-colors inline-flex items-center gap-1.5 group/link outline-none truncate block max-w-full">
                              <span className="truncate">{item.tagId}</span>
                              <ExternalLink className="w-3 h-3 text-text-tertiary group-hover/link:text-link transition-colors shrink-0" />
                            </Link>
                          </div>
                          <div className="text-[11px] text-text-tertiary font-medium flex items-center gap-1.5 min-w-0">
                            <span className="truncate" title={item.pageName}>{item.pageName}</span>
                            <span className="w-1 h-1 rounded-full bg-border-strong shrink-0" />
                            <span className="shrink-0">{item.module}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top min-w-[260px]">
                          <div className="group/copy flex items-start justify-between gap-2">
                            <div className="text-[13px] text-text-primary leading-relaxed font-medium">
                              {item.english}
                            </div>
                            <CopyButton
                              text={item.english}
                              className="opacity-0 group-hover/copy:opacity-100 group-hover:opacity-100 shrink-0 mt-0.5"
                              title="Copy English draft"
                            />
                          </div>
                          {item.changeReason && (
                            <div className="text-[11px] text-text-tertiary italic mt-1">
                              Reason: "{item.changeReason}"
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 align-middle w-[120px] shrink-0">
                          <span className="font-mono text-[10px] font-medium text-text-secondary bg-bg-main px-1.5 py-0.5 rounded border border-border-subtle">
                            v{(item.englishVersion || 1) + 1}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 align-top text-right w-28 bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
                          {canApproveEnglish ? (
                            <button 
                              onClick={() => handleApproveEnglishDraft(item.pageId, item.tagId)}
                              className="h-7 px-3 bg-accent-blue text-white hover:brightness-110 text-[12px] font-medium rounded-md transition-all active:scale-[0.98] inline-flex items-center justify-center gap-1.5 cursor-pointer outline-none shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" weight="bold" />
                              <span>Approve</span>
                            </button>
                          ) : (
                            <Link 
                              to={`/pages/${item.pageId}/tags/${item.tagId}`}
                              className="h-7 px-3 bg-bg-main border border-border-subtle hover:border-border-strong text-text-primary text-[12px] font-medium rounded-md transition-all active:scale-[0.98] inline-flex items-center justify-center outline-none"
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-24 text-center">
                          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
                            <EmptyStateGraphic className="mb-4 opacity-80" />
                            <h3 className="text-[14px] font-bold text-text-primary mb-1.5">No Pending English Drafts</h3>
                            <p className="text-[12px] max-w-sm text-balance">
                              All master English copy edits are approved and up to date.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === "publish" ? (
              <div className="flex-1 overflow-auto scrollbar-none w-full">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead className="bg-bg-sidebar border-b border-border-subtle sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[240px] max-w-[240px] shrink-0 bg-bg-sidebar">Page & Target Environment</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[200px] bg-bg-sidebar">Language & Payload</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[180px] bg-bg-sidebar">Requested By</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-right w-44 bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {publishRequests.length > 0 ? publishRequests.map((req) => (
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
                          <div className="text-[13px] font-semibold text-text-primary">
                            {req.language.toUpperCase()}
                          </div>
                          <div className="text-[11px] text-text-tertiary mt-0.5">
                            {req.tagCount} approved string{req.tagCount === 1 ? '' : 's'} included
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top min-w-[180px]">
                          <div className="text-[13px] font-medium text-text-primary truncate" title={req.requestedBy}>
                            {req.requestedBy}
                          </div>
                          <div className="text-[11px] text-text-tertiary mt-0.5">
                            {new Date(req.requestedAt).toLocaleDateString()} · {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-top text-right w-44 bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
                          {canApprovePublish ? (
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => handleReviewPublish(req.id, "REJECT")}
                                className="h-7 px-3 border border-border-subtle hover:border-danger/30 text-text-secondary hover:text-danger hover:bg-danger/10 text-[12px] font-medium rounded-md transition-colors cursor-pointer outline-none"
                              >
                                Reject
                              </button>
                              <button 
                                onClick={() => handleReviewPublish(req.id, "APPROVE")}
                                className="h-7 px-3 bg-accent-blue text-white hover:brightness-110 text-[12px] font-medium rounded-md transition-all active:scale-[0.98] inline-flex items-center gap-1.5 cursor-pointer outline-none shadow-xs"
                              >
                                <Check className="w-3.5 h-3.5" weight="bold" />
                                <span>Approve</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-text-tertiary italic">Requires Support Reviewer</span>
                          )}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-24 text-center">
                          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
                            <EmptyStateGraphic className="mb-4 opacity-80" />
                            <h3 className="text-[14px] font-bold text-text-primary mb-1.5">No Pending Release Requests</h3>
                            <p className="text-[12px] max-w-sm text-balance">
                              No production releases are currently waiting for approval.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === "stale" ? (
              <div className="flex-1 overflow-auto scrollbar-none w-full">
                <div className="px-4 py-2 bg-bg-main border-b border-border-subtle flex items-center justify-between">
                  <span className="text-[12px] text-text-tertiary font-medium">{staleList.length} translations marked stale</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Sort by:</span>
                    <select
                      value={staleSort}
                      onChange={(e) => setStaleSort(e.target.value as any)}
                      className="bg-bg-card border border-border-strong rounded-md px-2 py-1 text-[12px] text-text-primary outline-none cursor-pointer"
                    >
                      <option value="age">Age (Oldest First)</option>
                      <option value="language">By Language</option>
                      <option value="page">By Page</option>
                    </select>
                  </div>
                </div>
                <table className="w-full min-w-[680px] text-left border-collapse">
                  <thead className="bg-bg-sidebar border-b border-border-subtle sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[220px] max-w-[220px] shrink-0 bg-bg-sidebar">Location & Tag</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-center w-[120px] bg-bg-sidebar shrink-0">Version Delta</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-center w-[120px] bg-bg-sidebar shrink-0">Stale Age</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-right w-28 bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {staleList.length > 0 ? staleList.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-bg-hover transition-colors cursor-default">
                        <td className="px-4 py-2.5 align-top w-[220px] max-w-[220px] shrink-0">
                          <div className="font-mono text-[12px] font-semibold text-text-primary mb-1 truncate">
                            <Link to={`/pages/${item.pageId}/tags/${item.tag}`} title={item.tag} className="text-link hover:underline transition-colors inline-flex items-center gap-1.5 group/link outline-none truncate block max-w-full">
                              <span className="truncate">{item.tag}</span>
                              <ExternalLink className="w-3 h-3 text-text-tertiary group-hover/link:text-link transition-colors shrink-0" weight="bold" />
                            </Link>
                          </div>
                          <div className="text-[11px] text-text-tertiary font-medium flex items-center gap-1.5 min-w-0">
                            <span className="truncate" title={item.page}>{item.page}</span>
                            <span className="w-1 h-1 rounded-full bg-border-strong shrink-0" />
                            <span className="shrink-0">{item.langName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-center w-[120px] shrink-0">
                          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold">
                            <span className="text-text-tertiary">v{item.masterVersion - item.delta}</span>
                            <span className="text-text-tertiary">→</span>
                            <span className="text-accent-blue">v{item.masterVersion}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-center w-[120px] shrink-0">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-bg-main border border-border-subtle text-amber-500">
                            <AlertCircle className="w-3 h-3" weight="bold" />
                            <span>{item.staleDays} days</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-right w-36 bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
                          <div className="flex items-center justify-end gap-1.5">
                            {canApprove && (
                              <button 
                                onClick={() => handleConfirmStaleTranslation(item.pageId, item.tag, item.langCode)}
                                className="h-7 px-2.5 bg-accent-blue text-white hover:brightness-110 text-[11px] font-medium rounded-md transition-all active:scale-[0.98] inline-flex items-center justify-center gap-1 cursor-pointer outline-none shadow-xs"
                                title="Confirm existing translation is still valid"
                              >
                                <Check className="w-3 h-3" weight="bold" />
                                <span>Confirm</span>
                              </button>
                            )}
                            <Link 
                              to={`/pages/${item.pageId}/tags/${item.tag}`}
                              className="h-7 px-2.5 bg-bg-main border border-border-subtle hover:border-border-strong text-text-primary text-[11px] font-medium rounded-md transition-all active:scale-[0.98] inline-flex items-center justify-center outline-none"
                            >
                              Review
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-24 text-center">
                          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
                            <EmptyStateGraphic className="mb-4 opacity-80" />
                            <h3 className="text-[14px] font-bold text-text-primary mb-1.5">You&apos;re all caught up!</h3>
                            <p className="text-[12px] max-w-sm text-balance">
                              All translations are up-to-date with their English masters.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === "escalations" ? (
              <div className="flex-1 overflow-auto scrollbar-none w-full">
                <table className="w-full min-w-[760px] text-left border-collapse">
                  <thead className="bg-bg-sidebar border-b border-border-subtle sticky top-0 z-20">
                    <tr>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[220px] max-w-[220px] shrink-0 bg-bg-sidebar">Tag & Page</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[180px] bg-bg-sidebar shrink-0">Escalated By</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[260px] bg-bg-sidebar">Reason & Context</th>
                      <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider text-right w-36 bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {escalatedList.length > 0 ? escalatedList.map((item) => {
                      const tagInfo = StoreService.getTag(item.pageId, item.tagId);
                      const englishText = tagInfo ? tagInfo.english : "No English master text found";
                      return (
                        <tr key={item.comment.commentId} className="group hover:bg-bg-hover transition-colors cursor-default">
                          <td className="px-4 py-2.5 align-top w-[220px] max-w-[220px] shrink-0">
                            <div className="font-mono text-[12px] font-semibold text-text-primary mb-1 truncate">
                              <Link to={`/pages/${item.pageId}/tags/${item.tagId}`} title={item.tagId} className="text-link hover:underline transition-colors inline-flex items-center gap-1.5 group/link outline-none truncate block max-w-full">
                                <span className="truncate">{item.tagId}</span>
                                <ExternalLink className="w-3 h-3 text-text-tertiary group-hover/link:text-link transition-colors shrink-0" />
                              </Link>
                            </div>
                            <div className="text-[11px] text-text-tertiary font-medium flex items-center gap-1.5 min-w-0">
                              <span className="truncate" title={item.pageName}>{item.pageName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-top w-[180px] shrink-0">
                            <div className="text-[13px] text-text-primary leading-relaxed font-semibold truncate" title={item.comment.author.displayName}>
                              {item.comment.author.displayName}
                            </div>
                            <div className="text-[11px] text-text-tertiary mt-1.5 flex flex-col gap-1.5 items-start">
                              <span className="px-1.5 py-0.5 bg-bg-card border border-border-subtle text-text-secondary text-[10px] font-mono font-medium rounded">
                                {item.comment.author.role}
                              </span>
                              <span>{new Date(item.comment.createdAt).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-top min-w-[260px]">
                            {item.comment.escalationReason && (
                              <div className="text-[13px] text-text-primary font-medium mb-3">
                                {item.comment.escalationReason}
                              </div>
                            )}
                            
                            <div className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">Source English Copy</div>
                            <div className="text-[12px] text-text-primary bg-bg-main border border-border-subtle p-2.5 rounded-lg font-medium leading-relaxed">
                              {englishText}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 align-top text-right w-36 bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0 space-y-2">
                            <Link 
                              to={`/pages/${item.pageId}/tags/${item.tagId}`}
                              className="h-7 px-3 bg-bg-main border border-border-subtle hover:border-border-strong text-text-primary text-[12px] font-medium rounded-md transition-all active:scale-[0.98] inline-flex items-center justify-center outline-none w-full"
                            >
                              Review
                            </Link>
                            {canResolveEscalation && (
                              <button 
                                onClick={() => handleResolveEscalation(item.tagId, item.comment.commentId)}
                                className="h-7 px-3 bg-accent-blue text-white hover:brightness-110 text-[12px] font-medium rounded-md transition-all active:scale-[0.98] cursor-pointer outline-none shadow-xs inline-flex items-center justify-center gap-1.5 w-full"
                              >
                                <Check className="w-3.5 h-3.5" weight="bold" />
                                <span>Resolve</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-24 text-center">
                          <div className="flex flex-col items-center justify-center py-20 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
                            <EmptyStateGraphic className="mb-4 opacity-80" />
                            <h3 className="text-[14px] font-bold text-text-primary mb-1.5">No Pending Escalations</h3>
                            <p className="text-[12px] max-w-sm text-balance">
                              There are no escalated items requiring your attention.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

