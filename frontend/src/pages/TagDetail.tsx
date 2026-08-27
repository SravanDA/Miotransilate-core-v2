import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { 
  ArrowLeft, Check, AlertCircle, Save,
  MessageSquare, User, CheckCircle2, Edit3 
} from "lucide-react";
import { TranslationStatusBadge } from "../components/translation/TranslationStatusBadge";
import { TranslationReviewModal } from "../components/translation/TranslationReviewModal";
import { StoreService } from "../store/StoreService";
import { engine } from "../engine/TranslationEngine";
import type { Tag } from "../types";

export function TagDetail() {
  const { pageId, tagId } = useParams();
  
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

  const [comments, setComments] = useState<{author: string, text: string, time: string, isResolved: boolean}[]>([
    { author: "Sarah (Product)", text: "Make sure this is brief, it sits in a small header.", time: "2 hours ago", isResolved: false },
  ]);
  const [newComment, setNewComment] = useState("");

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
      status: "Approved", // Direct edits become approved
      confidence: 100
    });
    showToast("Translation saved manually");
  };

  const handleRunAI = () => {
    if (!pageId || !tagId || !tag) return;
    engine.translateTag(pageId, tagId, selectedLanguage);
    showToast("AI generated a draft. Pending review.");
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      setComments([...comments, { author: "You", text: newComment, time: "Just now", isResolved: false }]);
      setNewComment("");
    }
  };

  const handleResolveComment = (idx: number) => {
    const updated = [...comments];
    updated[idx].isResolved = true;
    setComments(updated);
  };

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
                <span className="w-2 h-2 rounded-full bg-primary" />
                Master English
              </h2>
              {!isEditingEnglish ? (
                <button 
                  onClick={() => setIsEditingEnglish(true)}
                  className="p-1.5 text-text-subtle hover:text-primary hover:bg-surface-hover rounded cursor-pointer transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Master
                  </button>
                </div>
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
                  {!isEditingTrans && currentVal.status === "Pending Review" && (
                    <button 
                      onClick={() => setIsReviewModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FF8B00] text-white text-xs font-bold rounded hover:bg-[#E57D00] transition-colors cursor-pointer shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Review AI Draft
                    </button>
                  )}
                  
                  {!isEditingTrans ? (
                    <>
                      <button 
                        onClick={handleRunAI}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border-main text-primary text-xs font-bold rounded transition-colors cursor-pointer shadow-sm"
                      >
                        Auto-Translate
                      </button>
                      <button 
                        onClick={() => setIsEditingTrans(true)}
                        className="p-1.5 text-text-subtle hover:text-primary hover:bg-surface-hover border border-border-main rounded cursor-pointer transition-colors shadow-sm"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
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
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover transition-colors cursor-pointer shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save
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

        {/* RIGHT COLUMN: Sidebar (Comments, Deployments, History) */}
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

          {/* Context & Comments */}
          <div className="bg-surface border border-border-main rounded-xl p-5 shadow-sm flex-1 flex flex-col">
            <h3 className="text-sm font-bold text-text-main mb-4 uppercase tracking-wider text-text-muted flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Comments
            </h3>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4 custom-scrollbar max-h-[300px]">
              {comments.map((comment, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${comment.isResolved ? 'bg-surface border-border-main opacity-60' : 'bg-[#EAE6FF]/30 border-[#403294]/20'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-text-main">{comment.author}</span>
                    </div>
                    <span className="text-[10px] text-text-subtle">{comment.time}</span>
                  </div>
                  <p className="text-sm text-text-main ml-6.5">{comment.text}</p>
                  {!comment.isResolved && (
                    <button 
                      onClick={() => handleResolveComment(idx)}
                      className="ml-6.5 mt-2 text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-border-main mt-auto">
              <input
                type="text"
                placeholder="Add context or mention someone..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none"
              />
              <button 
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="w-full h-9 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-sm font-bold rounded transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                Post Comment
              </button>
            </div>
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
      />
    </div>
  );
}
