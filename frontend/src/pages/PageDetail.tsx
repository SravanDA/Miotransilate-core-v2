import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { 
  MagnifyingGlass as Search, Sparkle as Sparkles, Plus, Check, X,
  UploadSimple, CircleNotch, ClockCounterClockwise, Trash, DownloadSimple,
  PencilSimple, Star
} from "@phosphor-icons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PublishModal } from "../components/publishing/PublishModal";
import { BulkApproveModal } from "../components/translation/BulkApproveModal";
import { TranslationStatusBadge } from "../components/translation/TranslationStatusBadge";
import { StatusDone, StatusCanceled } from "../components/ui/LinearIcons";
import { CopyTypeSelector } from "../components/translation/CopyTypeSelector";
import { CopyButton } from "../components/ui/CopyButton";
import { StoreService } from "../store/StoreService";
import { ApiService } from "../services/ApiService";
import { BookmarkService } from "../services/BookmarkService";
import { ExportService } from "../services/ExportService";
import { Dropdown } from "../components/ui/Dropdown";
import { engine } from "../engine/TranslationEngine";
import type { Tag, CopyType } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { EmptyStateGraphic } from "../components/ui/EmptyStateGraphic";

export function PageDetail() {
 const { pageId } = useParams();
 const navigate = useNavigate();
 const { user, can } = useAuth();
 const { toast } = useToast();
 
 const [tags, setTags] = useState<Tag[]>([]);
 const [pageInfo, setPageInfo] = useState<{ name: string; module: string; status: string }>({ name: "Unknown", module: "Unknown", status: "Unknown" });
 const [isEditingName, setIsEditingName] = useState(false);
 const [editedName, setEditedName] = useState("");
 const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
 const [selectedLanguage, setSelectedLanguage] = useState(activeLangs[0]?.code || "en");
 const [showDeprecateModal, setShowDeprecateModal] = useState(false);
 const [isPageBookmarked, setIsPageBookmarked] = useState(pageId ? BookmarkService.isBookmarked(pageId) : false);

 const parentRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (pageId) StoreService.refreshPageDetail(pageId);
 const load = () => {
 if (!pageId) return;
 setTags(StoreService.getTags(pageId));
 
 const pInfo = StoreService.getPage(pageId);
 if (pInfo) {
 setPageInfo({ name: pInfo.name, module: pInfo.module, status: pInfo.status });
 }
 
 const langs = StoreService.getActiveLanguages();
 setActiveLangs(langs);
 if (!langs.find(l => l.code === selectedLanguage)) {
 setSelectedLanguage(langs[0]?.code || "en");
 }
 };
 load();
 return StoreService.subscribe(load);
 }, [pageId, selectedLanguage]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowDeprecateModal(false);
        setIsEditingName(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

 const [searchQuery, setSearchQuery] = useState("");
 const [selectedStatus, setSelectedStatus] = useState("All");
 const [selectedType, setSelectedType] = useState("All");
 
 const [isAddTagOpen, setIsAddTagOpen] = useState(false);
 const [newTagId, setNewTagId] = useState("");
 const [newEnglish, setNewEnglish] = useState("");
 const [newCopyType, setNewCopyType] = useState<string>("Button");

 const [isTranslating, setIsTranslating] = useState(false);
 const [isBulkApproveModalOpen, setIsBulkApproveModalOpen] = useState(false);

 const availableCopyTypes = useMemo(() => {
   const types = new Set<string>(["Button", "Label", "Header", "Placeholder", "Error", "Tooltip", "General"]);
   tags.forEach(t => {
     if (t.type && t.type.trim()) types.add(t.type);
   });
   return Array.from(types);
 }, [tags]);

 const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
 const showToast = (msg: string) => toast(msg);

 const threshold = StoreService.getConfidenceThreshold();

 const pendingReviewTags = useMemo(() => {
   return tags.filter(t => t.values[selectedLanguage]?.status === "Pending Review");
 }, [tags, selectedLanguage]);

 const eligibleBulkTags = useMemo(() => {
   return pendingReviewTags.filter(t => (t.values[selectedLanguage]?.confidence || 0) >= threshold);
 }, [pendingReviewTags, selectedLanguage, threshold]);

 const lowConfidenceBulkTags = useMemo(() => {
   return pendingReviewTags.filter(t => (t.values[selectedLanguage]?.confidence || 0) < threshold);
 }, [pendingReviewTags, selectedLanguage, threshold]);

  const missingEnglishCount = useMemo(() => {
    return tags.filter(t => !t.english || !t.english.trim()).length;
  }, [tags]);

  const handleTranslateAll = async () => {
    if (!pageId) return;
    if (!can('TRANSLATION_CREATE') && !user?.roles?.includes('FN')) {
      showToast("You don't have permission to generate translations.");
      return;
    }
    
    if (missingEnglishCount === tags.length && tags.length > 0) {
      showToast(`Cannot translate: All ${tags.length} tags are missing Master English copy. Click 'Seed English' to populate English text first.`);
      return;
    }

    setIsTranslating(true);
    showToast(`Generating translations for ${selectedLanguage}...`);
    try {
      const res = await engine.translatePageBatch(pageId, selectedLanguage);
      if (res.status === 'COMPLETE') {
        showToast(`Successfully translated all ${res.translated} tags for ${selectedLanguage}`);
      } else if (res.status === 'PARTIAL_SUCCESS') {
        showToast(`Generated ${res.translated} translations (${res.needsAttention} items need review)`);
      } else if (res.status === 'NO_ELIGIBLE_TAGS') {
        if (missingEnglishCount > 0) {
          showToast(`Cannot translate: ${missingEnglishCount} tags on this page are missing Master English copy. Click 'Seed English' to add English strings.`);
        } else {
          showToast(`All tags for ${selectedLanguage} are already translated or approved.`);
        }
      } else {
        showToast(res.error ? `Translation failed: ${res.error}` : `Translation batch failed. Please check API key in LLM DevKit.`);
      }
    } catch (e: any) {
      showToast(`Translation error: ${e?.message || "Please check LLM DevKit"}`);
    } finally {
      setIsTranslating(false);
    }
  };

 const handleOpenBulkApprove = () => {
   if (!pageId) return;
   if (!can('TRANSLATION_APPROVE') && !can('TRANSLATION_BULK_APPROVE') && !user?.roles?.includes('FN')) {
     showToast("You don't have permission to bulk approve translations.");
     return;
   }

   if (pendingReviewTags.length === 0) {
     showToast("No pending review translations for this language.");
     return;
   }

   setIsBulkApproveModalOpen(true);
 };

 const executeBulkApprove = () => {
   if (!pageId) return;
   
   eligibleBulkTags.forEach(tag => {
     StoreService.updateTranslation(pageId, tag.id, selectedLanguage, {
       status: "Approved"
     });
   });

   if (lowConfidenceBulkTags.length > 0) {
     showToast(`Approved ${eligibleBulkTags.length} high-confidence translations. ${lowConfidenceBulkTags.length} low-confidence tags kept for manual review.`);
   } else {
     showToast(`Bulk approved ${eligibleBulkTags.length} translations for ${selectedLanguage}`);
   }
 };

 const handleDeprecatePage = async () => {
   if (!pageId) return;
   try {
     await ApiService.deprecatePage(pageId);
     showToast(`Page ${pageInfo.name} marked as Deprecated`);
     setShowDeprecateModal(false);
     navigate("/pages");
   } catch {
     showToast("Failed to deprecate page");
   }
 };

 const filteredTags = useMemo(() => {
 return tags.filter(tag => {
 const val = tag.values[selectedLanguage] || { text: "", status: tag.english ? "No Trans" : "No Eng" };
 
 const matchesSearch = tag.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
 tag.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
 val.text.toLowerCase().includes(searchQuery.toLowerCase());
 
 const matchesStatus = selectedStatus === "All" || val.status === selectedStatus;
 const matchesType = selectedType === "All" || tag.type === selectedType;
 
 return matchesSearch && matchesStatus && matchesType;
 });
 }, [tags, searchQuery, selectedStatus, selectedType, selectedLanguage]);

  const handleStartEditName = () => {
    setEditedName(pageInfo.name);
    setIsEditingName(true);
  };

  const handleSavePageName = async () => {
    if (!pageId || !editedName.trim()) return;
    const newName = editedName.trim();
    setIsEditingName(false);
    await StoreService.updatePageName(pageId, newName);
    setPageInfo(prev => ({ ...prev, name: newName }));
    toast(`Page renamed to "${newName}"`, { type: "success" });
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName(pageInfo.name);
  };

  const handleTogglePageBookmark = () => {
    if (!pageId) return;
    const isNow = BookmarkService.toggleBookmark({
      id: pageId,
      type: "page",
      pageId,
      name: pageInfo.name
    });
    setIsPageBookmarked(isNow);
    showToast(isNow ? "Page bookmarked" : "Bookmark removed");
  };

  const rowVirtualizer = useVirtualizer({
  count: filteredTags.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 44, // Match sleek row height
  overscan: 10,
  });

  return (
 <div className="flex flex-col gap-4 w-full ">
 {/* Header Card */}
 <div className="bg-bg-card border border-border-subtle rounded-xl p-5 flex flex-col gap-3">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
 <div className="flex items-center gap-3 flex-wrap">
    {isEditingName ? (
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSavePageName();
            else if (e.key === "Escape") handleCancelEditName();
          }}
          autoFocus
          className="h-8 px-2.5 bg-bg-main border border-accent-blue rounded-md text-base font-bold text-text-primary outline-none shadow-xs focus:ring-1 focus:ring-accent-blue min-w-[220px]"
        />
        <button
          onClick={handleSavePageName}
          className="h-8 px-2.5 bg-accent-blue text-white rounded-md hover:brightness-110 flex items-center justify-center cursor-pointer transition-colors shadow-xs"
          title="Save page name (Enter)"
        >
          <Check className="w-3.5 h-3.5" weight="bold" />
        </button>
        <button
          onClick={handleCancelEditName}
          className="h-8 px-2.5 bg-bg-hover text-text-tertiary hover:text-text-primary rounded-md border border-border-subtle flex items-center justify-center cursor-pointer transition-colors"
          title="Cancel (Esc)"
        >
          <X className="w-3.5 h-3.5" weight="bold" />
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-1.5 group/edit">
        <h1 
          className="text-xl font-bold text-text-primary tracking-tight hover:text-link cursor-pointer transition-colors"
          onClick={handleStartEditName}
          title="Click to rename page"
        >
          {pageInfo.name}
        </h1>
        <button
          onClick={handleStartEditName}
          className="p-1 text-text-tertiary hover:text-text-primary opacity-60 group-hover/edit:opacity-100 hover:bg-bg-hover rounded transition-all cursor-pointer outline-none"
          title="Rename Page"
        >
          <PencilSimple className="w-3.5 h-3.5" />
        </button>
      </div>
    )}
  <button
    onClick={handleTogglePageBookmark}
    className={`p-1.5 rounded-md border transition-colors cursor-pointer outline-none ${
      isPageBookmarked 
        ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20" 
        : "bg-bg-main text-text-tertiary border-border-subtle hover:text-text-primary hover:bg-bg-hover"
    }`}
    title={isPageBookmarked ? "Remove bookmark" : "Bookmark this page"}
  >
    <Star className="w-3.5 h-3.5" weight={isPageBookmarked ? "fill" : "regular"} />
  </button>
 <span className="px-2 py-0.5 bg-bg-active text-text-secondary text-[11px] font-mono font-bold rounded">
 {pageId || "PAGE"}
 </span>
  <div className="flex items-center gap-1.5 text-[13px] font-normal text-text-primary select-none">
    {pageInfo.status === "Active" ? (
      <>
        <StatusDone className="w-3.5 h-3.5 shrink-0" />
        <span>Active</span>
      </>
    ) : (
      <>
        <StatusCanceled className="w-3.5 h-3.5 shrink-0" />
        <span>{pageInfo.status}</span>
      </>
    )}
  </div>
 </div>
 <div className="flex items-center gap-3 text-[12px] text-text-tertiary">
   <span>Module: <strong className="text-text-primary">{pageInfo.module}</strong> · Tags: <strong className="text-text-primary">{tags.length}</strong></span>
   <Link
     to={`/history?entityId=${pageId}&entityType=PAGE`}
     className="inline-flex items-center gap-1 text-[11px] font-semibold text-link hover:underline outline-none ml-2"
   >
     <ClockCounterClockwise className="w-3.5 h-3.5" />
     <span>Audit History</span>
   </Link>
   {(can('PAGE_TAG_CREATE') || user?.roles?.includes('FN')) && pageInfo.status !== "Deprecated" && (
     <button
       onClick={() => setShowDeprecateModal(true)}
       className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-tertiary hover:text-danger transition-colors cursor-pointer outline-none"
     >
       <Trash className="w-3.5 h-3.5" />
       <span>Deprecate</span>
     </button>
   )}
 </div>
 </div>

 <div className="pt-3 border-t border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px] text-text-tertiary">
 <div>
 Coverage: {activeLangs.map((lang, idx) => {
 const langAppr = tags.filter(t => t.values[lang.code]?.status === "Approved").length;
 return (
 <span key={lang.code}>
 {lang.name} <strong className="text-accent-blue">{langAppr}/{tags.length}</strong>
 {idx < activeLangs.length - 1 ? " · " : ""}
 </span>
 );
 })}
 </div>
 </div>
 </div>

 {/* Toolbar Card */}
 <div className="bg-bg-card p-3 rounded-xl border border-border-subtle flex flex-col gap-3">
 <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
 <div className="grid grid-cols-1 sm:grid-cols-3 md:flex items-center gap-2.5 w-full md:w-auto">
 <Dropdown
 value={selectedLanguage}
 onChange={setSelectedLanguage}
 className="w-full md:w-48"
 options={[
 { value: "eng", label: "Language: English" },
 ...activeLangs.map(lang => ({ value: lang.code, label: `Language: ${lang.name}` }))
 ]}
 />

 <Dropdown
 value={selectedStatus}
 onChange={setSelectedStatus}
 className="w-full md:w-36"
 options={[
 { value: "All", label: "Status" },
 { value: "Approved", label: "Approved" },
 { value: "Pending Review", label: "Pending Review" },
 { value: "Stale", label: "Stale" },
 { value: "Draft", label: "Draft" },
 { value: "No Trans", label: "No Trans" },
 ]}
 />

  <Dropdown
  value={selectedType}
  onChange={setSelectedType}
  className="w-full md:w-36"
  options={[
  { value: "All", label: "Copy Type" },
  ...availableCopyTypes.map(type => ({ value: type, label: type }))
  ]}
  />
 </div>

 <div className="flex-1 w-full md:max-w-xs relative">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" weight="bold" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search tags..."
 className="w-full h-9 pl-8 pr-3 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent-blue outline-none transition-colors"
 />
 </div>
 </div>

 <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-border-subtle">
 <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
 {can('TRANSLATION_CREATE') && (
 <button
 onClick={handleTranslateAll}
 disabled={isTranslating}
 className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-bg-card hover:bg-bg-hover hover:border-border-strong text-text-primary text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-[0.98] outline-none disabled:opacity-50"
 >
 {isTranslating ? (
   <CircleNotch className="w-3.5 h-3.5 text-accent-blue animate-spin shrink-0" />
 ) : (
   <Sparkles className="w-3.5 h-3.5 text-accent-blue shrink-0" weight="fill" />
 )}
 <span>{isTranslating ? "Translating..." : "Translate All"}</span>
 </button>
 )}
 {can('TRANSLATION_APPROVE') && (
 <button
 onClick={handleOpenBulkApprove}
 className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-bg-card hover:bg-bg-hover hover:border-border-strong text-text-primary text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-[0.98] outline-none"
 >
 <Check className="w-3.5 h-3.5 text-text-secondary shrink-0" weight="bold" />
 <span>Bulk Approve</span>
 </button>
 )}
 <button
   onClick={() => ExportService.exportToJson(pageInfo.name, tags, activeLangs)}
   className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-bg-card hover:bg-bg-hover hover:border-border-strong text-text-primary text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-[0.98] outline-none"
   title="Export translations as JSON"
 >
   <DownloadSimple className="w-3.5 h-3.5 text-text-secondary shrink-0" weight="bold" />
   <span>JSON</span>
 </button>
 <button
   onClick={() => ExportService.exportToCsv(pageInfo.name, tags, activeLangs)}
   className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-bg-card hover:bg-bg-hover hover:border-border-strong text-text-primary text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-[0.98] outline-none"
   title="Export translations as CSV"
 >
   <DownloadSimple className="w-3.5 h-3.5 text-text-secondary shrink-0" weight="bold" />
   <span>CSV</span>
 </button>
 {missingEnglishCount > 0 && (
   <button
     onClick={async () => {
       if (!pageId) return;
       await StoreService.seedEnglishCopiesForPage(pageId);
       showToast(`✨ Populated ${missingEnglishCount} Master English strings for ${pageInfo.name || 'this page'}`);
     }}
     className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-accent-blue/30 bg-accent-blue/10 hover:bg-accent-blue/20 text-accent-blue text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-[0.98] outline-none"
     title="Populate realistic Master English strings for empty tags"
   >
     <Sparkles className="w-3.5 h-3.5 shrink-0" weight="fill" />
     <span>Seed English ({missingEnglishCount})</span>
   </button>
 )}
 </div>

 <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
 {(can('PUBLISH_QA') || can('PUBLISH_PRODUCTION')) && (
 <button
 onClick={() => setIsPublishModalOpen(true)}
 className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-md border border-border-subtle bg-bg-card hover:bg-bg-hover hover:border-border-strong text-text-primary text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-[0.98] outline-none"
 >
 <UploadSimple className="w-3.5 h-3.5 text-text-secondary shrink-0" weight="bold" />
 <span>Publish</span>
 </button>
 )}
 {can('ENGLISH_AUTHOR') && (
 <button
 onClick={() => setIsAddTagOpen(true)}
 className="h-8 px-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#5e6ad2] hover:bg-[#525ec2] text-white text-[12px] font-medium transition-all shadow-xs cursor-pointer active:scale-[0.98] outline-none"
 >
 <Plus className="w-3.5 h-3.5 shrink-0" weight="bold" />
 <span>Add Tag</span>
 </button>
 )}
 </div>
 </div>
 </div>

 {/* Table */}
 <div 
 className="bg-bg-card rounded-lg border border-border-subtle overflow-hidden flex flex-col shadow-xs"
 >
  <div 
    ref={parentRef}
    className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] w-full scroll-smooth" 
  >
 <table className="w-full min-w-[860px] text-left text-[13px] text-text-primary border-collapse">
 <thead className="bg-bg-sidebar border-b border-border-subtle text-[11px] uppercase font-bold text-text-tertiary tracking-wider sticky top-0 z-20 shadow-xs">
 <tr>
 <th className="px-4 py-2.5 w-[220px] max-w-[220px] bg-bg-sidebar shrink-0">TAG ID</th>
 <th className="px-4 py-2.5 w-[120px] bg-bg-sidebar shrink-0">TYPE</th>
 <th className="px-4 py-2.5 min-w-[240px] bg-bg-sidebar">ENGLISH</th>
 <th className="px-4 py-2.5 min-w-[240px] bg-bg-sidebar">
 {selectedLanguage === "eng" || selectedLanguage === "en" ? "VERSION" : (activeLangs.find(l => l.code === selectedLanguage)?.name.toUpperCase() || "TRANSLATION")}
 </th>
 <th className="px-4 py-2.5 w-[140px] text-right bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">STATUS</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border-subtle">
  {filteredTags.length > 0 ? (
  <>
    {rowVirtualizer.getVirtualItems().length > 0 ? (
      <>
        {rowVirtualizer.getVirtualItems()[0].start > 0 && (
          <tr>
            <td colSpan={5} style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px`, padding: 0, border: 0 }} />
          </tr>
        )}
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const tag = filteredTags[virtualRow.index];
          const isEng = selectedLanguage === "eng" || selectedLanguage === "en";
          const val = !isEng ? (tag.values[selectedLanguage] || { text: "", status: tag.english ? "No Trans" : "No Eng" }) : { text: `v${tag.englishVersion || 1}`, status: "Approved" };
          
          return (
            <tr 
            key={tag.id} 
            className="hover:bg-bg-hover transition-colors h-[48px] group cursor-default"
            >
            <td className="px-4 py-2.5 font-mono font-medium text-link w-[220px] max-w-[220px] shrink-0">
            <Link to={`/pages/${pageId}/tags/${tag.id}`} title={tag.id} className="hover:underline truncate block outline-none">
            {tag.id}
            </Link>
            </td>
             <td className="px-4 py-2.5 w-[120px] shrink-0">
             <CopyTypeSelector
               value={tag.type}
               disabled={!can('PAGE_TAG_CREATE') && !can('ENGLISH_AUTHOR') && !user?.roles?.includes('FN')}
               onChange={(newType) => {
                 if (pageId) {
                   StoreService.updateTagType(pageId, tag.id, newType);
                   showToast(`Type updated to "${newType}"`);
                 }
               }}
             />
             </td>
            <td className="px-4 py-2.5 font-medium min-w-[240px] max-w-[340px]">
              <div className="group/copy flex items-center justify-between gap-1.5">
                {tag.english ? <span className="truncate block" title={tag.english}>{tag.english}</span> : <span className="text-text-tertiary italic truncate block">(Draft)</span>}
                {tag.english && (
                  <CopyButton
                    text={tag.english}
                    className="opacity-0 group-hover:opacity-100 group-hover/copy:opacity-100 shrink-0"
                    title="Copy English copy"
                  />
                )}
              </div>
            </td>
            <td className="px-4 py-2.5 font-sans min-w-[240px] max-w-[340px]" dir="auto">
            {isEng ? (
              <span className="px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-mono text-[11px] font-bold">
                v{tag.englishVersion || 1}
              </span>
            ) : (
              <div className="group/copy flex items-center justify-between gap-1.5">
                {val.text ? <span className="truncate block" title={val.text}>{val.text}</span> : <span className="text-text-tertiary">—</span>}
                {val.text && (
                  <CopyButton
                    text={val.text}
                    className="opacity-0 group-hover:opacity-100 group-hover/copy:opacity-100 shrink-0"
                    title="Copy translation"
                  />
                )}
              </div>
            )}
            </td>
            <td className="px-4 py-2.5 w-[140px] text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
            <div className="flex justify-end">
            {isEng ? (
            <div className="inline-flex items-center gap-1.5 text-[13px] font-normal text-text-primary select-none">
              <StatusDone className="w-3.5 h-3.5 shrink-0" />
              <span>Master</span>
            </div>
            ) : (
            <TranslationStatusBadge status={val.status as any} />
            )}
            </div>
            </td>
            </tr>
          );
        })}
        {rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end > 0 && (
          <tr>
            <td colSpan={5} style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`, padding: 0, border: 0 }} />
          </tr>
        )}
      </>
    ) : (
      filteredTags.slice(0, 50).map((tag) => {
        const isEng = selectedLanguage === "eng" || selectedLanguage === "en";
        const val = !isEng ? (tag.values[selectedLanguage] || { text: "", status: tag.english ? "No Trans" : "No Eng" }) : { text: `v${tag.englishVersion || 1}`, status: "Approved" };
        
        return (
          <tr 
          key={tag.id} 
          className="hover:bg-bg-hover transition-colors h-[48px] group cursor-default"
          >
          <td className="px-4 py-2.5 font-mono font-medium text-link w-[220px] max-w-[220px] shrink-0">
          <Link to={`/pages/${pageId}/tags/${tag.id}`} title={tag.id} className="hover:underline truncate block outline-none">
          {tag.id}
          </Link>
          </td>
           <td className="px-4 py-2.5 w-[120px] shrink-0">
           <CopyTypeSelector
             value={tag.type}
             disabled={!can('PAGE_TAG_CREATE') && !can('ENGLISH_AUTHOR') && !user?.roles?.includes('FN')}
             onChange={(newType) => {
               if (pageId) {
                 StoreService.updateTagType(pageId, tag.id, newType);
                 showToast(`Type updated to "${newType}"`);
               }
             }}
           />
           </td>
          <td className="px-4 py-2.5 font-medium min-w-[240px] max-w-[340px]">
            <div className="group/copy flex items-center justify-between gap-1.5">
              {tag.english ? <span className="truncate block" title={tag.english}>{tag.english}</span> : <span className="text-text-tertiary italic truncate block">(Draft)</span>}
              {tag.english && (
                <CopyButton
                  text={tag.english}
                  className="opacity-0 group-hover:opacity-100 group-hover/copy:opacity-100 shrink-0"
                  title="Copy English copy"
                />
              )}
            </div>
          </td>
          <td className="px-4 py-2.5 font-sans min-w-[240px] max-w-[340px]" dir="auto">
          {isEng ? (
            <span className="px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-mono text-[11px] font-bold">
              v{tag.englishVersion || 1}
            </span>
          ) : (
            <div className="group/copy flex items-center justify-between gap-1.5">
              {val.text ? <span className="truncate block" title={val.text}>{val.text}</span> : <span className="text-text-tertiary">—</span>}
              {val.text && (
                <CopyButton
                  text={val.text}
                  className="opacity-0 group-hover:opacity-100 group-hover/copy:opacity-100 shrink-0"
                  title="Copy translation"
                />
              )}
            </div>
          )}
          </td>
          <td className="px-4 py-2.5 w-[140px] text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
          <div className="flex justify-end">
          {isEng ? (
          <div className="inline-flex items-center gap-1.5 text-[13px] font-normal text-text-primary select-none">
            <StatusDone className="w-3.5 h-3.5 shrink-0" />
            <span>Master</span>
          </div>
          ) : (
          <TranslationStatusBadge status={val.status as any} />
          )}
          </div>
          </td>
          </tr>
        );
      })
    )}
  </>
  ) : (
 <tr>
 <td colSpan={6} className="px-5 py-24 text-center">
 <div className="flex flex-col items-center justify-center py-20 text-text-tertiary bg-bg-hover/30 rounded-xl border border-dashed border-border-subtle">
 <EmptyStateGraphic className="mb-4 opacity-80" />
 <h3 className="text-[14px] font-bold text-text-primary mb-1.5">No tags found</h3>
 <p className="text-[12px] max-w-sm text-balance">
 {tags.length === 0 ? "Start by adding your first tag to this page." : "Adjust your filters or search terms to find what you're looking for."}
 </p>
 </div>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 {/* Add Tag Modal */}
 {isAddTagOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
 <div className="bg-bg-card rounded-xl w-full max-w-md flex flex-col border border-border-subtle overflow-hidden">
 <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between bg-bg-sidebar rounded-t-xl">
 <h2 className="text-[14px] font-bold text-text-primary">Create New Tag</h2>
 <button onClick={() => setIsAddTagOpen(false)} className="text-text-tertiary hover:text-text-primary cursor-pointer outline-none">✕</button>
 </div>
 <form onSubmit={(e) => {
 e.preventDefault();
 if (newTagId && pageId) {
 const newTag: Tag = {
 id: newTagId,
 pageId,
 type: newCopyType as CopyType,
 english: newEnglish,
 englishVersion: 1,
 values: {},
 comments: [],
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString()
 };
 StoreService.initEmptyValuesForTag(newTag);
 StoreService.createTag(pageId, newTag);
 
 setIsAddTagOpen(false);
 setNewTagId("");
 setNewEnglish("");
 showToast(`Tag ${newTagId} created`);
 }
 }} className="p-5 flex flex-col gap-4 bg-bg-card rounded-b-xl">
 <div className="flex flex-col gap-1.5">
 <label className="text-[11px] font-bold text-text-tertiary uppercase">Tag ID</label>
 <input
 type="text"
 required
 placeholder="e.g., BTN_SUBMIT"
 value={newTagId}
 onChange={(e) => setNewTagId(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
 className="w-full h-8 px-2.5 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary font-mono focus:border-accent-blue outline-none transition-colors"
 />
 </div>
  <div className="flex flex-col gap-1.5">
  <div className="flex items-center justify-between">
    <label className="text-[11px] font-bold text-text-tertiary uppercase">Copy Type (Optional)</label>
    <span className="text-[11px] text-text-tertiary">Helper for translators & AI</span>
  </div>
  <CopyTypeSelector
    value={newCopyType}
    onChange={(val) => setNewCopyType(val)}
    size="md"
    className="w-full"
  />
  </div>
 <div className="flex flex-col gap-1.5">
 <label className="text-[11px] font-bold text-text-tertiary uppercase">English Copy</label>
 <input
 type="text"
 placeholder="Enter master English string..."
 value={newEnglish}
 onChange={(e) => setNewEnglish(e.target.value)}
 className="w-full h-8 px-2.5 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary focus:border-accent-blue outline-none transition-colors"
 />
 </div>

 <div className="flex justify-end gap-2.5 pt-4 border-t border-border-subtle mt-1">
 <button
 type="button"
 onClick={() => setIsAddTagOpen(false)}
 className="px-3.5 py-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
 >
 Cancel
 </button>
 <button
 type="submit"
 className="px-3.5 py-1.5 bg-accent-blue text-white text-[13px] font-medium rounded-md hover:brightness-110 transition-colors cursor-pointer outline-none"
 >
 Create Tag
 </button>
 </div>
 </form>
 </div>
 </div>
 )}

  {/* Publish Modal */}
  {pageId && <PublishModal 
  isOpen={isPublishModalOpen}
  onClose={() => setIsPublishModalOpen(false)}
  onPublish={async (env, langCode) => {
  setIsPublishModalOpen(false);
  const isEng = langCode === "eng" || langCode === "en";
  const count = isEng 
  ? tags.filter(t => t.english && t.english.trim().length > 0).length 
  : tags.filter(t => t.values[langCode]?.status === "Approved").length;

  const res = await StoreService.publish(
    pageId,
    pageInfo.name,
    langCode,
    env,
    count,
    user?.displayName || "System User"
  );
  showToast(res.message);
  }}
  pageName={pageInfo.name}
  totalTags={tags.length}
  initialLanguage={selectedLanguage}
  availableLanguages={activeLangs}
  tags={tags}
  />}

  {/* Bulk Approve Modal */}
  <BulkApproveModal
    isOpen={isBulkApproveModalOpen}
    onClose={() => setIsBulkApproveModalOpen(false)}
    onConfirm={executeBulkApprove}
    totalPending={pendingReviewTags.length}
    eligibleCount={eligibleBulkTags.length}
    lowConfidenceCount={lowConfidenceBulkTags.length}
    threshold={threshold}
  />

  {/* Deprecate Page Modal */}
  {showDeprecateModal && (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) setShowDeprecateModal(false); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-bg-card border border-border-subtle rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4 text-text-primary">
        <h3 className="text-base font-bold text-danger flex items-center gap-2">
          <Trash className="w-5 h-5" />
          Deprecate Page &quot;{pageInfo.name}&quot;
        </h3>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Are you sure you want to mark page <strong>{pageId}</strong> as <strong>Deprecated</strong>? Deprecated pages and their tags are preserved for historical audit trails, but won&apos;t be included in future deployments.
        </p>
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-subtle">
          <button
            onClick={() => setShowDeprecateModal(false)}
            className="px-3.5 py-1.5 text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleDeprecatePage}
            className="px-4 py-1.5 bg-danger text-white text-[12px] font-bold rounded-md hover:brightness-110 transition-all cursor-pointer outline-none"
          >
            Confirm Deprecation
          </button>
        </div>
      </div>
    </div>
  )}
  </div>
  );
}