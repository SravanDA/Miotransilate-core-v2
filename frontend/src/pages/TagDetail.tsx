import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, WarningCircle as AlertCircle, FloppyDisk as Save,
  ChatCircle as MessageSquare, User, CheckCircle, PencilSimple as Edit3,
  ArrowBendDownRight as Reply, CaretDown, FileText, Check, Trash,
  ClockCounterClockwise, Star, CircleNotch, Plus, Tag as TagIcon, Stack,
  PaperPlaneRight,
  Sparkle as Sparkles
} from "@phosphor-icons/react";
import { TranslationStatusBadge } from "../components/translation/TranslationStatusBadge";
import { TranslationReviewModal } from "../components/translation/TranslationReviewModal";
import { TranslationLengthGauge } from "../components/translation/TranslationLengthGauge";
import { ConfidenceBadge } from "../components/translation/ConfidenceBadge";
import { CopyTypeSelector } from "../components/translation/CopyTypeSelector";
import { StatusCompleted, StatusInProgress, StatusBacklog, StatusTodo } from "../components/ui/LinearIcons";
import { CopyButton } from "../components/ui/CopyButton";
import { StoreService } from "../store/StoreService";
import { engine } from "../engine/TranslationEngine";
// import { WorkflowStepper } from "../components/workflow/WorkflowStepper";
import type { Tag, Comment, TranslationValue } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { ApiService } from "../services/ApiService";
import { BookmarkService } from "../services/BookmarkService";
import { RecentlyEditedService } from "../services/RecentlyEditedService";

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
      setReplyText("");
      setShowReplyInput(false);
      onRefresh();
      showToast("Reply posted");

      try {
        await ApiService.addComment(tagId, {
          text: replyText.trim(),
          scope: comment.scope,
          parentCommentId: comment.commentId
        });
      } catch (err) {
        console.warn("Backend reply sync note:", err);
      }
    }
  };

  const handleResolve = async () => {

    onRefresh();
    showToast("Thread resolved");
    try {
      await ApiService.resolveComment(tagId, comment.commentId);
    } catch {}
  };

  const handleUnresolve = async () => {

    onRefresh();
    showToast("Thread reopened");
    try {
      await ApiService.unresolveComment(tagId, comment.commentId);
    } catch {}
  };

 const hasReplies = comment.replies && comment.replies.length > 0;

 return (
 <div className={`${depth > 0 ? 'ml-8 pl-4 border-l border-border-subtle' : ''}`}>
 <div className={`group rounded-lg py-3 ${comment.resolved && depth === 0 ? 'opacity-60' : ''}`}>
 {/* Author row */}
 <div className="flex items-start gap-2.5">
 <div className="w-7 h-7 rounded-full bg-accent-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
 <User className="w-4 h-4 text-accent-blue" />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-[13px] font-bold text-text-primary">{comment.author.displayName}</span>
 <span className="text-[11px] text-text-tertiary">{timeAgo(comment.createdAt)}</span>
  {comment.isEscalation && (
    <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 dark:text-amber-400 text-[10px] font-medium rounded border border-amber-500/20">
      Escalation
    </span>
  )}
  {comment.resolved && (
    <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium rounded border border-emerald-500/20 flex items-center gap-1">
      <CheckCircle className="w-3 h-3" weight="bold" /> Resolved
    </span>
  )}
 </div>
 
 {/* Comment text */}
 <p className="text-[13px] text-text-primary mt-1 leading-relaxed whitespace-pre-wrap">{comment.text}</p>
 
 {/* Action bar */}
 <div className="flex items-center gap-3 mt-2">
 {can('COMMENT_CREATE') && (
 <button 
 onClick={() => setShowReplyInput(!showReplyInput)}
 className="text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer flex items-center gap-1 outline-none"
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
 className="text-[11px] font-semibold text-text-secondary hover:text-success transition-colors cursor-pointer flex items-center gap-1 outline-none"
 >
 <CheckCircle className="w-3.5 h-3.5" />
 Resolve
 </button>
 ) : (
 <button 
 onClick={handleUnresolve}
 className="text-[11px] font-semibold text-text-secondary hover:text-warning transition-colors cursor-pointer flex items-center gap-1 outline-none"
 >
 <AlertCircle className="w-3.5 h-3.5" />
 Reopen
 </button>
 )}
 </>
 )}
 {comment.resolved && comment.resolvedBy && (
 <span className="text-[10px] text-text-tertiary italic">
 by {comment.resolvedBy.displayName}
 </span>
 )}
 </div>

 {/* Reply input */}
 {showReplyInput && (
 <div className="mt-3 flex items-center gap-2">
 <div className="w-6 h-6 rounded-full bg-accent-blue/10 flex items-center justify-center flex-shrink-0">
 <User className="w-3 h-3 text-accent-blue" />
 </div>
 <input
 type="text"
 autoFocus
 placeholder="Write a reply..."
 value={replyText}
 onChange={(e) => setReplyText(e.target.value)}
 onKeyDown={(e) => { if (e.key === 'Enter' && replyText.trim()) handleReply(); }}
 className="flex-1 h-8 px-2.5 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary focus:border-accent-blue outline-none transition-colors"
 />
  <button
  onClick={handleReply}
  disabled={!replyText.trim()}
  className="btn-primary h-8 px-3"
  >
  Reply
  </button>
  <button
  onClick={() => { setShowReplyInput(false); setReplyText(""); }}
  className="btn-ghost h-8"
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
 className="ml-9 mt-1 text-[11px] font-semibold text-text-secondary hover:text-text-primary cursor-pointer flex items-center gap-1 transition-colors outline-none"
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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const isFounder = Boolean(user?.roles?.includes('FN') || user?.roles?.includes('FOUNDER'));
 
  const [tag, setTag] = useState<Tag | null>(null);
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
  const initialLang = searchParams.get("lang") || activeLangs[0]?.code || "ar";
  const [selectedLanguage, setSelectedLanguage] = useState(initialLang);

  useEffect(() => {
    const langParam = searchParams.get("lang");
    if (langParam && langParam !== selectedLanguage) {
      setSelectedLanguage(langParam);
      setIsEditingTrans(false);
    }
  }, [searchParams]);

 const [englishCopy, setEnglishCopy] = useState("");
 const [englishChangeReason, setEnglishChangeReason] = useState("");
 const [isEditingEnglish, setIsEditingEnglish] = useState(false);
 const [isSavingEnglish, setIsSavingEnglish] = useState(false);
 const [isApprovingEnglish, setIsApprovingEnglish] = useState(false);

 const [transCopy, setTransCopy] = useState("");
 const [isEditingTrans, setIsEditingTrans] = useState(false);
 const [isTranslatingTag, setIsTranslatingTag] = useState(false);
 const [showDeprecateModal, setShowDeprecateModal] = useState(false);

 useEffect(() => {
 if (pageId) StoreService.refreshPageDetail(pageId);
 const load = () => {
 if (!pageId || !tagId) return;
 const t = StoreService.getTag(pageId, tagId);
 if (t) {
 setTag(t);
 if (!isEditingEnglish) {
   setEnglishCopy(t.english);
   setEnglishChangeReason(t.englishChangeReason || "");
 }
 
 const currentLangVal = t.values[selectedLanguage];
 if (!isEditingTrans) setTransCopy(currentLangVal?.text || "");
 }
 setActiveLangs(StoreService.getActiveLanguages());
 };
 load();
 return StoreService.subscribe(load);
 }, [pageId, tagId, selectedLanguage]);

 const { toast } = useToast();
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [showProperties, setShowProperties] = useState(true);

  const [showEnglishHistory, setShowEnglishHistory] = useState(false);
 const [englishVersions, setEnglishVersions] = useState<any[]>([]);
 const [loadingEnglishHistory, setLoadingEnglishHistory] = useState(false);

 const [showTransHistory, setShowTransHistory] = useState(false);
 const [transVersions, setTransVersions] = useState<any[]>([]);
 const [loadingTransHistory, setLoadingTransHistory] = useState(false);

 const loadEnglishHistory = async () => {
   if (!tagId) return;
   setLoadingEnglishHistory(true);
   try {
     const res = await ApiService.getEnglishCopyVersions(tagId);
     setEnglishVersions(res || []);
   } catch {
     if (tag) {
       setEnglishVersions([
         { version: tag.englishVersion || 1, text: tag.english, changeReason: tag.englishChangeReason || "Initial copy", createdAt: tag.updatedAt || tag.createdAt }
       ]);
     }
   } finally {
     setLoadingEnglishHistory(false);
   }
 };

 const loadTransHistory = async () => {
   if (!tagId || !selectedLanguage) return;
   setLoadingTransHistory(true);
   try {
     const res = await ApiService.getTranslationVersions(tagId, selectedLanguage);
     setTransVersions(res || []);
   } catch {
     const val = tag?.values?.[selectedLanguage];
     if (val) {
       setTransVersions([
         { version: 1, translatedText: val.text, confidenceScore: val.confidence, status: val.status, createdAt: val.lastUpdated }
       ]);
     }
   } finally {
     setLoadingTransHistory(false);
   }
 };

 const [comments, setComments] = useState<Comment[]>([]);
 const [commentFilter, setCommentFilter] = useState<"all" | "open" | "resolved">("all");

  const fetchComments = async () => {
    if (!tagId) return;
    try {
      const fetched = await ApiService.getComments(tagId);
      if (Array.isArray(fetched)) {
        setComments(fetched);
        return;
      }
    } catch {
      setComments([]);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [tagId]);

 const [newComment, setNewComment] = useState("");
 const [isEscalation, setIsEscalation] = useState(false);

 const showToast = (msg: string) => toast(msg);

 const [isBookmarked, setIsBookmarked] = useState(tagId ? BookmarkService.isBookmarked(tagId) : false);

 const handleToggleBookmark = () => {
   if (!tagId || !pageId) return;
    const isNow = BookmarkService.toggleBookmark({
      id: tagId,
      type: "tag",
      pageId,
      tagId,
      name: tagId
    });
   setIsBookmarked(isNow);
   showToast(isNow ? "Tag bookmarked" : "Bookmark removed");
 };

  const handleSaveEnglish = async () => {
    if (!pageId || !tagId) return;
    setIsSavingEnglish(true);
    const textToSave = englishCopy;
    const reasonToSave = englishChangeReason;
    setIsEditingEnglish(false);
    await StoreService.updateEnglish(pageId, tagId, textToSave, reasonToSave);
    RecentlyEditedService.recordEdit({ id: tagId, pageId, tagId, title: tagId });
    setIsSavingEnglish(false);
    showToast("Master English draft submitted. Click 'Approve English' to mark translations as Stale.");
  };

  const handleSaveAndApproveEnglish = async () => {
    if (!pageId || !tagId) return;
    setIsSavingEnglish(true);
    const textToSave = englishCopy;
    const reasonToSave = englishChangeReason;
    setIsEditingEnglish(false);
    await StoreService.saveEnglishAndApprove(pageId, tagId, textToSave, reasonToSave);
    RecentlyEditedService.recordEdit({ id: tagId, pageId, tagId, title: tagId });
    setIsSavingEnglish(false);
    showToast("Master English approved! Translations marked as Stale.");
  };

 const handleApproveEnglish = async () => {
 if (!pageId || !tagId) return;
 setIsApprovingEnglish(true);
 await StoreService.approveEnglish(pageId, tagId);
 setIsApprovingEnglish(false);
 showToast("Master English approved! Translations marked as Stale.");
 };

 const handleConfirmStale = async () => {
 if (!pageId || !tagId) return;
 await StoreService.confirmStaleTranslation(pageId, tagId, selectedLanguage);
 showToast(`Confirmed ${langConfig?.name} translation as valid for English v${tag?.englishVersion}`);
 };

 const handleDeprecateTag = async () => {
 if (!tagId || !pageId) return;
 try {
 await ApiService.deprecateTag(tagId);
 showToast(`Tag ${tagId} has been marked as Deprecated`);
 setShowDeprecateModal(false);
 navigate(`/pages/${pageId}`);
  } catch {
    showToast("Failed to deprecate tag");
  }
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
    RecentlyEditedService.recordEdit({ id: tagId, pageId, tagId, title: tagId, language: selectedLanguage });
    showToast("Translation saved manually");
  };



  const handleRunAI = async () => {
    if (!pageId || !tagId || !tag) return;
    const sourceEnglish = (englishCopy || tag.english || "").trim();
    if (!sourceEnglish) {
      showToast("Master English copy is required before translating.");
      return;
    }
    
    setIsTranslatingTag(true);
    try {
      // Auto-save English copy if modified locally
      if (sourceEnglish !== tag.english) {
        await StoreService.updateEnglish(pageId, tagId, sourceEnglish, "Auto-saved before translation");
      }

      await engine.translateTag(pageId, tagId, selectedLanguage);
      
      const updatedTag = StoreService.getTag(pageId, tagId);
      if (updatedTag) {
        setTag(updatedTag);
        const val = updatedTag.values[selectedLanguage];
        if (val?.text) {
          setTransCopy(val.text);
        }
      }

      showToast(`Generated ${langConfig?.name || selectedLanguage} draft. Pending review.`);
    } catch (err: any) {
      console.error("AI translation error:", err);
      showToast(err?.message ? `Translation error: ${err.message}` : "Translation generation failed. Please try again.");
    } finally {
      setIsTranslatingTag(false);
    }
  };

  const handleAddComment = async () => {
    if (newComment.trim() && tagId) {
      const commentText = newComment.trim();
      const newCommentObj: Comment = {
        commentId: "c_" + Date.now(),
        tagId,
        parentCommentId: null,
        author: {
          userId: user?.userId || "11111111-1111-1111-1111-111111111111",
          displayName: user?.displayName || "Founder",
          role: user?.roles?.[0] || "FN"
        },
        text: commentText,
        scope: { type: "ENGLISH", languageCode: null },
        isEscalation,
        escalationReason: isEscalation ? commentText : null,
        resolved: false,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date().toISOString(),
        replies: []
      };

      const updatedComments = [newCommentObj, ...comments];
      setComments(updatedComments);
      setNewComment("");
      setIsEscalation(false);
      showToast("Comment posted");

      try {
        await ApiService.addComment(tagId, {
          text: commentText,
          scope: { type: "ENGLISH" },
          isEscalation,
          escalationReason: isEscalation ? commentText : null
        });
      } catch (err) {
        console.warn("Backend comment sync note:", err);
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

 const currentVal: TranslationValue = tag?.values[selectedLanguage] || { 
 text: "", 
 status: "No Trans", 
 confidence: 0, 
 translatedAtEnglishVersion: 1,
 lastUpdated: new Date().toISOString()
 };
 const deployments = StoreService.getDeployments().filter(d => d.pageId === pageId && d.language === selectedLanguage);
 const langConfig = activeLangs.find(l => l.code === selectedLanguage);

 if (!tag) {
 return <div className="p-8 text-text-tertiary">Loading tag data...</div>;
 }

 return (
 <div className="flex flex-col gap-4 w-full ">
 {/* Breadcrumbs & Header */}
 <div className="flex flex-col gap-3">
 <Link 
 to={`/pages/${pageId}`}
className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-tertiary hover:text-text-primary transition-colors w-fit outline-none"
 >
 <ArrowLeft className="w-3.5 h-3.5" />
 Back to {pageId}
 </Link>
 <div className="flex items-center gap-3 flex-wrap">
 <h1 className="text-xl font-bold text-text-primary font-mono">{tag.id}</h1>
 <button
     onClick={handleToggleBookmark}
     className={`h-8 px-2.5 rounded-lg border transition-all cursor-pointer outline-none  active:scale-[0.98] inline-flex items-center justify-center ${
       isBookmarked 
         ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20" 
         : "bg-bg-card text-text-tertiary border-border-subtle hover:border-border-strong hover:text-text-primary hover:bg-bg-hover"
     }`}
     title={isBookmarked ? "Remove bookmark" : "Bookmark this tag"}
   >
     <Star className="w-3.5 h-3.5" weight={isBookmarked ? "fill" : "regular"} />
   </button>
 <CopyTypeSelector
    value={tag.type}
    disabled={!can('PAGE_TAG_CREATE') && !can('ENGLISH_AUTHOR') && !user?.roles?.includes('FN')}
    onChange={async (newType) => {
      if (pageId && tagId) {
        await StoreService.updateTagType(pageId, tagId, newType);
        showToast(`Copy type updated to ${newType}`);
      }
    }}
    size="md"
  />
 <span className="px-2 py-0.5 bg-accent-blue/10 text-accent-blue text-[11px] font-semibold rounded border border-accent-blue/20">
 v{tag.englishVersion}
 </span>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 
 {/* LEFT COLUMN: Editors */}
 <div className="lg:col-span-2 flex flex-col gap-5">
 
   {/* Master English Panel */}
   <div id="english-copy-panel" className="bg-bg-card border border-border-subtle rounded-xl p-5 scroll-mt-20">
   <div className="flex items-center justify-between mb-3">
   <div className="flex items-center gap-2.5">
     <h2 className="text-[13px] font-semibold text-text-primary flex items-center gap-2">
       <FileText className="w-4 h-4 text-text-tertiary" weight="bold" />
       Master English Copy
     </h2>
     <TranslationStatusBadge status={(tag.englishStatus || (tag.english ? "Approved" : "Draft")) as any} />
   </div>
   
   <div className="flex items-center gap-2">
     {tag.englishStatus === "Pending Review" && (can('ENGLISH_APPROVE') || user?.roles?.includes('FN')) && (
       <button 
         onClick={handleApproveEnglish}
         disabled={isApprovingEnglish}
         className="btn-primary"
       >
         <Check className="w-3.5 h-3.5" weight="bold" />
         <span>{isApprovingEnglish ? "Approving..." : "Approve English"}</span>
       </button>
     )}
     {can('ENGLISH_AUTHOR') && (
       !isEditingEnglish ? (
         <button 
           onClick={() => setIsEditingEnglish(true)}
           className="btn-secondary h-8 px-2.5 text-text-tertiary hover:text-text-primary"
           title="Edit English copy"
         >
           <Edit3 className="w-3.5 h-3.5" weight="bold" />
         </button>
       ) : (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsEditingEnglish(false);
                setEnglishCopy(tag.english);
                setEnglishChangeReason(tag.englishChangeReason || "");
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveEnglish}
              disabled={isSavingEnglish}
              className="btn-secondary"
              title="Save as draft for review"
            >
              <Save className="w-3.5 h-3.5" weight="fill" />
              <span>Save Draft</span>
            </button>
            {(can('ENGLISH_APPROVE') || user?.roles?.includes('FN')) && (
              <button 
                onClick={handleSaveAndApproveEnglish}
                disabled={isSavingEnglish}
                className="btn-primary"
                title="Save and approve immediately (marks translations as Stale)"
              >
                <Check className="w-3.5 h-3.5" weight="bold" />
                <span>Save & Approve</span>
              </button>
            )}
          </div>
       )
     )}
   </div>
   </div>
  
  {isEditingEnglish ? (
  <div className="space-y-3">
    <textarea
      value={englishCopy}
      onChange={(e) => setEnglishCopy(e.target.value)}
      placeholder="Enter master English copy..."
      className="w-full h-24 p-3 bg-bg-main border border-border-strong rounded-lg text-[14px] text-text-primary focus:border-accent-blue outline-none resize-none transition-colors"
    />
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-1">Change Reason (Optional)</label>
      <input
        type="text"
        placeholder="e.g., Clarified button label, Fixed typo..."
        value={englishChangeReason}
        onChange={(e) => setEnglishChangeReason(e.target.value)}
        className="w-full h-8 px-2.5 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary focus:border-accent-blue outline-none transition-colors"
      />
    </div>
  </div>
  ) : (
  <div className="group/copy relative p-4 bg-bg-hover border border-border-subtle rounded-lg text-[14px] text-text-primary whitespace-pre-wrap font-medium flex items-start justify-between gap-3">
    <div className="flex-1">
      {tag.english || <span className="text-text-tertiary italic">No English copy added yet.</span>}
    </div>
    {tag.english && (
      <CopyButton
        text={tag.english}
        className="opacity-0 group-hover/copy:opacity-100 group-hover:opacity-100 shrink-0"
        title="Copy English copy"
      />
    )}
  </div>
  )}
  {isEditingEnglish && (
  <p className="text-[11px] text-text-tertiary mt-2 font-medium">
    Saving a draft will queue this tag for English approval. Translations will be marked Stale once approved.
  </p>
  )}

  {/* English Version History Collapsible */}
  <div className="mt-4 pt-3 border-t border-border-subtle">
    <button
      onClick={() => {
        if (!showEnglishHistory) loadEnglishHistory();
        setShowEnglishHistory(!showEnglishHistory);
      }}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-link hover:underline cursor-pointer outline-none"
    >
      <ClockCounterClockwise className="w-3.5 h-3.5" />
      <span>{showEnglishHistory ? "Hide English Version History" : "View English Version History"}</span>
      <CaretDown className={`w-3 h-3 transition-transform ${showEnglishHistory ? '-rotate-180' : ''}`} />
    </button>

    {showEnglishHistory && (
      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
        {loadingEnglishHistory ? (
          <div className="text-[11px] text-text-tertiary">Loading versions...</div>
        ) : englishVersions.length > 0 ? (
          englishVersions.map((v: any, i: number) => (
            <div key={i} className="p-2.5 bg-bg-main border border-border-subtle rounded-md text-[12px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-accent-blue bg-accent-blue/10 px-1.5 py-0.5 rounded border border-accent-blue/20">
                  v{v.version || tag.englishVersion}
                </span>
                <span className="text-[10px] text-text-tertiary">
                  {v.createdAt ? timeAgo(v.createdAt) : "Recorded"}
                </span>
              </div>
              <div className="text-text-primary font-medium">{v.text || v.translatedText || tag.english}</div>
              {v.changeReason && (
                <div className="text-[10px] text-text-tertiary italic">Reason: "{v.changeReason}"</div>
              )}
            </div>
          ))
        ) : (
          <div className="text-[11px] text-text-tertiary">Current version: v{tag.englishVersion}</div>
        )}
      </div>
    )}
  </div>
  </div>

 {/* Translation Panel */}
 <div id="translation-panel" className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden flex flex-col scroll-mt-20">
 
 {/* Language Tabs */}
 <div className="flex overflow-x-auto border-b border-border-subtle scrollbar-none bg-bg-sidebar">
 {activeLangs.map(lang => (
 <button
 key={lang.code}
 onClick={() => {
   setSelectedLanguage(lang.code);
   setIsEditingTrans(false);
   setSearchParams({ lang: lang.code }, { replace: true });
 }}
 className={`px-4 py-2.5 text-[13px] font-bold whitespace-nowrap border-b-2 transition-colors cursor-pointer outline-none ${
 selectedLanguage === lang.code
 ? "border-accent-blue text-text-primary bg-bg-card"
 : "border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover"
 }`}
 >
 {lang.name}
 {tag.values[lang.code]?.status === "Pending Review" && (
 <span className="ml-2 w-1.5 h-1.5 inline-block rounded-full bg-warning" />
 )}
 </button>
 ))}
 </div>

 <div className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5 flex-nowrap shrink-0">
          <h2 className="text-[13px] font-bold text-text-primary whitespace-nowrap">
            {langConfig?.name} Translation
          </h2>
          <TranslationStatusBadge status={currentVal.status as any} />
          {currentVal.text && (
            <ConfidenceBadge confidence={currentVal.confidence} status={currentVal.status} size="md" />
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {!isEditingTrans ? (
            <>
              {currentVal.status !== "Approved" && currentVal.text && (can('TRANSLATION_APPROVE') || user?.roles?.includes('FN')) && (
                <>
                  <button 
                    onClick={() => setIsReviewModalOpen(true)}
                    className="btn-secondary"
                  >
                    <CheckCircle className="w-4 h-4 text-accent-blue" weight="bold" />
                    <span>Review AI Draft</span>
                  </button>
                  <button 
                    onClick={async () => {
                      if (!pageId || !tagId) return;
                      await StoreService.approveTranslation(pageId, tagId, selectedLanguage);
                      showToast(`Approved ${langConfig?.name || selectedLanguage} translation`);
                    }}
                    className="btn-success h-8 px-3 text-[12px] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" weight="bold" />
                    <span>Approve</span>
                  </button>
                </>
              )}

              {(can('TRANSLATION_CREATE') || user?.roles?.includes('FN')) && (
                <button 
                  onClick={handleRunAI}
                  disabled={isTranslatingTag}
                  className="btn-secondary"
                >
                  {isTranslatingTag ? (
                    <CircleNotch className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-accent-blue" weight="bold" />
                  )}
                  <span>{isTranslatingTag ? "Translating..." : "Auto-Translate"}</span>
                </button>
              )}

              {can('TRANSLATION_EDIT') && (
                <button 
                  onClick={() => setIsEditingTrans(true)}
                  className="btn-secondary h-8 px-2.5 text-text-secondary hover:text-text-primary"
                  title="Edit Translation"
                >
                  <Edit3 className="w-3.5 h-3.5" weight="bold" />
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
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveTranslation}
                className="btn-primary"
              >
                <Save className="w-3.5 h-3.5" weight="fill" />
                <span>Save Translation</span>
              </button>
            </>
          )}
        </div>
      </div>

 {currentVal.status === "Stale" && !isEditingTrans && (
 <div className="p-3 bg-bg-main border border-border-subtle rounded-lg text-[12px] text-text-secondary flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div className="flex items-start gap-2.5">
      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" weight="bold" />
      <div>
        <span className="text-text-primary font-medium">Stale Translation.</span> The master English text was updated (v{tag.englishVersion}) since this was translated (from v{currentVal.translatedAtEnglishVersion}).
      </div>
    </div>
    {can('TRANSLATION_APPROVE') && (
      <button
        onClick={handleConfirmStale}
        className="btn-secondary shrink-0"
      >
        Confirm as Valid
      </button>
    )}
  </div>
 )}

 {isEditingTrans ? (
 <>
 <textarea
 dir={langConfig?.direction || "auto"}
 value={transCopy}
 onChange={(e) => setTransCopy(e.target.value)}
 className="w-full h-24 p-3 bg-bg-main border border-border-strong rounded-lg text-[14px] text-text-primary focus:border-accent-blue outline-none resize-none transition-colors"
 />
 <TranslationLengthGauge 
 sourceText={tag.english}
 translatedText={transCopy}
 />
 </>
) : (
 <div 
 dir={langConfig?.direction || "auto"}
 className="group/copy relative p-4 bg-bg-main border border-border-strong rounded-lg text-[14px] text-text-primary whitespace-pre-wrap min-h-[6rem] flex items-start justify-between gap-3 transition-colors"
 >
 <div className="flex-1">
   {currentVal.text || <span className="text-text-tertiary italic text-[13px]">No translation available. Click Auto-Translate or Edit.</span>}
 </div>
 {currentVal.text && (
   <CopyButton
     text={currentVal.text}
     className="opacity-0 group-hover/copy:opacity-100 group-hover:opacity-100 shrink-0"
     title="Copy translation"
   />
 )}
 </div>
 )}

 {/* Translation Quality & Confidence Metadata */}
 {currentVal.text && (
   <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-text-tertiary">
     <div className="flex items-center gap-2 flex-wrap">
       <ConfidenceBadge confidence={currentVal.confidence ?? 95} status={currentVal.status} size="sm" />
       {currentVal.backTranslation && (
         <span className="text-text-tertiary">
           · <span className="text-text-secondary italic">Reading aid: "{currentVal.backTranslation}"</span>
         </span>
       )}
     </div>
     {currentVal.translatedAtEnglishVersion && (
       <span className="font-mono text-[10px] text-text-tertiary">
         Based on English v{currentVal.translatedAtEnglishVersion}
       </span>
     )}
   </div>
 )}

 {/* Translation Version History Collapsible */}
 <div className="pt-2 border-t border-border-subtle">
    <button
      onClick={() => {
        if (!showTransHistory) loadTransHistory();
        setShowTransHistory(!showTransHistory);
      }}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-link hover:underline cursor-pointer outline-none"
    >
      <ClockCounterClockwise className="w-3.5 h-3.5" />
      <span>{showTransHistory ? `Hide ${langConfig?.name} Version History` : `View ${langConfig?.name} Version History`}</span>
      <CaretDown className={`w-3 h-3 transition-transform ${showTransHistory ? '-rotate-180' : ''}`} />
    </button>

    {showTransHistory && (
      <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
        {loadingTransHistory ? (
          <div className="text-[11px] text-text-tertiary">Loading versions...</div>
        ) : transVersions.length > 0 ? (
          transVersions.map((v: any, i: number) => (
            <div key={i} className="p-2.5 bg-bg-main border border-border-subtle rounded-md text-[12px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-medium text-text-secondary bg-bg-card px-1.5 py-0.5 rounded border border-border-subtle">
                  v{v.version || (i + 1)} · {v.status || "Approved"}
                </span>
                <span className="text-[10px] text-text-tertiary">
                  {v.createdAt ? timeAgo(v.createdAt) : "Recorded"}
                </span>
              </div>
              <div className="text-text-primary font-medium" dir={langConfig?.direction || "auto"}>
                {v.translatedText || v.text || currentVal.text}
              </div>
              {v.confidenceScore !== undefined && (
                <div className="text-[10px] text-text-tertiary">Confidence: {v.confidenceScore}%</div>
              )}
            </div>
          ))
        ) : (
          <div className="text-[11px] text-text-tertiary">Current status: {currentVal.status}</div>
        )}
      </div>
    )}
  </div>
 </div>
 </div>
 </div>

 {/* RIGHT COLUMN: Linear-Style Sidebar (Properties & Discussion) */}
 <div className="flex flex-col gap-4">
  
    {/* Visual 3-Step Lifecycle Pipeline (Preserved for future phase) */}
    {/* <WorkflowStepper
      englishStatus={tag.englishStatus || (tag.english ? "Approved" : "Draft")}
      englishText={tag.english}
      englishVersion={tag.englishVersion}
      translationStatus={currentVal.status}
      selectedLanguage={selectedLanguage}
      languageName={langConfig?.name || selectedLanguage}
      deployments={deployments}
    /> */}

    {/* Properties Panel (Linear Reference Style) */}
    <div id="properties-panel" className="bg-bg-card border border-border-subtle rounded-xl p-4 scroll-mt-20">
      <div className="flex items-center justify-between mb-3 select-none">
        <button 
          onClick={() => setShowProperties(!showProperties)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary hover:text-text-secondary transition-colors cursor-pointer outline-none"
        >
          <span>Properties</span>
          <CaretDown className={`w-3 h-3 text-text-tertiary transition-transform ${showProperties ? '' : '-rotate-90'}`} weight="bold" />
        </button>
        <div className="flex items-center gap-1">
          <Link 
            to={`/history?entityId=${tag.id}&entityType=TAG`}
            className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors outline-none"
            title="View audit history"
          >
            <ClockCounterClockwise className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={() => showToast("Tag properties configured")}
            className="p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors cursor-pointer outline-none"
            title="Add property"
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
          </button>
        </div>
      </div>

      {showProperties && (
        <div className="space-y-0.5 text-[13px]">
          {/* Status */}
          <div className="grid grid-cols-[100px_1fr] items-center h-8 px-2 -mx-2 rounded-md hover:bg-bg-hover/60 transition-colors">
            <span className="text-text-secondary text-[13px] font-normal select-none">Status</span>
            <div className="flex items-center gap-2 text-text-primary text-[13px] font-normal min-w-0">
              {currentVal.status === "Approved" ? (
                <>
                  <StatusCompleted className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate text-text-primary">Approved</span>
                </>
              ) : currentVal.status === "Pending Review" ? (
                <>
                  <StatusInProgress className="w-3.5 h-3.5 text-warning shrink-0" />
                  <span className="truncate text-text-primary">In Progress</span>
                </>
              ) : currentVal.status === "Needs Attention" ? (
                <>
                  <StatusInProgress className="w-3.5 h-3.5 text-[#EB5757] shrink-0" />
                  <span className="truncate text-text-primary">Needs Attention</span>
                </>
              ) : currentVal.status === "Stale" ? (
                <>
                  <StatusTodo className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate text-text-primary">Stale</span>
                </>
              ) : (
                <>
                  <StatusBacklog className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                  <span className="text-text-primary truncate">{currentVal.status || "Draft"}</span>
                </>
              )}
            </div>
          </div>

          {/* Master English Status */}
          <div className="grid grid-cols-[100px_1fr] items-center h-8 px-2 -mx-2 rounded-md hover:bg-bg-hover/60 transition-colors">
            <span className="text-text-secondary text-[13px] font-normal select-none">English</span>
            <div className="flex items-center gap-2 text-text-primary text-[13px] font-normal min-w-0">
              <span className="font-mono text-[11px] text-text-secondary bg-bg-hover px-1.5 py-0.2 rounded border border-border-subtle shrink-0">
                v{tag.englishVersion}
              </span>
              <span className="truncate text-text-primary">{tag.englishStatus || (tag.english ? "Approved" : "Draft")}</span>
            </div>
          </div>

          {/* Copy Type / Label */}
          <div className="grid grid-cols-[100px_1fr] items-center h-8 px-2 -mx-2 rounded-md hover:bg-bg-hover/60 transition-colors">
            <span className="text-text-secondary text-[13px] font-normal select-none">Type</span>
            <div className="flex items-center gap-2 text-text-primary text-[13px] font-normal min-w-0">
              <TagIcon className="w-3.5 h-3.5 text-text-tertiary shrink-0" weight="regular" />
              <span className="truncate text-text-primary">{tag.type || "General"}</span>
            </div>
          </div>

          {/* Translation Confidence */}
          <div className="grid grid-cols-[100px_1fr] items-center h-8 px-2 -mx-2 rounded-md hover:bg-bg-hover/60 transition-colors">
            <span className="text-text-secondary text-[13px] font-normal select-none">Confidence</span>
            <div className="flex items-center gap-2 text-text-primary text-[13px] font-normal min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-accent-blue shrink-0" weight="fill" />
              <span className="truncate text-text-primary tabular-nums">
                {currentVal.confidence !== undefined && currentVal.confidence > 0
                  ? `${currentVal.confidence}%`
                  : currentVal.status === "Approved"
                  ? "Verified"
                  : "Unverified"}
              </span>
            </div>
          </div>

          {/* Lead / Assignee */}
          <div className="grid grid-cols-[100px_1fr] items-center h-8 px-2 -mx-2 rounded-md hover:bg-bg-hover/60 transition-colors">
            <span className="text-text-secondary text-[13px] font-normal select-none">Lead</span>
            <div className="flex items-center gap-2 text-text-primary text-[13px] font-normal min-w-0">
              <div className="w-4 h-4 rounded-full bg-accent-blue/15 text-accent-blue text-[9px] font-bold flex items-center justify-center shrink-0">
                {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : "S"}
              </div>
              <span className="truncate text-text-primary">{user?.displayName || "Sravan S"}</span>
            </div>
          </div>

          {/* Page / Module Container */}
          <div className="grid grid-cols-[100px_1fr] items-center h-8 px-2 -mx-2 rounded-md hover:bg-bg-hover/60 transition-colors">
            <span className="text-text-secondary text-[13px] font-normal select-none">Page</span>
            <Link 
              to={`/pages/${pageId}`}
              className="flex items-center gap-2 text-text-primary hover:text-accent-blue transition-colors text-[13px] font-normal min-w-0"
            >
              <Stack className="w-3.5 h-3.5 text-text-tertiary shrink-0" weight="duotone" />
              <span className="truncate text-text-primary">{pageId}</span>
            </Link>
          </div>

          {/* Environments Deployments */}
          {(["DEV", "QA", "PRODUCTION"] as const).map(env => {
            const dep = deployments.find(d => d.environment === env);
            const displayLabel = env === "DEV" ? "Development" : env === "QA" ? "Staging (QA)" : "Production";
            return (
              <div key={env} className="grid grid-cols-[100px_1fr] items-center h-8 px-2 -mx-2 rounded-md hover:bg-bg-hover/60 transition-colors">
                <span className="text-text-secondary text-[13px] font-normal select-none">{displayLabel}</span>
                <div className="flex items-center gap-2 text-[13px] font-normal min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dep ? (env === 'PRODUCTION' ? 'bg-purple-500' : 'bg-emerald-500') : 'bg-border-strong'}`} />
                  {dep ? (
                    <span className="text-text-primary font-normal tabular-nums">
                      Live <span className="text-text-secondary">· v{dep.version}</span>
                    </span>
                  ) : (
                    <span className="text-text-secondary font-normal">Not deployed</span>
                  )}
                </div>
              </div>
            );
          })}

          {(can('PAGE_TAG_CREATE') || user?.roles?.includes('FN')) && (
            <div className="pt-2 mt-1 flex justify-end">
              <button
                onClick={() => setShowDeprecateModal(true)}
                className="inline-flex items-center gap-1.5 text-[11px] font-normal text-text-secondary hover:text-danger transition-colors cursor-pointer outline-none"
              >
                <Trash className="w-3.5 h-3.5" />
                <span>Deprecate Tag</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Discussion / Comments Card (Linear Style) */}
    <div className="bg-bg-card border border-border-subtle rounded-xl flex-1 flex flex-col overflow-hidden">
      
      {/* Header & Linear Segmented Tab Controls */}
      <div className="p-3.5 pb-2.5 border-b border-border-subtle">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
            <MessageSquare className="w-3.5 h-3.5 text-text-tertiary" />
            <span>Discussion</span>
            <span className="text-[11px] font-normal text-text-tertiary">({comments.length})</span>
          </div>
        </div>
        
        {/* Minimalist Segmented Tabs */}
        <div className="flex items-center p-0.5 bg-bg-main rounded-lg border border-border-subtle gap-0.5 text-[11px]">
          {([
            { key: "all", label: "All", count: comments.length },
            { key: "open", label: "Open", count: openCount },
            { key: "resolved", label: "Resolved", count: resolvedCount }
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setCommentFilter(tab.key)}
              className={`flex-1 py-1 px-2 rounded-md font-normal transition-all cursor-pointer outline-none text-center ${
                commentFilter === tab.key
                  ? "bg-bg-card text-text-primary font-medium border border-border-subtle"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <span>{tab.label}</span>
              <span className="ml-1 opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Escalation banner */}
      {(() => {
        const activeEscalation = comments.find(c => c.isEscalation && !c.resolved);
        if (!activeEscalation) return null;
        return (
          <div className="mx-3.5 mt-3 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" weight="bold" />
              <div>
                <p className="text-[12px] font-semibold text-text-primary">Active Escalation</p>
                <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">"{activeEscalation.escalationReason}"</p>
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
                className="px-2.5 py-1 bg-bg-card border border-amber-500/30 text-text-primary hover:bg-amber-500/10 text-[11px] font-semibold rounded-md transition-all whitespace-nowrap cursor-pointer active:scale-[0.98] outline-none"
              >
                Resolve
              </button>
            )}
          </div>
        );
      })()}
      
      {/* Comment threads list */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2 scrollbar-none max-h-[380px]">
        {filteredComments.length === 0 ? (
          <div className="text-center py-8 text-text-tertiary flex flex-col items-center">
            <MessageSquare className="w-6 h-6 mb-1.5 opacity-30" />
            <p className="text-[12px] font-normal">
              {commentFilter === "all" ? "No comments yet. Start a discussion." 
                : commentFilter === "open" ? "No open threads." 
                : "No resolved threads."}
            </p>
          </div>
        ) : (
          filteredComments.map(comment => (
            <div key={comment.commentId} className="border-b border-border-subtle last:border-0 pb-2.5 last:pb-0">
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

      {/* Linear Comment Composer (Always Available Chatbox) */}
      <div className="p-3 border-t border-border-subtle mt-auto bg-bg-card">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (newComment.trim()) handleAddComment();
          }}
          className="flex flex-col gap-2"
        >
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="Leave a comment... (Enter to post)"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full h-8.5 pl-3 pr-9 bg-bg-main border border-border-subtle focus:border-border-strong rounded-lg text-[12px] text-text-primary outline-none placeholder:text-text-tertiary transition-colors"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="absolute right-1.5 h-6 w-6 rounded-md flex items-center justify-center text-text-tertiary hover:text-accent-blue disabled:opacity-30 disabled:hover:text-text-tertiary transition-colors cursor-pointer outline-none"
              title="Post comment"
            >
              <PaperPlaneRight className="w-3.5 h-3.5" weight="bold" />
            </button>
          </div>
          
          {(!isFounder && can('ESCALATE')) ? (
            <div className="flex items-center justify-between text-[11px]">
              <label className="flex items-center gap-1.5 font-normal text-text-secondary cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={isEscalation}
                  onChange={(e) => setIsEscalation(e.target.checked)}
                  className="rounded border-border-subtle text-accent-blue focus:ring-accent-blue cursor-pointer"
                />
                <span>Escalate to Founder</span>
              </label>
              {newComment.trim() && (
                <span className="text-[10px] text-text-tertiary font-mono">Press Enter ↵</span>
              )}
            </div>
          ) : newComment.trim() ? (
            <div className="flex justify-end text-[11px]">
              <span className="text-[10px] text-text-tertiary font-mono">Press Enter ↵</span>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  </div>
</div>

  <TranslationReviewModal 
    isOpen={isReviewModalOpen}
    onClose={() => setIsReviewModalOpen(false)}
    onApprove={async (newText, reviewerComment) => {
      if (!pageId || !tagId) return;
      await StoreService.updateTranslation(pageId, tagId, selectedLanguage, {
        text: newText,
        status: "Approved",
        confidence: 100
      });
      if (reviewerComment && reviewerComment.trim()) {
        try {
          await ApiService.addComment(tagId, {
            text: `Approval note: ${reviewerComment.trim()}`,
            scope: { type: "LANGUAGE", languageCode: selectedLanguage }
          });
          fetchComments();
        } catch (e) {
          console.warn("Could not save review note:", e);
        }
      }
      showToast(`Approved ${langConfig?.name} translation`);
    }}
    onReject={async (reason) => {
      if (!pageId || !tagId) return;
      await StoreService.rejectTranslation(pageId, tagId, selectedLanguage, reason);
      try {
        await ApiService.addComment(tagId, {
          text: `Translation Rejected: ${reason}`,
          scope: { type: "LANGUAGE", languageCode: selectedLanguage }
        });
        fetchComments();
      } catch (e) {
        console.warn("Could not record rejection comment:", e);
      }
      showToast(`Rejected ${langConfig?.name} translation. Returned to draft.`);
    }}
    onReturnForRevision={async (comment) => {
      if (!pageId || !tagId) return;
      await StoreService.returnTranslationForRevision(pageId, tagId, selectedLanguage, comment);
      try {
        await ApiService.addComment(tagId, {
          text: `Returned for revision: ${comment}`,
          scope: { type: "LANGUAGE", languageCode: selectedLanguage }
        });
        fetchComments();
      } catch (e) {
        console.warn("Could not record revision comment:", e);
      }
      showToast(`Translation returned for revision.`);
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

  {/* Deprecate Tag Modal */}
  {showDeprecateModal && typeof document !== "undefined" && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-hidden">
      <div className="bg-bg-card border border-border-subtle rounded-xl max-w-md w-full max-h-[90vh] my-auto p-5 space-y-4 text-text-primary">
        <h3 className="text-base font-bold text-danger flex items-center gap-2">
          <Trash className="w-5 h-5" />
          Deprecate Tag {tag.id}
        </h3>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Are you sure you want to mark this tag as <strong>Deprecated</strong>? Deprecated tags cannot be edited or translated, but their history is preserved forever in the audit trail.
        </p>
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <button
            onClick={() => setShowDeprecateModal(false)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleDeprecateTag}
            className="btn-danger-solid"
          >
            Confirm Deprecation
          </button>
        </div>
      </div>
    </div>,
    document.body
  )}
  </div>
  );
}
