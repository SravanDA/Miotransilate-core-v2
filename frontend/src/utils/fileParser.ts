import * as XLSX from 'xlsx';

export interface TagImport {
  id: string;
  type?: string;
  english: string;
  values?: Record<string, { text: string; status?: string; confidence?: number }>;
}

export interface PageImport {
  pageId: string;
  name: string;
  module: string;
  status?: string;
  tags: TagImport[];
}

export interface InputFile {
  fileName: string;
  fileContent: string | ArrayBuffer;
}

export interface ParseResult {
  pagesToUpload: PageImport[];
  summary: {
    totalFiles: number;
    totalPages: number;
    totalTags: number;
  };
}

export const PAGE_META_LOOKUP: Record<string, { name: string; module: string }> = {
  SERSET: { name: "Service Settings", module: "Service Settings" },
  CUSINS: { name: "Customer Insights", module: "Customer Insights" },
  CAMREW: { name: "Campaign & Rewards", module: "Campaign & Rewards" },
  POTSALESET: { name: "POS / Sale Settings", module: "POS / Sale Settings" },
  STAFFSET: { name: "Staff Settings", module: "Staff Settings" },
  CUSWISH: { name: "Customer Wishlist", module: "Customer Wishlist" }
};

export const KNOWN_LANGUAGES: Record<string, string> = {
  ar: "ar",
  arabic: "ar",
  es: "es",
  spanish: "es",
  tr: "tr",
  turkish: "tr",
  bg: "bg",
  bulgarian: "bg",
  it: "it",
  italian: "it",
  fr: "fr",
  french: "fr",
  frenchcanada: "fr",
  frenchca: "fr",
  frca: "fr",
  de: "de",
  german: "de"
};

/**
 * Robust RFC 4180 CSV / TSV Lexer.
 * Correctly parses cells containing commas, escaped quotes (""), newlines, and auto-detects delimiter.
 */
