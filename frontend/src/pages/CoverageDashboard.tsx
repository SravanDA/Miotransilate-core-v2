import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlass as Search, Globe, Plus, Pulse, X } from "@phosphor-icons/react";
import { StoreService } from "../store/StoreService";
import { Dropdown } from "../components/ui/Dropdown";
import { StatusCompleted, StatusInProgress, StatusBacklog } from "../components/ui/LinearIcons";
import { EmptyStateGraphic } from "../components/ui/EmptyStateGraphic";
import { useAuth } from "../contexts/AuthContext";

export function CoverageDashboard() {
 const { user, can } = useAuth();
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
 color: pct >= 90 ? "text-[#5e6ad2]" : pct >= 60 ? "text-[#f2c94c]" : pct > 0 ? "text-[#f2c94c]" : "text-text-primary",
 badge: pct >= 90 ? "Ready" : pct >= 60 ? "In Review" : pct > 0 ? "Translating" : "Not Started",
 Icon: pct >= 90 ? StatusCompleted : pct > 0 ? StatusInProgress : StatusBacklog
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
 if (percent >= 90) return "bg-[#5e6ad2]";
 if (percent >= 60) return "bg-[#f2c94c]";
 if (percent > 0) return "bg-[#5c94ff]";
 return "bg-border-strong";
 };

 return (
 <div className="flex flex-col gap-1.5 w-full">
 <div className="flex items-center justify-between text-[11px] font-medium">
 <span className="text-text-secondary">{percent >= 90 ? "Ready" : percent >= 60 ? "In Review" : percent > 0 ? "Translating" : "Not Started"}</span>
 <span className="text-text-primary">{percent}%</span>
 </div>
 <div className="w-full bg-bg-active rounded-full h-1.5 overflow-hidden">
 <div
 className={`h-full rounded-full transition-all duration-500 ease-out ${getBarColor()}`}
 style={{ width: `${percent}%` }}
 />
 </div>
 </div>
 );
 };

 return (
 <div className="flex flex-col gap-4 w-full ">
 {/* Header */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
 <div>
 <h1 className="text-xl font-bold tracking-tight text-text-primary">Coverage</h1>
 <p className="text-[13px] text-text-tertiary mt-0.5">
 Real-time translation completion and review status across all active languages.
 </p>
 </div>
 {(can('ADMIN_LANGUAGES') || can('ADMIN_USERS') || user?.roles?.includes('FN')) && (
    <Link
      to="/settings"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-card hover:bg-bg-hover border border-border-strong text-[12px] font-bold rounded-md transition-colors text-text-primary active:scale-[0.98] outline-none"
    >
      <Globe className="w-3.5 h-3.5 text-link" weight="bold" />
      Manage Languages
    </Link>
  )}
 </div>

 {/* Language Coverage Cards (Horizontal Scroll for 1 viewport) */}
 <div className="flex overflow-x-auto gap-4 pb-2 shrink-0 snap-x scrollbar-none">
 {metrics.map((m, idx) => (
 <div
 key={idx}
 className="bg-bg-card border border-border-subtle rounded-xl p-4 flex flex-col justify-between transition-all hover:border-accent-blue/40 min-h-[100px] min-w-[220px] snap-start"
 >
  <div className="flex items-center justify-between gap-2 mb-2">
  <span className="text-[13px] font-medium text-text-primary truncate">
  {m.label}
  </span>
  <span className="inline-flex items-center gap-1.5 text-[12px] font-normal text-text-primary shrink-0 select-none">
  <m.Icon className="w-3.5 h-3.5 shrink-0" />
  <span>{m.badge}</span>
  </span>
  </div>
 <div className="flex items-baseline gap-2 mt-auto">
 <span className={`text-2xl font-bold tracking-tight leading-none ${m.color}`}>
 {m.val}
 </span>
 <span className="text-[11px] text-text-tertiary font-medium truncate">
 {m.sub}
 </span>
 </div>
 </div>
 ))}
 {metrics.length === 0 && (
 <div className="w-full p-4 text-center text-[13px] text-text-secondary font-medium bg-bg-card border border-border-subtle rounded-xl">
 No active languages to display metrics for.
 </div>
 )}
 </div>

 {/* Table Section */}
 <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
 {/* Table Toolbar */}
 <div className="p-3 border-b border-border-subtle flex flex-wrap items-center justify-between gap-4 shrink-0 bg-bg-sidebar rounded-t-xl">
 <div className="flex items-center gap-2">
 <Pulse className="w-4 h-4 text-text-secondary" weight="bold" />
 <h2 className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
 Translation Readiness Matrix
 </h2>
 </div>
 <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
 <div className="relative w-full sm:w-64 min-w-[200px] flex-1 sm:flex-none">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" weight="bold" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Filter pages..."
 className="w-full h-8 pl-8 pr-3 bg-bg-main hover:bg-bg-hover border border-border-strong rounded-md text-[13px] font-medium text-text-primary placeholder:text-text-tertiary focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-all"
 />
 </div>
 <Dropdown
 value={selectedModule}
 onChange={setSelectedModule}
 className="w-full sm:w-36 flex-1 sm:flex-none min-w-[120px]"
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

 <div className="flex-1 overflow-auto scrollbar-none">
 <table className="w-full min-w-[800px] text-left border-collapse">
 <thead className="bg-bg-main border-b border-border-subtle sticky top-0 z-20">
 <tr>
 <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-[240px] max-w-[240px] shrink-0 sticky left-0 z-30 bg-bg-main -[4px_0_12px_rgba(0,0,0,0.25)] border-r border-border-subtle/40">Page Location</th>
 <th className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider w-24 text-center shrink-0">String Count</th>
 {activeLangs.map(lang => (
 <th key={lang.code} className="px-4 py-2 text-[10px] uppercase font-bold text-text-tertiary tracking-wider min-w-[160px]">{lang.name}</th>
 ))}
 </tr>
 </thead>
 <tbody className="divide-y divide-border-subtle">
 {filteredPages.length > 0 ? (
 <>
 {filteredPages.map((item) => (
 <tr key={item.pageId} className="group hover:bg-bg-hover transition-colors cursor-default">
 <td className="px-4 py-2 align-middle w-[240px] max-w-[240px] shrink-0 sticky left-0 z-10 bg-bg-card group-hover:bg-bg-hover -[4px_0_12px_rgba(0,0,0,0.25)] border-r border-border-subtle/40 transition-colors">
 <div className="flex flex-col gap-0.5 min-w-0">
 <Link 
 to={`/pages/${item.pageId}`} 
 title={item.name}
 className="text-[13px] font-bold text-link hover:underline transition-colors truncate block outline-none"
 >
 {item.name}
 </Link>
 <span className="text-[11px] text-text-tertiary font-medium truncate block" title={item.module}>{item.module}</span>
 </div>
 </td>
  <td className="px-4 py-2 align-middle text-center shrink-0">
  <span className="text-[13px] font-mono text-text-secondary tabular-nums font-medium">
  {item.totalTags}
  </span>
  </td>
 {activeLangs.map(lang => {
 const cov = item.coverageMap[lang.code] || { approved: 0, total: item.totalTags };
 const pct = cov.total > 0 ? Math.round((cov.approved / cov.total) * 100) : 0;
 return (
 <td key={lang.code} className="px-4 py-2 align-middle min-w-[160px]">
   <Link 
     to={`/pages/${item.pageId}?lang=${lang.code}`} 
     className="block hover:opacity-80 transition-opacity"
     title={`Click to view ${lang.name} translations for ${item.name}`}
   >
     {renderProgressBar(pct)}
   </Link>
 </td>
 );
 })}
 </tr>
 ))}

 {/* Summary Row */}
 <tr className="bg-bg-sidebar font-bold border-t-2 border-border-strong sticky bottom-0 z-20">
   <td className="px-4 py-2.5 text-[12px] text-text-primary uppercase tracking-wider w-[240px] max-w-[240px] shrink-0 sticky left-0 z-30 bg-bg-sidebar -[4px_0_12px_rgba(0,0,0,0.25)] border-r border-border-subtle/40">
     Global Average / Total
   </td>
   <td className="px-4 py-2.5 text-[13px] font-mono text-text-primary text-center shrink-0">
     {filteredPages.reduce((acc, p) => acc + p.totalTags, 0)}
   </td>
   {activeLangs.map(lang => {
     let totalTagsSum = 0;
     let totalApprSum = 0;
     filteredPages.forEach(p => {
       const cov = p.coverageMap[lang.code] || { approved: 0, total: p.totalTags };
       totalTagsSum += cov.total;
       totalApprSum += cov.approved;
     });
     const avgPct = totalTagsSum > 0 ? Math.round((totalApprSum / totalTagsSum) * 100) : 0;
     return (
       <td key={lang.code} className="px-4 py-2.5 align-middle min-w-[160px]">
         {renderProgressBar(avgPct)}
       </td>
     );
   })}
 </tr>
 </>
 ) : (
  <tr>
    <td colSpan={2 + activeLangs.length} className="px-5 py-24 text-center">
      <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
        <EmptyStateGraphic className="mb-4 opacity-80" />
        <h3 className="text-[14px] font-bold text-text-primary mb-1.5">
          {registeredPages.length === 0 ? "No Pages Registered" : "No Matching Pages"}
        </h3>
        <p className="text-[12px] max-w-sm text-balance text-text-secondary">
          {registeredPages.length === 0
            ? "There are no pages registered to monitor coverage. Register your first page to track localization readiness!"
            : "No registered pages match your current search query or module filter."}
        </p>
        {registeredPages.length === 0 ? (
          <Link
            to="/pages"
            className="mt-4 inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-[#5e6ad2] hover:bg-[#525ec2] text-white text-[12px] font-medium rounded-md transition-all active:scale-[0.98] outline-none "
          >
            <Plus className="w-3.5 h-3.5" weight="bold" />
            <span>Go to Pages</span>
          </Link>
        ) : (
          <button
            onClick={() => { setSearchQuery(""); setSelectedModule("All"); }}
            className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-bg-card hover:bg-bg-hover text-text-secondary hover:text-text-primary border border-border-subtle text-[12px] font-medium rounded-md transition-colors outline-none cursor-pointer "
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </td>
  </tr>
  )}
 </tbody>
 </table>
 </div>

 {/* Footer Legend */}
 <div className="px-5 py-2.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-4 text-[11px] font-bold text-text-tertiary bg-bg-sidebar shrink-0">
 <span>Showing {filteredPages.length} of {registeredPages.length} pages</span>
   <div className="flex items-center gap-4">
   <span className="flex items-center gap-1.5 text-text-primary text-[12px] font-normal">
   <StatusCompleted className="w-3.5 h-3.5 shrink-0" />
   ≥90% Ready
   </span>
   <span className="flex items-center gap-1.5 text-text-primary text-[12px] font-normal">
   <StatusInProgress className="w-3.5 h-3.5 shrink-0" />
   60–89% In Review
   </span>
   <span className="flex items-center gap-1.5 text-text-primary text-[12px] font-normal">
   <StatusInProgress className="w-3.5 h-3.5 shrink-0" />
   &lt;60% Translating
   </span>
   <span className="flex items-center gap-1.5 text-text-primary text-[12px] font-normal">
   <StatusBacklog className="w-3.5 h-3.5 shrink-0" />
   0% Not Started
   </span>
   </div>
 </div>
 </div>
 </div>
 );
}
