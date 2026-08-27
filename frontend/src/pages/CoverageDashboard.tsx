import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Globe, Layers, Plus } from "lucide-react";
import { StoreService } from "../store/StoreService";

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
    // Generate metrics for top 4 active languages, or pad with empty if fewer
    const topLangs = activeLangs.slice(0, 4);
    let totalStrings = 0;
    
    pageMetrics.forEach(p => totalStrings += p.totalTags);
    
    return topLangs.map(lang => {
      let approvedCount = 0;
      pageMetrics.forEach(p => {
        approvedCount += (p.coverageMap[lang.code]?.approved || 0);
      });
      
      const pct = totalStrings > 0 ? Math.round((approvedCount / totalStrings) * 100) : 0;
      
      return {
        label: `${lang.name.toUpperCase()} COVERAGE`,
        val: `${pct}%`,
        sub: `${approvedCount} / ${totalStrings} approved`,
        color: pct >= 90 ? "text-[#36B37E] dark:text-[#57D9A3]" : pct >= 60 ? "text-primary dark:text-[#4C9AFF]" : pct > 0 ? "text-[#FF8B00] dark:text-[#FFAB00]" : "text-text-main",
        badge: pct >= 90 ? "Production Ready" : pct >= 60 ? "In Review" : pct > 0 ? "Translating" : "No Data",
        badgeBg: pct >= 90 ? "bg-[#E3FCEF] text-[#006644] border border-[#ABF5D1]" : pct >= 60 ? "bg-[#DEEBFF] text-[#0747A6] border border-[#B3D4FF]" : pct > 0 ? "bg-[#FFF0B3] text-[#172B4D] border border-[#FFE380]" : "bg-surface-active text-text-subtle"
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
      if (percent >= 90) return "bg-[#36B37E]";
      if (percent >= 60) return "bg-[#0052CC]";
      if (percent > 0) return "bg-[#FFAB00]";
      return "bg-transparent";
    };

    return (
      <div className="flex items-center gap-3 w-full">
        <div className="flex-1 bg-border-main/50 dark:bg-white/10 rounded-full h-2 overflow-hidden min-w-[70px]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${getBarColor()}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="font-mono text-xs font-semibold w-9 text-right text-text-main">
          {percent}%
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-main">Coverage Dashboard</h1>
          <p className="text-sm text-text-subtle mt-0.5">
            Monitor translation readiness across all pages and active languages
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-surface hover:bg-surface-hover border border-border-main text-xs font-bold rounded transition-colors cursor-pointer shadow-sm text-text-main"
          >
            <Globe className="w-3.5 h-3.5 text-primary" />
            Manage Languages
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div 
        className="w-full"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1rem"
        }}
      >
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="bg-surface border border-border-main rounded-xl p-5 shadow-sm flex flex-col justify-between transition-all hover:border-primary/40 min-h-[115px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                {m.label}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.badgeBg}`}>
                {m.badge}
              </span>
            </div>
            <div className="my-1">
              <span className={`text-3xl font-bold ${m.color}`}>
                {m.val}
              </span>
            </div>
            <div className="text-xs text-text-subtle font-medium">
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-border-main rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border-main flex flex-wrap items-center justify-between gap-4 bg-surface">
          <div>
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider">
              TRANSLATION READINESS MATRIX
            </h2>
            <p className="text-[11px] text-text-subtle mt-0.5">
              Live percentage of approved strings per target locale
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-subtle pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter pages..."
                className="w-full h-8 pl-8 pr-3 bg-surface border border-border-main rounded text-xs text-text-main placeholder:text-text-subtle focus:border-primary outline-none"
              />
            </div>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="h-8 px-3 bg-surface border border-border-main rounded text-xs text-text-main font-bold focus:border-primary outline-none cursor-pointer"
            >
              <option value="All">Module: All ▾</option>
              <option value="POS">POS</option>
              <option value="Cal">Calendar</option>
              <option value="Staff">Staff</option>
              <option value="CRM">CRM</option>
              <option value="Rpt">Reporting</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-main border-collapse">
            <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider">
              <tr>
                <th className="px-6 py-4 border-r border-border-main/50 min-w-[180px]">PAGE</th>
                <th className="px-6 py-4 border-r border-border-main/50 w-24 text-center">TAGS</th>
                {activeLangs.map(lang => (
                  <th key={lang.code} className="px-6 py-4 border-r border-border-main/50 min-w-[160px]">{lang.name.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              {filteredPages.length > 0 ? (
                filteredPages.map((item) => (
                  <tr key={item.pageId} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 border-r border-border-main/50 font-bold">
                      <Link 
                        to={`/pages/${item.pageId}`} 
                        className="text-primary font-semibold hover:underline flex items-center gap-1.5"
                      >
                        <span>{item.name}</span>
                        <span className="text-[10px] text-text-subtle font-mono font-normal">({item.module})</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 text-center font-bold text-text-main">
                      {item.totalTags}
                    </td>
                    {activeLangs.map(lang => {
                      const cov = item.coverageMap[lang.code] || { approved: 0, total: item.totalTags };
                      const pct = cov.total > 0 ? Math.round((cov.approved / cov.total) * 100) : 0;
                      return (
                        <td key={lang.code} className="px-6 py-4 border-r border-border-main/50">
                          {renderProgressBar(pct)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2 + activeLangs.length} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-text-subtle mb-3">
                        <Layers className="w-6 h-6 text-text-subtle" />
                      </div>
                      <h3 className="text-base font-bold text-text-main mb-1">
                        {registeredPages.length === 0 ? "No pages registered yet" : "No matching pages found"}
                      </h3>
                      {registeredPages.length === 0 && (
                        <Link
                          to="/pages"
                          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Go to Page List
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3.5 border-t border-border-main flex items-center justify-between text-xs text-text-subtle bg-surface-hover/30">
          <span>Showing {filteredPages.length} of {registeredPages.length} pages</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#36B37E]"></span>
              ≥90% Ready
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#0052CC]"></span>
              60-89% In Review
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FFAB00]"></span>
              &lt;60% Translating
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