export function parseDelimitedRows(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, ''); // Strip UTF-8 BOM if present
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  // Auto-detect delimiter from first non-empty line
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

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // Skip second quote
        } else {
          insideQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function cleanHeaderToken(header: string): string {
  return (header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function formatPageName(pageId: string): string {
  const clean = pageId.toUpperCase();
  for (const [key, val] of Object.entries(PAGE_META_LOOKUP)) {
    if (clean === key || clean.startsWith(key)) return val.name;
  }
  return pageId
    .split(/[_\-\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatModuleName(pageId: string, parsedModule?: string): string {
  if (parsedModule && parsedModule.trim().length > 0) return parsedModule.trim();
  const clean = pageId.toUpperCase();
  for (const [key, val] of Object.entries(PAGE_META_LOOKUP)) {
    if (clean === key || clean.startsWith(key)) return val.module;
  }
  return formatPageName(pageId);
}

export function processTableRows(rows: string[][], fileName: string, pageMap: Map<string, PageImport>) {
  if (!rows || rows.length === 0) return;

  const lowerName = (fileName || '').toLowerCase();
  const firstRow = rows[0];
  const normalizedHeaders = firstRow.map(cleanHeaderToken);

  let pageIdIdx = -1;
  let pageNameIdx = -1;
  let moduleIdx = -1;
  let tagIdIdx = -1;
  let typeIdx = -1;
  let englishIdx = -1;
  const langColMap: { colIdx: number; langCode: string }[] = [];

  const PAGE_ID_KEYS = ['pageid', 'page', 'screencode', 'screenid', 'pagecode', 'viewid', 'view', 'screen', 'pagekey'];
  const PAGE_NAME_KEYS = ['pagename', 'name', 'screenname', 'title', 'pagetitle', 'screentitle', 'viewname', 'viewtitle'];
  const MODULE_KEYS = ['module', 'modulename', 'section', 'category', 'feature', 'group', 'component', 'domain'];
  const TAG_ID_KEYS = ['tagid', 'tagname', 'tag', 'key', 'stringid', 'token', 'id', 'identifier', 'tagkey', 'tagcode', 'code'];
  const TYPE_KEYS = ['type', 'copytype', 'element', 'tagtype', 'category', 'kind', 'elementtype'];
  const ENGLISH_KEYS = [
    'tagcontent', 'content', 'tagtext', 'tagstring', 'english', 'englishtext',
    'tagenglish', 'englishcopy', 'copy', 'englishmaster', 'master', 'source',
    'sourcetext', 'sourcestring', 'en', 'text', 'string', 'label', 'value',
    'message', 'description', 'englishus', 'defaulttext', 'originaltext'
  ];

  normalizedHeaders.forEach((h, idx) => {
    if (PAGE_ID_KEYS.includes(h)) {
      pageIdIdx = idx;
    } else if (PAGE_NAME_KEYS.includes(h)) {
      pageNameIdx = idx;
    } else if (MODULE_KEYS.includes(h)) {
      moduleIdx = idx;
    } else if (TAG_ID_KEYS.includes(h)) {
      tagIdIdx = idx;
    } else if (TYPE_KEYS.includes(h)) {
      typeIdx = idx;
    } else if (ENGLISH_KEYS.includes(h)) {
      englishIdx = idx;
    } else {
      // Check for translation target language columns
      for (const [key, code] of Object.entries(KNOWN_LANGUAGES)) {
        if (h === key || h === `trans${key}` || h.includes(key)) {
          langColMap.push({ colIdx: idx, langCode: code });
          break;
        }
      }
    }
  });

  const isHeaderRow = pageIdIdx !== -1 || tagIdIdx !== -1 || englishIdx !== -1;
  const dataRows = isHeaderRow ? rows.slice(1) : rows;

  if (!isHeaderRow && firstRow.length === 3) {
    pageIdIdx = 0;
    tagIdIdx = 1;
    englishIdx = 2;
  } else if (!isHeaderRow && firstRow.length >= 4) {
    pageIdIdx = 0;
    tagIdIdx = 1;
    typeIdx = 2;
    englishIdx = 3;
  } else if (isHeaderRow && pageIdIdx === -1 && tagIdIdx !== -1 && englishIdx !== -1) {
    pageIdIdx = -999;
  }

  for (const row of dataRows) {
    if (!row || row.length === 0 || !row.some(c => String(c).trim().length > 0)) continue;

    let pageId = "";
    let pageName = "";
    let moduleName = "";

    if (pageIdIdx === -999) {
      let derived = lowerName
        .replace(/\.(csv|tsv|txt|xlsx?|json)$/i, '')
        .replace(/_translations?$/i, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .toUpperCase() || "PAGE_DEFAULT";

      // Match known page prefixes e.g. SERSET8595887364225503877 -> SERSET
      for (const knownKey of Object.keys(PAGE_META_LOOKUP)) {
        if (derived.startsWith(knownKey)) {
          derived = knownKey;
          break;
        }
      }

      pageId = derived;
      pageName = formatPageName(pageId);
      moduleName = formatModuleName(pageId);
    } else {
      pageId = (row[pageIdIdx >= 0 ? pageIdIdx : 0] || "").toString().trim().toUpperCase();
      if (!pageId) continue;
      
      pageName = pageNameIdx >= 0 && row[pageNameIdx] 
        ? String(row[pageNameIdx]).trim() 
        : formatPageName(pageId);
        
      moduleName = moduleIdx >= 0 && row[moduleIdx]
        ? String(row[moduleIdx]).trim() 
        : formatModuleName(pageId);
    }

    if (!pageMap.has(pageId)) {
      pageMap.set(pageId, {
        pageId,
        name: pageName,
        module: moduleName,
        status: "Active",
        tags: []
      });
    }

    const currentPage = pageMap.get(pageId)!;
    const tagId = tagIdIdx >= 0 && row[tagIdIdx] ? String(row[tagIdIdx]).trim() : "";
    const english = englishIdx >= 0 && row[englishIdx] ? String(row[englishIdx]).trim() : "";
    let copyType = typeIdx >= 0 && row[typeIdx] ? String(row[typeIdx]).trim() : "General";

    if (copyType.length > 30 || copyType.includes(" ")) {
      copyType = "General";
    }

    if (tagId || english) {
      const generatedTagId = tagId || `TAG_${pageId}_${currentPage.tags.length + 1}`;
      
      const values: Record<string, { text: string; status?: string; confidence?: number }> = {};
      for (const lang of langColMap) {
        const transText = (row[lang.colIdx] || "").toString().trim();
        if (transText) {
          values[lang.langCode] = {
            text: transText,
            status: "Approved",
            confidence: 95
          };
        }
      }

      // Check if tag already parsed from an earlier row/file to update non-destructively
      const existingTagIdx = currentPage.tags.findIndex(t => t.id === generatedTagId);
      if (existingTagIdx >= 0) {
        const existing = currentPage.tags[existingTagIdx];
        currentPage.tags[existingTagIdx] = {
          ...existing,
          english: english || existing.english,
          type: copyType !== "General" ? copyType : existing.type,
          values: { ...(existing.values || {}), ...values }
        };
      } else {
        currentPage.tags.push({
          id: generatedTagId,
          type: copyType,
          english: english,
          values: Object.keys(values).length > 0 ? values : undefined
        });
      }
    }
  }
}

export function processSingleFile(file: InputFile, pageMap: Map<string, PageImport>) {
  const { fileName, fileContent } = file;
  const lowerName = (fileName || "").toLowerCase();

  // 1. JSON
  if (lowerName.endsWith('.json')) {
    const text = typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent);
    const parsed = JSON.parse(text);
    const pages: PageImport[] = Array.isArray(parsed) 
      ? parsed 
      : (parsed.pages && Array.isArray(parsed.pages) ? parsed.pages : [parsed]);

    for (const p of pages) {
      if (!p.pageId) continue;
      const pageId = p.pageId.toUpperCase();
      if (!pageMap.has(pageId)) {
        pageMap.set(pageId, {
          pageId,
          name: p.name || formatPageName(pageId),
          module: p.module || formatModuleName(pageId),
          status: p.status || "Active",
          tags: []
        });
      }
      const pageEntry = pageMap.get(pageId)!;
      if (p.tags && Array.isArray(p.tags)) {
        for (const t of p.tags) {
          const exIdx = pageEntry.tags.findIndex(ex => ex.id === t.id);
          if (exIdx >= 0) {
            pageEntry.tags[exIdx] = { ...pageEntry.tags[exIdx], ...t };
          } else {
            pageEntry.tags.push({
              id: t.id,
              type: t.type || "General",
              english: t.english || "",
              values: t.values
            });
          }
        }
      }
    }
  } 
  // 2. Excel (.xlsx, .xls)
  else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const workbook = typeof fileContent === 'string'
      ? XLSX.read(fileContent, { type: 'binary' })
      : XLSX.read(fileContent, { type: 'array' });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const sheetRows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
      processTableRows(sheetRows, fileName, pageMap);
    }
  }
  // 3. CSV / TSV / TXT
  else {
    const text = typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent);
    const rows = parseDelimitedRows(text);
    processTableRows(rows, fileName, pageMap);
  }
}

export function parseFilesPayload(files: InputFile[]): ParseResult {
  if (!files || files.length === 0) {
    throw new Error("No files provided for processing.");
  }

  const pageMap = new Map<string, PageImport>();

  for (const file of files) {
    processSingleFile(file, pageMap);
  }

  const pagesToUpload = Array.from(pageMap.values());

  if (pagesToUpload.length === 0) {
    throw new Error("No valid pages or tags could be parsed from the uploaded file(s). Please verify the file contents.");
  }

  for (const p of pagesToUpload) {
    if (!p.pageId) {
      throw new Error("Parsed page is missing a valid Page ID.");
    }
    p.name = p.name || formatPageName(p.pageId);
    p.module = p.module || formatModuleName(p.pageId);
  }

  const totalTags = pagesToUpload.reduce((sum, p) => sum + p.tags.length, 0);

  return {
    pagesToUpload,
    summary: {
      totalFiles: files.length,
      totalPages: pagesToUpload.length,
      totalTags
    }
  };
}

/**
 * Parses files using Web Worker if available, with transparent in-thread fallback.
 */
export async function parseUploadFiles(files: InputFile[]): Promise<ParseResult> {
  try {
    if (typeof Worker !== 'undefined') {
      return await new Promise<ParseResult>((resolve, reject) => {
        try {
          const worker = new Worker(new URL('../workers/parser.worker.ts', import.meta.url), { type: 'module' });
          
          worker.onmessage = (event) => {
            if (event.data?.success) {
              resolve({
                pagesToUpload: event.data.pagesToUpload,
                summary: event.data.summary
              });
            } else {
              reject(new Error(event.data?.error || "Parsing failed in worker."));
            }
            worker.terminate();
          };

          worker.onerror = (err) => {
            console.warn("Worker execution error, falling back to direct parser:", err);
            worker.terminate();
            try {
              resolve(parseFilesPayload(files));
            } catch (fallbackErr) {
              reject(fallbackErr);
            }
          };

          worker.postMessage({ files });
        } catch (workerInitErr) {
          console.warn("Worker initialization failed, using direct parser:", workerInitErr);
          resolve(parseFilesPayload(files));
        }
      });
    }
  } catch (err) {
    console.warn("Worker error caught, using direct parser fallback:", err);
  }

  return parseFilesPayload(files);
}
