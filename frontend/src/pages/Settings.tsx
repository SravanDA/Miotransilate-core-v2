// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { 
  Globe, 
  Users, 
  Settings as SettingsIcon, 
  Database, 
  Plus, 
  Check,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Layers,
  FileText
} from "lucide-react";
import { StoreService } from "../store/StoreService";
import type { LanguageConfig } from "../types";
import { Toggle } from "../components/ui/Toggle";
import { AdminService } from "../api/services/AdminService";
import { ApiService } from "../services/ApiService";

const PAGE_NAME_MAPPINGS: Record<string, string> = {
  SERSET: "Service Settings",
  CUSINS: "Customer Insights",
  CAMREW: "Campaign & Rewards",
  POTSALESET: "POS / Sale Settings",
  STAFFSET: "Staff Settings",
  CUSWISH: "Customer Wishlist"
};

interface ImportValidationRow {
  rowNumber: number;
  pageId: string;
  tagName: string;
  englishText: string;
  status: "IMPORTED" | "UPDATED" | "SKIPPED";
  reason: string;
}

interface ImportSummary {
  fileName: string;
  fileSizeBytes: number;
  totalRows: number;
  pagesCount: number;
  tagsCount: number;
  translationsCount: number;
  timestamp: string;
  rows: ImportValidationRow[];
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function Settings() {
  const [activeTab, setActiveTab] = useState<"languages" | "users" | "config" | "data">("languages");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [reportSearch, setReportSearch] = useState("");
  const [reportFilter, setReportFilter] = useState<"ALL" | "IMPORTED" | "UPDATED" | "SKIPPED">("ALL");

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

  // --- CSV FILE UPLOAD HANDLER ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    showToast(`Reading ${file.name}...`);

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length === 0) {
        showToast("The CSV file is empty.");
        setIsImporting(false);
        return;
      }

      // Check header row
      let pageIdx = 0;
      let tagIdx = 1;
      let englishIdx = 2;
      let startRow = 0;
      const extraLangIndices: { [code: string]: number } = {};

      const firstRow = rows[0].map(c => c.toLowerCase());
      const hasHeader = firstRow.some(c => 
        c.includes("page") || c.includes("tag") || c.includes("content") || c.includes("english") || c.includes("text")
      );

      if (hasHeader) {
        startRow = 1;
        firstRow.forEach((col, idx) => {
          if (col.includes("page")) pageIdx = idx;
          else if (col.includes("tag") || col.includes("key")) tagIdx = idx;
          else if (col.includes("content") || col.includes("english") || col.includes("text")) englishIdx = idx;
          else {
            // Check if column is a language code like ar, es, fr, de, etc.
            const matchedLang = languages.find(l => l.code.toLowerCase() === col || l.name.toLowerCase() === col);
            if (matchedLang) {
              extraLangIndices[matchedLang.code] = idx;
            }
          }
        });
      }

      const validationRows: ImportValidationRow[] = [];
      const touchedPages = new Set<string>();
      let importedTagsCount = 0;
      let translationsCount = 0;

      // 1. Process client-side store integration
      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        const pageId = (row[pageIdx] || "").trim().toUpperCase();
        const tagName = (row[tagIdx] || "").trim();
        const englishText = (row[englishIdx] || "").trim();

        if (!pageId || !tagName) {
          validationRows.push({
            rowNumber: i + 1,
            pageId: pageId || "UNKNOWN",
            tagName: tagName || "UNKNOWN",
            englishText: englishText || "",
            status: "SKIPPED",
            reason: "Missing PageId or TagName"
          });
          continue;
        }

        touchedPages.add(pageId);

        // Ensure page exists in StoreService
        let page = StoreService.getPage(pageId);
        if (!page) {
          const pageName = PAGE_NAME_MAPPINGS[pageId] || `${pageId} Module`;
          page = {
            pageId: pageId,
            name: pageName,
            module: pageName,
            status: "Active",
            createdAt: new Date().toISOString()
          };
          StoreService.createPage(page);
        }

        // Check if tag already exists
        const existingTag = StoreService.getTag(pageId, tagName);
        const values: Record<string, any> = existingTag?.values || {};

