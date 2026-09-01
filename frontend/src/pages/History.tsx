import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  FileText, 
  Translate, 
  RocketLaunch, 
  ShieldCheck, 
  Tag as TagIcon,
  CaretDown,
  CaretUp,
  X,
  CaretLeft,
  CaretRight,
  ClockCounterClockwise,
  MagnifyingGlass,
  Clock
} from "@phosphor-icons/react";
import { AuditService } from "../api/services/AuditService";
import { StoreService } from "../store/StoreService";
import { Dropdown } from "../components/ui/Dropdown";
import type { AuditRecord, AuditTrailResponse } from "../types";

const ENTITY_OPTIONS = [
  { value: "", label: "All Entities" },
  { value: "TAG", label: "Tags" },
  { value: "PAGE", label: "Pages" },
  { value: "ENGLISH_COPY", label: "English Copy" },
  { value: "TRANSLATION", label: "Translations" },
  { value: "RELEASE", label: "Releases" },
  { value: "USER", label: "Users & Roles" },
];

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "TRANSLATION_", label: "Translation Actions" },
  { value: "ENGLISH_COPY_", label: "English Copy Actions" },
  { value: "PUBLISHING_", label: "Publishing & Gates" },
  { value: "RELEASE_", label: "Releases & Deployments" },
  { value: "USER_", label: "User Management" },
  { value: "PAGE_", label: "Page & Tag Management" },
];

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Recently";
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInSeconds / 3600);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatHumanAction(action: string): string {
  switch (action) {
    case "TRANSLATION_APPROVE":
    case "TRANSLATION_APPROVED":
      return "Approved translation";
    case "TRANSLATION_CREATE":
    case "TRANSLATION_CREATED":
      return "Generated AI translation";
    case "TRANSLATION_EDIT":
    case "TRANSLATION_EDITED":
      return "Edited translation";
    case "ENGLISH_COPY_AUTHOR":
    case "ENGLISH_COPY_AUTHORED":
      return "Authored English copy";
    case "ENGLISH_COPY_APPROVE":
    case "ENGLISH_COPY_APPROVED":
      return "Approved English copy";
    case "PUBLISHING_APPROVAL_REQUEST":
      return "Requested production gate approval";
    case "RELEASE_PUBLISHED":
    case "PUBLISHING_PUBLISHED":
      return "Published deployment";
    case "USER_ROLE_ASSIGNED":
      return "Assigned system role";
    case "USER_ROLE_REVOKED":
      return "Revoked system role";
    default:
      return action.toLowerCase().replace(/_/g, " ");
  }
}

function getIconForAction(action: string) {
  if (action.startsWith("ENGLISH_COPY_") || action.startsWith("PAGE_")) {
    return { icon: FileText, color: "text-[#5e6ad2]", bg: "bg-[#5e6ad2]/10" };
  }
  if (action.startsWith("TRANSLATION_") || action.startsWith("TAG_")) {
    return { icon: Translate, color: "text-emerald-500", bg: "bg-emerald-500/10" };
  }
  if (action.startsWith("PUBLISHING_") || action.startsWith("RELEASE_")) {
    return { icon: RocketLaunch, color: "text-purple-500", bg: "bg-purple-500/10" };
  }
  if (action.startsWith("USER_") || action.startsWith("CUSTOM_ROLE_")) {
    return { icon: ShieldCheck, color: "text-amber-500", bg: "bg-amber-500/10" };
  }
  return { icon: TagIcon, color: "text-text-secondary", bg: "bg-bg-hover" };
}

