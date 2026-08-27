import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, FileText } from "lucide-react";
import { StoreService } from "../store/StoreService";
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPageId, setNewPageId] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [newModule, setNewModule] = useState("POS");

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

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Page List</h1>
          <p className="text-sm text-text-subtle mt-0.5">Browsable registry of all MioSalon pages & localization readiness</p>
        </div>
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Page
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-surface p-4 rounded border border-border-main flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex-1 max-w-md relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="w-full h-9 pl-9 pr-4 bg-surface border border-border-main rounded text-sm text-text-main placeholder:text-text-subtle focus:border-primary outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <select 
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none cursor-pointer"
          >
            <option value="All">Module ▾</option>
            <option value="POS">POS</option>
            <option value="Cal">Calendar</option>
            <option value="Staff">Staff</option>
            <option value="CRM">CRM</option>
            <option value="Rpt">Reporting</option>
          </select>

          <select 
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none cursor-pointer"
          >
            <option value="All">Status ▾</option>
            <option value="Active">Active</option>
            <option value="Deprecated">Deprecated</option>
          </select>

          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none cursor-pointer"
          >
            <option value="coverage">Sort: Coverage ▾</option>
            <option value="name">Sort: Name ▾</option>
            <option value="tags">Sort: Tags ▾</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded border border-border-main overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-main border-collapse">
            <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider">
              <tr>
                <th className="px-6 py-4 border-r border-border-main/50">PAGE</th>
                <th className="px-6 py-4 border-r border-border-main/50">MODULE</th>
                <th className="px-6 py-4 border-r border-border-main/50">TAGS</th>
                {activeLangs.map(lang => (
                  <th key={lang.code} className="px-6 py-4 border-r border-border-main/50">{lang.name.toUpperCase()}</th>
                ))}
                <th className="px-6 py-4">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {filteredPages.length > 0 ? (
                filteredPages.map((page) => (
                  <tr key={page.pageId} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 border-r border-border-main/50 font-bold">
                      <Link to={`/pages/${page.pageId}`} className="text-primary font-semibold hover:underline">
                        {page.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 text-text-muted">
                      {page.module}
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 font-bold text-text-main">
                      {page.totalTags}
                    </td>
                    {activeLangs.map(lang => {
                      const cov = page.coverageMap[lang.code] || { approved: 0, total: page.totalTags };
                      return (
                        <td key={lang.code} className="px-6 py-4 border-r border-border-main/50 font-mono text-text-muted">
                          {cov.approved} / {cov.total}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4">
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
                ))
              ) : (
                <tr>
                  <td colSpan={4 + activeLangs.length} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-text-subtle mb-3">
                        <FileText className="w-6 h-6 text-text-subtle" />
                      </div>
                      <h3 className="text-base font-bold text-text-main mb-1">
                        {pages.length === 0 ? "No pages registered yet" : "No matching pages found"}
                      </h3>
                      <p className="text-xs text-text-subtle mb-4">
                        {pages.length === 0
                          ? "Get started by registering your first page to track localization readiness across modules."
                          : "Try adjusting your search query or filters to find what you're looking for."}
                      </p>
                      {pages.length === 0 && (
                        <button
                          onClick={() => setIsCreateModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Create First Page
                        </button>
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
                <select
                  value={newModule}
                  onChange={(e) => setNewModule(e.target.value)}
                  className="w-full h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none cursor-pointer"
                >
                  <option value="POS">POS</option>
                  <option value="CRM">CRM</option>
                  <option value="Cal">Calendar</option>
                  <option value="Staff">Staff</option>
                  <option value="Rpt">Reporting</option>
                </select>
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
    </div>
  );
}
