import { useState, useEffect } from "react";
import { Globe, MagnifyingGlass as Search } from "@phosphor-icons/react";
import { StatusBacklog, StatusInProgress, StatusDone } from "../components/ui/LinearIcons";
import { Link } from "react-router-dom";
import { PublishModal } from "../components/publishing/PublishModal";
import { StoreService } from "../store/StoreService";
import type { DeploymentRecord } from "../types";

export function Deployments() {
 const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
 const [pages, setPages] = useState(StoreService.getPages());
 const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());

 useEffect(() => {
 StoreService.refreshPages();
 const load = () => {
 setDeployments(StoreService.getDeployments());
 setPages(StoreService.getPages());
 setActiveLangs(StoreService.getActiveLanguages());
 };
 load();
 return StoreService.subscribe(load);
 }, []);

 const [activeTab, setActiveTab] = useState<"matrix" | "history">("matrix");
 const [searchQuery, setSearchQuery] = useState("");

 const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
 const [publishTarget, setPublishTarget] = useState<{pageId: string, pageName: string, lang: string} | null>(null);

 const getLatestVersion = (pageId: string, langCode: string, env: string) => {
 const envDeps = deployments.filter(d => d.pageId === pageId && d.language === langCode && d.environment === env);
 if (envDeps.length === 0) return null;
 return envDeps.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];
 };

 const filteredPages = pages.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.pageId.toLowerCase().includes(searchQuery.toLowerCase()));

 return (
 <div className="flex flex-col gap-4 w-full pb-8">
 {/* Header */}
 <div>
 <h1 className="text-xl font-bold text-text-primary flex items-center gap-2 tracking-tight">
 <Globe className="w-6 h-6 text-accent-blue" weight="fill" />
 Deployments
 </h1>
 <p className="text-[13px] text-text-tertiary mt-0.5">Manage translation releases across Dev, QA, and Production environments</p>
 </div>

 {/* Stats Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 {[
  { name: "DEV", desc: "deployments", color: "text-accent-blue", icon: <StatusBacklog className="w-4 h-4" /> },
  { name: "QA", desc: "deployments", color: "text-warning", icon: <StatusInProgress className="w-4 h-4" /> },
  { name: "PRODUCTION", desc: "live releases", color: "text-[#5e6ad2]", icon: <StatusDone className="w-4 h-4 text-current" /> }
 ].map(env => {
 const latestCount = deployments.filter(d => d.environment === env.name).length;
 return (
 <div key={env.name} className="bg-bg-card border border-border-subtle rounded-xl p-5 flex flex-col gap-6 transition-colors hover:border-border-strong cursor-default">
 <div className="flex items-center gap-3">
 <div className={`w-7 h-7 rounded-full bg-bg-sidebar border border-border-strong flex items-center justify-center ${env.color}`}>
 {env.icon}
 </div>
 <h3 className="text-[14px] font-semibold text-text-secondary">{env.name}</h3>
 </div>
 <div className="flex items-baseline gap-2 mt-auto">
 <span className="text-3xl font-bold text-text-primary tracking-tight">{latestCount}</span>
 <span className="text-[12px] font-medium text-text-tertiary">{env.desc}</span>
 </div>
 </div>
 );
 })}
 </div>

 {/* Tabs & Content */}
 <div className="bg-bg-card border border-border-subtle rounded-xl flex flex-col min-h-0 overflow-hidden">
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border-subtle gap-4 rounded-t-xl">
 <div className="flex gap-4 sm:gap-4 text-[13px] font-bold overflow-x-auto whitespace-nowrap scrollbar-none w-full sm:w-auto pb-1 sm:pb-0">
 <button
 onClick={() => setActiveTab("matrix")}
 className={`pb-4 border-b-2 transition-colors -mb-4 outline-none cursor-pointer ${
 activeTab === "matrix" ? "border-accent-blue text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
 }`}
 >
 Environment Matrix
 </button>
 <button
 onClick={() => setActiveTab("history")}
 className={`pb-4 border-b-2 transition-colors -mb-4 outline-none cursor-pointer ${
 activeTab === "history" ? "border-accent-blue text-text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
 }`}
 >
 Publish History
 </button>
 </div>
 <div className="relative w-full sm:w-64 min-w-[200px]">
 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" weight="bold" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search..."
 className="w-full h-8 pl-8 pr-3 bg-bg-main border border-border-strong rounded-md text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent-blue outline-none transition-colors"
 />
 </div>
 </div>

  {activeTab === "matrix" && (
  <div className="overflow-auto scrollbar-none w-full flex-1">
  <table className="w-full min-w-[700px] text-left text-[13px] text-text-primary border-collapse">
  <thead className="bg-bg-sidebar border-b border-border-subtle text-[10px] uppercase font-bold text-text-tertiary tracking-wider sticky top-0 z-20">
  <tr>
  <th className="px-4 py-2 w-[220px] max-w-[220px] shrink-0 sticky left-0 z-30 bg-bg-sidebar shadow-[4px_0_12px_rgba(0,0,0,0.25)] border-r border-border-subtle/40">MODULE / PAGE</th>
  <th className="px-4 py-2 w-[140px] shrink-0 bg-bg-sidebar">LANGUAGE</th>
  <th className="px-4 py-2 min-w-[140px] bg-bg-sidebar">DEV</th>
  <th className="px-4 py-2 min-w-[140px] bg-bg-sidebar">QA</th>
  <th className="px-4 py-2 w-36 text-right bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">PRODUCTION</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-border-subtle">
  {filteredPages.map(page => (
  activeLangs.map((lang, idx) => {
  const dev = getLatestVersion(page.pageId, lang.code, "DEV");
  const qa = getLatestVersion(page.pageId, lang.code, "QA");
  const prod = getLatestVersion(page.pageId, lang.code, "PRODUCTION");
  
  return (
  <tr key={`${page.pageId}-${lang.code}`} className="group hover:bg-bg-hover transition-colors cursor-default">
  {idx === 0 && (
  <td rowSpan={activeLangs.length} className="px-4 py-2 border-r border-b border-border-subtle align-top w-[220px] max-w-[220px] shrink-0 sticky left-0 z-10 bg-bg-card group-hover:bg-bg-hover shadow-[4px_0_12px_rgba(0,0,0,0.25)] transition-colors">
  <div className="font-bold text-text-primary mb-1 truncate" title={page.module}>{page.module}</div>
  <Link to={`/pages/${page.pageId}`} title={page.name} className="text-link font-semibold hover:underline text-[12px] outline-none truncate block">
  {page.name}
  </Link>
  </td>
  )}
  <td className="px-4 py-2 text-[12px] font-bold text-text-secondary w-[140px] shrink-0">
  {lang.name}
  </td>
  <td className="px-4 py-2 min-w-[140px]">
  {dev ? (
  <div className="flex items-center justify-between gap-2">
  <span className="font-mono text-[12px] font-bold text-accent-blue">v{dev.version}</span>
  <button 
  onClick={() => {
  setPublishTarget({ pageId: page.pageId, pageName: page.name, lang: lang.code });
  setIsPublishModalOpen(true);
  }}
  className="text-[11px] font-medium text-text-secondary hover:text-text-primary px-2 py-0.5 rounded border border-border-subtle hover:border-border-strong hover:bg-bg-hover transition-all cursor-pointer outline-none shrink-0"
  >
  Promote
  </button>
  </div>
  ) : <span className="text-text-tertiary">—</span>}
  </td>
  <td className="px-4 py-2 min-w-[140px]">
  {qa ? (
  <div className="flex items-center justify-between gap-2">
  <span className="font-mono text-[12px] font-bold text-warning">v{qa.version}</span>
  <button 
  onClick={() => {
  setPublishTarget({ pageId: page.pageId, pageName: page.name, lang: lang.code });
  setIsPublishModalOpen(true);
  }}
  className="text-[11px] font-medium text-text-secondary hover:text-text-primary px-2 py-0.5 rounded border border-border-subtle hover:border-border-strong hover:bg-bg-hover transition-all cursor-pointer outline-none shrink-0"
  >
  Promote
  </button>
  </div>
  ) : <span className="text-text-tertiary">—</span>}
  </td>
  <td className="px-4 py-2 w-36 text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
  {prod ? (
  <div className="flex justify-end">
    <span className="font-mono text-[12px] font-bold text-success flex items-center gap-1.5">
    <StatusDone className="w-3.5 h-3.5" /> v{prod.version}
    </span>
  </div>
  ) : <span className="text-text-tertiary">—</span>}
  </td>
  </tr>
  );
  })
  ))}
  </tbody>
  </table>
  </div>
  )}

  {activeTab === "history" && (
  <div className="overflow-auto scrollbar-none w-full flex-1">
  <table className="w-full min-w-[750px] text-left text-[13px] text-text-primary border-collapse">
  <thead className="bg-bg-sidebar border-b border-border-subtle text-[10px] uppercase font-bold text-text-tertiary tracking-wider sticky top-0 z-20">
  <tr>
  <th className="px-4 py-2 w-[180px] shrink-0 bg-bg-sidebar">DATE</th>
  <th className="px-4 py-2 w-[220px] max-w-[220px] shrink-0 bg-bg-sidebar">PAGE</th>
  <th className="px-4 py-2 w-[120px] shrink-0 bg-bg-sidebar">LANGUAGE</th>
  <th className="px-4 py-2 w-[130px] shrink-0 bg-bg-sidebar">ENVIRONMENT</th>
  <th className="px-4 py-2 w-[100px] shrink-0 bg-bg-sidebar">VERSION</th>
  <th className="px-4 py-2 w-36 text-right bg-bg-sidebar sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">PUBLISHED BY</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-border-subtle">
  {deployments.length > 0 ? deployments.map(dep => (
  <tr key={dep.id} className="group hover:bg-bg-hover transition-colors cursor-default">
  <td className="px-4 py-2 text-[12px] text-text-secondary font-mono w-[180px] shrink-0">
  {new Date(dep.publishedAt).toLocaleString()}
  </td>
  <td className="px-4 py-2 font-bold text-text-primary w-[220px] max-w-[220px] shrink-0">
  <span className="truncate block" title={dep.pageName}>{dep.pageName}</span>
  </td>
  <td className="px-4 py-2 font-bold text-text-secondary w-[120px] shrink-0">
  {activeLangs.find(l => l.code === dep.language)?.name || dep.language}
  </td>
  <td className="px-4 py-2 w-[130px] shrink-0">
   <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
   dep.environment === 'PRODUCTION' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 
   dep.environment === 'QA' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 
   'bg-accent-blue/10 text-accent-blue border-accent-blue/20'
   }`}>
   {dep.environment}
   </span>
   </td>
  <td className="px-4 py-2 font-mono text-[12px] font-bold w-[100px] shrink-0">
  v{dep.version}
  </td>
  <td className="px-4 py-2 text-[12px] font-medium text-text-secondary w-36 text-right bg-bg-card group-hover:bg-bg-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
  <span className="truncate block" title={dep.publishedBy}>{dep.publishedBy}</span>
  </td>
  </tr>
  )) : (
  <tr>
  <td colSpan={6} className="px-6 py-16 text-center text-[13px] text-text-tertiary">
  No deployments found. Use the Publish tool in a Page Detail view to create one.
  </td>
  </tr>
  )}
  </tbody>
  </table>
  </div>
  )}
 </div>

 {publishTarget && (
 <PublishModal
 isOpen={isPublishModalOpen}
 onClose={() => {
 setIsPublishModalOpen(false);
 setPublishTarget(null);
 }}
 onPublish={async (env, langCode) => {
 const isEng = langCode === "eng" || langCode === "en";
 const tags = StoreService.getTags(publishTarget.pageId);
 const count = isEng
 ? tags.filter(t => t.english && t.english.trim().length > 0).length
 : tags.filter(t => t.values[langCode]?.status === "Approved").length;

 await StoreService.publish(
 publishTarget.pageId,
 publishTarget.pageName,
 langCode,
 env,
 count
 );
 setIsPublishModalOpen(false);
 setPublishTarget(null);
 }}
 pageName={publishTarget.pageName}
 totalTags={StoreService.getTags(publishTarget.pageId).length}
 initialLanguage={publishTarget.lang}
 availableLanguages={StoreService.getActiveLanguages()}
 tags={StoreService.getTags(publishTarget.pageId)}
 />
 )}
 </div>
 );
}
