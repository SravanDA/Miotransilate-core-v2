import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { 
  ArrowLeft, Check, WarningCircle as AlertCircle, FloppyDisk as Save,
  ChatCircle as MessageSquare, User, CheckCircle, PencilSimple as Edit3,
  ArrowBendDownRight as Reply, CaretDown
} from "@phosphor-icons/react";
import { TranslationStatusBadge } from "../components/translation/TranslationStatusBadge";
import { TranslationReviewModal } from "../components/translation/TranslationReviewModal";
import { StoreService } from "../store/StoreService";
import { engine } from "../engine/TranslationEngine";
import type { Tag, Comment } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { ApiService } from "../services/ApiService";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function CommentThread({ 
  comment, 
  depth, 
  tagId, 
  can, 
  onRefresh, 
  showToast 
}: { 
  comment: Comment; 
  depth: number; 
  tagId: string; 
  can: (p: string) => boolean;
  onRefresh: () => void; 
  showToast: (msg: string) => void;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const handleReply = async () => {
    if (replyText.trim() && tagId) {
      try {
        await ApiService.addComment(tagId, {
          text: replyText,
          scope: comment.scope,
          parentCommentId: comment.commentId
        });
        setReplyText("");
        setShowReplyInput(false);
        onRefresh();
      } catch {
        showToast("Failed to post reply");
      }
    }
  };

  const handleResolve = async () => {
    try {
      await ApiService.resolveComment(tagId, comment.commentId);
      onRefresh();
    } catch {
      showToast("Failed to resolve");
    }
  };

  const handleUnresolve = async () => {
    try {
      await ApiService.unresolveComment(tagId, comment.commentId);
      onRefresh();
    } catch {
      showToast("Failed to reopen");
    }
  };

  const hasReplies = comment.replies && comment.replies.length > 0;

  return (
    <div className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-border-main/40' : ''}`}>
      <div className={`group rounded-lg py-3 ${comment.resolved && depth === 0 ? 'opacity-60' : ''}`}>
        {/* Author row */}
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-bold text-text-main">{comment.author.displayName}</span>
              <span className="text-[10px] text-text-subtle">{timeAgo(comment.createdAt)}</span>
              {comment.isEscalation && (
                <span className="px-1.5 py-0.5 bg-[#FFEBE6] text-[#BF2600] text-[10px] font-bold rounded">
                  ESCALATION
                </span>
              )}
              {comment.resolved && (
                <span className="px-1.5 py-0.5 bg-[#E3FCEF] text-[#006644] text-[10px] font-bold rounded flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" weight="fill" /> Resolved
                </span>
              )}
            </div>
            
            {/* Comment text */}
            <p className="text-sm text-text-main mt-1 leading-relaxed whitespace-pre-wrap">{comment.text}</p>
            
            {/* Action bar */}
            <div className="flex items-center gap-3 mt-2">
              {can('COMMENT_CREATE') && (
                <button 
                  onClick={() => setShowReplyInput(!showReplyInput)}
                  className="text-xs font-semibold text-text-subtle hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Reply className="w-3.5 h-3.5" />
                  Reply
                </button>
              )}
              {depth === 0 && can('COMMENT_CREATE') && (
                <>
                  {!comment.resolved ? (
                    <button 
                      onClick={handleResolve}
                      className="text-xs font-semibold text-text-subtle hover:text-[#006644] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Resolve
                    </button>
                  ) : (
                    <button 
                      onClick={handleUnresolve}
                      className="text-xs font-semibold text-text-subtle hover:text-[#BF2600] transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Reopen
                    </button>
                  )}
                </>
              )}
              {comment.resolved && comment.resolvedBy && (
                <span className="text-[10px] text-text-subtle italic">
                  by {comment.resolvedBy.displayName}
                </span>
              )}
            </div>

            {/* Reply input */}
            {showReplyInput && (
              <div className="mt-3 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-3 h-3 text-primary" />
                </div>
                <input
                  type="text"
                  autoFocus
                  placeholder="Write a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && replyText.trim()) handleReply(); }}
                  className="flex-1 h-8 px-3 bg-surface border border-border-main rounded-lg text-sm text-text-main focus:border-primary outline-none"
                />
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                  className="h-8 px-3 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover disabled:opacity-40 cursor-pointer transition-colors"
                >
                  Reply
                </button>
                <button
                  onClick={() => { setShowReplyInput(false); setReplyText(""); }}
                  className="text-xs text-text-subtle hover:text-text-main cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Nested replies */}
      {hasReplies && !collapsed && (
        <div className="mt-1 space-y-1">
          {comment.replies.map(reply => (
            <CommentThread 
              key={reply.commentId} 
              comment={reply} 
              depth={depth + 1} 
              tagId={tagId} 
              can={can}
              onRefresh={onRefresh}
              showToast={showToast}
            />
          ))}
        </div>
      )}
      
      {/* Collapse toggle for threads with replies */}
      {hasReplies && depth === 0 && (
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="ml-9 mt-1 text-[11px] font-semibold text-text-subtle hover:text-primary cursor-pointer flex items-center gap-1 transition-colors"
        >
          <CaretDown className={`w-3 h-3 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          {collapsed ? `Show ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}` : 'Hide replies'}
        </button>
      )}
    </div>
  );
}

export function TagDetail() {
  const { pageId, tagId } = useParams();
  const { can } = useAuth();
  
  const [tag, setTag] = useState<Tag | null>(null);
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
  const [selectedLanguage, setSelectedLanguage] = useState(activeLangs[0]?.code || "en");

  const [englishCopy, setEnglishCopy] = useState("");
  const [isEditingEnglish, setIsEditingEnglish] = useState(false);

  const [transCopy, setTransCopy] = useState("");
  const [isEditingTrans, setIsEditingTrans] = useState(false);

  useEffect(() => {
    if (pageId) StoreService.refreshPageDetail(pageId);
    const load = () => {
      if (!pageId || !tagId) return;
      const t = StoreService.getTag(pageId, tagId);
      if (t) {
        setTag(t);
        if (!isEditingEnglish) setEnglishCopy(t.english);
        
        const currentLangVal = t.values[selectedLanguage];
        if (!isEditingTrans) setTransCopy(currentLangVal?.text || "");
      }
      setActiveLangs(StoreService.getActiveLanguages());
    };
    load();
    return StoreService.subscribe(load);
  }, [pageId, tagId, selectedLanguage]);

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentFilter, setCommentFilter] = useState<"all" | "open" | "resolved">("all");

  const fetchComments = async () => {
    if (tagId) {
      try {
        const fetched = await ApiService.getComments(tagId);
        setComments(fetched);
      } catch (err) {
        console.error("Failed to load comments", err);
      }
    }
  };

  useEffect(() => {
    fetchComments();
  }, [tagId]);

  const [newComment, setNewComment] = useState("");
  const [isEscalation, setIsEscalation] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveEnglish = async () => {
    if (!pageId || !tagId) return;
    const textToSave = englishCopy;
    setIsEditingEnglish(false);
    await StoreService.updateEnglish(pageId, tagId, textToSave);
    showToast("Master English updated. Older translations marked as Stale.");
  };

  const handleSaveTranslation = async () => {
    if (!pageId || !tagId) return;
    const textToSave = transCopy;
    setIsEditingTrans(false);
    await StoreService.updateTranslation(pageId, tagId, selectedLanguage, {
      text: textToSave,
      status: "Approved",
      confidence: 100
    });
    showToast("Translation saved manually");
  };

  const handleRunAI = () => {
    if (!pageId || !tagId || !tag) return;
    engine.translateTag(pageId, tagId, selectedLanguage);
    showToast("AI generated a draft. Pending review.");
  };

  const handleAddComment = async () => {
    if (newComment.trim() && tagId) {
      try {
        await ApiService.addComment(tagId, {
          text: newComment,
          scope: { type: "ENGLISH" },
          isEscalation,
          escalationReason: isEscalation ? newComment : null
        });
        setNewComment("");
        setIsEscalation(false);
        fetchComments();
      } catch {
        showToast("Failed to post comment");
      }
    }
  };

  // Filter comments client-side for the tabs
  const filteredComments = comments.filter(c => {
    if (commentFilter === "open") return !c.resolved;
    if (commentFilter === "resolved") return c.resolved;
    return true;
  });

  const openCount = comments.filter(c => !c.resolved).length;
  const resolvedCount = comments.filter(c => c.resolved).length;

  const currentVal = tag?.values[selectedLanguage] || { text: "", status: "No Trans", confidence: 0, translatedAtEnglishVersion: 1 };
  const deployments = StoreService.getDeployments().filter(d => d.pageId === pageId && d.language === selectedLanguage);
  const langConfig = activeLangs.find(l => l.code === selectedLanguage);

  if (!tag) {
    return <div className="p-8">Loading tag data...</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#172B4D] text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-[#79F2C0]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumbs & Header */}
      <div className="flex flex-col gap-4">
        <Link 
          to={`/pages/${pageId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-subtle hover:text-text-main hover:underline w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {pageId}
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text-main font-mono">{tag.id}</h1>
          <span className="px-2 py-0.5 bg-surface-active text-text-muted text-xs font-bold rounded">
            {tag.type}
          </span>
          <span className="px-2 py-0.5 bg-[#EAE6FF] text-[#403294] text-xs font-semibold rounded">
            v{tag.englishVersion}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Editors */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Master English Panel */}
          <div className="bg-surface border border-border-main rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-text-muted" weight="bold" />
                Discussion & Context
              </h2>
              {can('ENGLISH_AUTHOR') && (
                !isEditingEnglish ? (
                  <button 
                    onClick={() => setIsEditingEnglish(true)}
                    className="p-1.5 text-text-subtle hover:text-primary hover:bg-surface-hover rounded cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-4 h-4" weight="bold" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        setIsEditingEnglish(false);
                        setEnglishCopy(tag.english);
                      }}
                      className="text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSaveEnglish}
                      className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary-hover shadow-xs transition-all active:scale-[0.98] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" weight="fill" />
                      Save Master
                    </button>
                  </div>
                )
              )}
            </div>
            
            {isEditingEnglish ? (
              <textarea
                value={englishCopy}
                onChange={(e) => setEnglishCopy(e.target.value)}
                className="w-full h-24 p-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none resize-none"
              />
            ) : (
              <div className="p-4 bg-surface-hover border border-border-main rounded text-sm text-text-main whitespace-pre-wrap font-medium">
                {tag.english || <span className="text-text-subtle italic">No English copy added yet.</span>}
              </div>
            )}
            {isEditingEnglish && (
              <p className="text-[11px] text-[#FF8B00] mt-2 font-medium">
                Warning: Saving a new master will mark all existing translations as Stale.
              </p>
            )}
          </div>

          {/* Translation Panel */}
          <div className="bg-surface border border-border-main rounded-xl shadow-sm overflow-hidden flex flex-col">
            
            {/* Language Tabs */}
            <div className="flex overflow-x-auto border-b border-border-main hide-scrollbar bg-surface-hover/30">
              {activeLangs.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                    selectedLanguage === lang.code
                      ? "border-primary text-primary bg-surface"
                      : "border-transparent text-text-muted hover:text-text-main hover:bg-surface"
                  }`}
                >
                  {lang.name}
                  {tag.values[lang.code]?.status === "Pending Review" && (
                    <span className="ml-2 w-2 h-2 inline-block rounded-full bg-[#FF8B00]" />
                  )}
                </button>
              ))}
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#36B37E]" />
                    {langConfig?.name} Translation
                  </h2>
                  <TranslationStatusBadge status={currentVal.status as any} />
                </div>
                
                <div className="flex items-center gap-2">
                  {!isEditingTrans && currentVal.status === "Pending Review" && can('TRANSLATION_APPROVE') && (
                    <button 
                      onClick={() => setIsReviewModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF8B00] text-white text-xs font-bold rounded hover:bg-[#E57D00] transition-colors cursor-pointer shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" weight="bold" />
                      Review AI Draft
                    </button>
                  )}
                  
                  {!isEditingTrans ? (
                    <>
                      {can('TRANSLATION_CREATE') && (
                        <button 
                          onClick={handleRunAI}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border-main text-primary text-xs font-bold rounded transition-colors cursor-pointer shadow-sm"
                        >
                          Auto-Translate
                        </button>
                      )}
                      {can('TRANSLATION_EDIT') && (
                        <button 
                          onClick={() => setIsEditingTrans(true)}
                          className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" weight="bold" />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => {
                          setIsEditingTrans(false);
                          setTransCopy(currentVal.text);
                        }}
                        className="text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleSaveTranslation}
                        className="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary-hover shadow-xs transition-all active:scale-[0.98] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" weight="fill" />
                        Save Translation
                      </button>
                    </>
                  )}
                </div>
              </div>

              {currentVal.status === "Stale" && !isEditingTrans && (
                <div className="p-3 bg-[#FFFAE6] border border-[#FFE380] rounded text-sm text-[#172B4D] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#FF8B00] flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Stale Translation.</strong> The master English text was updated (v{tag.englishVersion}) since this was translated (from v{currentVal.translatedAtEnglishVersion}). Please review and update.
                  </div>
                </div>
              )}

              {isEditingTrans ? (
                <textarea
                  dir={langConfig?.direction || "auto"}
                  value={transCopy}
                  onChange={(e) => setTransCopy(e.target.value)}
                  className="w-full h-24 p-3 bg-surface border border-border-main rounded text-lg text-text-main focus:border-primary outline-none resize-none font-sans"
                />
              ) : (
                <div 
                  dir={langConfig?.direction || "auto"}
                  className="p-4 bg-surface border border-border-main rounded text-lg text-text-main whitespace-pre-wrap font-sans min-h-[6rem] flex items-center shadow-sm inset-shadow"
                >
                  {currentVal.text || <span className="text-text-subtle italic text-sm">No translation available. Click Auto-Translate or Edit.</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Sidebar (Comments, Deployments) */}
        <div className="flex flex-col gap-6">
          
          {/* Deployment Status */}
          <div className="bg-surface border border-border-main rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-text-main mb-4 uppercase tracking-wider text-text-muted">Deployments</h3>
            <div className="space-y-3">
              {(["DEV", "QA", "PRODUCTION"] as const).map(env => {
                const dep = deployments.find(d => d.environment === env);
                return (
                  <div key={env} className="flex items-center justify-between text-sm pb-3 border-b border-border-main last:border-0 last:pb-0">
                    <span className="font-semibold text-text-main">{env}</span>
                    {dep ? (
                      <span className="px-2 py-0.5 bg-[#E3FCEF] text-[#006644] text-xs font-bold rounded">Live</span>
                    ) : (
                      <span className="text-text-subtle">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Threaded Comments */}
          <div className="bg-surface border border-border-main rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden">
            
            {/* Comments Header */}
            <div className="px-5 pt-5 pb-0">
              <h3 className="text-base font-bold text-text-main mb-3">Comments</h3>
              
              {/* Filter tabs: All / Open / Resolved */}
              <div className="flex items-center gap-1 border-b border-border-main">
                {([
                  { key: "all", label: "All", count: comments.length },
                  { key: "open", label: "Open", count: openCount },
                  { key: "resolved", label: "Resolved", count: resolvedCount }
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setCommentFilter(tab.key)}
                    className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                      commentFilter === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-text-subtle hover:text-text-main"
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                      commentFilter === tab.key ? "bg-primary/10 text-primary" : "bg-surface-active text-text-subtle"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Escalation banner */}
            {(() => {
              const activeEscalation = comments.find(c => c.isEscalation && !c.resolved);
              if (!activeEscalation) return null;
              return (
                <div className="mx-5 mt-4 p-3 bg-[#FFF7E6] border border-[#FF991F] rounded-lg flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-[#FF991F] flex-shrink-0 mt-0.5 weight-bold" />
                    <div>
                      <p className="text-sm font-bold text-[#172B4D]">Active Escalation</p>
                      <p className="text-xs text-[#505F79] mt-0.5 leading-relaxed">This tag has been escalated for review: <strong>"{activeEscalation.escalationReason}"</strong></p>
                    </div>
                  </div>
                  {can('COMMENT_CREATE') && (
                    <button 
                      onClick={async () => {
                        try {
                          await ApiService.resolveComment(tagId!, activeEscalation.commentId);
                          fetchComments();
                          showToast("Escalation resolved");
                        } catch {
                          showToast("Failed to resolve escalation");
                        }
                      }}
                      className="px-4 py-2 bg-white border border-[#FF991F]/50 text-[#172B4D] hover:bg-[#FF991F]/10 hover:border-[#FF991F] text-xs font-bold rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer active:scale-[0.98]"
                    >
                      Resolve Escalation
                    </button>
                  )}
                </div>
              );
            })()}
            
            {/* Comment threads */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2 space-y-1 custom-scrollbar max-h-[420px]">
              {filteredComments.length === 0 ? (
                <div className="text-center py-10 text-text-subtle">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">
                    {commentFilter === "all" ? "No comments yet. Start a discussion." 
                     : commentFilter === "open" ? "No open threads." 
                     : "No resolved threads."}
                  </p>
                </div>
              ) : (
                filteredComments.map(comment => (
                  <div key={comment.commentId} className="border-b border-border-main/40 last:border-0 pb-3 last:pb-0">
                    <CommentThread
                      comment={comment}
                      depth={0}
                      tagId={tagId!}
                      can={can}
                      onRefresh={fetchComments}
                      showToast={showToast}
                    />
                  </div>
                ))
              )}
            </div>

            {/* New comment input */}
            {can('COMMENT_CREATE') && (
              <div className="px-5 py-4 border-t border-border-main mt-auto">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Start a discussion..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && newComment.trim()) handleAddComment(); }}
                      className="w-full h-9 px-3 bg-surface border border-border-main rounded-lg text-sm text-text-main focus:border-primary outline-none placeholder:text-text-subtle/60"
                    />
                    {newComment.trim() && (
                      <div className="flex items-center justify-between mt-2">
                        {can('ESCALATE') ? (
                          <label className="flex items-center gap-2 text-xs font-semibold text-text-subtle cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={isEscalation}
                              onChange={(e) => setIsEscalation(e.target.checked)}
                              className="rounded border-border-main text-primary focus:ring-primary"
                            />
                            Escalate to Founder
                          </label>
                        ) : <div />}
                        <button 
                          onClick={handleAddComment}
                          disabled={!newComment.trim()}
                          className="h-8 px-4 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover disabled:opacity-50 cursor-pointer transition-colors shadow-sm"
                        >
                          Post
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      <TranslationReviewModal 
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onApprove={(newText) => {
          if (!pageId || !tagId) return;
          StoreService.updateTranslation(pageId, tagId, selectedLanguage, {
            text: newText,
            status: "Approved",
            confidence: 100
          });
          showToast(`Approved ${langConfig?.name} translation`);
        }}
        onRegenerate={() => {
          setIsReviewModalOpen(false);
          handleRunAI();
        }}
        tagId={tag.id}
        englishText={tag.english}
        initialTranslation={currentVal.text}
        confidenceScore={currentVal.confidence}
        languageName={langConfig?.name || selectedLanguage}
        languageDirection={langConfig?.direction || "LTR"}
        stateCause={currentVal.stateCause}
        backTranslation={currentVal.backTranslation}
      />
    </div>
  );
}
