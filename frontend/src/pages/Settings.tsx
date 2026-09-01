import { useState, useEffect } from "react";
import { 
  Globe, 
  Users, 
  Gear as SettingsIcon, 
  Plus, 
  ArrowsClockwise as RefreshCw
} from "@phosphor-icons/react";
import { StoreService, type LengthConflictConfig } from "../store/StoreService";
import type { LanguageConfig } from "../types";
import { useToast } from "../contexts/ToastContext";
import { Dropdown } from "../components/ui/Dropdown";
import { Toggle } from "../components/ui/Toggle";
import { Slider } from "../components/ui/Slider";
import { AdminService } from "../api/services/AdminService";
import { UserService, type UserWithRoles, type Role } from "../api/services/UserService";

const DEFAULT_SYSTEM_ROLES: Role[] = [
  { roleCode: "DEV", roleName: "Developer", description: "View-only access in workspace", isActive: true, isSystem: true },
  { roleCode: "PM", roleName: "Product Manager", description: "Authors English copy, creates pages/tags", isActive: true, isSystem: true },
  { roleCode: "QA", roleName: "Quality Assurance", description: "Reviews and authoring of English copy", isActive: true, isSystem: true },
  { roleCode: "LR", roleName: "Localization Reviewer", description: "Translates and approves language translations", isActive: true, isSystem: true },
  { roleCode: "SR", roleName: "Support Reviewer", description: "Approves English copy and production releases", isActive: true, isSystem: true },
  { roleCode: "ADMIN", roleName: "Administrator", description: "System user & configuration management", isActive: true, isSystem: true },
  { roleCode: "FN", roleName: "Founder", description: "Full system authority and overrides", isActive: true, isSystem: true },
];

