// @ts-nocheck
import { useState, useEffect } from "react";
import { 
  Globe, 
  Users, 
  Settings as SettingsIcon, 
  Database, 
  Plus, 
  Check
} from "lucide-react";
import { StoreService } from "../store/StoreService";
import type { LanguageConfig } from "../types";
import { Toggle } from "../components/ui/Toggle";
import { AdminService } from "../api/services/AdminService";

export function Settings() {
  const [activeTab, setActiveTab] = useState<"languages" | "users" | "config" | "data">("languages");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [languages, setLanguages] = useState<LanguageConfig[]>([]);
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangName, setNewLangName] = useState("");
  const [configEtag, setConfigEtag] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLanguages(StoreService.getLanguages());
      try {
        const conf = await AdminService.getConfig();
        const thresh = conf.find(c => c.configKey === "AI_CONFIDENCE_THRESHOLD");
        if (thresh) {
          setConfidenceThreshold(parseInt(thresh.configValue, 10));
          setConfigEtag(thresh.etagVersion);
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
    return StoreService.subscribe(() => setLanguages(StoreService.getLanguages()));
  }, []);

  const [aiModel, setAiModel] = useState("Claude 3.5 Sonnet");
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [autoTranslate, setAutoTranslate] = useState(true);

  const toggleLanguage = (code: string) => {
    const newLangs = languages.map(l => l.code === code ? { ...l, active: !l.active } : l);
    StoreService.saveLanguages(newLangs);
    showToast("Language configuration updated");
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#172B4D] text-white px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-[#79F2C0]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-main">Settings</h1>
        <p className="text-sm text-text-subtle mt-0.5">Manage languages, users, roles, and translation services</p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-border-main gap-8 text-sm font-bold">
        <button
          onClick={() => setActiveTab("languages")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "languages"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <Globe className="w-4 h-4" />
          Languages
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "users"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <Users className="w-4 h-4" />
          Users & Roles
        </button>
        <button
          onClick={() => setActiveTab("config")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "config"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          Configuration
        </button>
        <button
          onClick={() => setActiveTab("data")}
          className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "data"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-text-muted hover:text-text-main"
          }`}
        >
          <Database className="w-4 h-4" />
          Data Import / Export
        </button>
      </div>

      {/* TAB 1: LANGUAGES */}
      {activeTab === "languages" && (
        <div className="bg-surface border border-border-main rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border-main flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-main">Supported Languages</h2>
              <p className="text-xs text-text-subtle mt-0.5">Activate or deactivate target localization locales</p>
            </div>
            <button 
              onClick={() => setShowAddLanguage(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Language
            </button>
          </div>

          {showAddLanguage && (
            <div className="p-4 bg-surface-hover border-b border-border-main flex items-center gap-4">
              <input 
                placeholder="e.g., pt-BR" 
                value={newLangCode} 
                onChange={e => setNewLangCode(e.target.value)} 
                className="h-8 px-3 border border-border-main rounded text-sm w-32 outline-none focus:border-primary bg-surface text-text-main"
              />
              <input 
                placeholder="e.g., Portuguese" 
                value={newLangName} 
                onChange={e => setNewLangName(e.target.value)} 
                className="h-8 px-3 border border-border-main rounded text-sm flex-1 outline-none focus:border-primary bg-surface text-text-main"
              />
              <button 
                type="submit" 
                onClick={async () => {
                  try {
                    await AdminService.addLanguage({ languageCode: newLangCode, languageName: newLangName, direction: "LTR" });
                    showToast(`Language ${newLangName} added.`);
                    setShowAddLanguage(false);
                    setNewLangCode("");
                    setNewLangName("");
                  } catch (e) {
                    showToast("Error adding language");
                  }
                }}
                className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded cursor-pointer"
              >
                Submit
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-text-main border-collapse">
              <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider">
                <tr>
                  <th className="px-6 py-4 border-r border-border-main/50">LANGUAGE</th>
                  <th className="px-6 py-4 border-r border-border-main/50 w-28">ISO CODE</th>
                  <th className="px-6 py-4 border-r border-border-main/50 w-32">NATIVE NAME</th>
                  <th className="px-6 py-4 border-r border-border-main/50 w-28">DIRECTION</th>
                  <th className="px-6 py-4 w-28 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {languages.map((lang) => (
                  <tr key={lang.code} className="hover:bg-surface-hover transition-colors">
                    <td className="px-6 py-4 border-r border-border-main/50 font-bold text-text-main">
                      {lang.name}
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 font-mono text-xs text-text-muted">
                      {lang.code.toUpperCase()}
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50 font-bold">
                      {lang.nativeName}
                    </td>
                    <td className="px-6 py-4 border-r border-border-main/50">
                      <span className="px-2 py-0.5 bg-surface-active text-text-muted text-xs font-bold rounded">
                        {lang.direction}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <Toggle 
                          checked={lang.active} 
                          onChange={() => toggleLanguage(lang.code)} 
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: USERS */}
      {activeTab === "users" && (
        <div className="bg-surface border border-border-main rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border-main flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-main">System Users & Roles</h2>
              <p className="text-xs text-text-subtle mt-0.5">Manage access control across the MioTranslate suite</p>
            </div>
            <button 
              onClick={() => showToast("Invite User modal")}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Invite User
            </button>
          </div>
          <div className="p-16 text-center text-text-muted text-sm font-medium">
            <Users className="w-8 h-8 mx-auto mb-3 text-border-main" />
            <p>Role management module is not available in the current preview.</p>
          </div>
        </div>
      )}

      {/* TAB 3: CONFIGURATION */}
      {activeTab === "config" && (
        <div className="bg-surface border border-border-main rounded-xl shadow-sm flex flex-col max-w-2xl">
          <div className="p-4 border-b border-border-main">
            <h2 className="text-sm font-bold text-text-main">Translation Engine Configuration</h2>
            <p className="text-xs text-text-subtle mt-0.5">Global settings for AI translations and workflow automation</p>
          </div>

          <div className="p-6 flex flex-col gap-6">
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-main">Primary AI Engine</label>
              <select 
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full h-9 px-3 bg-surface border border-border-main rounded text-sm text-text-main focus:border-primary outline-none cursor-pointer"
              >
                <option>Claude 3.5 Sonnet</option>
                <option>GPT-4o</option>
                <option>Gemini 1.5 Pro</option>
              </select>
              <span className="text-xs text-text-subtle">Select the provider used for bulk translation generation</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-text-main">Confidence Threshold ({confidenceThreshold}%)</label>
              <input 
                type="range" 
                min="50" max="99" 
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <span className="text-xs text-text-subtle">Translations scoring below {confidenceThreshold}% are routed directly to Language Reviewers</span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border-main">
              <div>
                <div className="text-sm font-semibold text-text-main">Auto-Translate on Master English Update</div>
                <div className="text-xs text-text-subtle">Automatically generate draft translations for all active locales when English is updated</div>
              </div>
              <Toggle 
                checked={autoTranslate} 
                onChange={setAutoTranslate} 
              />
            </div>

            <div className="pt-2">
              <button
                onClick={async () => {
                  try {
                    await AdminService.updateConfig("AI_CONFIDENCE_THRESHOLD", String(confidenceThreshold), configEtag);
                    showToast("Configuration saved");
                  } catch (e: any) {
                    if (e.response && e.response.status === 409) {
                      showToast("Conflict: Configuration modified by another user.");
                    } else {
                      showToast("Error saving configuration");
                    }
                  }
                }}
                className="px-4 py-2 bg-primary text-white text-sm font-bold rounded hover:bg-primary-hover shadow-sm cursor-pointer"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATA IMPORT */}
      {activeTab === "data" && (
        <div className="bg-surface border border-border-main rounded-xl shadow-sm p-6 flex flex-col gap-6">
          <div>
            <h2 className="text-base font-bold text-text-main">Data Export & Import</h2>
            <p className="text-xs text-text-subtle mt-0.5">Export all localization keys as JSON bundles or import translations from CSV/XLIFF</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-border-main rounded-xl p-5 flex flex-col gap-3">
              <h3 className="text-sm font-bold text-text-main">Export Full Catalog</h3>
              <p className="text-xs text-text-subtle">Download all registered pages, tags, translations, and version history in standard JSON format.</p>
              <button
                onClick={() => showToast("Exporting full catalog...")}
                className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded w-fit transition-colors cursor-pointer shadow-sm"
              >
                Export JSON
              </button>
            </div>

            <div className="border border-border-main rounded-xl p-5 flex flex-col gap-3">
              <h3 className="text-sm font-bold text-text-main">Import Translation CSV</h3>
              <p className="text-xs text-text-subtle">Upload offline agency translations to batch-update target locale tags.</p>
              <button
                onClick={() => showToast("Opening file selector...")}
                className="px-4 py-2 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover w-fit transition-colors cursor-pointer shadow-sm"
              >
                Upload CSV File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
