// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { 
  Globe, 
  Users, 
  Gear as SettingsIcon, 
  Database, 
  Plus, 
  Check,
  Upload,
  Download,
  FileCsv as FileSpreadsheet,
  CheckCircle,
  WarningCircle as AlertCircle,
  MagnifyingGlass as Search,
  ArrowsClockwise as RefreshCw,
  Stack as Layers,
  FileText,
  Clock,
  Sparkle as Sparkles,
  Trash as Trash2,
  Warning as AlertTriangle
} from "@phosphor-icons/react";
import { StoreService } from "../store/StoreService";
import type { LanguageConfig } from "../types";
import { RoleAccessModal } from "../components/auth/RoleAccessModal";
import { Dropdown } from "../components/ui/Dropdown";
import { Toggle } from "../components/ui/Toggle";
import { AdminService } from "../api/services/AdminService";
import { ApiService } from "../services/ApiService";
import { UserService, type UserWithRoles, type Role } from "../api/services/UserService";
import { MigrationService, type MockLsSyncStatus, type ImportSummary, type ImportValidationRow } from "../api/services/MigrationService";

const PAGE_NAME_MAPPINGS: Record<string, string> = {
  SERSET: "Service Settings",
  CUSINS: "Customer Insights",
  CAMREW: "Campaign & Rewards",
  POTSALESET: "POS / Sale Settings",
  STAFFSET: "Staff Settings",
  CUSWISH: "Customer Wishlist"
};
// Using types from MigrationService now

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [mockLsStatus, setMockLsStatus] = useState<MockLsSyncStatus>({
    hasMigrated: false,
    lastMigrationAt: null,
    pagesMigrated: 0,
    tagsMigrated: 0
  });

  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [reportSearch, setReportSearch] = useState("");
  const [reportFilter, setReportFilter] = useState<"ALL" | "IMPORTED" | "UPDATED" | "SKIPPED">("ALL");

  // User & Role State
  const [systemUsers, setSystemUsers] = useState<UserWithRoles[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [roleAssignmentUserId, setRoleAssignmentUserId] = useState<string | null>(null);
  const [roleToAssign, setRoleToAssign] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [languages, setLanguages] = useState<LanguageConfig[]>([]);
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangName, setNewLangName] = useState("");
  const [configEtag, setConfigEtag] = useState(0);

  const fetchMockLsStatus = async () => {
    try {
      const data = await MigrationService.getMockLsStatus();
      setMockLsStatus(data);
    } catch (e) {
      console.warn("Failed to fetch Mock LS sync status:", e);
    }
  };

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
      fetchMockLsStatus();
    };
    load();
    return StoreService.subscribe(() => setLanguages(StoreService.getLanguages()));
  }, []);

  const loadUsersAndRoles = async () => {
    setIsUsersLoading(true);
    try {
      const [users, roles] = await Promise.all([
        UserService.getUsers(),
        UserService.getRoles()
      ]);
      setSystemUsers(users);
      setAvailableRoles(roles.filter(r => r.isActive));
    } catch (e: any) {
      showToast(`Error loading users: ${e.message}`);
    } finally {
      setIsUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      loadUsersAndRoles();
    }
  }, [activeTab]);

  const [aiModel, setAiModel] = useState("Claude 3.5 Sonnet");
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [autoTranslate, setAutoTranslate] = useState(true);

  const toggleLanguage = (code: string) => {
    const newLangs = languages.map(l => l.code === code ? { ...l, active: !l.active } : l);
    StoreService.saveLanguages(newLangs);
    showToast("Language configuration updated");
  };

  // --- MOCK LS SYNC HANDLER ---
  const handleSyncFromMockLs = async () => {
    setIsSyncing(true);
    showToast("Migrating all pages & tags from Mock Language Services...");

    try {
      const data = await MigrationService.syncFromMockLs();

      setMockLsStatus({
        hasMigrated: true,
        lastMigrationAt: data.lastMigrationAt,
        pagesMigrated: data.pagesMigrated,
        tagsMigrated: data.tagsMigrated
      });

      // Refresh app-wide store cache
      await StoreService.refreshPages();

      showToast(`Migration complete! ${data.tagsMigrated} tags across ${data.pagesMigrated} pages migrated to DB.`);
    } catch (err: any) {
      console.error(err);
      showToast(`Migration error: ${err.message || "Failed to connect to backend"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- DELETE ALL MIGRATED DATA HANDLER ---
  const handleConfirmDeleteAllData = async () => {
    setIsDeleting(true);
    setShowDeleteModal(false);
    showToast("Deleting all migrated data...");

    try {
      await MigrationService.resetMigratedData();

      // Reset store cache
      StoreService.cache.pages = [];
      StoreService.cache.tags = {};
      StoreService.cache.pageDetails = {};
      await StoreService.refreshPages();

      setMockLsStatus({
        hasMigrated: false,
        lastMigrationAt: null,
        pagesMigrated: 0,
        tagsMigrated: 0
      });
      setImportSummary(null);

      showToast("All migrated pages, tags, and translation copies deleted.");
    } catch (err: any) {
      console.error(err);
      showToast(`Delete failed: ${err.message || "Could not connect to backend"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- USER & ROLE HANDLERS ---
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await UserService.inviteUser({
        email: inviteEmail,
        displayName: inviteName,
        initialPassword: invitePassword
      });
      if (inviteRole) {
        await UserService.assignRole(user.userId, inviteRole);
      }
      showToast("User invited successfully");
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      setInviteRole("");
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(`Error inviting user: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await UserService.updateUserStatus(userId, !currentStatus);
      showToast(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(`Error updating user status: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleAssignRole = async (userId: string) => {
    if (!roleToAssign) return;
    try {
      await UserService.assignRole(userId, roleToAssign);
      showToast("Role assigned successfully");
      setRoleAssignmentUserId(null);
      setRoleToAssign("");
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(`Error assigning role: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleRevokeRole = async (assignmentId: string) => {
    try {
      await UserService.revokeRole(assignmentId);
      showToast("Role revoked successfully");
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(`Error revoking role: ${err.response?.data?.message || err.message}`);
    }
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

        const existingTag = StoreService.getTag(pageId, tagName);
        const values: Record<string, any> = existingTag?.values || {};

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

      // 2. Also send to backend /v1/migrations API
      try {
        const formData = new FormData();
        formData.append("file", file);
        const importEvent = await MigrationService.uploadImportFile(formData);
        
        if (importEvent?.importEventId) {
          await MigrationService.executeImport(importEvent.importEventId);
        }
      } catch (err) {
        console.warn("Backend migration sync fallback (local store updated):", err);
      }

      await StoreService.refreshPages();
      await fetchMockLsStatus();

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

  const formatMigrationTimestamp = (ts: string | null) => {
    if (!ts) return "Never migrated";
    try {
      const d = new Date(ts);
      return d.toLocaleDateString(undefined, { 
        month: "short", 
        day: "numeric", 
        year: "numeric",
        hour: "numeric", 
        minute: "2-digit" 
      });
    } catch {
      return ts;
    }
  };

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
          <Check className="w-4 h-4 text-[#79F2C0]" weight="bold" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border-main rounded-xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
                <AlertTriangle className="w-5 h-5" weight="fill" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-main">Delete All Migrated Data?</h3>
                <p className="text-xs text-text-subtle mt-0.5">This action will clear the database registry.</p>
              </div>
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              This will remove all <strong>{mockLsStatus.pagesMigrated || 6} pages</strong>, <strong>{mockLsStatus.tagsMigrated || 834} tags</strong>, approved English master strings, and translations from the database. You can re-migrate them anytime from Mock LS.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-main">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteAllData}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded cursor-pointer transition-colors shadow-sm flex items-center gap-1.5"
              >
                {isDeleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" weight="fill" />}
                Yes, Delete All Data
              </button>
            </div>
          </div>
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
          <Globe className="w-4 h-4" weight="fill" />
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
          <Users className="w-4 h-4" weight="fill" />
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
          <SettingsIcon className="w-4 h-4" weight="fill" />
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
          <Database className="w-4 h-4" weight="fill" />
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
              <Plus className="w-3.5 h-3.5" weight="bold" />
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
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" weight="bold" />
              Invite User
            </button>
          </div>
          
          {showInviteModal && (
            <div className="p-4 bg-surface-hover border-b border-border-main">
              <form onSubmit={handleInviteUser} className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-subtle mb-1">Email</label>
                  <input 
                    type="email" required placeholder="user@miosalon.com" 
                    value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                    className="w-full h-8 px-3 border border-border-main rounded text-sm outline-none focus:border-primary bg-surface text-text-main"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-subtle mb-1">Display Name</label>
                  <input 
                    type="text" required placeholder="John Doe" 
                    value={inviteName} onChange={e => setInviteName(e.target.value)}
                    className="w-full h-8 px-3 border border-border-main rounded text-sm outline-none focus:border-primary bg-surface text-text-main"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-subtle mb-1">Initial Password</label>
                  <input 
                    type="text" required placeholder="ChangeMe123!" 
                    value={invitePassword} onChange={e => setInvitePassword(e.target.value)}
                    className="w-full h-8 px-3 border border-border-main rounded text-sm outline-none focus:border-primary bg-surface text-text-main"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-bold text-text-subtle mb-1">Initial Role</label>
                  <Dropdown
                    value={inviteRole}
                    onChange={setInviteRole}
                    className="w-full"
                    options={[
                      { value: "", label: "(None)" },
                      ...availableRoles.map(r => ({ value: r.roleCode, label: r.roleName }))
                    ]}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button type="submit" className="h-8 px-4 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded cursor-pointer transition-colors shadow-sm">
                    Create User
                  </button>
                  <button type="button" onClick={() => setShowInviteModal(false)} className="h-8 px-4 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded cursor-pointer transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {isUsersLoading ? (
            <div className="p-16 text-center text-text-muted text-sm font-medium flex flex-col items-center">
              <RefreshCw className="w-6 h-6 animate-spin mb-3 text-border-main" weight="bold" />
              <p>Loading users...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-main border-collapse">
                <thead className="bg-surface-hover/70 border-b border-border-main text-xs uppercase font-bold text-text-muted tracking-wider">
                  <tr>
                    <th className="px-6 py-4 border-r border-border-main/50 w-1/4">USER</th>
                    <th className="px-6 py-4 border-r border-border-main/50">ASSIGNED ROLES</th>
                    <th className="px-6 py-4 w-28 text-center">ACTIVE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-main">
                  {systemUsers.map((ur) => (
                    <tr key={ur.user.userId} className={`transition-colors ${!ur.user.isActive ? "bg-red-50/30 opacity-75" : "hover:bg-surface-hover"}`}>
                      <td className="px-6 py-4 border-r border-border-main/50">
                        <div className="font-bold text-text-main">{ur.user.displayName}</div>
                        <div className="text-xs text-text-subtle">{ur.user.email}</div>
                      </td>
                      <td className="px-6 py-4 border-r border-border-main/50">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2 items-center">
                            {ur.roles.map(roleAssignment => (
                              <div key={roleAssignment.assignmentId} className="flex items-center bg-primary/5 border border-primary/20 rounded pl-2 text-xs font-bold text-primary">
                                <span className="py-1 pr-1.5">{roleAssignment.role}</span>
                                <button 
                                  onClick={() => handleRevokeRole(roleAssignment.assignmentId)}
                                  title="Revoke Role"
                                  className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-r border-l border-primary/20 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" weight="fill" />
                                </button>
                              </div>
                            ))}
                            {roleAssignmentUserId !== ur.user.userId && (
                              <button 
                                onClick={() => setRoleAssignmentUserId(ur.user.userId)}
                                className="h-6 px-2 text-[10px] font-bold border border-border-main border-dashed text-text-subtle hover:text-primary hover:border-primary rounded cursor-pointer transition-colors uppercase tracking-wider"
                              >
                                + Add Role
                              </button>
                            )}
                          </div>
                          
                          {roleAssignmentUserId === ur.user.userId && (
                            <div className="flex items-center gap-2 mt-1">
                              <Dropdown
                                value={roleToAssign}
                                onChange={setRoleToAssign}
                                className="w-48"
                                options={[
                                  { value: "", label: "Select role..." },
                                  ...availableRoles
                                    .filter(r => !ur.roles.find(assigned => assigned.role === r.roleCode))
                                    .map(r => ({ value: r.roleCode, label: r.roleName }))
                                ]}
                              />
                              <button 
                                onClick={() => handleAssignRole(ur.user.userId)}
                                disabled={!roleToAssign}
                                className="h-7 px-3 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded cursor-pointer transition-colors shadow-sm"
                              >
                                Assign
                              </button>
                              <button 
                                onClick={() => { setRoleAssignmentUserId(null); setRoleToAssign(""); }}
                                className="h-7 px-3 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded cursor-pointer transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <Toggle 
                            checked={ur.user.isActive} 
                            onChange={() => handleToggleUserStatus(ur.user.userId, ur.user.isActive)} 
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {systemUsers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-text-muted text-sm">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
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
              <Dropdown
                value={aiModel}
                onChange={setAiModel}
                className="w-full"
                options={[
                  { value: "Claude 3.5 Sonnet", label: "Claude 3.5 Sonnet" },
                  { value: "GPT-4o", label: "GPT-4o" },
                  { value: "Gemini 1.5 Pro", label: "Gemini 1.5 Pro" },
                ]}
              />
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
              <h2 className="text-base font-bold text-text-main">Data Synchronization & Migration</h2>
              <p className="text-xs text-text-subtle mt-0.5">Synchronize pages and tags from Mock Language Services or import/export CSV bundles</p>
            </div>

            {/* Hidden File Input */}
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Action Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Migrate from Mock LS */}
              <div className="border border-border-main rounded-xl p-5 flex flex-col gap-3 justify-between bg-surface-hover/30 relative">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" weight="fill" />
                      <h3 className="text-sm font-bold text-text-main">Migrate from Mock LS</h3>
                    </div>
                    {mockLsStatus.hasMigrated && (
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" weight="bold" /> Synced
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-subtle">
                    Extract all pages, tags, and English UX copy from Mock MioSalon / Language Services directly into MioTranslate DB.
                  </p>
                  
                  {/* Last Migration Timestamp display */}
                  <div className="mt-2 pt-2 border-t border-border-main/50 flex items-center gap-1.5 text-xs text-text-muted">
                    <Clock className="w-3.5 h-3.5 text-text-subtle" weight="bold" />
                    <span>Last Migration: <strong className="text-text-main font-semibold">{formatMigrationTimestamp(mockLsStatus.lastMigrationAt)}</strong></span>
                  </div>
                  {mockLsStatus.hasMigrated && mockLsStatus.pagesMigrated > 0 && (
                    <div className="text-[11px] text-text-subtle">
                      {mockLsStatus.pagesMigrated} pages • {mockLsStatus.tagsMigrated} tags in database
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={handleSyncFromMockLs}
                    disabled={isSyncing || isDeleting}
                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover w-full transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" weight="bold" />
                        Migrating from Mock LS...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" weight="bold" />
                        Migrate from Mock LS
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowDeleteModal(true)}
                    disabled={isDeleting || isSyncing}
                    className="px-4 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded w-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" weight="bold" />
                        Deleting Data...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" weight="fill" />
                        Delete All Migrated Data
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Card 2: Import CSV */}
              <div className="border border-border-main rounded-xl p-5 flex flex-col gap-3 justify-between bg-surface-hover/30">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" weight="bold" />
                    <h3 className="text-sm font-bold text-text-main">Import Translation CSV</h3>
                  </div>
                  <p className="text-xs text-text-subtle">
                    Upload offline agency translations or tag lists to batch-update target locale tags.
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded w-full transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" weight="bold" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" weight="fill" />
                      Upload CSV File
                    </>
                  )}
                </button>
              </div>

              {/* Card 3: Export */}
              <div className="border border-border-main rounded-xl p-5 flex flex-col gap-3 justify-between bg-surface-hover/30">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-primary" weight="bold" />
                    <h3 className="text-sm font-bold text-text-main">Export Full Catalog</h3>
                  </div>
                  <p className="text-xs text-text-subtle">
                    Download all registered pages, tags, translations, and version history in standard JSON format.
                  </p>
                </div>
                <button
                  onClick={handleExportJson}
                  className="px-4 py-2 bg-surface hover:bg-surface-hover border border-border-main text-text-main text-xs font-bold rounded w-full transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" weight="bold" />
                  Export JSON
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
                    <CheckCircle className="w-5 h-5" weight="fill" />
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
                    <Layers className="w-4 h-4 text-text-muted" weight="fill" />
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
                      <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" weight="bold" />
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
