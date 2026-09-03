import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { 
  MagnifyingGlass as Search, Check, X,
  CircleNotch, ClockCounterClockwise, Trash, DownloadSimple,
  PencilSimple, Plus, UploadSimple, CheckCircle,
  DotsThreeVertical, CaretDown, CaretUp, ArrowsDownUp,
  WarningCircle as AlertCircle
} from "@phosphor-icons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PublishModal } from "../components/publishing/PublishModal";
import { BulkApproveModal } from "../components/translation/BulkApproveModal";
import { BulkTranslatePageModal } from "../components/translation/BulkTranslatePageModal";
import { LengthConflictsModal } from "../components/translation/LengthConflictsModal";
import { Sparkles as LucideSparkles } from "lucide-react";
import { TranslationStatusBadge } from "../components/translation/TranslationStatusBadge";
import { ConfidenceBadge } from "../components/translation/ConfidenceBadge";
import { 
  StatusCompleted, 
  StatusDone,
  StatusBacklog, 
  StatusInProgress, 
  StatusCanceled, 
  StatusPlanned 
} from "../components/ui/LinearIcons";
// import { CopyTypeSelector } from "../components/translation/CopyTypeSelector";
import { CopyButton } from "../components/ui/CopyButton";
import { StoreService, type LengthConflictConfig } from "../store/StoreService";
import { ApiService } from "../services/ApiService";
import { ExportService } from "../services/ExportService";
import { Dropdown } from "../components/ui/Dropdown";
import { engine } from "../engine/TranslationEngine";
import type { Tag, CopyType } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { EmptyStateGraphic } from "../components/ui/EmptyStateGraphic";
import { Tooltip } from "../components/ui/Tooltip";

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
 // const [isPageBookmarked, setIsPageBookmarked] = useState(pageId ? BookmarkService.isBookmarked(pageId) : false);

  const [searchParams, setSearchParams] = useSearchParams();
  const isConflictsFilter = searchParams.get("conflicts") === "true";
  const [isLengthConflictsModalOpen, setIsLengthConflictsModalOpen] = useState(false);
  const [lengthConflictConfig, setLengthConflictConfig] = useState<LengthConflictConfig>(() => StoreService.getLengthConflictConfig());

 const parentRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (pageId) StoreService.refreshPageDetail(pageId);
 const load = () => {
 if (!pageId) return;
 setTags([...StoreService.getTags(pageId)]);
 setLengthConflictConfig(StoreService.getLengthConflictConfig());
 
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
 const selectedType = "All";
 // const [selectedType, setSelectedType] = useState("All");
 
 const [isAddTagOpen, setIsAddTagOpen] = useState(false);
 const [newTagId, setNewTagId] = useState("");
 const [newEnglish, setNewEnglish] = useState("");
 const newCopyType = "General";
 // const [newCopyType, setNewCopyType] = useState<string>("Button");

  const [isTranslating, setIsTranslating] = useState(false);
  const [isBulkApproveModalOpen, setIsBulkApproveModalOpen] = useState(false);
  const [isBulkTranslateModalOpen, setIsBulkTranslateModalOpen] = useState(false);
  
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [confidenceSort, setConfidenceSort] = useState<'none' | 'asc' | 'desc'>('none');

  const handleToggleConfidenceSort = () => {
    setConfidenceSort(prev => {
      if (prev === 'none') return 'desc';
      if (prev === 'desc') return 'asc';
      return 'none';
    });
  };

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    if (isMoreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMoreMenuOpen]);

  // const availableCopyTypes = useMemo(() => {
  //   const types = new Set<string>(["Button", "Label", "Header", "Placeholder", "Error", "Tooltip", "General"]);
  //   tags.forEach(t => {
  //     if (t.type && t.type.trim()) types.add(t.type);
  //   });
  //   return Array.from(types);
  // }, [tags]);

 const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
 const showToast = (msg: string) => toast(msg);

 const threshold = StoreService.getConfidenceThreshold();

  const pendingReviewTags = useMemo(() => {
    return tags.filter(t => {
      const val = t.values[selectedLanguage];
      return val && val.text && val.text.trim().length > 0 && val.status !== "Approved";
    });
  }, [tags, selectedLanguage]);

 const eligibleBulkTags = useMemo(() => {
   return pendingReviewTags.filter(t => (t.values[selectedLanguage]?.confidence || 0) >= threshold);
 }, [pendingReviewTags, selectedLanguage, threshold]);

 const lowConfidenceBulkTags = useMemo(() => {
   return pendingReviewTags.filter(t => (t.values[selectedLanguage]?.confidence || 0) < threshold);
 }, [pendingReviewTags, selectedLanguage, threshold]);

  const isFullyApproved = useMemo(() => {
    if (tags.length === 0) return false;
    const approvedCount = tags.filter(t => t.values[selectedLanguage]?.status === "Approved").length;
    return approvedCount === tags.length;
  }, [tags, selectedLanguage]);

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
        if (res.translated > 0) {
          showToast(`Successfully translated all ${res.translated} tags for ${selectedLanguage}`);
        } else {
          showToast(`All tags for ${selectedLanguage} are already translated and up-to-date.`);
        }
      } else if (res.status === 'PARTIAL_SUCCESS') {
        showToast(`Generated ${res.translated} translations (${res.needsAttention} items need review${res.blocked > 0 ? `, ${res.blocked} blocked` : ''})`);
      } else if (res.status === 'NO_ELIGIBLE_TAGS') {
        if (missingEnglishCount > 0) {
          showToast(`Cannot translate: ${missingEnglishCount} tags on this page are missing Master English copy. Add English strings first.`);
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

  const executeBulkApprove = async () => {
    if (!pageId) return;
    
    try {
      const res = await StoreService.bulkApproveTranslations(pageId, selectedLanguage);
      const approvedCount = res?.approved ?? eligibleBulkTags.length;
      const skippedCount = res?.skipped ?? lowConfidenceBulkTags.length;
      
      if (skippedCount > 0) {
        showToast(`Approved ${approvedCount} translations. ${skippedCount} low-confidence tags kept for manual review.`);
      } else {
        showToast(`Bulk approved ${approvedCount} translations for ${selectedLangName}`);
      }
    } catch (err: any) {
      showToast(`Bulk approval failed: ${err?.message || "Unknown error"}`);
    }
  };

  const handleApproveTag = async (e: React.MouseEvent, tagId: string) => {
    e.stopPropagation();
    if (!pageId) return;
    if (!can('TRANSLATION_APPROVE') && !can('TRANSLATION_BULK_APPROVE') && !user?.roles?.includes('FN')) {
      showToast("You don't have permission to approve translations.");
      return;
    }
    await StoreService.approveTranslation(pageId, tagId, selectedLanguage);
    showToast(`Approved translation for tag ${tagId}`);
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

  // Length conflicts for this page
  const pageConflicts = useMemo(() => {
    if (!pageId || !lengthConflictConfig.enabled) return [];
    void tags;
    return StoreService.getLengthConflicts().filter(c => c.pageId === pageId);
  }, [pageId, tags, lengthConflictConfig.enabled]);

  // Conflicts specific to selectedLanguage on this page
  const langConflicts = useMemo(() => {
    return pageConflicts.filter(c => c.languageCode === selectedLanguage);
  }, [pageConflicts, selectedLanguage]);

  // Tag IDs that conflict in selectedLanguage
  const conflictTagIds = useMemo(() => {
    return new Set(langConflicts.map(c => c.tagId));
  }, [langConflicts]);

  // Tag IDs that conflict across ANY language on this page
  const allPageConflictTagIds = useMemo(() => {
    return new Set(pageConflicts.map(c => c.tagId));
  }, [pageConflicts]);

  // Map of tagId -> diffPercentage in selectedLanguage
  const conflictMap = useMemo(() => {
    const map = new Map<string, number>();
    langConflicts.forEach(c => map.set(c.tagId, c.diffPercentage));
    return map;
  }, [langConflicts]);

  const toggleConflictsFilter = () => {
    const next = !isConflictsFilter;
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      if (next) {
        p.set("conflicts", "true");
      } else {
        p.delete("conflicts");
      }
      return p;
    }, { replace: true });
  };

  const filteredTags = useMemo(() => {
    const result = tags.filter(tag => {
      const val = tag.values[selectedLanguage] || { text: "", status: tag.english ? "No Trans" : "No Eng" };
      
      const matchesSearch = tag.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        tag.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        val.text.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = selectedStatus === "All" || val.status === selectedStatus;
      const matchesType = selectedType === "All" || tag.type === selectedType;
      
      // Filter by length conflicts if active and guardrail enabled
      if (lengthConflictConfig.enabled && isConflictsFilter) {
        const matchesConflict = conflictTagIds.has(tag.id) || (conflictTagIds.size === 0 && allPageConflictTagIds.has(tag.id));
        if (!matchesConflict) return false;
      }

      return matchesSearch && matchesStatus && matchesType;
    });

    if (confidenceSort !== 'none') {
      result.sort((a, b) => {
        const isEng = selectedLanguage === "eng" || selectedLanguage === "en";
        const valA = isEng ? 100 : a.values[selectedLanguage]?.confidence;
        const valB = isEng ? 100 : b.values[selectedLanguage]?.confidence;

        const hasA = typeof valA === 'number';
        const hasB = typeof valB === 'number';

        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;

        return confidenceSort === 'desc' ? valB - valA : valA - valB;
      });
    }

    return result;
  }, [tags, searchQuery, selectedStatus, selectedType, selectedLanguage, confidenceSort, isConflictsFilter, conflictTagIds, allPageConflictTagIds, lengthConflictConfig.enabled]);

  const selectedLangName = useMemo(() => {
    const found = activeLangs.find(l => l.code === selectedLanguage);
    return found ? found.name : selectedLanguage.toUpperCase();
  }, [activeLangs, selectedLanguage]);

  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Clear selection when changing page, language or filters
  useEffect(() => {
    setSelectedTagIds(new Set());
  }, [pageId, selectedLanguage, selectedStatus, selectedType]);

  // Escape key deselects all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedTagIds.size > 0) {
        setSelectedTagIds(new Set());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTagIds.size]);

  const toggleSelectTag = (tagId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTagIds.size === filteredTags.length && filteredTags.length > 0) {
      setSelectedTagIds(new Set());
    } else {
      setSelectedTagIds(new Set(filteredTags.map(t => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedTagIds(new Set());
  };

  const isAllSelected = filteredTags.length > 0 && selectedTagIds.size === filteredTags.length;
  const isPartiallySelected = selectedTagIds.size > 0 && selectedTagIds.size < filteredTags.length;

  const handleApproveSelected = async () => {
    if (selectedTagIds.size === 0 || !pageId) return;
    if (!can('TRANSLATION_APPROVE') && !can('TRANSLATION_BULK_APPROVE') && !user?.roles?.includes('FN')) {
      showToast("You don't have permission to approve translations.");
      return;
    }
    setIsBatchProcessing(true);
    try {
      const tagIdsArray = Array.from(selectedTagIds);
      await Promise.all(
        tagIdsArray.map(tagId => StoreService.approveTranslation(pageId, tagId, selectedLanguage))
      );
      showToast(`Approved ${tagIdsArray.length} selected translation${tagIdsArray.length > 1 ? 's' : ''} for ${selectedLangName}`);
      setSelectedTagIds(new Set());
    } catch (e: any) {
      showToast(`Failed to approve selected tags: ${e?.message || "Unknown error"}`);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleTranslateSelected = async () => {
    if (selectedTagIds.size === 0 || !pageId) return;
    if (!can('TRANSLATION_CREATE') && !user?.roles?.includes('FN')) {
      showToast("You don't have permission to generate translations.");
      return;
    }
    setIsBatchProcessing(true);
    showToast(`Translating ${selectedTagIds.size} selected tag${selectedTagIds.size > 1 ? 's' : ''} for ${selectedLangName}...`);
    try {
      const tagIdsArray = Array.from(selectedTagIds);
      await Promise.all(
        tagIdsArray.map(tagId => engine.translateTag(pageId, tagId, selectedLanguage))
      );
      showToast(`Completed translations for ${tagIdsArray.length} selected tag${tagIdsArray.length > 1 ? 's' : ''}`);
      setSelectedTagIds(new Set());
    } catch (e: any) {
      showToast(`Batch translation error: ${e?.message || "Check LLM DevKit"}`);
    } finally {
      setIsBatchProcessing(false);
    }
  };

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

  // const handleTogglePageBookmark = () => {
  //   if (!pageId) return;
  //   const isNow = BookmarkService.toggleBookmark({
  //     id: pageId,
  //     type: "page",
  //     pageId,
  //     name: pageInfo.name
  //   });
  //   setIsPageBookmarked(isNow);
  //   showToast(isNow ? "Page bookmarked" : "Bookmark removed");
  // };

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
          className="h-8 px-2.5 bg-bg-main border border-accent-blue rounded-md text-base font-bold text-text-primary outline-none  focus:ring-1 focus:ring-accent-blue min-w-[220px]"
        />
        <button
          onClick={handleSavePageName}
          className="btn-primary h-8 px-2.5"
          title="Save page name (Enter)"
        >
          <Check className="w-3.5 h-3.5" weight="bold" />
        </button>
        <button
          onClick={handleCancelEditName}
          className="btn-secondary h-8 px-2.5 text-text-tertiary hover:text-text-primary"
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
  {/* Bookmark button commented out:
  <Tooltip content={isPageBookmarked ? "Remove bookmark" : "Bookmark this page"}>
    <button
      onClick={handleTogglePageBookmark}
      className={`h-8 px-2.5 rounded-lg border transition-all cursor-pointer outline-none active:scale-[0.98] inline-flex items-center justify-center ${
        isPageBookmarked 
          ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20" 
          : "bg-bg-card text-text-tertiary border-border-subtle hover:border-border-strong hover:text-text-primary hover:bg-bg-hover"
      }`}
    >
      <Star className="w-3.5 h-3.5" weight={isPageBookmarked ? "fill" : "regular"} />
    </button>
  </Tooltip> */}
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
  {/* Macro Coverage Readiness Strip */}
  <div className="pt-3 border-t border-border-subtle flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
    {activeLangs.map((lang) => {
      const approvedCount = tags.filter(t => t.values[lang.code]?.status === "Approved").length;
      const isReady = approvedCount === tags.length && tags.length > 0;
      const percent = tags.length > 0 ? Math.round((approvedCount / tags.length) * 100) : 0;
      const isSelected = selectedLanguage === lang.code;

      return (
        <button
          key={lang.code}
          type="button"
          onClick={() => setSelectedLanguage(lang.code)}
          className={`h-6 px-2 rounded-md border text-[11px] font-medium inline-flex items-center gap-1.5 transition-all cursor-pointer outline-none shrink-0 ${
            isSelected
              ? "bg-accent-blue/15 border-accent-blue/60 text-accent-blue font-semibold "
              : isReady
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-500 hover:bg-emerald-500/15"
                : percent > 0
                  ? "bg-bg-main border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
                  : "bg-bg-main/60 border-border-subtle/80 text-text-tertiary hover:text-text-secondary hover:border-border-strong"
          }`}
          title={`Click to view ${lang.name} translations`}
        >
          <span className="font-semibold uppercase tracking-wider">{lang.code}</span>
          <span className={`tabular-nums ${isReady ? "text-emerald-500 font-semibold" : isSelected ? "text-accent-blue" : "text-text-tertiary"}`}>
            {percent}%
          </span>
          {isReady && <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" weight="fill" />}
        </button>
      );
    })}
  </div>
 </div>

 {/* Toolbar Card */}
 <div className="bg-bg-card p-3 rounded-xl border border-border-subtle flex flex-col gap-3">
 <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
 <div className="grid grid-cols-1 sm:grid-cols-2 md:flex items-center gap-2.5 w-full md:w-auto">
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
          className="w-full md:w-[146px]"
          options={[
            { value: "All", label: "Status" },
            { value: "Approved", label: "Approved", icon: <StatusCompleted className="w-3.5 h-3.5" /> },
            { value: "Pending Review", label: "Pending Review", icon: <StatusInProgress className="w-3.5 h-3.5" /> },
            { value: "Needs Attention", label: "Needs Attention", icon: <StatusInProgress className="w-3.5 h-3.5 text-[#EB5757]" /> },
            { value: "Stale", label: "Stale", icon: <StatusInProgress className="w-3.5 h-3.5 text-amber-500" /> },
            { value: "Draft", label: "Draft", icon: <StatusPlanned className="w-3.5 h-3.5" /> },
            { value: "Blocked", label: "Blocked", icon: <StatusCanceled className="w-3.5 h-3.5 text-rose-500" /> },
            { value: "No Trans", label: "No Trans", icon: <StatusBacklog className="w-3.5 h-3.5" /> },
          ]}
        />

   {/* Copy Type filter commented out for now:
   <Dropdown
   value={selectedType}
   onChange={setSelectedType}
   className="w-full md:w-36"
   options={[
   { value: "All", label: "Copy Type" },
   ...availableCopyTypes.map(type => ({ value: type, label: type }))
   ]}
   /> */}
 </div>

  <div className="flex items-center gap-2 flex-1 w-full md:max-w-md">
    <div className="flex-1 relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" weight="bold" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search tags..."
        className="w-full h-9 pl-8 pr-3 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent-blue outline-none transition-colors"
      />
    </div>

    {lengthConflictConfig.enabled && (conflictTagIds.size > 0 || allPageConflictTagIds.size > 0) && (
      <Tooltip content={isConflictsFilter ? "Clear conflicts filter" : `Filter table by length conflicts (${conflictTagIds.size || allPageConflictTagIds.size} tags)`}>
        <button
          onClick={toggleConflictsFilter}
          className={`h-9 px-2.5 inline-flex items-center gap-1.5 rounded-md text-[12px] font-medium border transition-all cursor-pointer shrink-0 ${
            isConflictsFilter
              ? "bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-300 ring-2 ring-amber-500/30 font-semibold shadow-xs"
              : "bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" weight="bold" />
          <span>{conflictTagIds.size || allPageConflictTagIds.size} Conflicts</span>
        </button>
      </Tooltip>
    )}
  </div>
 </div>

  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-border-subtle">
    {/* Left: Primary Workflow Actions — Translate & Approve */}
    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">

      {/* Bulk Translate Page Button — Primary Button Color with Lucide AI Sparkles */}
      {(can('TRANSLATION_CREATE') || user?.roles?.includes('FN')) && (
        <Tooltip content="Bulk translate all tags on this page across all active languages">
          <button
            onClick={() => setIsBulkTranslateModalOpen(true)}
            className="btn-primary h-8 px-2.5 shadow-xs"
          >
            <LucideSparkles className="w-3.5 h-3.5 text-white shrink-0" strokeWidth={2.2} />
            <span>Translate All Languages</span>
          </button>
        </Tooltip>
      )}

      {/* Translate Selected Language Button — Normal White Button with Lucide AI Sparkles */}
      {(can('TRANSLATION_CREATE') || user?.roles?.includes('FN')) && selectedLanguage !== 'eng' && selectedLanguage !== 'en' && (
        <Tooltip content={`Translate tags for currently selected language (${selectedLangName})`}>
          <button
            onClick={handleTranslateAll}
            disabled={isTranslating}
            className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-hover hover:border-border-strong text-text-primary text-[12px] font-medium transition-all cursor-pointer active:scale-[0.98] outline-none disabled:opacity-50 shadow-xs"
          >
            {isTranslating ? (
              <CircleNotch className="w-3.5 h-3.5 text-text-primary animate-spin shrink-0" />
            ) : (
              <LucideSparkles className="w-3.5 h-3.5 text-text-secondary shrink-0" strokeWidth={2} />
            )}
            <span>{isTranslating ? "Translating..." : `Translate ${selectedLangName}`}</span>
          </button>
        </Tooltip>
      )}

      {/* Vertical Separator between Translation & Approval */}
      {(can('TRANSLATION_CREATE') || user?.roles?.includes('FN')) && can('TRANSLATION_APPROVE') && (
        <div className="h-4 w-px bg-border-subtle mx-0.5 hidden sm:block" />
      )}

      {/* Bulk Approve — Solid Green #4CB782 when pending, Dark Green #236B47 when fully approved */}
      {can('TRANSLATION_APPROVE') && (
        <Tooltip content={isFullyApproved ? "All translations for this language are approved" : "Approve translations ready for review"}>
          <button
            onClick={isFullyApproved ? undefined : handleOpenBulkApprove}
            disabled={isFullyApproved}
            className={`h-8 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium transition-all shadow-xs outline-none ${
              isFullyApproved
                ? 'bg-[#236B47] text-white cursor-default'
                : 'bg-[#4CB782] hover:bg-[#43a575] text-white cursor-pointer active:scale-[0.98]'
            }`}
          >
            <Check className="w-3.5 h-3.5 text-white shrink-0" weight="bold" />
            <span>{isFullyApproved ? "Approved" : "Approve"}</span>
            {!isFullyApproved && eligibleBulkTags.length > 0 && (
              <span className="px-1.5 py-0.2 bg-black/15 text-white text-[11px] font-semibold rounded-full tabular-nums">
                {eligibleBulkTags.length}
              </span>
            )}
          </button>
        </Tooltip>
      )}
    </div>

    {/* Right: Utility 3-dot Menu & Publish CTA */}
    <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">

      {/* 3-dot More Options (Export JSON, Export CSV, Add Tag) */}
      <div className="relative" ref={moreMenuRef}>
        <Tooltip content="More options (Export, Add Tag)">
          <button
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-hover hover:border-border-strong text-text-secondary hover:text-text-primary transition-all cursor-pointer active:scale-[0.98] outline-none shadow-xs ${isMoreMenuOpen ? 'bg-bg-hover border-border-strong text-text-primary' : ''}`}
          >
            <DotsThreeVertical className="w-4 h-4" weight="bold" />
          </button>
        </Tooltip>

        {isMoreMenuOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-48 rounded-lg border border-border-subtle bg-bg-card shadow-xl p-1 z-50 animate-in fade-in-50 duration-100">
            <button
              onClick={() => {
                ExportService.exportToJson(pageInfo.name, tags, activeLangs);
                setIsMoreMenuOpen(false);
              }}
              className="w-full h-8 px-2.5 flex items-center justify-between text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
            >
              <div className="flex items-center gap-2">
                <DownloadSimple className="w-3.5 h-3.5 shrink-0" weight="bold" />
                <span>Export JSON</span>
              </div>
              <span className="text-[10px] text-text-tertiary uppercase font-mono">.json</span>
            </button>
            <button
              onClick={() => {
                ExportService.exportToCsv(pageInfo.name, tags, activeLangs);
                setIsMoreMenuOpen(false);
              }}
              className="w-full h-8 px-2.5 flex items-center justify-between text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
            >
              <div className="flex items-center gap-2">
                <DownloadSimple className="w-3.5 h-3.5 shrink-0" weight="bold" />
                <span>Export CSV</span>
              </div>
              <span className="text-[10px] text-text-tertiary uppercase font-mono">.csv</span>
            </button>

            {can('ENGLISH_AUTHOR') && (
              <>
                <div className="h-px bg-border-subtle my-1" />
                <button
                  onClick={() => {
                    setIsAddTagOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full h-8 px-2.5 flex items-center gap-2 text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" weight="bold" />
                  <span>Add Tag</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Publish — Primary Lavender CTA */}
      {(can('PUBLISH_QA') || can('PUBLISH_PRODUCTION')) && (
        <button
          onClick={() => setIsPublishModalOpen(true)}
          className="btn-primary shadow-xs"
        >
          <UploadSimple className="w-3.5 h-3.5 shrink-0" weight="bold" />
          <span>Publish</span>
        </button>
      )}
    </div>
  </div>

 </div>

  {/* Active Conflicts Filter Banner */}
  {lengthConflictConfig.enabled && isConflictsFilter && (
    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-[12px] mb-3 animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" weight="bold" />
        <span>
          Filtered by <strong>Length Conflicts</strong> — showing <strong>{filteredTags.length}</strong> tags exceeding UI layout budgets
          {conflictTagIds.size > 0 ? ` in ${selectedLangName}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setIsLengthConflictsModalOpen(true)}
          className="text-amber-700 dark:text-amber-300 hover:underline font-semibold cursor-pointer"
        >
          View Full Report
        </button>
        <span className="text-amber-500/40">•</span>
        <button
          onClick={toggleConflictsFilter}
          className="h-6 px-2.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 font-medium transition-colors cursor-pointer text-[11px]"
        >
          Clear Filter
        </button>
      </div>
    </div>
  )}

 {/* Table */}
 <div 
 className="bg-bg-card rounded-xl border border-border-subtle overflow-hidden flex flex-col "
 >
  <div 
    ref={parentRef}
    className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] w-full scroll-smooth" 
  >
 <table className="w-full text-left text-[13px] text-text-primary border-collapse">
 <thead className="bg-bg-sidebar border-b border-border-subtle text-[11px] uppercase font-bold text-text-tertiary tracking-wider sticky top-0 z-20 ">
 <tr>
 <th className="px-3 py-2.5 w-[38px] min-w-[38px] max-w-[38px] bg-bg-sidebar shrink-0 text-center">
   <input
     type="checkbox"
     checked={isAllSelected}
     ref={el => { if (el) el.indeterminate = isPartiallySelected; }}
     onChange={toggleSelectAll}
     className="w-3.5 h-3.5 rounded border-border-strong text-accent-blue focus:ring-accent-blue/30 cursor-pointer accent-[#5E6AD2]"
     title={isAllSelected ? "Deselect all (Esc)" : "Select all"}
   />
 </th>
 <th className="px-4 py-2.5 w-[180px] min-w-[180px] max-w-[180px] bg-bg-sidebar shrink-0 whitespace-nowrap">TAG ID</th>
 {/* <th className="px-3 py-2.5 w-[90px] min-w-[90px] bg-bg-sidebar shrink-0 whitespace-nowrap">TYPE</th> */}
 <th className="px-4 py-2.5 min-w-[180px] max-w-[260px] bg-bg-sidebar">ENGLISH</th>
 <th className="px-4 py-2.5 min-w-[180px] max-w-[260px] bg-bg-sidebar">
 {selectedLanguage === "eng" || selectedLanguage === "en" ? "VERSION" : (activeLangs.find(l => l.code === selectedLanguage)?.name.toUpperCase() || "TRANSLATION")}
 </th>
  <th 
    onClick={handleToggleConfidenceSort}
    className="px-4 py-2.5 w-[130px] min-w-[130px] bg-bg-sidebar shrink-0 whitespace-nowrap cursor-pointer select-none group/th hover:bg-bg-hover/60 transition-colors"
    title={`Confidence: ${confidenceSort === 'none' ? 'Click to sort high to low' : confidenceSort === 'desc' ? 'Sorted High to Low (click for Low to High)' : 'Sorted Low to High (click to reset)'}`}
  >
    <div className="inline-flex items-center gap-1.5">
      <span className={`transition-colors ${confidenceSort !== 'none' ? 'text-accent-blue font-bold' : 'text-text-tertiary group-hover/th:text-text-secondary'}`}>
        CONFIDENCE
      </span>
      {confidenceSort === 'desc' && (
        <CaretDown className="w-3 h-3 text-accent-blue" weight="bold" />
      )}
      {confidenceSort === 'asc' && (
        <CaretUp className="w-3 h-3 text-accent-blue" weight="bold" />
      )}
      {confidenceSort === 'none' && (
        <ArrowsDownUp className="w-3 h-3 text-text-tertiary opacity-0 group-hover/th:opacity-100 transition-opacity" weight="bold" />
      )}
    </div>
  </th>
 <th className="px-4 py-2.5 w-[140px] min-w-[140px] text-right bg-bg-sidebar border-l border-border-subtle shrink-0 whitespace-nowrap">STATUS</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border-subtle">
  {filteredTags.length > 0 ? (
  <>
    {rowVirtualizer.getVirtualItems().length > 0 ? (
      <>
        {rowVirtualizer.getVirtualItems()[0].start > 0 && (
          <tr>
            <td colSpan={6} style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px`, padding: 0, border: 0 }} />
          </tr>
        )}
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const tag = filteredTags[virtualRow.index];
          const isEng = selectedLanguage === "eng" || selectedLanguage === "en";
          const val = !isEng ? (tag.values[selectedLanguage] || { text: "", status: tag.english ? "No Trans" : "No Eng", confidence: 0 }) : { text: `v${tag.englishVersion || 1}`, status: "Approved", confidence: 100 };
          const isSelected = selectedTagIds.has(tag.id);
          
          return (
            <tr 
            key={tag.id} 
            className={`hover:bg-bg-hover transition-colors h-[44px] group cursor-default ${isSelected ? "bg-accent-blue/5 hover:bg-accent-blue/10" : ""}`}
            >
            <td className="px-3 py-2 w-[38px] min-w-[38px] max-w-[38px] shrink-0 text-center" onClick={(e) => e.stopPropagation()}>
               <input
                 type="checkbox"
                 checked={isSelected}
                 onChange={(e) => toggleSelectTag(tag.id, e as any)}
                 className="w-3.5 h-3.5 rounded border-border-strong text-accent-blue focus:ring-accent-blue/30 cursor-pointer accent-[#5E6AD2]"
               />
             </td>
            <td className="px-4 py-2 font-mono font-medium text-link w-[180px] min-w-[180px] max-w-[180px] shrink-0 text-[12px] truncate">
            <Link to={`/pages/${pageId}/tags/${tag.id}?lang=${selectedLanguage}`} title={tag.id} className="hover:underline truncate block outline-none">
            {tag.id}
            </Link>
            </td>
            {/* TYPE column commented out for now:
            <td className="px-3 py-2 w-[90px] min-w-[90px] shrink-0 whitespace-nowrap">
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
            </td> */}
            <td className="px-4 py-2 font-medium min-w-[180px] max-w-[260px] text-[13px]">
              <div className="group/copy flex items-center justify-between gap-1.5">
                <span className="truncate block" title={tag.english || "(Draft)"}>
                  {tag.english || <span className="text-text-tertiary italic">(Draft)</span>}
                </span>
                {tag.english && (
                  <CopyButton
                    text={tag.english}
                    className="opacity-0 group-hover:opacity-100 group-hover/copy:opacity-100 shrink-0"
                    title="Copy English copy"
                  />
                )}
              </div>
            </td>
            <td className="px-4 py-2 font-sans min-w-[180px] max-w-[260px] text-[13px]" dir="auto">
            {isEng ? (
              <span className="px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-mono text-[11px] font-bold">
                v{tag.englishVersion || 1}
              </span>
            ) : (
              <div className="group/copy flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <span className="truncate block" title={val.text || "-"}>
                    {val.text ? val.text : <span className="text-text-tertiary">-</span>}
                  </span>
                  {lengthConflictConfig.enabled && conflictMap.has(tag.id) && (
                    <span 
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0"
                      title={`Exceeds English copy length budget by +${conflictMap.get(tag.id)}%`}
                    >
                      +{conflictMap.get(tag.id)}% len
                    </span>
                  )}
                </div>
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
            <td className="px-4 py-2 w-[130px] min-w-[130px] shrink-0 whitespace-nowrap">
              {isEng ? (
                <span className="text-[11px] font-mono text-text-tertiary">Source</span>
              ) : (
                <ConfidenceBadge confidence={val.confidence} status={val.status} size="sm" />
              )}
            </td>
            <td className="px-4 py-2 w-[140px] min-w-[140px] text-right bg-bg-card group-hover:bg-bg-hover border-l border-border-subtle transition-colors shrink-0 whitespace-nowrap">
            <div className="flex items-center justify-end gap-1.5">
            {isEng ? (
            <div className="inline-flex items-center gap-1.5 text-[12px] font-normal text-text-primary select-none">
              <StatusDone className="w-3.5 h-3.5 shrink-0" />
              <span>Master</span>
            </div>
            ) : (
            <>
              {val.status !== "Approved" && val.status !== "No Trans" && val.status !== "No Eng" && val.text && (can('TRANSLATION_APPROVE') || can('TRANSLATION_BULK_APPROVE') || user?.roles?.includes('FN')) && (
                <Tooltip content="Approve this translation">
                  <button
                    onClick={(e) => handleApproveTag(e, tag.id)}
                    className="btn-success h-6 px-2 text-[11px] opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <Check className="w-3 h-3" weight="bold" />
                    <span>Approve</span>
                  </button>
                </Tooltip>
              )}
              <TranslationStatusBadge status={val.status as any} />
            </>
            )}
            </div>
            </td>
            </tr>
          );
        })}
        {rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end > 0 && (
          <tr>
            <td colSpan={6} style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`, padding: 0, border: 0 }} />
          </tr>
        )}
      </>
    ) : (
      filteredTags.slice(0, 50).map((tag) => {
        const isEng = selectedLanguage === "eng" || selectedLanguage === "en";
        const val = !isEng ? (tag.values[selectedLanguage] || { text: "", status: tag.english ? "No Trans" : "No Eng", confidence: 0 }) : { text: `v${tag.englishVersion || 1}`, status: "Approved", confidence: 100 };
        
        return (
          <tr 
          key={tag.id} 
          className="hover:bg-bg-hover transition-colors h-[44px] group cursor-default"
          >
          <td className="px-4 py-2 font-mono font-medium text-link w-[180px] min-w-[180px] max-w-[180px] shrink-0 text-[12px] truncate">
          <Link to={`/pages/${pageId}/tags/${tag.id}?lang=${selectedLanguage}`} title={tag.id} className="hover:underline truncate block outline-none">
          {tag.id}
          </Link>
          </td>
          {/* TYPE column commented out for now:
          <td className="px-3 py-2 w-[90px] min-w-[90px] shrink-0 whitespace-nowrap">
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
          </td> */}
          <td className="px-4 py-2 font-medium min-w-[180px] max-w-[260px] text-[13px]">
            <div className="group/copy flex items-center justify-between gap-1.5">
              <span className="truncate block" title={tag.english || "(Draft)"}>
                {tag.english ? tag.english : <span className="text-text-tertiary italic">(Draft)</span>}
              </span>
              {tag.english && (
                <CopyButton
                  text={tag.english}
                  className="opacity-0 group-hover:opacity-100 group-hover/copy:opacity-100 shrink-0"
                  title="Copy English copy"
                />
              )}
            </div>
          </td>
          <td className="px-4 py-2 font-sans min-w-[180px] max-w-[260px] text-[13px]" dir="auto">
          {isEng ? (
            <span className="px-2 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-mono text-[11px] font-bold">
              v{tag.englishVersion || 1}
            </span>
          ) : (
            <div className="group/copy flex items-center justify-between gap-1.5">
              <span className="truncate block" title={val.text || "-"}>
                {val.text ? val.text : <span className="text-text-tertiary">-</span>}
              </span>
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
          <td className="px-4 py-2 w-[130px] min-w-[130px] shrink-0 whitespace-nowrap">
            {isEng ? (
              <span className="text-[11px] font-mono text-text-tertiary">Source</span>
            ) : (
              <ConfidenceBadge confidence={val.confidence} status={val.status} size="sm" />
            )}
          </td>
          <td className="px-4 py-2 w-[140px] min-w-[140px] text-right bg-bg-card group-hover:bg-bg-hover border-l border-border-subtle transition-colors shrink-0 whitespace-nowrap">
          <div className="flex items-center justify-end gap-1.5">
          {isEng ? (
          <div className="inline-flex items-center gap-1.5 text-[12px] font-normal text-text-primary select-none">
            <StatusDone className="w-3.5 h-3.5 shrink-0" />
            <span>Master</span>
          </div>
          ) : (
          <>
            {val.status !== "Approved" && val.status !== "No Trans" && val.status !== "No Eng" && val.text && (can('TRANSLATION_APPROVE') || can('TRANSLATION_BULK_APPROVE') || user?.roles?.includes('FN')) && (
              <button
                onClick={(e) => handleApproveTag(e, tag.id)}
                className="btn-success h-6 px-2 text-[11px] opacity-0 group-hover:opacity-100"
                title="Approve this translation"
              >
                <Check className="w-3 h-3" weight="bold" />
                <span>Approve</span>
              </button>
            )}
            <TranslationStatusBadge status={val.status as any} />
          </>
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

  {/* Floating Batch Action Bar (Linear Style) */}
  {selectedTagIds.size > 0 && typeof document !== "undefined" && createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990] animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#1E1E20] text-white shadow-2xl border border-white/12 backdrop-blur-xl text-[12px]">
        <div className="flex items-center gap-2 pr-2.5 border-r border-white/15">
          <span className="w-5 h-5 rounded-full bg-[#5E6AD2] text-white font-semibold text-[11px] flex items-center justify-center shadow-xs">
            {selectedTagIds.size}
          </span>
          <span className="font-medium text-white/90">selected</span>
        </div>

        {(can('TRANSLATION_APPROVE') || can('TRANSLATION_BULK_APPROVE') || user?.roles?.includes('FN')) && (
          <button
            onClick={handleApproveSelected}
            disabled={isBatchProcessing}
            className="h-7 px-3 inline-flex items-center gap-1.5 rounded-lg bg-[#4CB782] hover:bg-[#43A675] text-white font-medium transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 shadow-xs"
            title={`Approve ${selectedTagIds.size} selected tags for ${selectedLangName}`}
          >
            {isBatchProcessing ? (
              <CircleNotch className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" weight="bold" />
            )}
            <span>Approve Selected ({selectedTagIds.size})</span>
          </button>
        )}

        {(can('TRANSLATION_CREATE') || user?.roles?.includes('FN')) && selectedLanguage !== 'eng' && selectedLanguage !== 'en' && (
          <button
            onClick={handleTranslateSelected}
            disabled={isBatchProcessing}
            className="h-7 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-all active:scale-[0.98] cursor-pointer border border-white/15 disabled:opacity-50 shadow-xs"
            title={`Translate ${selectedTagIds.size} selected tags to ${selectedLangName}`}
          >
            {isBatchProcessing ? (
              <CircleNotch className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LucideSparkles className="w-3.5 h-3.5" />
            )}
            <span>Translate Selected ({selectedTagIds.size})</span>
          </button>
        )}

        <button
          onClick={clearSelection}
          className="h-7 px-2 inline-flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer ml-0.5"
          title="Deselect all (Esc)"
        >
          <X className="w-3.5 h-3.5" weight="bold" />
        </button>
      </div>
    </div>,
    document.body
  )}

 {/* Add Tag Modal */}
  {isAddTagOpen && typeof document !== "undefined" && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-hidden">
      <div className="bg-bg-card rounded-xl w-full max-w-md max-h-[90vh] my-auto flex flex-col border border-border-subtle overflow-hidden">
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
        }} className="p-5 flex flex-col gap-4 bg-bg-card rounded-b-xl overflow-y-auto flex-1 min-h-0">
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
          {/* Copy Type (Optional) - Commented out since type is removed:
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
          </div> */}
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

          <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle mt-1">
            <button
              type="button"
              onClick={() => setIsAddTagOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Create Tag
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )}

  {/* Publish Modal */}
  {pageId && <PublishModal 
  isOpen={isPublishModalOpen}
  pageId={pageId}
  onClose={() => setIsPublishModalOpen(false)}
  onPublish={async (_env, _langCode) => {
  if (pageId) StoreService.refreshPageDetail(pageId);
  }}
  onPublishAll={async (_env, _languages) => {
  if (pageId) StoreService.refreshPageDetail(pageId);
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

  {/* Bulk Translate Page Modal */}
  <BulkTranslatePageModal
    isOpen={isBulkTranslateModalOpen}
    onClose={() => setIsBulkTranslateModalOpen(false)}
    pageId={pageId || ""}
    pageName={pageInfo.name}
    onComplete={() => {
      if (pageId) StoreService.refreshPageDetail(pageId);
    }}
  />

  {/* Deprecate Page Modal */}
  {showDeprecateModal && typeof document !== "undefined" && createPortal(
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) setShowDeprecateModal(false); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-hidden"
    >
      <div className="bg-bg-card border border-border-subtle rounded-xl max-w-md w-full max-h-[90vh] my-auto p-5 space-y-4 text-text-primary">
        <h3 className="text-base font-bold text-danger flex items-center gap-2">
          <Trash className="w-5 h-5" />
          Deprecate Page &quot;{pageInfo.name}&quot;
        </h3>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Are you sure you want to mark page <strong>{pageId}</strong> as <strong>Deprecated</strong>? Deprecated pages and their tags are preserved for historical audit trails, but won&apos;t be included in future deployments.
        </p>
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <button
            onClick={() => setShowDeprecateModal(false)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleDeprecatePage}
            className="btn-danger-solid"
          >
            Confirm Deprecation
          </button>
        </div>
      </div>
    </div>,
    document.body
  )}

  {/* Length Conflicts Modal */}
  <LengthConflictsModal
    isOpen={isLengthConflictsModalOpen}
    onClose={() => setIsLengthConflictsModalOpen(false)}
  />
  </div>
  );
}