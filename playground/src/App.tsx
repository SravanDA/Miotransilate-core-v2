import { useState, useEffect } from "react";
import type { PageSummary, RenderResult, ChangeResult } from "./api";
import { PlaygroundApi } from "./api";
import type { Environment, Language } from "./types";
import { Toolbar } from "./components/Toolbar";
import { PageRenderer } from "./components/PageRenderer";
import { ChangedTagsPanel } from "./components/ChangedTagsPanel";

function App() {
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>("SERSET");
  const [selectedLang, setSelectedLang] = useState<Language>("eng");
  const [selectedEnv, setSelectedEnv] = useState<Environment>("DEV");
  
  const [renderData, setRenderData] = useState<RenderResult | null>(null);
  const [changeData, setChangeData] = useState<ChangeResult | null>(null);
  const [showChanges, setShowChanges] = useState(false);

  const loadPages = async () => {
    try {
      const p = await PlaygroundApi.getPages();
      setPages(p);
      if (p.length > 0 && !p.find(x => x.pageId === selectedPage)) {
        setSelectedPage(p[0].pageId);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadData = async () => {
    if (!selectedPage) return;
    try {
      const rd = await PlaygroundApi.renderPage(selectedPage, selectedLang, selectedEnv);
      setRenderData(rd);
      
      const cd = await PlaygroundApi.getChanges(selectedPage, selectedLang, selectedEnv);
      setChangeData(cd);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedPage, selectedLang, selectedEnv]);

  const handleReset = async (env?: string, pageId?: string) => {
    await PlaygroundApi.reset(env, pageId);
    await loadData();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F6F7] font-sans">
      <Toolbar 
        pages={pages}
        selectedPage={selectedPage}
        onSelectPage={setSelectedPage}
        selectedLang={selectedLang}
        onSelectLang={(l) => setSelectedLang(l as Language)}
        selectedEnv={selectedEnv}
        onSelectEnv={(e) => setSelectedEnv(e as Environment)}
        onRefresh={loadData}
        showChanges={showChanges}
        onToggleChanges={setShowChanges}
        onReset={handleReset}
      />
      
      <div className="flex-1 overflow-auto p-8 flex justify-center">
        <div className="w-full max-w-4xl">
          {renderData ? (
            <PageRenderer renderData={renderData} changeData={changeData} showChanges={showChanges} />
          ) : (
            <div className="text-center p-8 text-gray-500">Loading...</div>
          )}
        </div>
      </div>

      <ChangedTagsPanel changeData={changeData} showChanges={showChanges} />
    </div>
  );
}

export default App;