        // Ingest extra translations from other columns if present
        Object.entries(extraLangIndices).forEach(([langCode, colIdx]) => {
          const transText = (row[colIdx] || "").trim();
          if (transText) {
            values[langCode] = {
              text: transText,
              status: "Approved",
              confidence: 100,
              translatedAtEnglishVersion: 1,
              lastUpdated: new Date().toISOString()
            };
            translationsCount++;
          }
        });

        if (existingTag) {
          existingTag.english = englishText || existingTag.english;
          existingTag.values = { ...existingTag.values, ...values };
          existingTag.updatedAt = new Date().toISOString();
          validationRows.push({
            rowNumber: i + 1,
            pageId,
            tagName,
            englishText,
            status: "UPDATED",
            reason: "Updated existing tag English & values"
          });
        } else {
          const newTag = {
            id: tagName,
            pageId,
            type: "TEXT",
            english: englishText,
            englishVersion: 1,
            values: values,
            comments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          StoreService.initEmptyValuesForTag(newTag);
          StoreService.createTag(pageId, newTag);
          importedTagsCount++;
          validationRows.push({
            rowNumber: i + 1,
            pageId,
            tagName,
            englishText,
            status: "IMPORTED",
            reason: "Created new tag with Approved English copy"
          });
        }
      }