function JsonViewer({ data, title }: { data: Record<string, any>; title: string }) {
  return (
    <div className="bg-bg-main border border-border-subtle rounded-lg p-3">
      <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">{title}</div>
      <pre className="text-[11px] font-mono text-text-primary overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function RecordCard({ record }: { record: AuditRecord }) {
  const [expanded, setExpanded] = useState(false);
  const { icon: Icon, color, bg } = getIconForAction(record.action);
  const hasDetails = Boolean(record.beforeState || record.afterState);

  return (
    <div className="flex gap-3.5 group relative">
      {/* Sleek Linear Timeline Node */}
      <div className="flex flex-col items-center">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-border-subtle ${bg} ${color} shadow-xs`}>
          <Icon className="w-3.5 h-3.5" weight="bold" />
        </div>
        <div className="w-px h-full bg-border-subtle group-last:bg-transparent my-1" />
      </div>
      
      {/* Content Card */}
      <div className="flex-1 pb-4">
        <div className="bg-bg-card border border-border-subtle rounded-xl p-3.5 hover:border-border-strong transition-all shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-[13px]">
                <span className="font-semibold text-text-primary capitalize">
                  {formatHumanAction(record.action)}
                </span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-bg-main border border-border-subtle text-text-secondary">
                  {record.subjectEntityType}: {record.subjectEntityId}
                </span>
                {record.subjectEntityIdAux && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue font-medium border border-accent-blue/20">
                    {record.subjectEntityIdAux}
                  </span>
                )}
              </div>

              {record.detail && (
                <p className="text-[12px] text-text-secondary leading-relaxed">
                  {record.detail}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[11px] text-text-tertiary">
              <Clock className="w-3 h-3" />
              <span>{formatTimeAgo(record.performedAt)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-text-tertiary border-t border-border-subtle/80 pt-2.5 mt-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-accent-blue/15 text-accent-blue flex items-center justify-center font-bold text-[9px]">
                {(record.performedByDisplayName || "S")[0].toUpperCase()}
              </div>
              <span className="font-medium text-text-secondary">{record.performedByDisplayName || "System"}</span>
              {record.performedBySource && (
                <span className="text-text-tertiary opacity-75">· {record.performedBySource}</span>
              )}
            </div>

            {hasDetails && (
              <button 
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-[11px] font-medium text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none"
              >
                <span>{expanded ? "Hide Diff" : "View State Diff"}</span>
                {expanded ? <CaretUp className="w-3 h-3" /> : <CaretDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Collapsible State Comparison */}
          {expanded && hasDetails && (
            <div className="mt-3 pt-3 border-t border-border-subtle grid grid-cols-1 md:grid-cols-2 gap-3">
              {record.beforeState ? (
                <JsonViewer data={record.beforeState} title="Previous State" />
              ) : (
                <div className="p-3 bg-bg-main border border-border-subtle rounded-lg text-[11px] text-text-tertiary italic">
                  No prior state (initial creation)
                </div>
              )}
              {record.afterState && (
                <JsonViewer data={record.afterState} title="Updated State" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function History() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<AuditTrailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [page, setPage] = useState(0);
  const [size] = useState(20);
  const [entityType, setEntityType] = useState<string>(searchParams.get("entityType") || "");
  const [action, setAction] = useState<string>(searchParams.get("action") || "");
  const [entityId, setEntityId] = useState<string>(searchParams.get("entityId") || "");
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d">("all");

  useEffect(() => {
    fetchData();
  }, [page, entityType, action, entityId, dateRange]);

  const fetchData = async () => {
    setLoading(true);
    let dateFrom: string | undefined = undefined;
    const now = new Date();
    if (dateRange === "today") {
      dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    } else if (dateRange === "7d") {
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (dateRange === "30d") {
      dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    try {
      const res = await AuditService.getAuditTrail({
        page,
        size,
        entityType: entityType || undefined,
        action: action || undefined,
        entityId: entityId || undefined,
        dateFrom
      });

      if (res && res.records && res.records.length > 0) {
        setData(res);
      } else {
        // Fallback local audit synthesis for offline/mock environments
        const localRecords: AuditRecord[] = [];
        const deps = StoreService.getDeployments();
        deps.forEach((d) => {
          localRecords.push({
            auditRecordId: d.id,
            action: "RELEASE_PUBLISHED",
            subjectEntityType: "PAGE",
            subjectEntityId: d.pageId,
            subjectEntityIdAux: d.language,
            performedByUserId: "sys-01",
            performedByDisplayName: d.publishedBy || "System User",
            performedBySource: "MioTranslate Web",
            performedAt: d.publishedAt,
            beforeState: null,
            afterState: { version: d.version, tagCount: d.tagCount, environment: d.environment },
            detail: `Published release v${d.version} (${d.language}) with ${d.tagCount} strings to ${d.environment}`,
            createdAt: d.publishedAt
          });
        });

        // Filter local records
        let filtered = localRecords;
        if (entityType) filtered = filtered.filter(r => r.subjectEntityType === entityType);
        if (action) filtered = filtered.filter(r => r.action.includes(action));
        if (entityId) filtered = filtered.filter(r => r.subjectEntityId.toLowerCase().includes(entityId.toLowerCase()));
        if (dateFrom) filtered = filtered.filter(r => new Date(r.performedAt) >= new Date(dateFrom!));

        setData({
          records: filtered,
          totalCount: filtered.length,
          page: 0,
          size: 20
        });
      }
    } catch (err) {
      console.warn("Backend audit API warning, using local history:", err);
      setData({ records: [], totalCount: 0, page: 0, size: 20 });
    } finally {
      setLoading(false);
    }
  };

  const hasFilters = Boolean(entityType || action || entityId || dateRange !== "all");
  const clearFilters = () => {
    setEntityType("");
    setAction("");
    setEntityId("");
    setDateRange("all");
    setPage(0);
    setSearchParams({});
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col h-full pt-2 pb-12">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">Activity & Audit Log</h1>
        <p className="text-[13px] text-text-tertiary">
          Immutable audit trail: every string translation, master copy approval, and production release decision.
        </p>
      </div>

      {/* Linear-Style Toolbar & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-3 bg-bg-card border border-border-subtle rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          
          {/* Search Box */}
          <div className="relative min-w-[180px]">
            <MagnifyingGlass className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search Tag or Page..."
              value={entityId}
              onChange={(e) => { setEntityId(e.target.value); setPage(0); }}
              className="w-full bg-bg-main border border-border-subtle focus:border-border-strong rounded-md pl-8 pr-2.5 py-1.5 text-[12px] text-text-primary outline-none transition-colors placeholder:text-text-tertiary"
            />
          </div>

          {/* Entity Filter Dropdown */}
          <Dropdown
            value={entityType}
            onChange={(val) => { setEntityType(val); setPage(0); }}
            className="w-36"
            options={ENTITY_OPTIONS}
          />

          {/* Action Filter Dropdown */}
          <Dropdown
            value={action}
            onChange={(val) => { setAction(val); setPage(0); }}
            className="w-44"
            options={ACTION_OPTIONS}
          />
        </div>

        {/* Date Presets Segmented Control */}
        <div className="flex items-center p-0.5 bg-bg-main rounded-lg border border-border-subtle gap-0.5 text-[11px]">
          {([
            { id: "all", label: "All time" },
            { id: "today", label: "Today" },
            { id: "7d", label: "7 days" },
            { id: "30d", label: "30 days" }
          ] as const).map(preset => (
            <button
              key={preset.id}
              onClick={() => { setDateRange(preset.id); setPage(0); }}
              className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer outline-none ${
                dateRange === preset.id
                  ? "bg-bg-card text-text-primary font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {hasFilters && (
          <button 
            onClick={clearFilters}
            className="flex items-center gap-1 text-[11px] font-medium text-text-tertiary hover:text-text-primary transition-colors cursor-pointer outline-none"
          >
            <X className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Activity Timeline List */}
      <div className="flex-1 relative">
        {loading && !data ? (
          <div className="flex items-center justify-center py-20 text-text-tertiary text-[13px]">
            Loading audit activity...
          </div>
        ) : data?.records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-card border border-border-subtle rounded-xl">
            <ClockCounterClockwise className="w-8 h-8 text-text-tertiary mb-2 opacity-40" />
            <div className="text-[13px] font-medium text-text-primary mb-0.5">No activity records match</div>
            <div className="text-[12px] text-text-tertiary">Try clearing your search query or broadening the date filter.</div>
          </div>
        ) : (
          <div className="relative pl-1">
            {data?.records.map(record => (
              <RecordCard key={record.auditRecordId} record={record} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {data && data.totalCount > 0 && (
        <div className="flex items-center justify-between py-3 mt-4 border-t border-border-subtle text-[12px] text-text-secondary">
          <div>
            Showing <span className="font-semibold text-text-primary">{page * size + 1}</span> to <span className="font-semibold text-text-primary">{Math.min((page + 1) * size, data.totalCount)}</span> of <span className="font-semibold text-text-primary">{data.totalCount}</span> events
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="h-7 px-2.5 flex items-center justify-center rounded-md border border-border-subtle bg-bg-card hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-[12px] font-medium"
            >
              <CaretLeft className="w-3.5 h-3.5 mr-1" /> Previous
            </button>
            <button 
              disabled={(page + 1) * size >= data.totalCount}
              onClick={() => setPage(p => p + 1)}
              className="h-7 px-2.5 flex items-center justify-center rounded-md border border-border-subtle bg-bg-card hover:bg-bg-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-[12px] font-medium"
            >
              Next <CaretRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
