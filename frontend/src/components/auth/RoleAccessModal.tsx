import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Check,
  X,
  Lock,
  Sparkle,
  MagnifyingGlass as Search,
  Info,
  FileText,
  Translate,
  PaperPlaneRight,
  Sliders,
  Users
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { Dropdown } from "../ui/Dropdown";
import { useAuth } from "../../contexts/AuthContext";

export interface PermissionMeta {
  code: string;
  name: string;
  category: "content" | "translation" | "publishing" | "collaboration" | "admin";
  description: string;
  isProtected: boolean;
  canDoText: string;
  cannotDoText: string;
}

export const ALL_PERMISSIONS: PermissionMeta[] = [
  // Content
  {
    code: "CONTENT_VIEW",
    name: "View Content & Registry",
    category: "content",
    description: "Browse registered pages, tags, statuses, and live localization states.",
    isProtected: false,
    canDoText: "View pages, tags, statuses, and localization coverage across all modules.",
    cannotDoText: "Cannot browse or view translation pages and registered tags."
  },
  {
    code: "HISTORY_VIEW",
    name: "View Version History",
    category: "content",
    description: "Inspect previous revisions, diffs, and supersession timestamps.",
    isProtected: false,
    canDoText: "View full revision history and compare changes across drafts and approved copies.",
    cannotDoText: "Cannot inspect historical versions or textual diffs."
  },
  {
    code: "PAGE_TAG_CREATE",
    name: "Create Pages & Tags",
    category: "content",
    description: "Register new UI pages and localizeable tag identifiers.",
    isProtected: false,
    canDoText: "Register new pages, define tag keys, and set copy types.",
    cannotDoText: "Cannot create or register new pages or tag keys."
  },
  {
    code: "ENGLISH_AUTHOR",
    name: "Author & Edit English Copy",
    category: "content",
    description: "Draft, edit, and modify English master copy strings.",
    isProtected: false,
    canDoText: "Create new English copy versions and modify draft copy text.",
    cannotDoText: "Cannot edit or create English master copy text."
  },
  {
    code: "SUBMIT_FOR_REVIEW",
    name: "Submit for Review",
    category: "content",
    description: "Transition drafts to PENDING_REVIEW for formal approval.",
    isProtected: false,
    canDoText: "Submit drafted English strings and translations for peer/lead review.",
    cannotDoText: "Cannot submit draft changes for approval."
  },
  {
    code: "ENGLISH_APPROVE",
    name: "Approve English Copy",
    category: "content",
    description: "Formally approve English copy and trigger automated stale cascades.",
    isProtected: false,
    canDoText: "Approve English copy into APPROVED status (triggers translation stale flags).",
    cannotDoText: "Cannot approve English master copy changes."
  },

  // Translation
  {
    code: "TRANSLATION_CREATE",
    name: "Generate AI Translations",
    category: "translation",
    description: "Request automated neural machine translation for target languages.",
    isProtected: false,
    canDoText: "Trigger single and batch AI translation generation via language services.",
    cannotDoText: "Cannot request AI translations."
  },
  {
    code: "TRANSLATION_EDIT",
    name: "Edit Translations Manually",
    category: "translation",
    description: "Directly edit translated text, revise machine output, and save drafts.",
    isProtected: false,
    canDoText: "Edit and polish translation text directly in the editor.",
    cannotDoText: "Cannot edit translated text."
  },
  {
    code: "TRANSLATION_APPROVE",
    name: "Approve Translations",
    category: "translation",
    description: "Approve individual translation versions into production-ready state.",
    isProtected: false,
    canDoText: "Approve translated strings for individual language tags.",
    cannotDoText: "Cannot approve translations."
  },
  {
    code: "TRANSLATION_BULK_APPROVE",
    name: "Bulk Approve Translations",
    category: "translation",
    description: "Approve all pending translations across an entire page in one click.",
    isProtected: false,
    canDoText: "Bulk approve all pending translations for selected languages on a page.",
    cannotDoText: "Cannot bulk approve translations across a page."
  },

  // Publishing
  {
    code: "PUBLISH_DEV",
    name: "Publish to DEV",
    category: "publishing",
    description: "Deploy approved localization bundles to the Development environment.",
    isProtected: false,
    canDoText: "Trigger deployments directly to DEV testing environments.",
    cannotDoText: "Cannot publish to the DEV environment."
  },
  {
    code: "PUBLISH_QA",
    name: "Publish to QA / Staging",
    category: "publishing",
    description: "Deploy approved translation bundles to QA for integration verification.",
    isProtected: false,
    canDoText: "Publish verified translation bundles to QA/Staging environments.",
    cannotDoText: "Cannot publish to QA/Staging."
  },
  {
    code: "PUBLISH_PRODUCTION",
    name: "Publish to PRODUCTION",
    category: "publishing",
    description: "Deploy live localization bundles to Production customer tenants.",
    isProtected: true,
    canDoText: "Execute live production deployments affecting customer-facing salons.",
    cannotDoText: "Cannot publish to Production (Protected privilege)."
  },
  {
    code: "ROLLBACK",
    name: "Rollback Deployments",
    category: "publishing",
    description: "Revert production or staging bundles to previous immutable snapshots.",
    isProtected: true,
    canDoText: "Execute instant 1-click rollbacks to any prior stable release snapshot.",
    cannotDoText: "Cannot initiate deployment rollbacks (Protected privilege)."
  },

  // Collaboration
  {
    code: "COMMENT_CREATE",
    name: "Add & Resolve Comments",
    category: "collaboration",
    description: "Participate in contextual discussions on tags, translations, and reviews.",
    isProtected: false,
    canDoText: "Add inline review notes, question phrasing, and resolve discussions.",
    cannotDoText: "Cannot add or resolve review comments."
  },
  {
    code: "ESCALATE",
    name: "Escalate to Founder",
    category: "collaboration",
    description: "Flag deadlocked review items or ambiguous terms for Founder review.",
    isProtected: false,
    canDoText: "Escalate difficult terms or contested approvals directly to the Founder.",
    cannotDoText: "Cannot escalate items (Founders cannot escalate to themselves)."
  },
  {
    code: "EXPORT",
    name: "Export Translation Bundles",
    category: "collaboration",
    description: "Export page dictionaries in JSON/CSV formats for external analysis.",
    isProtected: false,
    canDoText: "Download CSV, JSON, and PO translation export artifacts.",
    cannotDoText: "Cannot export translation data."
  },
  {
    code: "AUDIT_VIEW",
    name: "Inspect Audit Trail",
    category: "collaboration",
    description: "Review immutable security audit records and actor trace logs.",
    isProtected: false,
    canDoText: "View immutable audit logs with before/after state captures.",
    cannotDoText: "Cannot view security audit logs."
  },

  // Admin
  {
    code: "ADMIN_USERS",
    name: "User & Role Administration",
    category: "admin",
    description: "Invite users, modify role assignments, and create custom RBAC roles.",
    isProtected: true,
    canDoText: "Manage user accounts, assign roles, and configure custom RBAC permissions.",
    cannotDoText: "Cannot manage users or role assignments (Protected privilege)."
  },
  {
    code: "ADMIN_LANGUAGES",
    name: "Language Management",
    category: "admin",
    description: "Activate new target languages, configure RTL/LTR, and initialize slots.",
    isProtected: true,
    canDoText: "Add and deactivate languages, set RTL/LTR layout directions.",
    cannotDoText: "Cannot configure supported languages (Protected privilege)."
  },
  {
    code: "ADMIN_CONFIG",
    name: "System Configuration",
    category: "admin",
    description: "Configure Language Services endpoints, auth policy, and rate limits.",
    isProtected: true,
    canDoText: "Update system settings, API integration URLs, and concurrency thresholds.",
    cannotDoText: "Cannot modify system configurations (Protected privilege)."
  },
  {
    code: "ADMIN_MIGRATION",
    name: "Data Migration Authority",
    category: "admin",
    description: "Execute bulk data import jobs and legacy tag ingestion workflows.",
    isProtected: true,
    canDoText: "Run legacy CSV migrations and batch import routines.",
    cannotDoText: "Cannot trigger data migrations (Protected privilege)."
  }
];

