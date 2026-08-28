import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass as Search, Globe, Stack as Layers, Plus, Pulse } from "@phosphor-icons/react";
import { StoreService } from "../store/StoreService";
import { Dropdown } from "../components/ui/Dropdown";

export function CoverageDashboard() {
  const [registeredPages, setRegisteredPages] = useState(StoreService.getPages());
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());

  useEffect(() => {
    StoreService.refreshPages();
    const load = () => {
      setRegisteredPages(StoreService.getPages());
      setActiveLangs(StoreService.getActiveLanguages());
    };
    load();
    return StoreService.subscribe(load);
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModule, setSelectedModule] = useState("All");

  const pageMetrics = useMemo(() => {
    return registeredPages.map(p => {
      const cov = StoreService.getPageCoverage(p.pageId);
      const totalTags = Object.values(cov)[0]?.total || 0;
      return {
        ...p,
        coverageMap: cov,
        totalTags
      };
    });
  }, [registeredPages, activeLangs]);

  const metrics = useMemo(() => {
    let totalStrings = 0;
    
    pageMetrics.forEach(p => totalStrings += p.totalTags);
    
    return activeLangs.map(lang => {
      let approvedCount = 0;
      pageMetrics.forEach(p => {
        approvedCount += (p.coverageMap[lang.code]?.approved || 0);
      });
      
      const pct = totalStrings > 0 ? Math.round((approvedCount / totalStrings) * 100) : 0;
      
      return {
        label: `${lang.name} Coverage`,
        val: `${pct}%`,
        sub: `${approvedCount} / ${totalStrings} approved`,
        color: pct >= 90 ? "text-emerald-600 dark:text-emerald-400" : pct >= 60 ? "text-blue-600 dark:text-blue-400" : pct > 0 ? "text-amber-600 dark:text-amber-400" : "text-text-main",
        badge: pct >= 90 ? "Production Ready" : pct >= 60 ? "In Review" : pct > 0 ? "Translating" : "No Data",
        badgeBg: pct >= 90 ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : pct >= 60 ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" : pct > 0 ? "bg-amber-500/10 text-amber-600 border border-amber-500/20" : "bg-surface-active text-text-subtle border border-border-main/50"
      };
    });
  }, [pageMetrics, activeLangs]);

  const filteredPages = useMemo(() => {
    return pageMetrics.filter(p => {
      const matchModule = selectedModule === "All" || p.module === selectedModule;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.pageId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchModule && matchSearch;
    });
  }, [pageMetrics, selectedModule, searchQuery]);

  const renderProgressBar = (percent: number) => {
    const getBarColor = () => {
      if (percent >= 90) return "bg-emerald-500";
      if (percent >= 60) return "bg-blue-500";
      if (percent > 0) return "bg-amber-500";
      return "bg-border-main/60";
    };

    return (
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-text-muted tracking-wider">{percent >= 90 ? "READY" : percent >= 60 ? "REVIEW" : percent > 0 ? "WIP" : "EMPTY"}</span>
          <span className="text-text-main">{percent}%</span>
        </div>
        <div className="w-full bg-surface-active rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${getBarColor()}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Coverage Dashboard</h1>
          <p className="text-sm text-text-subtle mt-0.5">
            Monitor translation readiness across all pages and active languages.
          </p>
        </div>
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border-main text-[11px] font-bold rounded-md transition-colors shadow-xs text-text-main active:scale-[0.98]"
        >
          <Globe className="w-3.5 h-3.5 text-primary" weight="bold" />
          Manage Languages
        </Link>
      </div>

      {/* Language Coverage Cards (Horizontal Scroll for 1 viewport) */}
      <div className="flex overflow-x-auto gap-4 pb-2 shrink-0 snap-x hide-scrollbar">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="bg-surface border border-border-main rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all hover:border-primary/40 hover:shadow-md min-h-[100px] min-w-[220px] snap-start"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider truncate">
                {m.label}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${m.badgeBg}`}>
                {m.badge}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-auto">
              <span className={`text-2xl font-bold tracking-tight leading-none ${m.color}`}>
                {m.val}
              </span>
              <span className="text-[11px] text-text-subtle font-medium truncate">
                {m.sub}
              </span>
            </div>
          </div>
        ))}
        {metrics.length === 0 && (
          <div className="w-full p-4 text-center text-sm text-text-muted font-medium">
            No active languages to display metrics for.
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-surface border border-border-main rounded-xl shadow-xs overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Table Toolbar */}
        <div className="p-3 border-b border-border-main/60 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            <Pulse className="w-4 h-4 text-text-muted" weight="bold" />
            <h2 className="text-[11px] font-bold text-text-main uppercase tracking-wider">
              Translation Readiness Matrix
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-subtle pointer-events-none" weight="bold" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter pages..."
                className="w-full h-8 pl-8 pr-3 bg-surface-hover hover:bg-surface-active border border-border-main/50 rounded-lg text-xs font-medium text-text-main placeholder:text-text-subtle focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
              />
            </div>
            <Dropdown
              value={selectedModule}
              onChange={setSelectedModule}
              className="w-36"
              options={[
                { value: "All", label: "All Modules" },
                { value: "POS", label: "POS" },
                { value: "Cal", label: "Calendar" },
                { value: "Staff", label: "Staff" },
                { value: "CRM", label: "CRM" },
                { value: "Rpt", label: "Reporting" },
              ]}
            />
          </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-hover/40 border-b border-border-main/60">
              <tr>
                <th className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider border-r border-border-main/40 min-w-[200px]">Page Location</th>
                <th className="px-4 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider border-r border-border-main/40 w-24 text-center">String Count</th>
                {activeLangs.map(lang => (
                  <th key={lang.code} className="px-5 py-3 text-[10px] uppercase font-bold text-text-muted tracking-wider border-r border-border-main/40 min-w-[160px]">{lang.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main/40">
              {filteredPages.length > 0 ? (
                filteredPages.map((item) => (
                  <tr key={item.pageId} className="group hover:bg-surface-hover/40 transition-colors">
                    <td className="px-5 py-4 border-r border-border-main/40 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <Link 
                          to={`/pages/${item.pageId}`} 
                          className="text-[13px] font-bold text-text-main hover:text-primary transition-colors truncate"
                        >
                          {item.name}
                        </Link>
                        <span className="text-[11px] text-text-subtle font-medium">{item.module}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 border-r border-border-main/40 align-middle text-center">
                      <span className="inline-flex items-center justify-center min-w-[2rem] h-6 bg-surface-active rounded text-[11px] font-bold text-text-main border border-border-main/50">
                        {item.totalTags}
                      </span>
                    </td>
                    {activeLangs.map(lang => {
                      const cov = item.coverageMap[lang.code] || { approved: 0, total: item.totalTags };
                      const pct = cov.total > 0 ? Math.round((cov.approved / cov.total) * 100) : 0;
                      return (
                        <td key={lang.code} className="px-5 py-4 border-r border-border-main/40 align-middle">
                          {renderProgressBar(pct)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2 + activeLangs.length} className="px-5 py-24 text-center">
                    <div className="flex flex-col items-center justify-center text-text-muted">
                      <div className="w-12 h-12 rounded-full bg-surface-active flex items-center justify-center mb-4">
                        <Layers className="w-6 h-6 text-text-muted/70" weight="fill" />
                      </div>
                      <h3 className="text-sm font-bold text-text-main mb-1">
                        {registeredPages.length === 0 ? "No pages registered" : "No matching pages found"}
                      </h3>
                      {registeredPages.length === 0 && (
                        <Link
                          to="/pages"
                          className="mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary text-white text-[11px] font-bold rounded-md hover:bg-primary-hover transition-colors shadow-xs active:scale-[0.98]"
                        >
                          <Plus className="w-3.5 h-3.5" weight="bold" />
                          <span>Go to Content</span>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Legend */}
        <div className="px-5 py-2.5 border-t border-border-main/60 flex flex-wrap items-center justify-between gap-4 text-[11px] font-bold text-text-subtle bg-surface-hover/30 shrink-0">
          <span>Showing {filteredPages.length} of {registeredPages.length} pages</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              ≥90% Ready
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              60-89% In Review
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              &lt;60% Translating
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
