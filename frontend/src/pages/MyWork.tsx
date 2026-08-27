import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { StoreService } from "../store/StoreService";

export function MyWork() {
  const [activeTab, setActiveTab] = useState<"pending" | "stale">("pending");
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
  const [selectedLanguage, setSelectedLanguage] = useState("All");

  const [pendingList, setPendingList] = useState<any[]>([]);
  const [staleList, setStaleList] = useState<any[]>([]);

  useEffect(() => {
    StoreService.refreshPages();
    const load = () => {
      setActiveLangs(StoreService.getActiveLanguages());
      setPendingList(StoreService.getPendingReviews(selectedLanguage === "All" ? undefined : selectedLanguage));
      setStaleList(StoreService.getStaleTranslations(selectedLanguage === "All" ? undefined : selectedLanguage));
    };
    load();
    return StoreService.subscribe(load);
  }, [selectedLanguage]);

  const handleApprove = (pageId: string, tagId: string, langCode: string) => {
    StoreService.updateTranslation(pageId, tagId, langCode, { status: "Approved" });
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-main">My Work</h1>
        <p className="text-sm text-text-subtle mt-0.5">Your personal queue of translations requiring review or updates</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div 
          onClick={() => setActiveTab("pending")}
          className={`bg-surface border rounded-xl p-5 cursor-pointer transition-all ${
            activeTab === "pending" ? "border-primary shadow-sm" : "border-border-main hover:border-primary/50"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${activeTab === "pending" ? "bg-[#EAE6FF]" : "bg-surface-active"}`}>
              <CheckCircle2 className={`w-5 h-5 ${activeTab === "pending" ? "text-[#403294]" : "text-text-muted"}`} />
            </div>
            <h3 className="text-sm font-bold text-text-main">Pending Review</h3>
          </div>
          <div className="text-3xl font-bold text-text-main">{pendingList.length}</div>
          <p className="text-xs text-text-subtle mt-1">AI-generated translations waiting for human approval</p>
        </div>

        <div 
          onClick={() => setActiveTab("stale")}
          className={`bg-surface border rounded-xl p-5 cursor-pointer transition-all ${
            activeTab === "stale" ? "border-[#FF8B00] shadow-sm" : "border-border-main hover:border-[#FF8B00]/50"
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${activeTab === "stale" ? "bg-[#FFFAE6]" : "bg-surface-active"}`}>
              <Clock className={`w-5 h-5 ${activeTab === "stale" ? "text-[#FF8B00]" : "text-text-muted"}`} />
            </div>
            <h3 className="text-sm font-bold text-text-main">Stale Translations</h3>
          </div>
          <div className="text-3xl font-bold text-text-main">{staleList.length}</div>
          <p className="text-xs text-text-subtle mt-1">Master English was updated since last translation</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <select 
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main font-bold focus:border-primary outline-none cursor-pointer"
        >
          <option value="All">All Languages ▾</option>
          {activeLangs.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.name}</option>
          ))}
        </select>
      </div>

      {/* Content Area */}
      <div className="bg-surface border border-border-main rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        {activeTab === "pending" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-main border-collapse">
              <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-r border-border-main/50">TAG</th>
                  <th className="px-6 py-4 border-r border-border-main/50 w-1/3">MASTER ENGLISH</th>
                  <th className="px-6 py-4 border-r border-border-main/50 w-1/3">DRAFT TRANSLATION</th>
                  <th className="px-6 py-4 w-32">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {pendingList.length > 0 ? pendingList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 border-r border-border-main/50">
                      <div className="font-mono font-bold text-primary mb-1">
                        <Link to={`/pages/${item.pageId}/tags/${item.tag}`} className="hover:underline flex items-center gap-1.5">
                          {item.tag} <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <div className="text-xs text-text-subtle font-medium">{item.page} • {item.langName}</div>
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 whitespace-pre-wrap font-medium">
                      {item.english}
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 whitespace-pre-wrap font-sans" dir="auto">
                      {item.translatedText}
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold">
                        <span className={`px-1.5 py-0.5 rounded ${item.conf >= 85 ? 'bg-[#E3FCEF] text-[#006644]' : 'bg-[#FFFAE6] text-[#FF8B00]'}`}>
                          {item.conf}% AI Conf
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleApprove(item.pageId, item.tag, item.langCode)}
                        className="w-full py-1.5 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded transition-colors shadow-sm cursor-pointer"
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-text-muted">
                      No pending reviews found for the selected language.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "stale" && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-main border-collapse">
              <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-r border-border-main/50">TAG</th>
                  <th className="px-6 py-4 border-r border-border-main/50 text-center">VERSION JUMP</th>
                  <th className="px-6 py-4 border-r border-border-main/50 text-center">STALE AGE</th>
                  <th className="px-6 py-4 w-32">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {staleList.length > 0 ? staleList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 border-r border-border-main/50">
                      <div className="font-mono font-bold text-primary mb-1">
                        <Link to={`/pages/${item.pageId}/tags/${item.tag}`} className="hover:underline flex items-center gap-1.5">
                          {item.tag} <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <div className="text-xs text-text-subtle font-medium">{item.page} • {item.langName}</div>
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 text-center">
                      <span className="px-2 py-1 bg-surface-active rounded font-mono text-xs text-text-main font-bold border border-border-main">
                        {item.change}
                      </span>
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 text-center text-[#FF8B00] font-bold">
                      {item.age}
                    </td>
                    <td className="px-6 py-4">
                      <Link 
                        to={`/pages/${item.pageId}/tags/${item.tag}`}
                        className="block w-full py-1.5 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded transition-colors shadow-sm text-center"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-text-muted">
                      No stale translations found for the selected language.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