      // 2. Also send to backend /v1/migrations API if backend is running
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/v1/migrations", {
          method: "POST",
          body: formData
        });
        if (res.ok) {
          const importEvent = await res.json();
          if (importEvent?.importEventId) {
            await fetch(`/v1/migrations/${importEvent.importEventId}/execute`, { method: "POST" });
          }
        }
      } catch (err) {
        console.warn("Backend migration sync fallback (local store updated):", err);
      }

      const summary: ImportSummary = {
        fileName: file.name,
        fileSizeBytes: file.size,
        totalRows: rows.length - startRow,
        pagesCount: touchedPages.size,
        tagsCount: importedTagsCount,
        translationsCount: translationsCount,
        timestamp: new Date().toLocaleTimeString(),
        rows: validationRows
      };

      setImportSummary(summary);
      showToast(`Successfully imported ${summary.totalRows} strings across ${summary.pagesCount} pages!`);
    } catch (err: any) {
      console.error(err);
      showToast(`Import failed: ${err.message || "Invalid file"}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // --- CATALOG JSON EXPORT HANDLER ---
  const handleExportJson = () => {
    try {
      const allPages = StoreService.getPages();
      const activeLanguages = StoreService.getActiveLanguages();
      
      const exportData = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        activeLanguages: activeLanguages.map(l => ({ code: l.code, name: l.name, direction: l.direction })),
        totalPages: allPages.length,
        pages: allPages.map(page => {
          const tags = StoreService.getTags(page.pageId);
          return {
            pageId: page.pageId,
            name: page.name,
            module: page.module,
            status: page.status,
            tagsCount: tags.length,
            tags: tags.map(tag => ({
              id: tag.id,
              type: tag.type,
              english: tag.english,
              englishVersion: tag.englishVersion,
              translations: tag.values
            }))
          };
        })
      };

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `miotranslate_catalog_export_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("Full catalog exported successfully!");
    } catch (e: any) {
      showToast(`Export failed: ${e.message}`);
    }
  };

  // Filtered rows for validation table
  const filteredRows = importSummary?.rows.filter(r => {
    if (reportFilter !== "ALL" && r.status !== reportFilter) return false;
    if (reportSearch) {
      const q = reportSearch.toLowerCase();
      return r.pageId.toLowerCase().includes(q) || 
             r.tagName.toLowerCase().includes(q) || 
             r.englishText.toLowerCase().includes(q) ||
             r.reason.toLowerCase().includes(q);
    }
    return true;
  }) || [];

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

      {/* TAB 4: DATA IMPORT & EXPORT */}
      {activeTab === "data" && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-border-main rounded-xl shadow-sm p-6 flex flex-col gap-6">
            <div>
              <h2 className="text-base font-bold text-text-main">Data Export & Import</h2>
              <p className="text-xs text-text-subtle mt-0.5">Export all localization keys as JSON bundles or import translations from CSV/XLIFF</p>
            </div>

            {/* Hidden File Input */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Export */}
              <div className="border border-border-main rounded-xl p-5 flex flex-col gap-3 justify-between bg-surface-hover/30">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-text-main">Export Full Catalog</h3>
                  </div>
                  <p className="text-xs text-text-subtle">
                    Download all registered pages, tags, translations, and version history in standard JSON format.
                  </p>
                </div>
                <button
                  onClick={handleExportJson}
                  className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded w-fit transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export JSON
                </button>
              </div>

              {/* Card 2: Import */}
              <div className="border border-border-main rounded-xl p-5 flex flex-col gap-3 justify-between bg-surface-hover/30">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-text-main">Import Translation CSV</h3>
                  </div>
                  <p className="text-xs text-text-subtle">
                    Upload offline agency translations or tag lists to batch-update target locale tags.
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover w-fit transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Upload CSV File
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Validation & Import Summary Report */}
          {importSummary && (
            <div className="bg-surface border border-border-main rounded-xl shadow-sm p-6 flex flex-col gap-6 animate-fadeIn">
              <div className="flex items-center justify-between pb-4 border-b border-border-main">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-main">Import Completed Successfully</h3>
                    <p className="text-xs text-text-subtle">File: <span className="font-mono font-medium">{importSummary.fileName}</span> ({Math.round(importSummary.fileSizeBytes / 1024)} KB) at {importSummary.timestamp}</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                  Verified
                </span>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-surface-hover/50 rounded-lg border border-border-main/50 flex flex-col">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Rows</span>
                  <span className="text-2xl font-bold text-text-main mt-1">{importSummary.totalRows}</span>
                </div>
                <div className="p-4 bg-surface-hover/50 rounded-lg border border-border-main/50 flex flex-col">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Pages Touched</span>
                  <span className="text-2xl font-bold text-primary mt-1">{importSummary.pagesCount}</span>
                </div>
                <div className="p-4 bg-surface-hover/50 rounded-lg border border-border-main/50 flex flex-col">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Tags Processed</span>
                  <span className="text-2xl font-bold text-emerald-600 mt-1">{importSummary.rows.filter(r => r.status !== 'SKIPPED').length}</span>
                </div>
                <div className="p-4 bg-surface-hover/50 rounded-lg border border-border-main/50 flex flex-col">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Translations Added</span>
                  <span className="text-2xl font-bold text-amber-600 mt-1">{importSummary.translationsCount}</span>
                </div>
              </div>

              {/* Validation Report Table */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-text-muted" />
                    <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">Validation Row Log ({filteredRows.length} of {importSummary.rows.length})</h4>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1 bg-surface-hover p-1 rounded-lg border border-border-main text-xs">
                      {(["ALL", "IMPORTED", "UPDATED", "SKIPPED"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setReportFilter(tab)}
                          className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
                            reportFilter === tab 
                              ? "bg-surface text-primary shadow-xs" 
                              : "text-text-muted hover:text-text-main"
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input 
                        placeholder="Filter rows..."
                        value={reportSearch}
                        onChange={e => setReportSearch(e.target.value)}
                        className="h-8 pl-8 pr-3 bg-surface border border-border-main rounded text-xs text-text-main outline-none focus:border-primary w-48"
                      />
                    </div>
                  </div>
                </div>

                <div className="border border-border-main rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface-hover/80 border-b border-border-main font-bold text-text-muted sticky top-0 uppercase">
                      <tr>
                        <th className="px-4 py-2.5 w-16">Row</th>
                        <th className="px-4 py-2.5 w-28">Page ID</th>
                        <th className="px-4 py-2.5 w-48">Tag Key</th>
                        <th className="px-4 py-2.5">English Copy / Value</th>
                        <th className="px-4 py-2.5 w-28 text-center">Status</th>
                        <th className="px-4 py-2.5 w-44">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main/50 bg-surface">
                      {filteredRows.map((r, i) => (
                        <tr key={i} className="hover:bg-surface-hover/50 transition-colors">
                          <td className="px-4 py-2 font-mono text-text-muted">{r.rowNumber}</td>
                          <td className="px-4 py-2 font-bold text-text-main">{r.pageId}</td>
                          <td className="px-4 py-2 font-mono text-text-main font-medium">{r.tagName}</td>
                          <td className="px-4 py-2 text-text-main truncate max-w-xs">{r.englishText}</td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.status === 'IMPORTED' ? 'bg-emerald-50 text-emerald-700' :
                              r.status === 'UPDATED' ? 'bg-blue-50 text-blue-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-text-subtle text-[11px] truncate max-w-xs">{r.reason}</td>
                        </tr>
                      ))}
                      {filteredRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                            No rows match your filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
