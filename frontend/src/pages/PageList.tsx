import { useState, useMemo, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Link } from "react-router-dom";
import { Plus, MagnifyingGlass as Search, UploadSimple, FileCsv, PencilSimple, Trash } from "@phosphor-icons/react";
import { StoreService } from "../store/StoreService";
import { Dropdown } from "../components/ui/Dropdown";
import { EmptyStateGraphic } from "../components/ui/EmptyStateGraphic";
import { StatusCompleted, StatusCanceled } from "../components/ui/LinearIcons";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import type { Page } from "../types";

export function PageList() {
 const { user, can } = useAuth();
 const { toast } = useToast();
 const [pages, setPages] = useState<Page[]>([]);
 const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
 const [renameTarget, setRenameTarget] = useState<{ pageId: string; name: string } | null>(null);
 
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

 const filteredPages = useMemo(() => {
 return pageMetrics.filter(page => {
 const matchesSearch = page.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
 page.pageId.toLowerCase().includes(searchQuery.toLowerCase());
 const matchesModule = selectedModule === "All" || page.module === selectedModule;
 const matchesStatus = selectedStatus === "All" || page.status === selectedStatus;
 return matchesSearch && matchesModule && matchesStatus;
 }).sort((a, b) => {
 if (sortBy === "coverage") {
 return b.overallCoverageScore - a.overallCoverageScore;
 }
 if (sortBy === "name") return a.name.localeCompare(b.name);
 if (sortBy === "tags") return b.totalTags - a.totalTags;
 return 0;
 });
 }, [pageMetrics, searchQuery, selectedModule, selectedStatus, sortBy]);

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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    
    if (uploadFiles.length === 0) {
      setUploadError("Please select at least one file to upload.");
      return;
    }

    setIsUploading(true);
    
    try {
      const filePayloads = await Promise.all(
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
      
      const result = await new Promise<{
        pagesToUpload: any[];
        summary: { totalFiles: number; totalPages: number; totalTags: number };
      }>((resolve, reject) => {
        const worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = (event) => {
          if (event.data.success) {
            resolve({
              pagesToUpload: event.data.pagesToUpload,
              summary: event.data.summary
            });
          } else {
            reject(new Error(event.data.error));
          }
          worker.terminate();
        };

        worker.onerror = () => {
          reject(new Error("Worker error during file parsing"));
          worker.terminate();
        };

        worker.postMessage({ files: filePayloads });
      });

      const { pagesToUpload, summary } = result;
      
      for (const p of pagesToUpload) {
        if (!p.pageId || !p.name || !p.module) {
          throw new Error(`Invalid format. Missing required fields in page: ${p.pageId}`);
        }
      }

      for (const p of pagesToUpload) {
        await StoreService.createPage({
          pageId: p.pageId,
          name: p.name,
          module: p.module,
          status: p.status || "Active",
          createdAt: new Date().toISOString()
        });

        if (p.tags && Array.isArray(p.tags)) {
          for (const t of p.tags) {
            await StoreService.createTag(p.pageId, {
              id: t.id,
              pageId: p.pageId,
              type: t.type || "General",
              english: t.english || "",
              englishStatus: t.english ? "Approved" : "Draft",
              englishVersion: 1,
              values: t.values || {},
              comments: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
      
      await StoreService.refreshPages();
      setIsUploadModalOpen(false);
      setUploadFiles([]);
      toast(`Successfully imported ${summary.totalPages} page(s) with ${summary.totalTags} tags from ${summary.totalFiles} file(s)!`, { type: "success" });
    } catch (err: any) {
      setUploadError(err.message || "Failed to process the uploaded files.");
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
 <div className="flex flex-col gap-4 w-full ">
 {/* Header */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div>
 <h1 className="text-xl font-bold text-text-primary tracking-tight">Pages</h1>
 <p className="text-[13px] text-text-tertiary mt-0.5">Manage and track localization coverage across all MioSalon product pages.</p>
 </div>
  {(can('PAGE_TAG_CREATE') || user?.roles?.includes('FN')) && (
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <button 
        onClick={() => setIsCreateModalOpen(true)}
        className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-bg-card text-text-primary border border-border-strong text-[13px] font-medium rounded-md hover:bg-bg-hover transition-colors cursor-pointer outline-none active:scale-[0.99]"
      >
        <Plus className="w-4 h-4" weight="bold" />
        <span>Add Page</span>
      </button>
      <button 
        onClick={() => setIsUploadModalOpen(true)}
        className="flex-1 sm:flex-none justify-center inline-flex items-center gap-1.5 px-3 py-2 bg-accent-blue text-white text-[13px] font-medium rounded-md hover:brightness-110 transition-colors cursor-pointer outline-none active:scale-[0.99]"
      >
        <UploadSimple className="w-4 h-4" weight="bold" />
        <span>Import Pages</span>
      </button>
      {/* Rename Modal */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-card rounded-xl w-full max-w-md flex flex-col border border-border-subtle shadow-2xl overflow-hidden">
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
            <form onSubmit={handleRenameSubmit} className="p-5 flex flex-col gap-4">
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
                  className="px-3.5 py-1.5 text-[12px] font-medium text-text-secondary hover:text-text-primary rounded-md border border-border-subtle hover:bg-bg-hover transition-colors cursor-pointer outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-[12px] font-medium text-white bg-accent-blue hover:brightness-110 rounded-md transition-colors cursor-pointer shadow-xs outline-none"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )}
 </div>

 {/* Toolbar */}
 <div className="bg-bg-card p-3 rounded-xl border border-border-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
 <div className="relative w-full md:w-64 shrink-0">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" weight="bold" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search pages..."
 className="w-full h-9 pl-8 pr-3 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent-blue outline-none transition-colors"
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-3 md:flex items-center gap-2.5 w-full md:w-auto">
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

  {/* Table */}
  <div 
  className="bg-bg-card rounded-xl border border-border-subtle overflow-hidden flex flex-col shadow-xs"
  >
  <div 
    ref={parentRef}
    className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] w-full scroll-smooth" 
  >
  <table className="w-full min-w-[960px] text-left text-[13px] text-text-primary border-collapse">
  <thead className="bg-bg-sidebar border-b border-border-subtle text-[11px] uppercase font-bold text-text-tertiary tracking-wider sticky top-0 z-20 shadow-xs">
  <tr>
  <th className="px-4 py-2.5 w-[240px] max-w-[240px] bg-bg-sidebar shrink-0">PAGE</th>
  <th className="px-4 py-2.5 w-[140px] max-w-[140px] bg-bg-sidebar shrink-0">MODULE</th>
  <th className="px-4 py-2.5 w-[80px] text-center bg-bg-sidebar shrink-0">TAGS</th>
  {activeLangs.map(lang => (
  <th key={lang.code} className="px-4 py-2.5 w-[100px] text-center bg-bg-sidebar shrink-0">{lang.name.toUpperCase()}</th>
  ))}
  <th className="px-4 py-2.5 w-[120px] text-right bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">STATUS</th>
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
              <td className="px-4 py-2.5 w-[120px] text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
              <div className="flex items-center justify-end gap-1.5 text-[13px] font-normal text-text-primary">
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
          <td className="px-4 py-2.5 w-[120px] text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
          <div className="flex items-center justify-end gap-1.5 text-[13px] font-normal text-text-primary">
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
  className="inline-flex items-center gap-1.5 px-4 py-2 bg-bg-card text-text-primary border border-border-strong text-[13px] font-medium rounded hover:bg-bg-hover transition-colors cursor-pointer outline-none"
  >
  <Plus className="w-4 h-4" />
  Manual Module
  </button>
  <button
  onClick={() => setIsUploadModalOpen(true)}
  className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-blue text-white text-[13px] font-medium rounded hover:brightness-110 transition-colors cursor-pointer outline-none"
  >
  <UploadSimple className="w-4 h-4" />
  Upload Pages
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
  {isCreateModalOpen && (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) setIsCreateModalOpen(false); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="bg-bg-card rounded-xl w-full max-w-md flex flex-col border border-border-subtle max-h-[calc(100vh-2rem)] overflow-hidden shadow-2xl">
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

          <div className="flex justify-end gap-2.5 pt-4 border-t border-border-subtle mt-1">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3.5 py-1.5 text-[13px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 bg-accent-blue text-white text-[13px] font-medium rounded-md hover:brightness-110 transition-colors cursor-pointer outline-none"
            >
              Create Page
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

  {/* Upload Modal */}
  {isUploadModalOpen && (
    <div 
      onClick={(e) => { 
        if (e.target === e.currentTarget && !isUploading) { 
          setIsUploadModalOpen(false); 
          setUploadFiles([]); 
          setUploadError(""); 
        } 
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150"
    >
      <div className="bg-bg-card rounded-2xl w-full max-w-lg flex flex-col border border-border-subtle max-h-[calc(100vh-2rem)] overflow-hidden shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.06)]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between shrink-0 bg-bg-sidebar/40">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-accent-blue shadow-[0_0_8px_rgba(94,106,210,0.8)]" />
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
                        ? "border-accent-blue bg-accent-blue/10 shadow-[inset_0_0_24px_rgba(94,106,210,0.15)]" 
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
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      {["CSV", "XLS", "XLSX", "TSV", "JSON"].map((ext) => (
                        <span 
                          key={ext} 
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-text-tertiary bg-white/[0.03] border border-border-subtle/60"
                        >
                          {ext}
                        </span>
                      ))}
                    </div>
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
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border-subtle mt-1">
                <button
                  type="button"
                  onClick={() => { setIsUploadModalOpen(false); setUploadFiles([]); setUploadError(""); }}
                  className="px-3.5 py-1.5 text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors cursor-pointer outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadFiles.length === 0 || isUploading}
                  className="px-4 py-1.5 bg-accent-blue disabled:opacity-50 text-white text-[12px] font-medium rounded-md hover:brightness-110 transition-all cursor-pointer inline-flex items-center gap-2 shadow-xs active:scale-[0.98] outline-none"
                >
                  <UploadSimple className={`w-3.5 h-3.5 ${isUploading ? 'animate-bounce' : ''}`} weight="bold" />
                  <span>{isUploading ? `Importing ${uploadFiles.length} file(s)...` : `Import ${uploadFiles.length > 0 ? `${uploadFiles.length} Files` : "Files"}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 </div>
 );
}
