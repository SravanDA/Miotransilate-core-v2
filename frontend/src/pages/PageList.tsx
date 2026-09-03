import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Link } from "react-router-dom";
import { 
  Plus, 
  MagnifyingGlass as Search, 
  UploadSimple, 
  FileCsv, 
  PencilSimple, 
  Trash, 
  Sparkle as Sparkles,
  CircleNotch,
  DownloadSimple
} from "@phosphor-icons/react";
import { StoreService } from "../store/StoreService";
import { Dropdown } from "../components/ui/Dropdown";
import { EmptyStateGraphic } from "../components/ui/EmptyStateGraphic";
import { StatusCompleted, StatusInProgress, StatusCanceled } from "../components/ui/LinearIcons";
import { BulkTranslatePageModal } from "../components/translation/BulkTranslatePageModal";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { parseUploadFiles, type InputFile } from "../utils/fileParser";
import type { Page } from "../types";

export function PageList() {
 const { user, can } = useAuth();
 const { toast } = useToast();
 const [pages, setPages] = useState<Page[]>([]);
 const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
 const [renameTarget, setRenameTarget] = useState<{ pageId: string; name: string } | null>(null);
 const [bulkTranslateTarget, setBulkTranslateTarget] = useState<{ pageId: string; name: string } | null>(null);
 
 useEffect(() => {
 StoreService.refreshPages();
 const load = () => {
 setPages(StoreService.getPages());
 setActiveLangs(StoreService.getActiveLanguages());
 };
 load();
 return StoreService.subscribe(load);
 }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsCreateModalOpen(false);
        setIsUploadModalOpen(false);
        setRenameTarget(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedPresetFilter, setSelectedPresetFilter] = useState<"all" | "incomplete" | "ready">("all");
  const [sortBy, setSortBy] = useState("coverage");
 
 const parentRef = useRef<HTMLDivElement>(null);

 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
 const [newPageId, setNewPageId] = useState("");
 const [newPageName, setNewPageName] = useState("");
 const [newModule, setNewModule] = useState("POS");

 const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
 const [uploadFiles, setUploadFiles] = useState<File[]>([]);
 const [isDragging, setIsDragging] = useState(false);
 const [uploadError, setUploadError] = useState("");
 const [isUploading, setIsUploading] = useState(false);

 // Compute coverage for all pages
 const pageMetrics = useMemo(() => {
 return pages.map(p => {
 const cov = StoreService.getPageCoverage(p.pageId);
 const totalTags = Object.values(cov)[0]?.total || 0;
 
 let totalApproved = 0;
 let possibleApproved = 0;
 
 activeLangs.forEach(l => {
 totalApproved += (cov[l.code]?.approved || 0);
 possibleApproved += totalTags;
 });

 return {
 ...p,
 coverageMap: cov,
 totalTags,
 overallCoverageScore: possibleApproved > 0 ? (totalApproved / possibleApproved) : 0
 };
 });
 }, [pages, activeLangs]);

  // Compute workspace macro coverage summary
  const macroSummary = useMemo(() => {
    let totalStrings = 0;
    pageMetrics.forEach(p => {
      totalStrings += p.totalTags;
    });

    const langMetrics = activeLangs.map(lang => {
      let approvedCount = 0;
      pageMetrics.forEach(p => {
        approvedCount += (p.coverageMap[lang.code]?.approved || 0);
      });

      const percent = totalStrings > 0 ? Math.round((approvedCount / totalStrings) * 100) : 0;
      return {
        code: lang.code,
        name: lang.name,
        approved: approvedCount,
        total: totalStrings,
        percent,
        isReady: percent === 100 && totalStrings > 0
      };
    });

    const readyPagesCount = pageMetrics.filter(p => p.totalTags > 0 && p.overallCoverageScore === 1).length;

    return {
      totalStrings,
      totalPages: pageMetrics.length,
      readyPagesCount,
      langMetrics
    };
  }, [pageMetrics, activeLangs]);

  const filteredPages = useMemo(() => {
    return pageMetrics.filter(page => {
      const matchesSearch = page.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        page.pageId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesModule = selectedModule === "All" || page.module === selectedModule;
      const matchesStatus = selectedStatus === "All" || page.status === selectedStatus;

      // Preset filter (all / incomplete / ready)
      let matchesPreset = true;
      if (selectedPresetFilter === "incomplete") {
        matchesPreset = page.totalTags === 0 || page.overallCoverageScore < 1;
      } else if (selectedPresetFilter === "ready") {
        matchesPreset = page.totalTags > 0 && page.overallCoverageScore === 1;
      }

      return matchesSearch && matchesModule && matchesStatus && matchesPreset;
    }).sort((a, b) => {
      if (sortBy === "coverage") {
        return b.overallCoverageScore - a.overallCoverageScore;
      }
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "tags") return b.totalTags - a.totalTags;
      return 0;
    });
  }, [pageMetrics, searchQuery, selectedModule, selectedStatus, selectedPresetFilter, sortBy]);

 const handleCreatePage = (e: React.FormEvent) => {
 e.preventDefault();
 if (!newPageId || !newPageName) return;

 StoreService.createPage({
 pageId: newPageId,
 name: newPageName,
 module: newModule,
 status: "Active",
 createdAt: new Date().toISOString()
 });

 setIsCreateModalOpen(false);
 setNewPageId("");
 setNewPageName("");
 };

 const rowVirtualizer = useVirtualizer({
 count: filteredPages.length,
 getScrollElement: () => parentRef.current,
 estimateSize: () => 44, // sleek row height
 overscan: 10,
 });

  const handleAddFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    setUploadFiles((prev) => {
      const existingNames = new Set(prev.map(f => f.name));
      const newItems = incoming.filter(f => !existingNames.has(f.name));
      return [...prev, ...newItems];
    });
    setUploadError("");
  };

  const handleRemoveFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadSampleCsv = () => {
    const sampleCsv = `PageId,PageName,Module,TagId,Type,English,Spanish,Arabic
SERSET,Service Settings,Service Settings,SERSET_SERVICE_NAME,General,Service Name,Nombre del servicio,اسم الخدمة
SERSET,Service Settings,Service Settings,SERSET_ADD_SERVICE,Button,Add Service,Agregar servicio,إضافة خدمة
CAMREW,Campaign & Rewards,Campaign & Rewards,CAMREW_REWARD_POINTS,General,Reward Points,Puntos de recompensa,نقاط المكافأة
CAMREW,Campaign & Rewards,Campaign & Rewards,CAMREW_SAVE,Button,Save,Guardar,حفظ`;

    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "miotranslate_sample_import.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    
    if (uploadFiles.length === 0) {
      setUploadError("Please select at least one file to upload.");
      return;
    }

    setIsUploading(true);
    
    try {
      const filePayloads: InputFile[] = await Promise.all(
        uploadFiles.map(async (file) => {
          const lower = file.name.toLowerCase();
          if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
            const buffer = await file.arrayBuffer();
            return { fileName: file.name, fileContent: buffer };
          } else {
            const text = await file.text();
            return { fileName: file.name, fileContent: text };
          }
        })
      );
      
      const result = await parseUploadFiles(filePayloads);
      const summary = await StoreService.bulkImportPages(result.pagesToUpload);
      
      setIsUploadModalOpen(false);
      setUploadFiles([]);
      toast(`Successfully imported ${summary.totalPages} page(s) with ${summary.totalTags} tags from ${result.summary.totalFiles} file(s)!`, { type: "success" });
    } catch (err: any) {
      console.error("File upload error:", err);
      setUploadError(err.message || "Failed to process the uploaded files. Please check the file format.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameTarget.name.trim()) return;
    await StoreService.updatePageName(renameTarget.pageId, renameTarget.name.trim());
    setRenameTarget(null);
  };

  return (
  <div className="flex flex-col gap-4 w-full">
  {/* Header */}
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
  <div>
  <h1 className="text-xl font-bold text-text-primary tracking-tight">Pages & Coverage</h1>
  <p className="text-[13px] text-text-tertiary mt-0.5">Manage, translate, and track deployment readiness across all product pages.</p>
  </div>
   {(can('PAGE_TAG_CREATE') || user?.roles?.includes('FN')) && (
     <div className="flex items-center gap-2 w-full sm:w-auto">
       <button 
         onClick={() => setIsUploadModalOpen(true)}
         className="btn-primary flex-1 sm:flex-none"
       >
         <UploadSimple className="w-3.5 h-3.5" weight="bold" />
         <span>Import Pages</span>
       </button>
       <button 
         onClick={() => setIsCreateModalOpen(true)}
         className="btn-secondary flex-1 sm:flex-none"
       >
         <Plus className="w-3.5 h-3.5" weight="bold" />
         <span>Add Page</span>
       </button>
      </div>
    )}
  </div>

  {/* Toolbar & Filter Tabs */}
  <div className="bg-bg-card p-2.5 rounded-xl border border-border-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 ">
    <div className="flex items-center gap-2 w-full md:w-auto">
      {/* Quick Filter Presets */}
      <div className="inline-flex p-0.5 bg-bg-main border border-border-subtle rounded-lg shrink-0 text-[12px] h-8 items-center">
        <button
          type="button"
          onClick={() => setSelectedPresetFilter("all")}
          className={`h-7 px-2.5 rounded-md font-medium text-[12px] inline-flex items-center justify-center transition-colors cursor-pointer outline-none ${
            selectedPresetFilter === "all" ? "bg-bg-card text-text-primary font-semibold " : "text-text-tertiary hover:text-text-primary"
          }`}
        >
          All ({pageMetrics.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedPresetFilter("incomplete")}
          className={`h-7 px-2.5 rounded-md font-medium text-[12px] inline-flex items-center justify-center transition-colors cursor-pointer outline-none ${
            selectedPresetFilter === "incomplete" ? "bg-bg-card text-text-primary font-semibold " : "text-text-tertiary hover:text-text-primary"
          }`}
        >
          In Progress ({pageMetrics.length - macroSummary.readyPagesCount})
        </button>
        <button
          type="button"
          onClick={() => setSelectedPresetFilter("ready")}
          className={`h-7 px-2.5 rounded-md font-medium text-[12px] inline-flex items-center justify-center transition-colors cursor-pointer outline-none ${
            selectedPresetFilter === "ready" ? "bg-bg-card text-emerald-500 font-semibold " : "text-text-tertiary hover:text-emerald-500"
          }`}
        >
          Ready ({macroSummary.readyPagesCount})
        </button>
      </div>

      <div className="relative flex-1 md:w-56 shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" weight="bold" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search pages..."
          className="w-full h-8 pl-8 pr-3 bg-bg-main border border-border-subtle rounded-lg text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-accent-blue outline-none transition-colors "
        />
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 md:flex items-center gap-2 w-full md:w-auto">
      <Dropdown
        value={selectedModule}
        onChange={setSelectedModule}
        className="w-full md:w-32"
        options={[
          { value: "All", label: "Module" },
          { value: "POS", label: "POS" },
          { value: "Cal", label: "Calendar" },
          { value: "Staff", label: "Staff" },
          { value: "CRM", label: "CRM" },
          { value: "Rpt", label: "Reporting" },
        ]}
      />

      <Dropdown
        value={selectedStatus}
        onChange={setSelectedStatus}
        className="w-full md:w-32"
        options={[
          { value: "All", label: "Status" },
          { value: "Active", label: "Active" },
          { value: "Deprecated", label: "Deprecated" },
        ]}
      />

      <Dropdown
        value={sortBy}
        onChange={setSortBy}
        className="w-full md:w-36 sm:col-span-1"
        options={[
          { value: "coverage", label: "Sort: Coverage" },
          { value: "name", label: "Sort: Name" },
          { value: "tags", label: "Sort: Tags" },
        ]}
      />
    </div>
  </div>

  {/* Rename Modal */}
  {renameTarget && typeof document !== "undefined" && createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-hidden">
      <div className="bg-bg-card rounded-xl w-full max-w-md max-h-[90vh] my-auto flex flex-col border border-border-subtle overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-sidebar">
          <h2 className="text-[14px] font-bold text-text-primary">Rename Page</h2>
          <button 
            type="button" 
            onClick={() => setRenameTarget(null)} 
            className="text-text-tertiary hover:text-text-primary cursor-pointer p-1 outline-none"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleRenameSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-tertiary uppercase">Page ID</label>
            <input
              type="text"
              disabled
              value={renameTarget.pageId}
              className="w-full h-8 px-2.5 bg-bg-main/50 border border-border-subtle rounded-md text-[13px] text-text-tertiary font-mono cursor-not-allowed"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-tertiary uppercase">Page Name</label>
            <input
              type="text"
              required
              autoFocus
              value={renameTarget.name}
              onChange={(e) => setRenameTarget({ ...renameTarget, name: e.target.value })}
              placeholder="Enter page name"
              className="w-full h-8 px-2.5 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary focus:border-accent-blue outline-none transition-colors"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )}

  {/* Table */}
  <div 
  className="bg-bg-card rounded-xl border border-border-subtle overflow-hidden flex flex-col "
  >
  <div 
    ref={parentRef}
    className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] w-full scroll-smooth" 
  >
  <table className="w-full min-w-[960px] text-left text-[13px] text-text-primary border-collapse">
  <thead className="bg-bg-sidebar border-b border-border-subtle text-[11px] uppercase font-bold text-text-tertiary tracking-wider sticky top-0 z-20 ">
  <tr>
  <th className="px-4 py-2.5 w-[240px] max-w-[240px] bg-bg-sidebar shrink-0">PAGE</th>
  <th className="px-4 py-2.5 w-[140px] max-w-[140px] bg-bg-sidebar shrink-0">MODULE</th>
  <th className="px-4 py-2.5 w-[80px] text-center bg-bg-sidebar shrink-0">TAGS</th>
  {activeLangs.map(lang => (
  <th key={lang.code} className="px-4 py-2.5 w-[100px] text-center bg-bg-sidebar shrink-0">{lang.name.toUpperCase()}</th>
  ))}
  <th className="px-4 py-2.5 w-[130px] text-right bg-bg-sidebar sticky right-0 z-30 border-l border-border-subtle shrink-0">STATUS</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-border-subtle">
  {filteredPages.length > 0 ? (
    <>
      {rowVirtualizer.getVirtualItems().length > 0 ? (
        <>
          {rowVirtualizer.getVirtualItems()[0].start > 0 && (
            <tr>
              <td colSpan={4 + activeLangs.length} style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px`, padding: 0, border: 0 }} />
            </tr>
          )}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const page = filteredPages[virtualRow.index];
            return (
              <tr 
              key={page.pageId} 
              className="hover:bg-bg-hover transition-colors h-[44px] group cursor-default"
              >
              <td className="px-4 py-2 font-medium w-[240px] max-w-[240px] shrink-0">
                <div className="flex items-center justify-between gap-2 group/title">
                  <Link to={`/pages/${page.pageId}`} title={page.name} className="text-text-primary group-hover/title:text-link font-semibold transition-colors truncate block outline-none text-[13px]">
                    {page.name}
                  </Link>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setBulkTranslateTarget({ pageId: page.pageId, name: page.name });
                      }}
                      className="opacity-0 group-hover/title:opacity-100 p-1 text-accent-blue hover:bg-accent-blue/10 rounded transition-all cursor-pointer outline-none shrink-0"
                      title="Bulk Translate All Languages"
                    >
                      <Sparkles className="w-3.5 h-3.5" weight="fill" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setRenameTarget({ pageId: page.pageId, name: page.name });
                      }}
                      className="opacity-0 group-hover/title:opacity-100 p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-all cursor-pointer outline-none shrink-0"
                      title="Rename Page"
                    >
                      <PencilSimple className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </td>
              <td className="px-4 py-2 text-text-secondary w-[140px] max-w-[140px] shrink-0 text-[12px]">
              <span className="truncate block" title={page.module}>{page.module}</span>
              </td>
              <td className="px-4 py-2 text-center w-[80px] shrink-0">
              <span className="text-[12px] font-mono text-text-secondary tabular-nums font-medium">
              {page.totalTags}
              </span>
              </td>
              {activeLangs.map(lang => {
              const cov = page.coverageMap[lang.code] || { approved: 0, total: page.totalTags };
              const isComplete = cov.total > 0 && cov.approved === cov.total;
              const hasProgress = cov.approved > 0;
              const pct = cov.total > 0 ? Math.round((cov.approved / cov.total) * 100) : 0;

              return (
              <td key={lang.code} className="px-4 py-2 text-center w-[100px] shrink-0">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span className={`text-[12px] font-mono tabular-nums ${
                    isComplete ? "text-emerald-500 font-bold" : hasProgress ? "text-text-primary font-medium" : "text-text-tertiary/60"
                  }`}>
                    {cov.approved}<span className="text-text-tertiary/40 mx-0.5">/</span>{cov.total}
                  </span>
                  {cov.total > 0 && !isComplete && hasProgress && (
                    <div className="w-10 h-0.5 bg-bg-main rounded-full overflow-hidden">
                      <div className="h-full bg-accent-blue rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              </td>
              );
              })}
              <td className="px-4 py-2 w-[130px] text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 border-l border-border-subtle transition-colors shrink-0">
              <div className="flex items-center justify-end gap-1.5 text-[12px] font-normal text-text-primary">
                {page.status === "Active" ? (
                  page.totalTags > 0 && page.overallCoverageScore === 1 ? (
                    <>
                      <StatusCompleted className="w-3.5 h-3.5 shrink-0" />
                      <span>Ready</span>
                    </>
                  ) : (
                    <>
                      <StatusInProgress className="w-3.5 h-3.5 shrink-0" />
                      <span>In Progress</span>
                    </>
                  )
                ) : (
                  <>
                    <StatusCanceled className="w-3.5 h-3.5 shrink-0" />
                    <span>Deprecated</span>
                  </>
                )}
              </div>
              </td>
              </tr>
            );
          })}
          {rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end > 0 && (
            <tr>
              <td colSpan={4 + activeLangs.length} style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px`, padding: 0, border: 0 }} />
            </tr>
          )}
        </>
      ) : (
        filteredPages.slice(0, 50).map((page) => (
          <tr 
          key={page.pageId} 
          className="hover:bg-bg-hover transition-colors h-[48px] group cursor-default"
          >
          <td className="px-4 py-2.5 font-medium w-[240px] max-w-[240px] shrink-0">
            <div className="flex items-center justify-between gap-2 group/title">
              <Link to={`/pages/${page.pageId}`} title={page.name} className="text-text-primary group-hover/title:text-link font-semibold transition-colors truncate block outline-none">
                {page.name}
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRenameTarget({ pageId: page.pageId, name: page.name });
                }}
                className="opacity-0 group-hover/title:opacity-100 p-1 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-all cursor-pointer outline-none shrink-0"
                title="Rename Page"
              >
                <PencilSimple className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
          <td className="px-4 py-2.5 text-text-secondary w-[140px] max-w-[140px] shrink-0">
          <span className="truncate block" title={page.module}>{page.module}</span>
          </td>
          <td className="px-4 py-2.5 text-center w-[80px] shrink-0">
          <span className="text-[13px] font-mono text-text-secondary tabular-nums font-medium">
          {page.totalTags}
          </span>
          </td>
          {activeLangs.map(lang => {
          const cov = page.coverageMap[lang.code] || { approved: 0, total: page.totalTags };
          const isComplete = cov.total > 0 && cov.approved === cov.total;
          return (
          <td key={lang.code} className="px-4 py-2.5 text-center w-[100px] shrink-0">
          <span className={`text-[12px] font-mono tabular-nums ${
            isComplete ? "text-success font-semibold" : cov.approved > 0 ? "text-text-primary font-medium" : "text-text-tertiary/60"
          }`}>
          {cov.approved}<span className="text-text-tertiary/40 mx-0.5">/</span>{cov.total}
          </span>
          </td>
          );
          })}
          <td className="px-4 py-2.5 w-[140px] text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
          <div className="flex items-center justify-end gap-2 text-[13px] font-normal text-text-primary">
            {(can('TRANSLATION_CREATE') || user?.roles?.includes('FN')) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setBulkTranslateTarget({ pageId: page.pageId, name: page.name }); }}
                className="p-1 text-text-tertiary hover:text-accent-blue hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
                title="Bulk Translate All Languages"
              >
                <Sparkles className="w-3.5 h-3.5" weight="bold" />
              </button>
            )}
            {page.status === "Active" ? (
              <>
                <StatusCompleted className="w-3.5 h-3.5 shrink-0" />
                <span>Active</span>
              </>
            ) : (
              <>
                <StatusCanceled className="w-3.5 h-3.5 shrink-0" />
                <span>Deprecated</span>
              </>
            )}
          </div>
          </td>
          </tr>
        ))
      )}
    </>
  ) : (
  <tr>
  <td colSpan={4 + activeLangs.length} className="px-6 py-16 text-center">
  <div className="flex flex-col items-center justify-center text-text-secondary">
  <EmptyStateGraphic className="w-28 h-28 mb-4 opacity-80" />
  <h3 className="text-[14px] font-bold text-text-primary mb-1">
  {pages.length === 0 ? "No modules yet" : "No results found"}
  </h3>
  <p className="text-[13px] text-text-tertiary mb-4">
  {pages.length === 0
  ? "Get started by registering your first page to track localization readiness across modules."
  : "Try adjusting your search query or filters to find what you're looking for."}
  </p>
  {pages.length === 0 && (
  <div className="flex gap-3">
  <button
  onClick={() => setIsCreateModalOpen(true)}
  className="btn-secondary"
  >
  <Plus className="w-3.5 h-3.5" weight="bold" />
  <span>Manual Module</span>
  </button>
  <button
  onClick={() => setIsUploadModalOpen(true)}
  className="btn-primary"
  >
  <UploadSimple className="w-3.5 h-3.5" weight="bold" />
  <span>Upload Pages</span>
  </button>
  </div>
  )}
  </div>
  </td>
  </tr>
  )}
  </tbody>
  </table>
  </div>
  </div>

  {/* Create Modal */}
  {isCreateModalOpen && typeof document !== "undefined" && createPortal(
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) setIsCreateModalOpen(false); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-hidden"
    >
      <div className="bg-bg-card rounded-xl w-full max-w-md flex flex-col border border-border-subtle max-h-[90vh] my-auto overflow-hidden">
        <div className="px-4 py-2 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-sidebar rounded-t-xl">
          <h2 className="text-[14px] font-bold text-text-primary">Create New Page</h2>
          <button onClick={() => setIsCreateModalOpen(false)} className="text-text-tertiary hover:text-text-primary cursor-pointer p-1 outline-none">✕</button>
        </div>
        <form onSubmit={handleCreatePage} className="p-5 flex flex-col gap-4 overflow-y-auto min-h-0 bg-bg-card rounded-b-xl">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-tertiary uppercase">Page ID</label>
            <input
              type="text"
              required
              placeholder="e.g., POS_QUICK_SALE"
              value={newPageId}
              onChange={(e) => setNewPageId(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              className="w-full h-8 px-2.5 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary font-mono focus:border-accent-blue outline-none transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-tertiary uppercase">Page Name</label>
            <input
              type="text"
              required
              placeholder="e.g., Quick Sale"
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              className="w-full h-8 px-2.5 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary focus:border-accent-blue outline-none transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-text-tertiary uppercase">Module</label>
            <Dropdown
              value={newModule}
              onChange={setNewModule}
              className="w-full"
              options={[
                { value: "POS", label: "POS" },
                { value: "CRM", label: "CRM" },
                { value: "Cal", label: "Calendar" },
                { value: "Staff", label: "Staff" },
                { value: "Rpt", label: "Reporting" },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle mt-1">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Create Page
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )}

  {/* Upload Modal */}
  {isUploadModalOpen && typeof document !== "undefined" && createPortal(
    <div 
      onClick={(e) => { 
        if (e.target === e.currentTarget && !isUploading) { 
          setIsUploadModalOpen(false); 
          setUploadFiles([]); 
          setUploadError(""); 
        } 
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-hidden"
    >
      <div className="bg-bg-card rounded-2xl w-full max-w-lg flex flex-col border border-border-subtle max-h-[90vh] my-auto overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-sidebar/40">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-accent-blue" />
            <h2 className="text-[14px] font-semibold text-text-primary tracking-tight">Bulk Import Pages & Tags</h2>
          </div>
          <button 
            type="button"
            onClick={() => { setIsUploadModalOpen(false); setUploadFiles([]); setUploadError(""); }} 
            className="text-text-tertiary hover:text-text-primary p-1 rounded-md hover:bg-white/[0.06] transition-colors cursor-pointer outline-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-6 flex flex-col gap-4 overflow-y-auto min-h-0 bg-bg-card">
              <div className="flex flex-col gap-2">
                <input 
                  id="bulk-file-upload" 
                  type="file" 
                  multiple
                  accept=".json,.csv,.tsv,.xls,.xlsx,.txt" 
                  className="hidden" 
                  onChange={(e) => {
                    handleAddFiles(e.target.files);
                    e.target.value = ""; // Reset for re-selection
                  }} 
                />

                {uploadFiles.length === 0 ? (
                  <div 
                    className={`relative w-full min-h-[220px] border border-dashed rounded-xl flex flex-col items-center justify-center p-6 transition-all duration-200 cursor-pointer outline-none group overflow-hidden ${
                      isDragging 
                        ? "border-accent-blue bg-accent-blue/10 -[inset_0_0_24px_rgba(94,106,210,0.15)]" 
                        : "border-border-strong/80 hover:border-accent-blue/60 bg-bg-main/80 hover:bg-bg-hover/80"
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files) {
                        handleAddFiles(e.dataTransfer.files);
                      }
                    }}
                    onClick={() => document.getElementById("bulk-file-upload")?.click()}
                  >
                    <EmptyStateGraphic className="w-24 h-24 mb-2 opacity-90 transition-transform duration-300 group-hover:scale-105" />
                    <p className="text-[13px] font-semibold text-text-primary tracking-tight mb-1">
                      Choose files or drag and drop here
                    </p>
                    <p className="text-[12px] text-text-tertiary mb-3 text-center">
                      Select one or multiple CSV, XLS, XLSX, or JSON files to bulk import
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap justify-center mb-3">
                      {["CSV", "XLS", "XLSX", "TSV", "JSON"].map((ext) => (
                        <span 
                          key={ext} 
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-text-tertiary bg-white/[0.03] border border-border-subtle/60"
                        >
                          {ext}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadSampleCsv();
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent-blue hover:text-accent-blue/80 hover:underline cursor-pointer outline-none bg-accent-blue/10 px-2.5 py-1 rounded-md transition-colors"
                    >
                      <DownloadSimple className="w-3.5 h-3.5" weight="bold" />
                      <span>Download Sample CSV Template</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Header Summary for Selected Files */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-text-primary">
                          {uploadFiles.length} {uploadFiles.length === 1 ? "file" : "files"} selected
                        </span>
                        <span className="text-text-tertiary text-[11px]">•</span>
                        <span className="text-[11px] text-text-tertiary font-mono">
                          {(uploadFiles.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB total
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => document.getElementById("bulk-file-upload")?.click()}
                          className="text-[11px] font-semibold text-link hover:underline inline-flex items-center gap-1 cursor-pointer outline-none"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add more</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setUploadFiles([])}
                          className="text-[11px] text-text-tertiary hover:text-danger cursor-pointer outline-none transition-colors"
                        >
                          Clear all
                        </button>
                      </div>
                    </div>

                    {/* Scrollable File Items */}
                    <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5 pr-1 -mr-1">
                      {uploadFiles.map((file, idx) => {
                        const ext = (file.name.split('.').pop() || "FILE").toUpperCase();
                        return (
                          <div 
                            key={`${file.name}-${idx}`}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-bg-main/80 border border-border-subtle hover:border-border-strong transition-all group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <div className="w-7 h-7 rounded-md bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center text-accent-blue shrink-0">
                                <FileCsv className="w-4 h-4" weight="duotone" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[12px] font-medium text-text-primary font-mono truncate" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-[10px] text-text-tertiary font-mono">
                                  {(file.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-bg-active text-text-secondary">
                                {ext}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(idx)}
                                className="p-1 text-text-tertiary hover:text-danger rounded hover:bg-danger/10 transition-colors cursor-pointer outline-none"
                                title="Remove file"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Drag and drop additional files footer */}
                    <div 
                      className={`border border-dashed rounded-lg p-2 text-center text-[11px] text-text-tertiary transition-colors cursor-pointer ${
                        isDragging ? "border-accent-blue bg-accent-blue/5 text-accent-blue" : "border-border-subtle hover:border-border-strong hover:bg-bg-hover/50"
                      }`}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files) {
                          handleAddFiles(e.dataTransfer.files);
                        }
                      }}
                      onClick={() => document.getElementById("bulk-file-upload")?.click()}
                    >
                      <span>Drop more files here or click to browse</span>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <p className="text-[12px] font-semibold text-danger mt-1.5 px-1 flex items-center gap-1.5">
                    <span>⚠</span> {uploadError}
                  </p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-subtle mt-1">
                <button
                  type="button"
                  onClick={() => { setIsUploadModalOpen(false); setUploadFiles([]); setUploadError(""); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadFiles.length === 0 || isUploading}
                  className="btn-primary disabled:opacity-50"
                >
                  {isUploading ? (
                    <CircleNotch className="w-3.5 h-3.5 animate-spin" weight="bold" />
                  ) : (
                    <UploadSimple className="w-3.5 h-3.5" weight="bold" />
                  )}
                  <span>{isUploading ? `Importing ${uploadFiles.length} file(s)...` : `Import ${uploadFiles.length > 0 ? `${uploadFiles.length} Files` : "Files"}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Translate Page Modal */}
      {bulkTranslateTarget && (
        <BulkTranslatePageModal
          isOpen={Boolean(bulkTranslateTarget)}
          onClose={() => setBulkTranslateTarget(null)}
          pageId={bulkTranslateTarget.pageId}
          pageName={bulkTranslateTarget.name}
          onComplete={() => {
            StoreService.refreshPages();
          }}
        />
      )}
  </div>
  );
}
