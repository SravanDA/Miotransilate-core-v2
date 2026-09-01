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
 MagnifyingGlass as Search,
 ArrowsClockwise as RefreshCw,
 Stack as Layers,
 Clock,
 Sparkle as Sparkles,
 Trash as Trash2,
 Warning as AlertTriangle
} from "@phosphor-icons/react";
import { StoreService, type LengthConflictConfig } from "../store/StoreService";
import type { LanguageConfig } from "../types";
import { useToast } from "../contexts/ToastContext";
import { Dropdown } from "../components/ui/Dropdown";
import { Toggle } from "../components/ui/Toggle";
import { Slider } from "../components/ui/Slider";
import { AdminService } from "../api/services/AdminService";
import { UserService, type UserWithRoles, type Role, type UserRoleAssignment } from "../api/services/UserService";
import { MigrationService, type MockLsSyncStatus, type ImportSummary, type ImportValidationRow } from "../api/services/MigrationService";

const DEFAULT_SYSTEM_ROLES: Role[] = [
  { roleCode: "DEV", roleName: "Developer", description: "View-only access in workspace", isActive: true, isSystem: true },
  { roleCode: "PM", roleName: "Product Manager", description: "Authors English copy, creates pages/tags", isActive: true, isSystem: true },
  { roleCode: "QA", roleName: "Quality Assurance", description: "Reviews and authoring of English copy", isActive: true, isSystem: true },
  { roleCode: "LR", roleName: "Localization Reviewer", description: "Translates and approves language translations", isActive: true, isSystem: true },
  { roleCode: "SR", roleName: "Support Reviewer", description: "Approves English copy and production releases", isActive: true, isSystem: true },
  { roleCode: "ADMIN", roleName: "Administrator", description: "System user & configuration management", isActive: true, isSystem: true },
  { roleCode: "FN", roleName: "Founder", description: "Full system authority and overrides", isActive: true, isSystem: true },
];

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
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  let delimiter = ',';
  if (firstLine.includes('\t') && (!firstLine.includes(',') || (firstLine.match(/\t/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0))) {
    delimiter = '\t';
  } else if (firstLine.includes(';') && (!firstLine.includes(',') || (firstLine.match(/;/g)?.length || 0) > (firstLine.match(/,/g)?.length || 0))) {
    delimiter = ';';
  }

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

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
      } else if (char === delimiter) {
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

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function Settings() {
 const { toast } = useToast();
 const [activeTab, setActiveTab] = useState<"languages" | "users" | "config" | "data">("languages");

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
 const [availableRoles, setAvailableRoles] = useState<Role[]>(DEFAULT_SYSTEM_ROLES);
 const [isUsersLoading, setIsUsersLoading] = useState(false);
 const [showInviteModal, setShowInviteModal] = useState(false);
 const [inviteEmail, setInviteEmail] = useState("");
 const [inviteName, setInviteName] = useState("");
 const [invitePassword, setInvitePassword] = useState("");
 const [inviteRole, setInviteRole] = useState("");
 const [roleAssignmentUserId, setRoleAssignmentUserId] = useState<string | null>(null);
 const [roleToAssign, setRoleToAssign] = useState("");

 const showToast = (msg: string) => toast(msg);

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
 UserService.getUsers().catch(() => []),
 UserService.getRoles().catch(() => [])
 ]);
 if (users && users.length > 0) {
   setSystemUsers(users);
 }
 const finalRoles = (roles && roles.length > 0) ? roles : DEFAULT_SYSTEM_ROLES;
 setAvailableRoles(finalRoles.filter(r => r.isActive));
 } catch (e: any) {
 setAvailableRoles(DEFAULT_SYSTEM_ROLES);
 console.warn(`Error loading users: ${e.message}`);
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
  const [lengthConflictConfig, setLengthConflictConfigState] = useState<LengthConflictConfig>(() => StoreService.getLengthConflictConfig());

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

  // --- COMPLETE RESET HANDLER ---
  const handleConfirmDeleteAllData = async () => {
    setIsDeleting(true);
    setShowDeleteModal(false);
    showToast("Resetting all MioTranslate data...");

    try {
      try {
        await MigrationService.resetMigratedData();
      } catch (backendErr) {
        console.warn("Backend reset notice:", backendErr);
      }

      // Completely reset all local storage, caches, and memory state
      await StoreService.resetAll();

      setMockLsStatus({
        hasMigrated: false,
        lastMigrationAt: null,
        pagesMigrated: 0,
        tagsMigrated: 0
      });
      setImportSummary(null);

      showToast("MioTranslate completely reset. All pages, tags, translations, and records cleared.");
    } catch (err: any) {
      console.error(err);
      showToast(`Reset failed: ${err.message || "Could not complete reset"}`);
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
    const selectedRole = roleToAssign;
    setRoleAssignmentUserId(null);
    setRoleToAssign("");

    try {
      await UserService.assignRole(userId, selectedRole);
      showToast(`Role "${selectedRole}" assigned successfully`);
      loadUsersAndRoles();
    } catch (err: any) {
      console.warn("Backend assignRole offline, applying locally:", err);
      setSystemUsers(prev => prev.map(u => {
        if (u.user.userId === userId) {
          const newAssignment: UserRoleAssignment = {
            assignmentId: `assign-${Date.now()}`,
            userId: userId,
            role: selectedRole,
            assignedBy: "admin",
            assignedAt: new Date().toISOString()
          };
          return {
            ...u,
            roles: [...(u.roles || []), newAssignment]
          };
        }
        return u;
      }));
      showToast(`Role "${selectedRole}" assigned successfully`);
    }
  };

  const handleRevokeRole = async (assignmentId: string) => {
    try {
      await UserService.revokeRole(assignmentId);
      showToast("Role revoked successfully");
      loadUsersAndRoles();
    } catch (err: any) {
      console.warn("Backend revokeRole offline, applying locally:", err);
      setSystemUsers(prev => prev.map(u => ({
        ...u,
        roles: (u.roles || []).filter(r => r.assignmentId !== assignmentId)
      })));
      showToast("Role revoked successfully");
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
    let pageIdx = -1;
    let tagIdx = -1;
    let englishIdx = -1;
    let startRow = 0;
    const extraLangIndices: { [code: string]: number } = {};

    const firstRowTokens = rows[0].map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const hasHeader = firstRowTokens.some(c => 
      c.includes("page") || c.includes("tag") || c.includes("key") || c.includes("english") || c.includes("master")
    );

    if (hasHeader) {
      startRow = 1;
      firstRowTokens.forEach((tok, idx) => {
        if (tok === 'pageid' || tok === 'page' || tok === 'screencode' || tok === 'screenid') pageIdx = idx;
        else if (tok === 'tagid' || tok === 'tag' || tok === 'tagname' || tok === 'key' || tok === 'stringid') tagIdx = idx;
        else if (tok === 'english' || tok === 'englishtext' || tok === 'englishmaster' || tok === 'master' || tok === 'source' || tok === 'en' || tok === 'text') englishIdx = idx;
        else {
          const matchedLang = languages.find(l => {
            const codeTok = l.code.toLowerCase().replace(/[^a-z0-9]/g, '');
            const nameTok = l.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return tok === codeTok || tok === nameTok || tok.includes(codeTok);
          });
          if (matchedLang) {
            extraLangIndices[matchedLang.code] = idx;
          }
        }
      });
    }

    // Default fallback indices if not specified in header
    if (pageIdx === -1) pageIdx = 0;
    if (tagIdx === -1) tagIdx = 1;
    if (englishIdx === -1) englishIdx = 2;

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

 const filteredRows = importSummary?.rows.filter((r: ImportValidationRow) => {
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
 <div className="flex flex-col gap-4 w-full ">
 {/* Confirmation Modal */}
 {showDeleteModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
 <div className="bg-bg-card border border-border-subtle rounded-xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 animate-fadeIn overflow-hidden">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
 <AlertTriangle className="w-5 h-5" weight="fill" />
 </div>
 <div>
 <h3 className="text-[14px] font-bold text-text-accent-blue">Delete All Migrated Data?</h3>
 <p className="text-[12px] text-text-tertiary mt-0.5">This action will clear the database registry.</p>
 </div>
 </div>

 <p className="text-[12px] text-text-secondary leading-relaxed">
 This will remove all <strong>{mockLsStatus.pagesMigrated || 6} pages</strong>, <strong>{mockLsStatus.tagsMigrated || 834} tags</strong>, approved English master strings, and translations from the database. You can re-migrate them anytime from Mock LS.
 </p>

 <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
 <button
 onClick={() => setShowDeleteModal(false)}
 className="px-4 py-2 bg-bg-card hover:bg-bg-card-hover border border-border-subtle text-text-accent-blue text-[12px] font-bold rounded cursor-pointer transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={handleConfirmDeleteAllData}
 disabled={isDeleting}
 className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[12px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5"
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
  <h1 className="text-xl font-bold tracking-tight text-text-primary">Settings</h1>
  <p className="text-[13px] text-text-tertiary mt-0.5">Manage languages, users, permissions, and translation services.</p>
  </div>

  {/* Settings Navigation Tabs */}
  <div className="flex overflow-x-auto scrollbar-none border-b border-border-subtle gap-4 sm:gap-8 text-[13px] font-bold whitespace-nowrap pb-px">
  <button
  onClick={() => setActiveTab("languages")}
  className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 outline-none shrink-0 ${
  activeTab === "languages"
  ? "border-accent-blue text-accent-blue font-bold"
  : "border-transparent text-text-secondary hover:text-text-primary"
  }`}
  >
  <Globe className="w-4 h-4" weight="fill" />
  Languages
  </button>
  <button
  onClick={() => setActiveTab("users")}
  className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 outline-none shrink-0 ${
  activeTab === "users"
  ? "border-accent-blue text-accent-blue font-bold"
  : "border-transparent text-text-secondary hover:text-text-primary"
  }`}
  >
  <Users className="w-4 h-4" weight="fill" />
  Users & Access
  </button>
  <button
  onClick={() => setActiveTab("config")}
  className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 outline-none shrink-0 ${
  activeTab === "config"
  ? "border-accent-blue text-accent-blue font-bold"
  : "border-transparent text-text-secondary hover:text-text-primary"
  }`}
  >
  <SettingsIcon className="w-4 h-4" weight="fill" />
  AI & Automation
  </button>
  <button
  onClick={() => setActiveTab("data")}
  className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 outline-none shrink-0 ${
  activeTab === "data"
  ? "border-accent-blue text-accent-blue font-bold"
  : "border-transparent text-text-secondary hover:text-text-primary"
  }`}
  >
  <Database className="w-4 h-4" weight="fill" />
  Import & Export
  </button>
  </div>

 {/* TAB 1: LANGUAGES */}
 {activeTab === "languages" && (
 <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden flex flex-col">
 <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h2 className="text-[13px] font-bold text-text-primary">Target Languages</h2>
 <p className="text-[12px] text-text-tertiary mt-0.5">Configure active target languages for localization.</p>
 </div>
 <button 
 onClick={() => setShowAddLanguage(true)}
 className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-accent-blue text-white text-[12px] font-bold rounded-md hover:bg-accent-blue-hover cursor-pointer transition-colors active:scale-[0.99]"
 >
 <Plus className="w-3.5 h-3.5" weight="bold" />
 Add Language
 </button>
 </div>

 {showAddLanguage && (
 <div className="p-4 bg-bg-card-hover border-b border-border-subtle flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
 <input 
 placeholder="e.g., pt-BR" 
 value={newLangCode} 
 onChange={e => setNewLangCode(e.target.value)} 
 className="h-9 px-3 border border-border-subtle rounded-md text-[13px] w-full sm:w-32 outline-none focus:border-accent-blue bg-bg-card text-text-accent-blue"
 />
 <input 
 placeholder="e.g., Portuguese" 
 value={newLangName} 
 onChange={e => setNewLangName(e.target.value)} 
 className="h-9 px-3 border border-border-subtle rounded-md text-[13px] flex-1 outline-none focus:border-accent-blue bg-bg-card text-text-accent-blue"
 />
 <div className="flex items-center gap-2">
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
 showToast("Failed to add language");
 }
 }}
 className="flex-1 sm:flex-none px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-[12px] font-bold rounded-md cursor-pointer transition-colors"
 >
 Add Language
 </button>
 <button 
 type="button"
 onClick={() => setShowAddLanguage(false)}
 className="flex-1 sm:flex-none px-4 py-2 bg-bg-card hover:bg-bg-card-hover border border-border-subtle text-text-secondary text-[12px] font-bold rounded-md cursor-pointer transition-colors"
 >
 Cancel
 </button>
 </div>
 </div>
 )}

  <div className="overflow-auto w-full">
  <table className="w-full min-w-[640px] text-left text-[13px] text-text-primary border-collapse">
  <thead className="bg-bg-card-hover/70 border-b border-border-subtle text-[12px] uppercase font-bold text-text-secondary tracking-wider sticky top-0 z-20">
  <tr>
  <th className="px-4 py-2.5">LANGUAGE</th>
  <th className="px-4 py-2.5 w-28">ISO CODE</th>
  <th className="px-4 py-2.5 w-36">NATIVE NAME</th>
  <th className="px-4 py-2.5 w-28">DIRECTION</th>
  <th className="px-4 py-2.5 w-28 text-center bg-bg-card-hover sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50">STATUS</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-border-subtle">
  {languages.map((lang) => (
  <tr key={lang.code} className="group hover:bg-bg-card-hover transition-colors">
  <td className="px-4 py-2.5 font-bold text-text-primary">
  {lang.name}
  </td>
  <td className="px-4 py-2.5 font-mono text-[12px] text-text-secondary">
  {lang.code.toUpperCase()}
  </td>
  <td className="px-4 py-2.5 font-bold">
  {lang.nativeName}
  </td>
  <td className="px-4 py-2.5">
  <span className="px-2 py-0.5 bg-bg-card-active text-text-secondary text-[12px] font-bold rounded">
  {lang.direction}
  </span>
  </td>
  <td className="px-4 py-2.5 text-center bg-bg-card group-hover:bg-bg-card-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors">
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
 <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
 <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h2 className="text-[13px] font-bold text-text-primary">System Users & Roles</h2>
 <p className="text-[12px] text-text-tertiary mt-0.5">Manage access control across the MioTranslate suite</p>
 </div>
 <button 
 onClick={() => setShowInviteModal(true)}
 className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-accent-blue text-white text-[12px] font-bold rounded-md hover:bg-accent-blue-hover cursor-pointer transition-colors active:scale-[0.99]"
 >
 <Plus className="w-3.5 h-3.5" weight="bold" />
 Invite User
 </button>
 </div>
 
 {showInviteModal && (
 <div className="p-4 bg-bg-card-hover border-b border-border-subtle">
 <form onSubmit={handleInviteUser} className="flex flex-col md:flex-row items-stretch md:items-end gap-3">
 <div className="flex-1">
 <label className="block text-[12px] font-bold text-text-tertiary mb-1">Email</label>
 <input 
 type="email" required placeholder="user@miosalon.com" 
 value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
 className="w-full h-9 px-3 border border-border-subtle rounded-md text-[13px] outline-none focus:border-accent-blue bg-bg-card text-text-primary"
 />
 </div>
 <div className="flex-1">
 <label className="block text-[12px] font-bold text-text-tertiary mb-1">Display Name</label>
 <input 
 type="text" required placeholder="John Doe" 
 value={inviteName} onChange={e => setInviteName(e.target.value)}
 className="w-full h-9 px-3 border border-border-subtle rounded-md text-[13px] outline-none focus:border-accent-blue bg-bg-card text-text-primary"
 />
 </div>
 <div className="flex-1">
 <label className="block text-[12px] font-bold text-text-tertiary mb-1">Initial Password</label>
 <input 
 type="text" required placeholder="ChangeMe123!" 
 value={invitePassword} onChange={e => setInvitePassword(e.target.value)}
 className="w-full h-9 px-3 border border-border-subtle rounded-md text-[13px] outline-none focus:border-accent-blue bg-bg-card text-text-primary"
 />
 </div>
 <div className="w-full md:w-36">
 <label className="block text-[12px] font-bold text-text-tertiary mb-1">Initial Role</label>
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
 <div className="flex items-center gap-2 pt-1 md:pt-0">
 <button type="submit" className="flex-1 md:flex-none h-9 px-4 bg-accent-blue hover:bg-accent-blue-hover text-white text-[12px] font-bold rounded-md cursor-pointer transition-colors">
 Create User
 </button>
 <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 md:flex-none h-9 px-4 bg-bg-card hover:bg-bg-card-hover border border-border-subtle text-text-primary text-[12px] font-bold rounded-md cursor-pointer transition-colors">
 Cancel
 </button>
 </div>
 </form>
 </div>
 )}

 {isUsersLoading ? (
 <div className="p-16 text-center text-text-secondary text-[13px] font-medium flex flex-col items-center">
 <RefreshCw className="w-6 h-6 animate-spin mb-3 text-text-tertiary" weight="bold" />
 <p>Loading users...</p>
 </div>
 ) : (
  <div className="overflow-auto w-full">
  <table className="w-full min-w-[640px] text-left text-[13px] text-text-primary border-collapse">
  <thead className="bg-bg-card-hover/70 border-b border-border-subtle text-[12px] uppercase font-bold text-text-secondary tracking-wider sticky top-0 z-20">
  <tr>
  <th className="px-4 py-2 w-1/4 min-w-[200px] max-w-[240px] shrink-0 bg-bg-card-hover">USER</th>
  <th className="px-4 py-2 min-w-[240px] bg-bg-card-hover">ASSIGNED ROLES</th>
  <th className="px-4 py-2 w-28 text-center bg-bg-card-hover sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">ACTIVE</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-border-subtle">
  {systemUsers.map((ur) => (
  <tr key={ur.user.userId} className={`group transition-colors ${!ur.user.isActive ? "bg-red-50/30 opacity-75" : "hover:bg-bg-card-hover"}`}>
  <td className="px-4 py-2 w-1/4 min-w-[200px] max-w-[240px] shrink-0">
  <div className="font-bold text-text-primary truncate block" title={ur.user.displayName}>{ur.user.displayName}</div>
  <div className="text-[12px] text-text-tertiary truncate block" title={ur.user.email}>{ur.user.email}</div>
  </td>
  <td className="px-4 py-2 min-w-[240px]">
  <div className="flex flex-col gap-2">
  <div className="flex flex-wrap gap-2 items-center">
  {ur.roles.map(roleAssignment => (
  <div key={roleAssignment.assignmentId} className="flex items-center bg-accent-blue/5 border border-accent-blue/20 rounded pl-2 text-[12px] font-bold text-accent-blue">
  <span className="py-1 pr-1.5">{roleAssignment.role}</span>
  <button 
  onClick={() => handleRevokeRole(roleAssignment.assignmentId)}
  title="Revoke Role"
  className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-r border-l border-accent-blue/20 transition-colors cursor-pointer"
  >
  <Trash2 className="w-3 h-3" weight="fill" />
  </button>
  </div>
  ))}
  {roleAssignmentUserId !== ur.user.userId && (
  <button 
  onClick={() => setRoleAssignmentUserId(ur.user.userId)}
  className="h-6 px-2 text-[10px] font-bold border border-border-subtle border-dashed text-text-tertiary hover:text-accent-blue hover:border-accent-blue rounded cursor-pointer transition-colors uppercase tracking-wider"
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
   className="w-52"
   placeholder="Select role..."
   options={[
   { value: "", label: "Select role..." },
   ...availableRoles
   .filter(r => !(ur.roles || []).some(assigned => (typeof assigned === 'string' ? assigned : assigned.role) === r.roleCode))
   .map(r => ({ value: r.roleCode, label: `${r.roleName} (${r.roleCode})` }))
   ]}
   />
   <button 
   onClick={() => handleAssignRole(ur.user.userId)}
   disabled={!roleToAssign}
   className="h-8 px-3 bg-[#5e6ad2] hover:bg-[#525ec2] disabled:opacity-40 text-white text-[12px] font-semibold rounded-md cursor-pointer transition-colors shadow-xs"
   >
   Assign
   </button>
   <button 
   onClick={() => { setRoleAssignmentUserId(null); setRoleToAssign(""); }}
   className="h-8 px-3 bg-bg-card hover:bg-bg-hover border border-border-subtle text-text-primary text-[12px] font-medium rounded-md cursor-pointer transition-colors"
   >
   Cancel
   </button>
   </div>
  )}
  </div>
  </td>
  <td className="px-4 py-2 text-center bg-bg-card group-hover:bg-bg-card-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors shrink-0">
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
  <td colSpan={3} className="px-6 py-8 text-center text-text-secondary text-[13px]">
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
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Primary AI & Engine Rules */}
      <div className="bg-bg-card border border-border-subtle rounded-xl flex flex-col shadow-xs">
        <div className="p-4 border-b border-border-subtle">
          <h2 className="text-[13px] font-bold text-text-primary">AI & Translation Engine Rules</h2>
          <p className="text-[12px] text-text-tertiary mt-0.5">Global configuration for automated translation generation and confidence gating.</p>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-text-primary">Primary AI Engine</label>
            <Dropdown
              value={aiModel}
              onChange={setAiModel}
              className="w-full"
              options={[
                { value: "Gemini 2.5 Flash", label: "Gemini 2.5 Flash (Recommended)" },
                { value: "Gemini 2.5 Pro", label: "Gemini 2.5 Pro" },
                { value: "Claude 3.5 Sonnet", label: "Claude 3.5 Sonnet" },
                { value: "GPT-4o", label: "GPT-4o" },
              ]}
            />
            <span className="text-[12px] text-text-tertiary">Select the provider used for single and bulk translation generation</span>
          </div>

          <div className="flex flex-col gap-2">
            <Slider
              label="AI Confidence Threshold"
              value={confidenceThreshold}
              onChange={setConfidenceThreshold}
              min={50}
              max={99}
              step={1}
              unit="%"
              helperText={`Translations scoring below ${confidenceThreshold}% are automatically routed to Language Reviewers for manual verification.`}
              presets={[
                { value: 60, label: "60% (Lenient)" },
                { value: 75, label: "75%" },
                { value: 85, label: "85% (Recommended)" },
                { value: 95, label: "95% (Strict)" }
              ]}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
            <div>
              <div className="text-[13px] font-semibold text-text-primary">Auto-Translate on Master English Update</div>
              <div className="text-[12px] text-text-tertiary">Automatically generate draft translations for active locales when English is updated</div>
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
                  showToast("AI engine configuration saved");
                } catch (e: any) {
                  if (e.response && e.response.status === 409) {
                    showToast("Conflict: Configuration modified by another user.");
                  } else {
                    showToast("Configuration saved locally");
                  }
                }
              }}
              className="px-4 py-2 bg-[#5e6ad2] hover:bg-[#525ec2] text-white text-[12px] font-medium rounded-md cursor-pointer transition-colors shadow-xs outline-none"
            >
              Save Engine Rules
            </button>
          </div>
        </div>
      </div>

      {/* Card: UI Length Conflict & Overflow Detection */}
      <div className="bg-bg-card border border-border-subtle rounded-xl flex flex-col shadow-xs overflow-hidden">
        <div className="p-4 border-b border-border-subtle flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-bold text-text-primary">UI Length Conflict & Overflow Detection</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                lengthConflictConfig.enabled 
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" 
                  : "bg-bg-main text-text-tertiary border-border-subtle"
              }`}>
                {lengthConflictConfig.enabled ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="text-[12px] text-text-tertiary">
              Monitor character expansion ratios against source English to prevent visual UI clipping in navigation, buttons, and titles.
            </p>
          </div>
          <Toggle 
            checked={lengthConflictConfig.enabled} 
            onChange={(enabled) => {
              const updated = { ...lengthConflictConfig, enabled };
              setLengthConflictConfigState(updated);
              StoreService.setLengthConflictConfig(updated);
              showToast(enabled ? "Length conflict detection enabled" : "Length conflict detection disabled");
            }} 
          />
        </div>

        {lengthConflictConfig.enabled && (
          <div className="p-5 flex flex-col gap-5 bg-bg-card">
            {/* Warning Threshold Slider */}
            <div className="flex flex-col gap-2">
              <Slider
                label="Warning Delta (+% vs English Source)"
                value={lengthConflictConfig.thresholdPercentage}
                onChange={(val) => {
                  const updated = { ...lengthConflictConfig, thresholdPercentage: val };
                  setLengthConflictConfigState(updated);
                  StoreService.setLengthConflictConfig(updated);
                }}
                min={10}
                max={100}
                step={5}
                unit="%"
                helperText={`Translations exceeding English length by more than +${lengthConflictConfig.thresholdPercentage}% are flagged with warning status.`}
                presets={[
                  { value: 15, label: "+15% (Strict)" },
                  { value: 25, label: "+25% (Standard)" },
                  { value: 40, label: "+40% (Lenient)" },
                  { value: 50, label: "+50% (High)" }
                ]}
              />
            </div>

            {/* Severe Conflict Threshold Slider */}
            <div className="flex flex-col gap-2">
              <Slider
                label="Critical Severity Delta (+% vs English Source)"
                value={lengthConflictConfig.severeThresholdPercentage}
                onChange={(val) => {
                  const updated = { ...lengthConflictConfig, severeThresholdPercentage: val };
                  setLengthConflictConfigState(updated);
                  StoreService.setLengthConflictConfig(updated);
                }}
                min={25}
                max={150}
                step={5}
                unit="%"
                helperText={`Translations exceeding +${lengthConflictConfig.severeThresholdPercentage}% expansion are flagged with critical hazard status in the conflict review modal.`}
                presets={[
                  { value: 35, label: "+35%" },
                  { value: 50, label: "+50% (Standard)" },
                  { value: 75, label: "+75%" },
                  { value: 100, label: "+100% (2× Source)" }
                ]}
              />
            </div>

            {/* Scope selector */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-text-primary">Enforcement Scope</label>
              <Dropdown
                value={lengthConflictConfig.targetScope}
                onChange={(val) => {
                  const updated = { ...lengthConflictConfig, targetScope: val as any };
                  setLengthConflictConfigState(updated);
                  StoreService.setLengthConflictConfig(updated);
                  showToast("Enforcement scope updated");
                }}
                className="w-full"
                options={[
                  { value: "ALL", label: "All Copy Types (Buttons, Labels, Titles, Paragraphs)" },
                  { value: "BUTTONS_TITLES", label: "Buttons, Labels & Headings Only (Layout-Critical)" },
                  { value: "SHORT_STRINGS", label: "Short UI Strings Only (≤ 40 characters)" },
                ]}
              />
              <span className="text-[12px] text-text-tertiary">Choose which UI copy elements are monitored for length overflow</span>
            </div>

            {/* Governance Policy Toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
              <div>
                <div className="text-[13px] font-semibold text-text-primary">Require Manual Review on Length Conflicts</div>
                <div className="text-[12px] text-text-tertiary">Block automatic AI approval whenever a translation exceeds the length threshold</div>
              </div>
              <Toggle 
                checked={lengthConflictConfig.preventAutoApprove} 
                onChange={(preventAutoApprove) => {
                  const updated = { ...lengthConflictConfig, preventAutoApprove };
                  setLengthConflictConfigState(updated);
                  StoreService.setLengthConflictConfig(updated);
                  showToast("Governance policy updated");
                }} 
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )}

 {/* TAB 4: DATA IMPORT & EXPORT */}
 {activeTab === "data" && (
 <div className="flex flex-col gap-4">
 <div className="bg-bg-card border border-border-subtle rounded-xl p-6 flex flex-col gap-4">
 <div>
 <h2 className="text-[14px] font-bold text-text-accent-blue">Data Synchronization & Migration</h2>
 <p className="text-[12px] text-text-tertiary mt-0.5">Synchronize pages and tags from Mock Language Services or import/export CSV bundles</p>
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
 <div className="border border-border-subtle rounded-xl p-5 flex flex-col gap-3 justify-between bg-bg-card-hover/30 relative">
 <div className="flex flex-col gap-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
  <Sparkles className="w-4 h-4 text-accent-blue" weight="fill" />
  <h3 className="text-[13px] font-semibold text-text-primary">Migrate from Mock LS</h3>
  </div>
  {mockLsStatus.hasMigrated && (
  <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium rounded border border-emerald-500/20 flex items-center gap-1">
  <Check className="w-3 h-3" weight="bold" /> Synced
  </span>
  )}
  </div>
  <p className="text-[12px] text-text-tertiary">
  Extract all pages, tags, and English UX copy from Mock MioSalon / Language Services directly into MioTranslate DB.
  </p>
  
  {/* Last Migration Timestamp display */}
  <div className="mt-2 pt-2 border-t border-border-subtle/50 flex items-center gap-1.5 text-[12px] text-text-secondary">
  <Clock className="w-3.5 h-3.5 text-text-tertiary" weight="bold" />
  <span>Last Migration: <strong className="text-text-primary font-medium">{formatMigrationTimestamp(mockLsStatus.lastMigrationAt)}</strong></span>
  </div>
  {mockLsStatus.hasMigrated && mockLsStatus.pagesMigrated > 0 && (
  <div className="text-[11px] text-text-tertiary">
  {mockLsStatus.pagesMigrated} pages • {mockLsStatus.tagsMigrated} tags in database
  </div>
  )}
  </div>

  <div className="flex flex-col gap-2 mt-2">
  <button
  onClick={handleSyncFromMockLs}
  disabled={isSyncing || isDeleting}
  className="h-8 px-4 bg-accent-blue text-white text-[12px] font-medium rounded-md hover:brightness-110 w-full transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
  >
  {isSyncing ? (
  <>
  <RefreshCw className="w-3.5 h-3.5 animate-spin" weight="bold" />
  <span>Migrating from Mock LS...</span>
  </>
  ) : (
  <>
  <RefreshCw className="w-3.5 h-3.5" weight="bold" />
  <span>Migrate from Mock LS</span>
  </>
  )}
  </button>

  <button
  onClick={() => setShowDeleteModal(true)}
  disabled={isDeleting || isSyncing}
  className="h-8 px-4 bg-bg-card hover:bg-danger/10 text-text-secondary hover:text-danger border border-border-subtle hover:border-danger/30 text-[12px] font-medium rounded-md w-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
  >
  {isDeleting ? (
  <>
  <RefreshCw className="w-3.5 h-3.5 animate-spin" weight="bold" />
  <span>Deleting Data...</span>
  </>
  ) : (
  <>
  <Trash2 className="w-3.5 h-3.5" weight="bold" />
  <span>Delete All Migrated Data</span>
  </>
  )}
  </button>
  </div>
  </div>

  {/* Card 2: Import CSV */}
  <div className="border border-border-subtle rounded-xl p-5 flex flex-col gap-3 justify-between bg-bg-card-hover/30">
  <div className="flex flex-col gap-2">
  <div className="flex items-center gap-2">
  <Upload className="w-4 h-4 text-accent-blue" weight="bold" />
  <h3 className="text-[13px] font-semibold text-text-primary">Import Translations (CSV)</h3>
  </div>
  <p className="text-[12px] text-text-tertiary">
  Upload offline translation deliverables or agency spreadsheets to batch-update target strings.
  </p>
  </div>
  <button
  onClick={() => fileInputRef.current?.click()}
  disabled={isImporting}
  className="h-8 px-4 bg-bg-card hover:bg-bg-hover border border-border-subtle hover:border-border-strong text-text-primary text-[12px] font-medium rounded-md w-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
  >
  {isImporting ? (
  <>
  <RefreshCw className="w-3.5 h-3.5 animate-spin" weight="bold" />
  <span>Importing...</span>
  </>
  ) : (
  <>
  <FileSpreadsheet className="w-3.5 h-3.5" weight="bold" />
  <span>Import CSV File</span>
  </>
  )}
  </button>
  </div>

  {/* Card 3: Export */}
  <div className="border border-border-subtle rounded-xl p-5 flex flex-col gap-3 justify-between bg-bg-card-hover/30">
  <div className="flex flex-col gap-2">
  <div className="flex items-center gap-2">
  <Download className="w-4 h-4 text-accent-blue" weight="bold" />
  <h3 className="text-[13px] font-semibold text-text-primary">Export Full Catalog</h3>
  </div>
  <p className="text-[12px] text-text-tertiary">
  Download all registered pages, tags, translations, and version history as a JSON bundle.
  </p>
  </div>
  <button
  onClick={handleExportJson}
  className="h-8 px-4 bg-bg-card hover:bg-bg-hover border border-border-subtle hover:border-border-strong text-text-primary text-[12px] font-medium rounded-md w-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
  >
  <Download className="w-3.5 h-3.5" weight="bold" />
  <span>Export JSON</span>
  </button>
  </div>
 </div>
 </div>

 {/* Validation & Import Summary Report */}
 {importSummary && (
 <div className="bg-bg-card border border-border-subtle rounded-xl p-6 flex flex-col gap-4 animate-fadeIn">
 <div className="flex items-center justify-between pb-4 border-b border-border-subtle">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
 <CheckCircle className="w-5 h-5" weight="fill" />
 </div>
 <div>
 <h3 className="text-[13px] font-bold text-text-accent-blue">Import Completed Successfully</h3>
 <p className="text-[12px] text-text-tertiary">File: <span className="font-mono font-medium">{importSummary.fileName}</span> ({Math.round(importSummary.fileSizeBytes / 1024)} KB) at {importSummary.timestamp}</p>
 </div>
 </div>
 <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[12px] font-bold rounded-full">
 Verified
 </span>
 </div>

 {/* Statistics Grid */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 <div className="p-4 bg-bg-card-hover/50 rounded-lg border border-border-subtle/50 flex flex-col">
 <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Total Rows</span>
 <span className="text-2xl font-bold text-text-accent-blue mt-1">{importSummary.totalRows}</span>
 </div>
 <div className="p-4 bg-bg-card-hover/50 rounded-lg border border-border-subtle/50 flex flex-col">
 <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Pages Touched</span>
 <span className="text-2xl font-bold text-accent-blue mt-1">{importSummary.pagesCount}</span>
 </div>
 <div className="p-4 bg-bg-card-hover/50 rounded-lg border border-border-subtle/50 flex flex-col">
 <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Tags Processed</span>
 <span className="text-2xl font-bold text-emerald-600 mt-1">{importSummary.rows.filter((r: ImportValidationRow) => r.status !== 'SKIPPED').length}</span>
 </div>
 <div className="p-4 bg-bg-card-hover/50 rounded-lg border border-border-subtle/50 flex flex-col">
 <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Translations Added</span>
 <span className="text-2xl font-bold text-amber-600 mt-1">{importSummary.translationsCount}</span>
 </div>
 </div>

 {/* Validation Report Table */}
 <div className="flex flex-col gap-3">
 <div className="flex items-center justify-between gap-4 flex-wrap">
 <div className="flex items-center gap-2">
 <Layers className="w-4 h-4 text-text-secondary" weight="fill" />
 <h4 className="text-[12px] font-bold text-text-accent-blue uppercase tracking-wider">Validation Row Log ({filteredRows.length} of {importSummary.rows.length})</h4>
 </div>
 
 <div className="flex items-center gap-3">
 {/* Status Filter */}
 <div className="flex items-center gap-1 bg-bg-card-hover p-1 rounded-lg border border-border-subtle text-[12px]">
 {(["ALL", "IMPORTED", "UPDATED", "SKIPPED"] as const).map(tab => (
 <button
 key={tab}
 onClick={() => setReportFilter(tab)}
 className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
 reportFilter === tab 
 ? "bg-bg-card text-accent-blue shadow-xs" 
 : "text-text-secondary hover:text-text-accent-blue"
 }`}
 >
 {tab}
 </button>
 ))}
 </div>

 {/* Search */}
 <div className="relative">
 <Search className="w-3.5 h-3.5 text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" weight="bold" />
 <input 
 placeholder="Filter rows..."
 value={reportSearch}
 onChange={e => setReportSearch(e.target.value)}
 className="h-8 pl-8 pr-3 bg-bg-card border border-border-subtle rounded text-[12px] text-text-accent-blue outline-none focus:border-accent-blue w-48"
 />
 </div>
 </div>
 </div>

 <div className="border border-border-subtle rounded-lg overflow-hidden max-h-80 overflow-auto">
 <table className="w-full text-left text-[12px] border-collapse min-w-[700px]">
 <thead className="bg-bg-card-hover/80 border-b border-border-subtle font-bold text-text-secondary sticky top-0 z-20 uppercase">
 <tr>
 <th className="px-4 py-2.5 w-16 shrink-0 bg-bg-card-hover">Row</th>
 <th className="px-4 py-2.5 w-28 shrink-0 bg-bg-card-hover">Page ID</th>
 <th className="px-4 py-2.5 w-[200px] max-w-[200px] shrink-0 bg-bg-card-hover">Tag Key</th>
 <th className="px-4 py-2.5 min-w-[220px] bg-bg-card-hover">English Copy / Value</th>
 <th className="px-4 py-2.5 w-28 text-center bg-bg-card-hover sticky right-0 z-30 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 shrink-0">Status</th>
 <th className="px-4 py-2.5 w-44 shrink-0 bg-bg-card-hover">Details</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border-subtle bg-bg-card">
 {filteredRows.map((r: ImportValidationRow, i: number) => (
 <tr key={i} className="group hover:bg-bg-card-hover/50 transition-colors">
 <td className="px-4 py-2 font-mono text-text-secondary w-16 shrink-0">{r.rowNumber}</td>
 <td className="px-4 py-2 font-bold text-text-primary w-28 shrink-0">{r.pageId}</td>
 <td className="px-4 py-2 font-mono text-text-primary font-medium w-[200px] max-w-[200px] shrink-0">
 <span className="truncate block" title={r.tagName}>{r.tagName}</span>
 </td>
 <td className="px-4 py-2 text-text-primary min-w-[220px]">
 <span className="truncate block" title={r.englishText}>{r.englishText}</span>
 </td>
 <td className="px-4 py-2 text-center w-28 shrink-0 bg-bg-card group-hover:bg-bg-card-hover sticky right-0 z-10 shadow-[-6px_0_12px_rgba(0,0,0,0.3)] border-l border-border-subtle/50 transition-colors">
 <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
 r.status === 'IMPORTED' ? 'bg-emerald-50 text-emerald-700' :
 r.status === 'UPDATED' ? 'bg-blue-50 text-blue-700' :
 'bg-amber-50 text-amber-700'
 }`}>
 {r.status}
 </span>
 </td>
 <td className="px-4 py-2 text-text-tertiary text-[11px] w-44 shrink-0 truncate max-w-xs">{r.reason}</td>
 </tr>
 ))}
 {filteredRows.length === 0 && (
 <tr>
 <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
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
