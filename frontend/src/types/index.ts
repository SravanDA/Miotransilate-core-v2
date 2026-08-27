export type TranslationStatus =
  | "Approved"
  | "Draft"
  | "Pending Review"
  | "Stale"
  | "No Trans"
  | "No Eng"
  | "Deprecated";

export type CopyType = 
  | "Button" 
  | "Label" 
  | "Header" 
  | "Placeholder"
  | "Error" 
  | "Tooltip" 
  | "General";

export type Environment = "DEV" | "QA" | "PRODUCTION";

export interface TranslationValue {
  text: string;
  status: TranslationStatus;
  confidence: number;
  translatedAtEnglishVersion: number;
  lastUpdated: string; // ISO string
}

export interface Comment {
  id: string;
  author: string;
  language: string;
  text: string;
  createdAt: string;
  resolved: boolean;
}

export interface Tag {
  id: string; // e.g. "QUICK_1"
  pageId: string;
  type: CopyType;
  english: string;
  englishVersion: number;
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
