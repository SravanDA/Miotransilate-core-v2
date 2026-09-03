export type TranslationStatus =
  | "Approved"
  | "Draft"
  | "Pending Review"
  | "Stale"
  | "No Trans"
  | "No Eng"
  | "Needs Attention"
  | "Blocked"
  | "Deprecated";

export type CopyType = 
  | "Button" 
  | "Label" 
  | "Header" 
  | "Placeholder" 
  | "Error" 
  | "Tooltip" 
  | "General"
  | "Modal Title"
  | "Badge"
  | "Tab"
  | "Toast"
  | "Form Help"
  | "Table Column"
  | (string & {});

export type Environment = "DEV" | "QA" | "PRODUCTION";

export interface TranslationValue {
  text: string;
  status: TranslationStatus;
  confidence: number;
  translatedAtEnglishVersion: number;
  lastUpdated: string; // ISO string
  stateCause?: string; // "verified", "needs_attention_length", "blocked_placeholder"
  backTranslation?: string;
}

export interface CommentAuthor {
  userId: string;
  displayName: string;
  role: string;
}

export interface Comment {
  commentId: string;
  tagId: string;
  parentCommentId: string | null;
  scope: { type: "ENGLISH" | "LANGUAGE"; languageCode: string | null };
  author: CommentAuthor;
  text: string;
  resolved: boolean;
  resolvedBy: CommentAuthor | null;
  resolvedAt: string | null;
  isEscalation: boolean;
  escalationReason: string | null;
  createdAt: string;
  replies: Comment[];
}

export interface EscalatedItem {
  comment: Comment;
  tagId: string;
  pageId: string;
  pageName: string;
  englishCopy: string;
  copyType: string;
}

export interface Tag {
  id: string; // e.g. "QUICK_1"
  pageId: string;
  type: CopyType;
  english: string;
  englishVersion: number;
  englishStatus?: EnglishCopyStatus;
  englishChangeReason?: string;
  description?: string;
  values: Record<string, TranslationValue>; // e.g. { "ar": { text: "...", ... } }
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  pageId: string;
  name: string;
  module: string;
  status: "Active" | "Deprecated";
  createdAt: string;
}

export interface LanguageConfig {
  code: string;         // e.g. "ar"
  name: string;         // e.g. "Arabic"
  nativeName: string;   // e.g. "العربية"
  direction: "LTR" | "RTL";
  active: boolean;
  langServiceCode?: string; // e.g. "arabic"
}

export interface DeploymentRecord {
  id: string;
  pageId: string;
  pageName: string;
  language: string;
  environment: Environment;
  tagCount: number;
  version: number;
  publishedAt: string;
  publishedBy: string;
  status: "SUCCESSFUL" | "FAILED" | "IN_PROGRESS";
}

export interface AuditRecord {
  auditRecordId: string;
  action: string;
  subjectEntityType: string;
  subjectEntityId: string;
  subjectEntityIdAux: string | null;
  performedByUserId: string | null;
  performedByDisplayName: string | null;
  performedBySource: string;
  performedAt: string;
  beforeState: Record<string, any> | null;
  afterState: Record<string, any> | null;
  detail: string | null;
  createdAt: string;
}

export interface AuditTrailResponse {
  records: AuditRecord[];
  totalCount: number;
  page: number;
  size: number;
}

export type EnglishCopyStatus = "Draft" | "Pending Review" | "Approved" | "Deprecated";

export interface PublishApprovalRequest {
  id: string;
  pageId: string;
  pageName: string;
  language: string;
  environment: Environment;
  tagCount: number;
  requestedBy: string;
  requestedAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface PageLanguageReadiness {
  code: string;
  name: string;
  nativeName?: string;
  approvedCount: number;
  totalTags: number;
  coveragePercent: number;
  lastPublishedVersion: number | null;
  lastPublishedAt: string | null;
  hasChanges: boolean;
  staleCount: number;
  isPending: boolean;
  variableErrorsCount: number;
}

export interface UnpublishedPageSummary {
  pageId: string;
  pageName: string;
  module: string;
  totalTags: number;
  languages: PageLanguageReadiness[];
  hasUnpublishedChanges: boolean;
  overallReadiness: "ready" | "partial" | "blocked" | "up-to-date";
}

export interface EnvironmentReleaseStatus {
  version: number | null;
  lastPublishedAt: string | null;
  hasUnpublishedChanges: boolean;
  deployedLanguagesCount: number;
}

export interface PageReleasePipelineItem {
  pageId: string;
  pageName: string;
  module: string;
  totalTags: number;
  dev: EnvironmentReleaseStatus;
  qa: EnvironmentReleaseStatus;
  production: EnvironmentReleaseStatus;
  pipelineState: "IN_SYNC" | "NEEDS_RELEASE" | "NEEDS_QA" | "APPROVAL_PENDING" | "UNRELEASED";
  pendingChangesSummary: string;
  hasProductionChanges: boolean;
  languages: PageLanguageReadiness[];
}

