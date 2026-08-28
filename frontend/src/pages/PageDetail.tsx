import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { MagnifyingGlass as Search, Sparkle as Sparkles, Plus, Stack as Layers, Check } from "@phosphor-icons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PublishModal } from "../components/publishing/PublishModal";
import { TranslationStatusBadge } from "../components/translation/TranslationStatusBadge";
import { StoreService } from "../store/StoreService";
import { Dropdown } from "../components/ui/Dropdown";
import { engine } from "../engine/TranslationEngine";
import type { Tag, CopyType } from "../types";
import { useAuth } from "../contexts/AuthContext";

export function PageDetail() {
  const { pageId } = useParams();
  const { can } = useAuth();
  
  const [tags, setTags] = useState<Tag[]>([]);
  const [pageInfo, setPageInfo] = useState<{ name: string; module: string; status: string }>({ name: "Unknown", module: "Unknown", status: "Unknown" });
  const [activeLangs, setActiveLangs] = useState(StoreService.getActiveLanguages());
  const [selectedLanguage, setSelectedLanguage] = useState(activeLangs[0]?.code || "en");

  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pageId) StoreService.refreshPageDetail(pageId);
    const load = () => {
      if (!pageId) return;
      setTags(StoreService.getTags(pageId));
      
      const pInfo = StoreService.getPage(pageId);
      if (pInfo) {
        setPageInfo({ name: pInfo.name, module: pInfo.module, status: pInfo.status });
      }
      
      const langs = StoreService.getActiveLanguages();
      setActiveLangs(langs);
      if (!langs.find(l => l.code === selectedLanguage)) {
        setSelectedLanguage(langs[0]?.code || "en");
      }
    };
    load();
    return StoreService.subscribe(load);
  }, [pageId, selectedLanguage]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedType, setSelectedType] = useState("All");

  const [isAddTagOpen, setIsAddTagOpen] = useState(false);
  const [newTagId, setNewTagId] = useState("");
  const [newCopyType, setNewCopyType] = useState<CopyType>("Button");
  const [newEnglish, setNewEnglish] = useState("");

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTranslateAll = async () => {
    if (!pageId) return;
    
    showToast(`Generating translations for ${selectedLanguage}...`);
    const status = await engine.translatePageBatch(pageId, selectedLanguage);
    
    if (status === 'COMPLETE') {
      showToast(`Successfully generated all translations for ${selectedLanguage}`);
    } else if (status === 'PARTIAL_SUCCESS') {
      showToast(`Generated translations with some items needing attention`);
    } else {
      showToast(`Translation batch failed. Please try again.`);
    }
  };

  const handleBulkApprove = () => {
    if (!pageId) return;
    
    tags.forEach(tag => {
      if (tag.values[selectedLanguage]?.status === "Pending Review") {
        StoreService.updateTranslation(pageId, tag.id, selectedLanguage, {
          status: "Approved"
        });
      }
    });
    showToast("Bulk approved all pending translations for this language");
  };

  const filteredTags = useMemo(() => {
    return tags.filter(tag => {
      const val = tag.values[selectedLanguage] || { text: "", status: tag.english ? "No Trans" : "No Eng" };
      
      const matchesSearch = tag.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            tag.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            val.text.toLowerCase().includes(searchQuery.toLowerCase());
                            
      const matchesStatus = selectedStatus === "All" || val.status === selectedStatus;
      const matchesType = selectedType === "All" || tag.type === selectedType;
      
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [tags, searchQuery, selectedStatus, selectedType, selectedLanguage]);

  const rowVirtualizer = useVirtualizer({
    count: filteredTags.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53,
    overscan: 10,
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#172B4D] text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-[#79F2C0]" weight="bold" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center text-sm font-medium text-text-subtle">
        <Link to="/pages" className="hover:underline">Content</Link>
        <span className="mx-2">▸</span>
        <span className="text-text-main font-semibold">{pageInfo.name}</span>
      </div>

      {/* Header Card */}
      <div className="bg-surface border border-border-main rounded-xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-main">{pageInfo.name}</h1>
            <span className="px-2 py-0.5 bg-surface-active text-text-muted text-xs font-mono font-bold rounded">
              {pageId || "PAGE"}
            </span>
            <span className="px-2.5 py-0.5 bg-[#E3FCEF] text-[#006644] text-xs font-semibold rounded-full border border-[#ABF5D1]">
              {pageInfo.status}
            </span>
          </div>
          <div className="text-sm text-text-subtle">
            Module: <strong className="text-text-main">{pageInfo.module}</strong> · Tags: <strong className="text-text-main">{tags.length}</strong>
          </div>
        </div>

        <div className="pt-3 border-t border-border-main flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-text-subtle">
          <div>
            Coverage: {activeLangs.map((lang, idx) => {
              const langAppr = tags.filter(t => t.values[lang.code]?.status === "Approved").length;
              return (
                <span key={lang.code}>
                  {lang.name} <strong className="text-primary">{langAppr}/{tags.length}</strong>
                  {idx < activeLangs.length - 1 ? " · " : ""}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toolbar Card */}
      <div className="bg-surface p-4 rounded-xl border border-border-main flex flex-col gap-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Dropdown
              value={selectedLanguage}
              onChange={setSelectedLanguage}
              className="w-48"
              options={[
                { value: "eng", label: "Language: English (Master) ▾" },
                ...activeLangs.map(lang => ({ value: lang.code, label: `Language: ${lang.name} ▾` }))
              ]}
            />

            <Dropdown
              value={selectedStatus}
              onChange={setSelectedStatus}
              className="w-36"
              options={[
                { value: "All", label: "Status ▾" },
                { value: "Approved", label: "Approved" },
                { value: "Pending Review", label: "Pending Review" },
                { value: "Stale", label: "Stale" },
                { value: "Draft", label: "Draft" },
                { value: "No Trans", label: "No Trans" },
              ]}
            />

            <Dropdown
              value={selectedType}
              onChange={setSelectedType}
              className="w-36"
              options={[
                { value: "All", label: "Copy Type ▾" },
                { value: "Header", label: "Header" },
                { value: "Button", label: "Button" },
                { value: "Label", label: "Label" },
                { value: "Placeholder", label: "Placeholder" },
                { value: "Error", label: "Error" },
              ]}
            />
          </div>

          <div className="flex-1 max-w-sm relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-subtle pointer-events-none" weight="bold" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tags..."
              className="w-full h-9 pl-9 pr-4 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t border-border-main/60">
          <div className="flex items-center gap-2.5">
            {can('TRANSLATION_CREATE') && (
              <button
                onClick={handleTranslateAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface hover:bg-surface-hover border border-border-main rounded text-sm font-bold text-primary transition-colors cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-primary" weight="fill" />
                Translate All
              </button>
            )}
            {can('TRANSLATION_APPROVE') && (
              <button
                onClick={handleBulkApprove}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface hover:bg-surface-hover border border-border-main rounded text-sm font-bold text-text-main transition-colors cursor-pointer shadow-sm"
              >
                Bulk Approve
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {(can('PUBLISH_QA') || can('PUBLISH_PRODUCTION')) && (
              <button
                onClick={() => setIsPublishModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-surface hover:bg-surface-hover border border-[#0052CC] text-primary text-sm font-bold rounded transition-colors cursor-pointer shadow-sm"
              >
                Publish ▸
              </button>
            )}
            {can('ENGLISH_AUTHOR') && (
              <button
                onClick={() => setIsAddTagOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-bold rounded hover:bg-primary-hover transition-colors cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" weight="bold" />
                Add Tag
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div 
        className="bg-surface rounded border border-border-main shadow-sm overflow-hidden flex flex-col"
      >
        <div 
          ref={parentRef}
          className="overflow-auto custom-scrollbar" 
          style={{ height: '500px' }}
        >
          <table className="w-full text-left text-sm text-text-main border-collapse table-fixed">
            <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 border-r border-border-main/50 w-[150px]">TAG ID</th>
                <th className="px-6 py-4 border-r border-border-main/50 w-[120px]">TYPE</th>
                <th className="px-6 py-4 border-r border-border-main/50 w-[300px]">ENGLISH</th>
                <th className="px-6 py-4 border-r border-border-main/50 w-[300px]">
                  {selectedLanguage === "eng" || selectedLanguage === "en" ? "VERSION" : (activeLangs.find(l => l.code === selectedLanguage)?.name.toUpperCase() || "TRANSLATION")}
                </th>
                <th className="px-6 py-4 w-[150px]">STATUS</th>
              </tr>
            </thead>
            <tbody 
              className="divide-y divide-border-main"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {filteredTags.length > 0 ? (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const tag = filteredTags[virtualRow.index];
                  const isEng = selectedLanguage === "eng" || selectedLanguage === "en";
                  const val = !isEng ? (tag.values[selectedLanguage] || { text: "", status: tag.english ? "No Trans" : "No Eng" }) : { text: `v${tag.englishVersion || 1}`, status: "Approved" };
                  
                  return (
                  <tr 
                    key={tag.id} 
                    className="hover:bg-surface-hover transition-colors absolute top-0 left-0 w-full flex items-center"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <td className="px-6 border-r border-border-main/50 font-mono font-bold text-primary w-[150px] h-full flex items-center">
                      <Link to={`/pages/${pageId}/tags/${tag.id}`} className="hover:underline truncate">
                        {tag.id}
                      </Link>
                    </td>
                    <td className="px-6 border-r border-border-main/50 w-[120px] h-full flex items-center">
                      <span className="px-2 py-0.5 rounded bg-surface-active text-text-muted text-xs font-medium">
                        {tag.type}
                      </span>
                    </td>
                    <td className="px-6 border-r border-border-main/50 font-bold w-[300px] h-full flex items-center overflow-hidden">
                      {tag.english ? <span className="truncate">"{tag.english}"</span> : <span className="text-text-subtle italic truncate">(Draft)</span>}
                    </td>
                    <td className="px-6 border-r border-border-main/50 text-right font-sans w-[300px] h-full flex items-center justify-end overflow-hidden" dir="auto">
                      {isEng ? (
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs font-bold">
                          v{tag.englishVersion || 1}
                        </span>
                      ) : (
                        val.text ? <span className="truncate">"{val.text}"</span> : <span className="text-text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-6 w-[150px] h-full flex items-center">
                      {isEng ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold text-xs border border-emerald-500/20">
                          Master
                        </span>
                      ) : (
                        <TranslationStatusBadge status={val.status as any} />
                      )}
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-text-subtle mb-3">
                        <Layers className="w-6 h-6 text-text-subtle" weight="fill" />
                      </div>
                      <h3 className="text-base font-bold text-text-main mb-1">
                        {tags.length === 0 ? "No tags added yet" : "No matching tags found"}
                      </h3>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Tag Modal */}
      {isAddTagOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#091E42]/50 p-4">
          <div className="bg-surface rounded-xl shadow-modal w-full max-w-md flex flex-col border border-border-main">
            <div className="px-6 py-4 border-b border-border-main flex items-center justify-between">
              <h2 className="text-base font-bold text-text-main">Create New Tag</h2>
              <button onClick={() => setIsAddTagOpen(false)} className="text-text-subtle hover:text-text-main cursor-pointer">✕</button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newTagId && pageId) {
                const newTag: Tag = {
                  id: newTagId,
                  pageId,
                  type: newCopyType,
                  english: newEnglish,
                  englishVersion: 1,
                  values: {},
                  comments: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                StoreService.initEmptyValuesForTag(newTag);
                StoreService.createTag(pageId, newTag);
                
                setIsAddTagOpen(false);
                setNewTagId("");
                setNewEnglish("");
                showToast(`Tag ${newTagId} created`);
              }
            }} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-muted uppercase">Tag ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., BTN_SUBMIT"
                  value={newTagId}
                  onChange={(e) => setNewTagId(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  className="w-full h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main font-mono focus:border-primary outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-muted uppercase">Copy Type</label>
                <Dropdown
                  value={newCopyType}
                  onChange={(val) => setNewCopyType(val as CopyType)}
                  className="w-full"
                  options={[
                    { value: "Button", label: "Button" },
                    { value: "Label", label: "Label" },
                    { value: "Header", label: "Header" },
                    { value: "Placeholder", label: "Placeholder" },
                    { value: "Error", label: "Error" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-text-muted uppercase">English Copy</label>
                <input
                  type="text"
                  placeholder="Enter master English string..."
                  value={newEnglish}
                  onChange={(e) => setNewEnglish(e.target.value)}
                  className="w-full h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-main">
                <button
                  type="button"
                  onClick={() => setIsAddTagOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-text-muted hover:bg-surface-hover rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-hover shadow-sm cursor-pointer"
                >
                  Create Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {pageId && <PublishModal 
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        onPublish={async (env, langCode) => {
          setIsPublishModalOpen(false);
          const isEng = langCode === "eng" || langCode === "en";
          const count = isEng 
            ? tags.filter(t => t.english && t.english.trim().length > 0).length 
            : tags.filter(t => t.values[langCode]?.status === "Approved").length;

          await StoreService.publish(
            pageId,
            pageInfo.name,
            langCode,
            env,
            count
          );
          showToast(`Published ${isEng ? 'English' : langCode} bundle to ${env} successfully!`);
        }}
        pageName={pageInfo.name}
        totalTags={tags.length}
        initialLanguage={selectedLanguage}
        availableLanguages={activeLangs}
        tags={tags}
      />}
    </div>
  );
}