export function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"languages" | "users" | "config">("languages");

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
      showToast(`Failed to invite user: ${err.message}`);
    }
  };

  const handleToggleUserStatus = async (userWrapper: UserWithRoles) => {
    try {
      const newStatus = !userWrapper.user.isActive;
      await UserService.updateUserStatus(userWrapper.user.userId, newStatus);
      showToast(`User ${userWrapper.user.displayName || userWrapper.user.email} ${newStatus ? 'activated' : 'deactivated'}`);
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(`Error updating user status: ${err.message}`);
    }
  };

  const handleAssignRole = async () => {
    if (!roleAssignmentUserId || !roleToAssign) return;
    try {
      await UserService.assignRole(roleAssignmentUserId, roleToAssign);
      showToast("Role assigned successfully");
      setRoleAssignmentUserId(null);
      setRoleToAssign("");
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(`Error assigning role: ${err.message}`);
    }
  };

  const handleRevokeRole = async (assignmentId: string) => {
    try {
      await UserService.revokeRole(assignmentId);
      showToast("Role revoked successfully");
      loadUsersAndRoles();
    } catch (err: any) {
      showToast(`Error revoking role: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-bg-card border border-border-subtle rounded-xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 animate-fadeIn">
            <h3 className="text-[14px] font-bold text-text-primary">Invite New User</h3>
            <form onSubmit={handleInviteUser} className="flex flex-col gap-3">
              <div>
                <label className="text-[12px] font-semibold text-text-secondary">Display Name</label>
                <input 
                  required
                  placeholder="e.g. Sarah Jenkins" 
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-bg-card border border-border-subtle rounded text-[13px] text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-text-secondary">Email Address</label>
                <input 
                  required
                  type="email"
                  placeholder="sarah@example.com" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-bg-card border border-border-subtle rounded text-[13px] text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-text-secondary">Initial Password</label>
                <input 
                  required
                  type="password"
                  placeholder="••••••••" 
                  value={invitePassword}
                  onChange={e => setInvitePassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-bg-card border border-border-subtle rounded text-[13px] text-text-primary outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="text-[12px] font-semibold text-text-secondary">Initial Role</label>
                <select 
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-bg-card border border-border-subtle rounded text-[13px] text-text-primary outline-none focus:border-accent-blue"
                >
                  <option value="">Select a role (optional)</option>
                  {availableRoles.map(r => (
                    <option key={r.roleCode} value={r.roleCode}>{r.roleName} ({r.roleCode})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-bg-card hover:bg-bg-card-hover border border-border-subtle text-text-primary text-[12px] font-bold rounded cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-[12px] font-bold rounded cursor-pointer transition-colors"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {roleAssignmentUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-bg-card border border-border-subtle rounded-xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4 animate-fadeIn">
            <h3 className="text-[14px] font-bold text-text-primary">Assign Role</h3>
            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-text-secondary">Select Role</label>
              <select 
                value={roleToAssign}
                onChange={e => setRoleToAssign(e.target.value)}
                className="w-full px-3 py-2 bg-bg-card border border-border-subtle rounded text-[13px] text-text-primary outline-none focus:border-accent-blue"
              >
                <option value="">Select a role...</option>
                {availableRoles.map(r => (
                  <option key={r.roleCode} value={r.roleCode}>{r.roleName} ({r.roleCode})</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => { setRoleAssignmentUserId(null); setRoleToAssign(""); }}
                className="px-4 py-2 bg-bg-card hover:bg-bg-card-hover border border-border-subtle text-text-primary text-[12px] font-bold rounded cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!roleToAssign}
                onClick={handleAssignRole}
                className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover disabled:opacity-50 text-white text-[12px] font-bold rounded cursor-pointer transition-colors"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">Settings</h1>
        <p className="text-[13px] text-text-tertiary mt-0.5">Manage languages, users, permissions, and AI translation rules.</p>
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
                placeholder="Code (e.g. it)"
                value={newLangCode}
                onChange={e => setNewLangCode(e.target.value)}
                className="h-8 px-3 bg-bg-card border border-border-subtle rounded text-[12px] text-text-primary outline-none focus:border-accent-blue w-28 uppercase"
              />
              <input 
                placeholder="Name (e.g. Italian)"
                value={newLangName}
                onChange={e => setNewLangName(e.target.value)}
                className="h-8 px-3 bg-bg-card border border-border-subtle rounded text-[12px] text-text-primary outline-none focus:border-accent-blue flex-1"
              />
              <div className="flex items-center gap-2">
                <button 
                  onClick={async () => {
                    if (newLangCode && newLangName) {
                      const code = newLangCode.trim().toLowerCase();
                      const name = newLangName.trim();
                      try {
                        await AdminService.addLanguage({ languageCode: code, languageName: name, direction: "LTR" });
                        const updated = StoreService.getLanguages();
                        setLanguages(updated);
                        setNewLangCode("");
                        setNewLangName("");
                        setShowAddLanguage(false);
                        showToast(`Added ${name} to languages`);
                      } catch (e: any) {
                        showToast(e.message || "Failed to add language");
                      }
                    }
                  }}
                  className="h-8 px-3.5 bg-accent-blue text-white text-[12px] font-bold rounded hover:bg-accent-blue-hover cursor-pointer"
                >
                  Save
                </button>
                <button 
                  onClick={() => setShowAddLanguage(false)}
                  className="h-8 px-3.5 bg-bg-card hover:bg-bg-card-hover border border-border-subtle text-text-primary text-[12px] font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border-subtle">
            {languages.map((l) => (
              <div key={l.code} className="p-4 flex items-center justify-between hover:bg-bg-card-hover/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-blue/10 text-accent-blue font-bold flex items-center justify-center text-xs">
                    {l.code.toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-[13px] text-text-primary">{l.name}</span>
                    <span className="text-[12px] text-text-tertiary ml-2">({l.direction.toUpperCase()})</span>
                  </div>
                </div>
                <Toggle checked={l.active} onChange={() => toggleLanguage(l.code)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: USERS & ACCESS */}
      {activeTab === "users" && (
        <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-[13px] font-bold text-text-primary">Users & Access Management</h2>
              <p className="text-[12px] text-text-tertiary mt-0.5">Manage team members, roles, and functional permissions.</p>
            </div>
            <button 
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-accent-blue text-white text-[12px] font-bold rounded-md hover:bg-accent-blue-hover cursor-pointer transition-colors active:scale-[0.99]"
            >
              <Plus className="w-3.5 h-3.5" weight="bold" />
              Invite User
            </button>
          </div>

          {isUsersLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-text-tertiary text-[13px]">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading users...
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {systemUsers.map((u) => (
                <div key={u.user.userId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-bg-card-hover/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-bg-card-hover border border-border-subtle flex items-center justify-center font-bold text-text-secondary text-xs">
                      {u.user.displayName ? u.user.displayName.slice(0, 2).toUpperCase() : u.user.email.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[13px] text-text-primary">{u.user.displayName || u.user.email}</span>
                        {!u.user.isActive && (
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded">Deactivated</span>
                        )}
                      </div>
                      <div className="text-[12px] text-text-tertiary">{u.user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {u.roles?.map(roleAssignment => (
                      <span 
                        key={roleAssignment.assignmentId}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-blue/10 text-accent-blue text-[11px] font-bold rounded-md"
                      >
                        {roleAssignment.role}
                        <button 
                          onClick={() => handleRevokeRole(roleAssignment.assignmentId)}
                          className="hover:text-red-500 cursor-pointer ml-0.5"
                          title="Revoke Role"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => setRoleAssignmentUserId(u.user.userId)}
                      className="px-2 py-0.5 border border-dashed border-border-subtle hover:border-accent-blue text-text-tertiary hover:text-accent-blue text-[11px] font-bold rounded-md cursor-pointer transition-colors"
                    >
                      + Role
                    </button>
                    <button
                      onClick={() => handleToggleUserStatus(u)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ml-2 ${
                        u.user.isActive 
                          ? "bg-bg-card-hover text-text-secondary hover:text-red-600" 
                          : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {u.user.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AI & AUTOMATION CONFIGURATION */}
      {activeTab === "config" && (
        <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border-subtle">
            <h2 className="text-[13px] font-bold text-text-primary">AI & Automation Engine</h2>
            <p className="text-[12px] text-text-tertiary mt-0.5">Control LLM models, confidence thresholds, and layout guardrails.</p>
          </div>

          <div className="p-6 flex flex-col gap-6">
            {/* AI Model */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-text-primary">Default AI Translation Model</label>
              <Dropdown
                value={aiModel}
                onChange={(val) => {
                  setAiModel(val);
                  showToast("Default AI Model updated");
                }}
                className="w-full"
                options={[
                  { value: "Gemini 2.5 Flash", label: "Gemini 2.5 Flash (Recommended - Multimodal & Fast)" },
                  { value: "Gemini 2.5 Pro", label: "Gemini 2.5 Pro (Deep Multilingual Reasoning)" },
                  { value: "Claude 3.5 Sonnet", label: "Claude 3.5 Sonnet (Production Localization Engine)" },
                  { value: "GPT-4o", label: "GPT-4o (OpenAI Omni Model)" },
                ]}
              />
              <span className="text-[12px] text-text-tertiary">Select the model cascade used for background bulk operations and automated translations</span>
            </div>

            {/* Confidence Threshold */}
            <div className="flex flex-col gap-2 pt-4 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-semibold text-text-primary">Confidence Auto-Approval Threshold</label>
                <span className="text-[13px] font-bold text-accent-blue">{confidenceThreshold}%</span>
              </div>
              <Slider 
                value={confidenceThreshold} 
                min={50} 
                max={100} 
                onChange={async (val) => {
                  setConfidenceThreshold(val);
                  try {
                    const res = await AdminService.updateConfig("AI_CONFIDENCE_THRESHOLD", val.toString(), configEtag);
                    setConfigEtag(res.etagVersion);
                    showToast("Confidence threshold saved to DB");
                  } catch (e: any) {
                    console.error("Failed to save to DB:", e);
                    showToast("Threshold updated locally");
                  }
                }} 
              />
              <span className="text-[12px] text-text-tertiary">Translations scoring at or above this threshold can be batch-approved</span>
            </div>

            {/* Auto Translate Toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-border-subtle">
              <div>
                <div className="text-[13px] font-semibold text-text-primary">Auto-Translate on Master English Approval</div>
                <div className="text-[12px] text-text-tertiary">Automatically trigger translation generation when English master copy is approved</div>
              </div>
              <Toggle 
                checked={autoTranslate} 
                onChange={(val) => {
                  setAutoTranslate(val);
                  showToast("Auto-Translate policy updated");
                }} 
              />
            </div>

            {/* Length Conflict Configuration */}
            <div className="flex flex-col gap-4 pt-4 border-t border-border-subtle">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-text-primary">Layout Length Expansion Guardrails</div>
                  <div className="text-[12px] text-text-tertiary">Flag strings that expand significantly in target languages to protect UI layouts</div>
                </div>
                <Toggle 
                  checked={lengthConflictConfig.enabled} 
                  onChange={(enabled) => {
                    const updated = { ...lengthConflictConfig, enabled };
                    setLengthConflictConfigState(updated);
                    StoreService.setLengthConflictConfig(updated);
                    showToast(enabled ? "Length guardrails enabled" : "Length guardrails disabled");
                  }} 
                />
              </div>

              {lengthConflictConfig.enabled && (
                <div className="p-4 bg-bg-card-hover/40 rounded-lg border border-border-subtle flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[12px] font-semibold text-text-secondary">Warning Threshold Percentage</label>
                      <span className="text-[12px] font-bold text-accent-blue">+{lengthConflictConfig.thresholdPercentage}%</span>
                    </div>
                    <Slider 
                      value={lengthConflictConfig.thresholdPercentage} 
                      min={10} 
                      max={100} 
                      onChange={(val) => {
                        const updated = { ...lengthConflictConfig, thresholdPercentage: val };
                        setLengthConflictConfigState(updated);
                        StoreService.setLengthConflictConfig(updated);
                      }} 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[12px] font-semibold text-text-secondary">Enforcement Scope</label>
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
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border-subtle/50">
                    <div>
                      <div className="text-[12px] font-semibold text-text-primary">Require Manual Review on Length Conflicts</div>
                      <div className="text-[11px] text-text-tertiary">Block auto-approval when translation length overflows</div>
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
        </div>
      )}
    </div>
  );
}