const CATEGORY_LABELS = {
  content: { label: "Content & Copywriting", icon: FileText },
  translation: { label: "Translation & Localization", icon: Translate },
  publishing: { label: "Publishing & Releases", icon: PaperPlaneRight },
  collaboration: { label: "Collaboration & Audit", icon: Users },
  admin: { label: "System Administration", icon: Sliders },
};

interface RoleAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoleAccessModal: React.FC<RoleAccessModalProps> = ({ isOpen, onClose }) => {
  const { user, can } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "allowed" | "restricted">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const simulatedRole = localStorage.getItem('miotranslate_simulate_role');
  const activeRoles = simulatedRole ? [simulatedRole] : (user?.roles || ["USER"]);
  const isSuperuser = user?.roles?.includes("FN") || can("*");

  const permissionsWithStatus = ALL_PERMISSIONS.map(p => {
    const isAllowed = isSuperuser || can(p.code);
    return {
      ...p,
      isAllowed
    };
  });

  const allowedCount = permissionsWithStatus.filter(p => p.isAllowed).length;
  const restrictedCount = permissionsWithStatus.length - allowedCount;

  const filteredPermissions = permissionsWithStatus.filter(p => {
    if (activeTab === "allowed" && !p.isAllowed) return false;
    if (activeTab === "restricted" && p.isAllowed) return false;
    if (selectedCategory !== "all" && p.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="bg-bg-card border border-border-subtle rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border-subtle flex items-center justify-between bg-bg-sidebar rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent-blue/10 text-accent-blue flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-bold text-text-primary">Role Access & Capabilities</h2>
                {simulatedRole && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                    <Sparkle className="w-2.5 h-2.5" /> Simulated ({simulatedRole})
                  </span>
                )}
              </div>
              <p className="text-[12px] text-text-tertiary mt-0.5">
                Active permissions matrix for <span className="font-semibold text-text-primary">{user?.displayName || "Current User"}</span> ({user?.email || "No email"})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer outline-none"
          >
            <X className="w-4 h-4" weight="bold" />
          </button>
        </div>

        {/* User Role Overview Banner */}
        <div className="px-6 py-4 bg-bg-card border-b border-border-subtle flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[12px] font-semibold text-text-secondary">Assigned Roles:</span>
            {activeRoles.map(r => (
              <span key={r} className="px-2.5 py-1 rounded bg-bg-active text-text-primary border border-border-strong text-[11px] font-bold tracking-wide flex items-center gap-1.5">
                <span>{r}</span>
                <span className="text-[10px] text-text-tertiary font-normal">
                  {r === "PM" && "• Product Manager"}
                  {r === "QA" && "• Quality Assurance"}
                  {r === "LR" && "• Localization Reviewer"}
                  {r === "SR" && "• Support Reviewer"}
                  {r === "FN" && "• Founder"}
                  {r === "ADMIN" && "• Administrator"}
                  {r === "DEV" && "• Developer Superuser"}
                </span>
              </span>
            ))}
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-active text-text-secondary rounded-md text-[12px] font-medium border border-border-subtle">
              <Check className="w-3.5 h-3.5" />
              <span>{allowedCount} Allowed</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-active text-text-secondary rounded-md text-[12px] font-medium border border-border-subtle">
              <Lock className="w-3.5 h-3.5" weight="fill" />
              <span>{restrictedCount} Restricted</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-6 py-3 border-b border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 bg-bg-hover/50">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all cursor-pointer outline-none ${
                activeTab === "all" ? "bg-bg-active text-text-primary border border-border-strong" : "text-text-secondary hover:text-text-primary border border-transparent"
              }`}
            >
              All ({ALL_PERMISSIONS.length})
            </button>
            <button
              onClick={() => setActiveTab("allowed")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all flex items-center gap-1 cursor-pointer outline-none ${
                activeTab === "allowed" ? "bg-bg-active text-text-primary border border-border-strong" : "text-text-secondary hover:text-text-primary border border-transparent"
              }`}
            >
              <Check className="w-3 h-3" /> Can Do ({allowedCount})
            </button>
            <button
              onClick={() => setActiveTab("restricted")}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all flex items-center gap-1 cursor-pointer outline-none ${
                activeTab === "restricted" ? "bg-bg-active text-text-primary border border-border-strong" : "text-text-secondary hover:text-text-primary border border-transparent"
              }`}
            >
              <Lock className="w-3 h-3" weight="fill" /> Can't Do ({restrictedCount})
            </button>
          </div>

          {/* MagnifyingGlass as Search & Category Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md justify-end">
            <Dropdown
              value={selectedCategory}
              onChange={setSelectedCategory}
              className="w-40"
              options={[
                { value: "all", label: "All Categories" },
                { value: "content", label: "Content & Copy" },
                { value: "translation", label: "Translation" },
                { value: "publishing", label: "Publishing" },
                { value: "collaboration", label: "Collaboration" },
                { value: "admin", label: "Administration" },
              ]}
            />
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter permissions..."
                className="w-full h-8 pl-8 pr-3 bg-bg-card border border-border-subtle rounded-md text-[12px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-blue"
              />
            </div>
          </div>
        </div>

        {/* Permissions List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 divide-y divide-border-subtle">
          {filteredPermissions.length === 0 ? (
            <div className="py-12 text-center text-text-secondary flex flex-col items-center justify-center">
              <Info className="w-8 h-8 text-text-tertiary mb-2" />
              <p className="text-[13px] font-semibold">No permissions match your filter</p>
              <p className="text-[12px] text-text-tertiary mt-1">Try switching tabs or resetting the search query.</p>
            </div>
          ) : (
            filteredPermissions.map((perm) => {
              const catMeta = CATEGORY_LABELS[perm.category];
              const CatIcon = catMeta.icon;

              return (
                <div key={perm.code} className={`pt-4 pb-2 first:pt-1 flex items-start gap-4 group ${!perm.isAllowed ? "opacity-50" : ""}`}>
                  <div className={`mt-0.5 shrink-0 ${perm.isAllowed ? "text-text-secondary" : "text-text-tertiary"}`}>
                    {perm.isAllowed ? <Check className="w-4 h-4" weight="bold" /> : <Lock className="w-4 h-4" weight="fill" />}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`font-medium text-[13px] ${perm.isAllowed ? "text-text-primary" : "text-text-primary line-through decoration-text-tertiary"}`}>
                        {perm.name}
                      </span>
                      <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-bg-active border border-border-subtle text-text-secondary">
                        {perm.code}
                      </code>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 border border-border-subtle text-text-secondary bg-bg-active`}>
                        <CatIcon className="w-2.5 h-2.5" />
                        {catMeta.label}
                      </span>
                      {perm.isProtected && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-bg-active text-text-primary border border-border-strong rounded">
                          PROTECTED
                        </span>
                      )}
                    </div>

                    <p className="text-[12px] text-text-secondary leading-relaxed max-w-2xl">
                      {perm.description}
                    </p>

                    <p className="text-[12px] text-text-tertiary mt-1 leading-relaxed max-w-2xl">
                      {perm.isAllowed ? perm.canDoText : perm.cannotDoText}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-bg-sidebar border-t border-border-subtle flex items-center justify-between rounded-b-xl">
          <span className="text-[11px] text-text-tertiary">
            Permissions are dynamically calculated based on primary role bindings and persona simulation.
          </span>
          <button
            onClick={onClose}
            className="h-8 px-4 bg-bg-card hover:bg-bg-hover text-text-primary text-[12px] font-medium rounded-md border border-border-subtle hover:border-border-strong transition-colors cursor-pointer outline-none"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
