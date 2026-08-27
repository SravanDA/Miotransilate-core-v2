import { RefreshCw, LayoutTemplate, Settings } from "lucide-react";
import type { PageSummary } from "../api";
import { LANGUAGES } from "../types";
import type { Environment } from "../types";
import { Button } from "./Button";

interface ToolbarProps {
  pages: PageSummary[];
  selectedPage: string;
  onSelectPage: (id: string) => void;
  selectedLang: string;
  onSelectLang: (lang: string) => void;
  selectedEnv: string;
  onSelectEnv: (env: string) => void;
  onRefresh: () => void;
  showChanges: boolean;
  onToggleChanges: (show: boolean) => void;
  onReset: (env?: string, pageId?: string) => void;
  currentView: 'playground' | 'settings';
  onViewChange: (view: 'playground' | 'settings') => void;
}

const ENVIRONMENTS: Environment[] = ["DEV", "QA", "PRODUCTION"];

export function Toolbar(props: ToolbarProps) {
  return (
    <div className="bg-white border-b border-[#DFE1E6] p-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-[#0052CC] font-bold text-lg">
          <LayoutTemplate className="w-5 h-5" />
          <span>MioSalon Playground</span>
        </div>

        <div className="flex items-center gap-3">
          <select 
            className="border border-[#DFE1E6] rounded px-3 py-1.5 text-sm bg-white text-[#172B4D] focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] focus:outline-none"
            value={props.selectedPage}
            onChange={e => props.onSelectPage(e.target.value)}
          >
            {props.pages.map(p => (
              <option key={p.pageId} value={p.pageId}>{p.pageName} ({p.pageId})</option>
            ))}
          </select>

          <select 
            className="border border-[#DFE1E6] rounded px-3 py-1.5 text-sm bg-white text-[#172B4D] focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] focus:outline-none"
            value={props.selectedLang}
            onChange={e => props.onSelectLang(e.target.value)}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>

          <select 
            className="border border-[#DFE1E6] rounded px-3 py-1.5 text-sm bg-white text-[#172B4D] focus:border-[#0052CC] focus:ring-1 focus:ring-[#0052CC] focus:outline-none"
            value={props.selectedEnv}
            onChange={e => props.onSelectEnv(e.target.value)}
          >
            {ENVIRONMENTS.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[#172B4D] cursor-pointer">
          <input 
            type="checkbox" 
            checked={props.showChanges} 
            onChange={e => props.onToggleChanges(e.target.checked)} 
            className="rounded border-[#DFE1E6] text-[#0052CC] focus:ring-[#0052CC]"
          />
          Show Changes
        </label>
        
        <div className="w-px h-6 bg-[#DFE1E6] mx-2" />

        <select 
          className="border border-[#DE350B]/30 rounded px-3 py-1.5 text-sm bg-white text-[#DE350B] focus:border-[#DE350B] focus:ring-1 focus:ring-[#DE350B] focus:outline-none"
          onChange={e => {
            if (e.target.value === "reset-all") props.onReset();
            if (e.target.value === "reset-env") props.onReset(props.selectedEnv);
            if (e.target.value === "reset-page") props.onReset(props.selectedEnv, props.selectedPage);
            e.target.value = "";
          }}
          value=""
        >
          <option value="" disabled>Reset...</option>
          <option value="reset-page">Reset Page in {props.selectedEnv}</option>
          <option value="reset-env">Reset entire {props.selectedEnv}</option>
          <option value="reset-all">Reset All Environments</option>
        </select>

        <Button 
          onClick={props.onRefresh}
          variant="outline"
          className="p-1.5"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-gray-600" />
        </Button>

        <Button 
          onClick={() => props.onViewChange(props.currentView === 'settings' ? 'playground' : 'settings')}
          variant={props.currentView === 'settings' ? 'primary' : 'outline'}
          className="p-1.5 ml-2"
          title="Data Import Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
