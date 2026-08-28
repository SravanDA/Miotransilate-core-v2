import { useState, useMemo, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Link } from "react-router-dom";
import { Plus, MagnifyingGlass as Search, FileText, UploadSimple, Tray, FileCsv } from "@phosphor-icons/react";
import { StoreService } from "../store/StoreService";
import { Dropdown } from "../components/ui/Dropdown";
import type { Page } from "../types";

export function PageList() {
  const [pages, setPages] = useState<Page[]>([]);
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
  
  useEffect(() => {
    StoreService.refreshPages();
    const load = () => {
      setPages(StoreService.getPages());
      setActiveLangs(StoreService.getActiveLanguages());
    };
    load();
    return StoreService.subscribe(load);
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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState("");

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
    estimateSize: () => 53, // rough height of table row
    overscan: 10,
  });

  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");
    
    if (!uploadFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    
    try {
      const fileContent = await uploadFile.text();
      
      const pagesToUpload = await new Promise<any[]>((resolve, reject) => {
        // Instantiate the worker
        const worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = (event) => {
          if (event.data.success) {
            resolve(event.data.pagesToUpload);
          } else {
            reject(new Error(event.data.error));
          }
          worker.terminate();
        };

        worker.onerror = () => {
          reject(new Error("Worker error during file parsing"));
          worker.terminate();
        };

        // Post data to worker
        worker.postMessage({
          fileContent,
          fileName: uploadFile.name
        });
      });
      
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
              type: t.type || "Label",
              english: t.english || "",
              englishVersion: 1,
              values: {},
              comments: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
      
      StoreService.refreshPages();
      setIsUploadModalOpen(false);
      setUploadFile(null);
    } catch (err: any) {
      setUploadError(err.message || "Failed to process the uploaded file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Page List</h1>
          <p className="text-sm text-text-subtle mt-0.5">Browsable registry of all MioSalon pages & localization readiness</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface text-text-main border border-border-main text-sm font-bold rounded hover:bg-surface-hover transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" weight="bold" />
            <span>Add Module</span>
          </button>
          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
          >
            <UploadSimple className="w-4 h-4" weight="bold" />
            <span>Upload Pages</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-surface p-4 rounded border border-border-main flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle pointer-events-none" weight="bold" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full h-9 pl-9 pr-4 bg-surface border border-border-main rounded text-sm text-text-main placeholder:text-text-subtle focus:border-primary outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Dropdown
            value={selectedModule}
            onChange={setSelectedModule}
            className="w-32"
            options={[
              { value: "All", label: "Module ▾" },
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
            className="w-32"
            options={[
              { value: "All", label: "Status ▾" },
              { value: "Active", label: "Active" },
              { value: "Deprecated", label: "Deprecated" },
            ]}
          />

          <Dropdown
            value={sortBy}
            onChange={setSortBy}
            className="w-40"
            options={[
              { value: "coverage", label: "Sort: Coverage ▾" },
              { value: "name", label: "Sort: Name ▾" },
              { value: "tags", label: "Sort: Tags ▾" },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div 
        className="bg-surface rounded border border-border-main shadow-sm overflow-hidden flex flex-col"
      >
        <div 
          ref={parentRef}
          className="overflow-auto custom-scrollbar" 
          style={{ height: '600px' }}
        >
          <table className="w-full text-left text-sm text-text-main border-collapse table-fixed">
            <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 border-r border-border-main/50 w-[200px]">PAGE</th>
                <th className="px-6 py-4 border-r border-border-main/50 w-[150px]">MODULE</th>
                <th className="px-6 py-4 border-r border-border-main/50 w-[100px]">TAGS</th>
                {activeLangs.map(lang => (
                  <th key={lang.code} className="px-6 py-4 border-r border-border-main/50 w-[120px]">{lang.name.toUpperCase()}</th>
                ))}
                <th className="px-6 py-4 w-[120px]">STATUS</th>
              </tr>
            </thead>
            <tbody 
              className="divide-y divide-border-main"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {filteredPages.length > 0 ? (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const page = filteredPages[virtualRow.index];
                  return (
                  <tr 
                    key={virtualRow.index} 
                    className="hover:bg-surface-hover transition-colors absolute top-0 left-0 w-full flex items-center"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <td className="px-6 border-r border-border-main/50 font-bold w-[200px] h-full flex items-center">
                      <Link to={`/pages/${page.pageId}`} className="text-primary font-semibold hover:underline truncate">
                        {page.name}
                      </Link>
                    </td>
                    <td className="px-6 border-r border-border-main/50 text-text-muted w-[150px] h-full flex items-center">
                      {page.module}
                    </td>
                    <td className="px-6 border-r border-border-main/50 font-bold text-text-main w-[100px] h-full flex items-center">
                      {page.totalTags}
                    </td>
                    {activeLangs.map(lang => {
                      const cov = page.coverageMap[lang.code] || { approved: 0, total: page.totalTags };
                      return (
                        <td key={lang.code} className="px-6 border-r border-border-main/50 font-mono text-text-muted w-[120px] h-full flex items-center">
                          {cov.approved} / {cov.total}
                        </td>
                      );
                    })}
                    <td className="px-6 w-[120px] h-full flex items-center">
                      {page.status === "Active" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#E3FCEF] text-[#006644] border border-[#ABF5D1]">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F4F5F7] text-[#5E6C84] border border-[#DFE1E6]">
                          Depr.
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4 + activeLangs.length} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-text-muted">
                      <div className="w-12 h-12 bg-surface-active rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-text-muted/70" weight="fill" />
                      </div>
                      <h3 className="text-sm font-bold text-text-main mb-1">
                        {pages.length === 0 ? "No modules yet" : "No results found"}
                      </h3>
                      <p className="text-xs text-text-subtle mb-4">
                        {pages.length === 0
                          ? "Get started by registering your first page to track localization readiness across modules."
                          : "Try adjusting your search query or filters to find what you're looking for."}
                      </p>
                      {pages.length === 0 && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface text-text-main border border-border-main text-xs font-bold rounded hover:bg-surface-hover transition-colors shadow-sm cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            Manual Module
                          </button>
                          <button
                            onClick={() => setIsUploadModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091E42]/50 p-4">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-md flex flex-col border border-border-main">
            <div className="px-6 py-4 border-b border-border-main flex items-center justify-between">
              <h2 className="text-base font-bold text-text-main">Create New Page</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-text-subtle hover:text-text-main cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCreatePage} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-muted uppercase">Page ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., POS_QUICK_SALE"
                  value={newPageId}
                  onChange={(e) => setNewPageId(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  className="w-full h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main font-mono focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-muted uppercase">Page Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Quick Sale"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  className="w-full h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-muted uppercase">Module</label>
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

              <div className="flex justify-end gap-3 pt-3 border-t border-border-main">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-text-muted hover:bg-surface-hover rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-hover shadow-sm cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091E42]/50 p-4">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-2xl flex flex-col border border-border-main">
            <div className="px-6 py-4 border-b border-border-main flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-text-main">Upload Pages & Tags</h2>
                <p className="text-xs text-text-subtle mt-0.5">Upload a .json or .csv file for single or bulk page ingestion.</p>
              </div>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-text-subtle hover:text-text-main cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleUpload} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div 
                  className={`relative w-full h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors cursor-pointer ${
                    isDragging ? "border-primary bg-primary/5" : "border-border-main hover:border-primary/50 bg-surface hover:bg-surface-hover"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setUploadFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <input 
                    id="file-upload" 
                    type="file" 
                    accept=".json,.csv" 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                      }
                    }} 
                  />
                  
                  {uploadFile ? (
                    <div className="flex flex-col items-center text-center">
                      <FileCsv className="w-10 h-10 text-primary mb-2" weight="duotone" />
                      <p className="text-sm font-bold text-text-main">{uploadFile.name}</p>
                      <p className="text-xs text-text-subtle mt-1">{(uploadFile.size / 1024).toFixed(2)} KB</p>
                      <button 
                        type="button" 
                        onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                        className="mt-3 text-xs font-bold text-[#BF2600] hover:underline"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center">
                      <div className="w-12 h-12 bg-surface-active rounded-full flex items-center justify-center mb-3">
                        <Tray className="w-6 h-6 text-text-muted" weight="bold" />
                      </div>
                      <p className="text-sm font-bold text-text-main mb-1">Click to upload or drag and drop</p>
                      <p className="text-xs text-text-subtle">Supports .JSON or .CSV</p>
                    </div>
                  )}
                </div>
                
                {uploadError && (
                  <p className="text-xs font-bold text-[#BF2600] mt-2">{uploadError}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-main mt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-text-muted hover:bg-surface-hover rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || isUploading}
                  className="px-4 py-2 bg-primary disabled:opacity-50 text-white text-sm font-bold rounded hover:bg-primary-hover shadow-sm cursor-pointer inline-flex items-center gap-2"
                >
                  <UploadSimple className={`w-4 h-4 ${isUploading ? 'animate-bounce' : ''}`} weight="bold" />
                  <span>{isUploading ? "Processing..." : "Process Upload"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
