import { useState, useEffect } from "react";
import { Globe, Database as Server, CheckCircle, Pulse, MagnifyingGlass as Search } from "@phosphor-icons/react";
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
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
          <Globe className="w-6 h-6 text-primary" weight="fill" />
          Deployments
        </h1>
        <p className="text-sm text-text-subtle mt-0.5">Manage translation releases across Dev, QA, and Production environments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: "DEV", desc: "Internal Testing", color: "border-primary", icon: <Server className="w-5 h-5 text-primary" weight="bold" /> },
          { name: "QA", desc: "Release Candidate", color: "border-[#FF8B00]", icon: <Pulse className="w-5 h-5 text-[#FF8B00]" weight="bold" /> },
          { name: "PRODUCTION", desc: "Live to Customers", color: "border-[#36B37E]", icon: <CheckCircle className="w-5 h-5 text-[#36B37E]" weight="fill" /> }
        ].map(env => {
          const latestCount = deployments.filter(d => d.environment === env.name).length;
          return (
            <div key={env.name} className={`bg-surface border-l-4 ${env.color} border-y border-r border-border-main rounded-xl p-5 shadow-sm flex items-center justify-between`}>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                  {env.icon}
                  <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">{env.name}</h3>
                </div>
                <div className="text-xs text-text-subtle font-medium">{env.desc}</div>
              </div>
              <div className="text-3xl font-bold text-text-main pr-4">{latestCount}</div>
            </div>
          );
        })}
      </div>

      {/* Tabs & Content */}
      <div className="bg-surface border border-border-main rounded-xl shadow-sm flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border-main">
          <div className="flex gap-6 text-sm font-bold">
            <button
              onClick={() => setActiveTab("matrix")}
              className={`pb-4 border-b-2 transition-colors -mb-4 ${
                activeTab === "matrix" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text-main"
              }`}
            >
              Environment Matrix
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-4 border-b-2 transition-colors -mb-4 ${
                activeTab === "history" ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text-main"
              }`}
            >
              Publish History
            </button>
          </div>
          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-subtle pointer-events-none" weight="bold" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full h-8 pl-8 pr-3 bg-surface border border-border-main rounded text-xs text-text-main placeholder:text-text-subtle focus:border-primary outline-none"
            />
          </div>
        </div>

        {activeTab === "matrix" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-main border-collapse">
              <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-r border-border-main/50">MODULE / PAGE</th>
                  <th className="px-6 py-4 border-r border-border-main/50">LANGUAGE</th>
                  <th className="px-6 py-4 border-r border-border-main/50">DEV</th>
                  <th className="px-6 py-4 border-r border-border-main/50">QA</th>
                  <th className="px-6 py-4">PRODUCTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {filteredPages.map(page => (
                  activeLangs.map((lang, idx) => {
                    const dev = getLatestVersion(page.pageId, lang.code, "DEV");
                    const qa = getLatestVersion(page.pageId, lang.code, "QA");
                    const prod = getLatestVersion(page.pageId, lang.code, "PRODUCTION");
                    
                    return (
                      <tr key={`${page.pageId}-${lang.code}`} className="hover:bg-surface-hover transition-colors">
                        {idx === 0 && (
                          <td rowSpan={activeLangs.length} className="px-6 py-4 border-r border-b border-border-main/50 align-top">
                            <div className="font-bold text-text-main mb-1">{page.module}</div>
                            <Link to={`/pages/${page.pageId}`} className="text-primary font-semibold hover:underline text-xs">
                              {page.name}
                            </Link>
                          </td>
                        )}
                        <td className="px-6 py-4 border-r border-border-main/50 text-xs font-bold text-text-muted">
                          {lang.name}
                        </td>
                        <td className="px-6 py-4 border-r border-border-main/50">
                          {dev ? (
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-[#0052CC]">v{dev.version}</span>
                              <button 
                                onClick={() => {
                                  setPublishTarget({ pageId: page.pageId, pageName: page.name, lang: lang.code });
                                  setIsPublishModalOpen(true);
                                }}
                                className="text-xs font-bold text-primary hover:underline cursor-pointer"
                              >
                                Promote ▸
                              </button>
                            </div>
                          ) : <span className="text-text-subtle">—</span>}
                        </td>
                        <td className="px-6 py-4 border-r border-border-main/50">
                          {qa ? (
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-bold text-[#FF8B00]">v{qa.version}</span>
                              <button 
                                onClick={() => {
                                  setPublishTarget({ pageId: page.pageId, pageName: page.name, lang: lang.code });
                                  setIsPublishModalOpen(true);
                                }}
                                className="text-xs font-bold text-primary hover:underline cursor-pointer"
                              >
                                Promote ▸
                              </button>
                            </div>
                          ) : <span className="text-text-subtle">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          {prod ? (
                            <span className="font-mono text-xs font-bold text-[#36B37E] flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" weight="fill" /> v{prod.version}
                            </span>
                          ) : <span className="text-text-subtle">—</span>}
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-main border-collapse">
              <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-r border-border-main/50">DATE</th>
                  <th className="px-6 py-4 border-r border-border-main/50">PAGE</th>
                  <th className="px-6 py-4 border-r border-border-main/50">LANGUAGE</th>
                  <th className="px-6 py-4 border-r border-border-main/50">ENVIRONMENT</th>
                  <th className="px-6 py-4 border-r border-border-main/50">VERSION</th>
                  <th className="px-6 py-4">PUBLISHED BY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {deployments.length > 0 ? deployments.map(dep => (
                  <tr key={dep.id} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 border-r border-border-main/50 text-xs text-text-muted font-mono">
                      {new Date(dep.publishedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 font-bold text-text-main">
                      {dep.pageName}
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 font-bold text-text-muted">
                      {activeLangs.find(l => l.code === dep.language)?.name || dep.language}
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        dep.environment === 'PRODUCTION' ? 'bg-[#E3FCEF] text-[#006644] border border-[#ABF5D1]' : 
                        dep.environment === 'QA' ? 'bg-[#FFF0B3] text-[#FF8B00] border border-[#FFE380]' : 
                        'bg-[#DEEBFF] text-[#0052CC] border border-[#B3D4FF]'
                      }`}>
                        {dep.environment}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 font-mono text-xs font-bold">
                      v{dep.version}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-text-muted">
                      {dep.publishedBy}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-text-muted">
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
