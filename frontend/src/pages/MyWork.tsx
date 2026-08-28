import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Clock, ArrowSquareOut as ExternalLink, Tray as Inbox, Check, Sparkle as Sparkles, WarningCircle as AlertCircle } from "@phosphor-icons/react";
import { StoreService } from "../store/StoreService";
import { ApiService } from "../services/ApiService";
import { motion, AnimatePresence } from "framer-motion";
import { Dropdown } from "../components/ui/Dropdown";

export function MyWork() {
  const [activeTab, setActiveTab] = useState<"pending" | "stale" | "escalations">("pending");
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
  const [selectedLanguage, setSelectedLanguage] = useState("All");

  const [pendingList, setPendingList] = useState<any[]>([]);
  const [staleList, setStaleList] = useState<any[]>([]);
  const [escalatedList, setEscalatedList] = useState<import("../types").EscalatedItem[]>([]);

  useEffect(() => {
    StoreService.refreshPages();
    const load = async () => {
      setActiveLangs(StoreService.getActiveLanguages());
      setPendingList(StoreService.getPendingReviews(selectedLanguage === "All" ? undefined : selectedLanguage));
      setStaleList(StoreService.getStaleTranslations(selectedLanguage === "All" ? undefined : selectedLanguage));
      
      try {
        const escalations = await ApiService.getEscalatedItems();
        setEscalatedList(escalations);
      } catch (err) {
        console.error("Failed to load escalations", err);
      }
    };
    load();
    return StoreService.subscribe(load);
  }, [selectedLanguage]);

  const handleApprove = (pageId: string, tagId: string, langCode: string) => {
    StoreService.updateTranslation(pageId, tagId, langCode, { status: "Approved" });
  };

  const handleResolveEscalation = async (tagId: string, commentId: string) => {
    try {
      await ApiService.resolveComment(tagId, commentId);
      const escalations = await ApiService.getEscalatedItems();
      setEscalatedList(escalations);
    } catch (err) {
      console.error("Failed to resolve escalation", err);
    }
  };

  const tabs = [
    { id: "pending", label: "Pending Review", count: pendingList.length, icon: CheckCircle },
    { id: "stale", label: "Stale Translations", count: staleList.length, icon: Clock },
    { id: "escalations", label: "Escalations", count: escalatedList.length, icon: AlertCircle }
  ] as const;

  return (
    <div className="flex flex-col gap-6 max-w-6xl w-full mx-auto pb-12 pt-4">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-text-main">My Work</h1>
        <p className="text-sm text-text-subtle">
          Review AI-generated translations or update strings where the English source has changed.
        </p>
      </div>

      {/* Control Bar: Tabs + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-main pb-4">
        {/* Tab Navigation */}
        <div className="flex items-center gap-2">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors duration-200 outline-none cursor-pointer ${
                  isActive ? "text-primary" : "text-text-muted hover:text-text-main hover:bg-surface-hover"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="myWorkTabBubble"
                    className="absolute inset-0 bg-primary/5 border border-primary/10 rounded-lg -z-10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <Icon className={`w-4 h-4 ${isActive ? "" : "opacity-70"}`} />
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] tracking-wide ml-1 transition-colors ${
                  isActive ? "bg-primary text-white font-bold" : "bg-surface-active text-text-subtle font-semibold"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Language Filter */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Filter:</span>
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

      {/* Main Content Area */}
      <div className="bg-surface border border-border-main rounded-xl shadow-xs overflow-hidden flex flex-col min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col"
          >
            {activeTab === "pending" ? (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-hover/40 border-b border-border-main/60">
                    <tr>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider w-[25%]">Location & Tag</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider w-[35%]">Master English</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider w-[35%]">AI Draft Translation</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/40">
                    {pendingList.length > 0 ? pendingList.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-surface-hover/40 transition-colors">
                        <td className="px-5 py-4 align-top">
                          <div className="font-mono text-xs font-semibold text-text-main mb-1 truncate">
                            <Link to={`/pages/${item.pageId}/tags/${item.tag}`} className="hover:text-primary transition-colors inline-flex items-center gap-1.5 group/link">
                              {item.tag} <ExternalLink className="w-3 h-3 text-text-muted group-hover/link:text-primary transition-colors" />
                            </Link>
                          </div>
                          <div className="text-[11px] text-text-subtle font-medium flex items-center gap-1.5">
                            <span className="truncate">{item.page}</span>
                            <span className="w-1 h-1 rounded-full bg-border-main shrink-0" />
                            <span className="shrink-0">{item.langName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-[13px] text-text-main leading-relaxed font-medium">
                            {item.english}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-[13px] text-text-main leading-relaxed mb-2" dir="auto">
                            {item.translatedText}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                              item.conf >= 85 
                                ? 'bg-emerald-500/5 text-emerald-600 border-emerald-500/10 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20' 
                                : 'bg-amber-500/5 text-amber-600 border-amber-500/10 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20'
                            }`}>
                              <Sparkles className="w-3 h-3" />
                              {item.conf}% Confidence
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-right">
                          <button 
                            onClick={() => handleApprove(item.pageId, item.tag, item.langCode)}
                            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-3 py-1.5 bg-primary text-white hover:bg-primary-hover text-[11px] font-bold rounded-md transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" weight="bold" />
                            <span>Approve</span>
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-24 text-center">
                          <div className="flex flex-col items-center justify-center py-20 text-text-subtle bg-surface-hover/30 rounded-xl border border-dashed border-border-main/60">
                            <div className="w-16 h-16 rounded-full bg-surface-active flex items-center justify-center mb-6 relative">
                              <CheckCircle className="w-8 h-8 text-emerald-500/80" weight="fill" />
                            </div>
                            <h3 className="text-base font-bold text-text-main mb-1.5">Queue is empty</h3>
                            <p className="text-xs max-w-sm text-balance">
                              There are no pending translations waiting for your review. You're all caught up!
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === "stale" ? (
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-hover/40 border-b border-border-main/60">
                    <tr>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider w-[35%]">Location & Tag</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider text-center">Version Delta</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider text-center">Stale Age</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider text-right w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/40">
                    {staleList.length > 0 ? staleList.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-surface-hover/40 transition-colors">
                        <td className="px-5 py-4 align-top">
                          <div className="font-mono text-xs font-semibold text-text-main mb-1 truncate">
                            <Link to={`/pages/${item.pageId}/tags/${item.tag}`} className="hover:text-primary transition-colors inline-flex items-center gap-1.5 group/link">
                              {item.tag} <ExternalLink className="w-3 h-3 text-text-muted group-hover/link:text-primary transition-colors" weight="bold" />
                            </Link>
                          </div>
                          <div className="text-[11px] text-text-subtle font-medium flex items-center gap-1.5">
                            <span className="truncate">{item.page}</span>
                            <span className="w-1 h-1 rounded-full bg-border-main shrink-0" />
                            <span className="shrink-0">{item.langName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-middle text-center">
                          <span className="inline-flex items-center px-2 py-0.5 bg-surface-active border border-border-main/50 rounded font-mono text-[11px] text-text-main font-bold">
                            {item.change}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-middle text-center">
                          <span className="text-[12px] font-bold text-amber-600/90 dark:text-amber-500/90">
                            {item.age}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-middle text-right">
                          <Link 
                            to={`/pages/${item.pageId}/tags/${item.tag}`}
                            className="inline-flex items-center justify-center w-full sm:w-auto px-3 py-1.5 bg-surface border border-border-main hover:border-text-muted hover:bg-surface-hover text-text-main text-[11px] font-bold rounded-md transition-all active:scale-[0.98] shadow-xs"
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-24 text-center">
                          <div className="flex flex-col items-center justify-center py-20 text-text-subtle bg-surface-hover/30 rounded-xl border border-dashed border-border-main/60">
                            <div className="w-16 h-16 rounded-full bg-surface-active flex items-center justify-center mb-6 relative">
                              <Inbox className="w-8 h-8 text-text-muted/60" weight="fill" />
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-surface-active flex items-center justify-center">
                                <Sparkles className="w-3 h-3 text-white" weight="fill" />
                              </div>
                            </div>
                            <h3 className="text-base font-bold text-text-main mb-1.5">You're all caught up!</h3>
                            <p className="text-xs max-w-sm text-balance">
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
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-surface-hover/40 border-b border-border-main/60">
                    <tr>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider w-[20%]">Tag & Page</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider w-[20%]">Escalated By</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider w-[40%]">Reason & Context</th>
                      <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider text-right w-[20%]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-main/40">
                    {escalatedList.length > 0 ? escalatedList.map((item) => {
                      const tagInfo = StoreService.getTag(item.pageId, item.tagId);
                      const englishText = tagInfo ? tagInfo.english : "No English master text found";
                      return (
                      <tr key={item.comment.commentId} className="group hover:bg-surface-hover/40 transition-colors">
                        <td className="px-5 py-4 align-top">
                          <div className="font-mono text-xs font-semibold text-text-main mb-1 truncate">
                            <Link to={`/pages/${item.pageId}/tags/${item.tagId}`} className="hover:text-primary transition-colors inline-flex items-center gap-1.5 group/link">
                              {item.tagId} <ExternalLink className="w-3 h-3 text-text-muted group-hover/link:text-primary transition-colors" />
                            </Link>
                          </div>
                          <div className="text-[11px] text-text-subtle font-medium flex items-center gap-1.5">
                            <span className="truncate">{item.pageName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="text-[13px] text-text-main leading-relaxed font-bold">
                            {item.comment.author.displayName}
                          </div>
                          <div className="text-[11px] text-text-subtle mt-1.5 flex flex-col gap-1.5 items-start">
                            <span className="px-2 py-0.5 bg-surface border border-border-main text-text-muted text-[10px] font-bold rounded shadow-sm">
                              {item.comment.author.role}
                            </span>
                            <span>{new Date(item.comment.createdAt).toLocaleDateString()}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {item.comment.escalationReason && (
                            <div className="text-[13px] text-[#172B4D] font-bold mb-3">
                              {item.comment.escalationReason}
                            </div>
                          )}
                          
                          <div className="bg-[#FFF7E6] border border-[#FF991F]/30 p-3 rounded-lg mb-3 shadow-xs">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-[#FF991F] weight-bold" />
                              <span className="text-[10px] font-bold text-[#FF991F] uppercase tracking-wider">Escalated Comment</span>
                            </div>
                            <div className="text-[13px] text-text-main leading-relaxed">
                              "{item.comment.text}"
                            </div>
                          </div>

                          <div className="text-[10px] font-bold text-text-subtle uppercase tracking-wider mb-1.5">Source English Copy</div>
                          <div className="text-[12px] text-text-main bg-surface border border-border-main/50 p-2.5 rounded-lg font-medium leading-relaxed shadow-sm inset-shadow">
                            {englishText}
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top text-right space-y-2.5">
                          <Link 
                            to={`/pages/${item.pageId}/tags/${item.tagId}`}
                            className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-surface border border-border-main hover:border-text-muted hover:bg-surface-hover text-text-main text-xs font-bold rounded-lg transition-all active:scale-[0.98] shadow-sm block"
                          >
                            Review Details
                          </Link>
                          <button 
                            onClick={() => handleResolveEscalation(item.tagId, item.comment.commentId)}
                            className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 bg-primary text-white hover:bg-primary-hover text-xs font-bold rounded-lg transition-all active:scale-[0.98] shadow-sm cursor-pointer"
                          >
                            <Check className="w-4 h-4" weight="bold" />
                            <span>Resolve</span>
                          </button>
                        </td>
                      </tr>
                    )}) : (
                      <tr>
                        <td colSpan={4} className="px-5 py-24 text-center">
                          <div className="flex flex-col items-center justify-center py-20 text-text-subtle bg-surface-hover/30 rounded-xl border border-dashed border-border-main/60">
                            <div className="w-16 h-16 rounded-full bg-surface-active flex items-center justify-center mb-6 relative">
                              <Inbox className="w-8 h-8 text-text-muted/60" weight="fill" />
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-surface-active flex items-center justify-center">
                                <Sparkles className="w-3 h-3 text-white" weight="fill" />
                              </div>
                            </div>
                            <h3 className="text-base font-bold text-text-main mb-1.5">No Pending Escalations</h3>
                            <p className="text-xs max-w-sm text-balance">
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
