/// <reference lib="webworker" />
import * as XLSX from 'xlsx';

interface TagImport {
  id: string;
  type?: string;
  english: string;
  values?: Record<string, { text: string; status?: string; confidence?: number }>;
}

interface PageImport {
  pageId: string;
  name: string;
  module: string;
  status?: string;
  tags: TagImport[];
}

interface InputFile {
  fileName: string;
  fileContent: string | ArrayBuffer;
}

const PAGE_META_LOOKUP: Record<string, { name: string; module: string }> = {
  SERSET: { name: "Service Settings", module: "Service Settings" },
  CUSINS: { name: "Customer Insights", module: "Customer Insights" },
  CAMREW: { name: "Campaign & Rewards", module: "Campaign & Rewards" },
  POTSALESET: { name: "POS / Sale Settings", module: "POS / Sale Settings" },
  STAFFSET: { name: "Staff Settings", module: "Staff Settings" },
  CUSWISH: { name: "Customer Wishlist", module: "Customer Wishlist" }
};

const KNOWN_LANGUAGES: Record<string, string> = {
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
  "french(canada)": "fr",
  "frenchcanada": "fr",
  de: "de",
  german: "de"
};

/**
 * Robust RFC 4180 CSV / TSV Lexer.
 * Correctly parses cells containing commas, escaped quotes (""), newlines, and auto-detects delimiter.
 */
function parseDelimitedRows(text: string): string[][] {
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

function cleanHeaderToken(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatPageName(pageId: string): string {
  const known = PAGE_META_LOOKUP[pageId.toUpperCase()];
  if (known) return known.name;
  return pageId
    .split(/[_\-\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatModuleName(pageId: string, parsedModule?: string): string {
  if (parsedModule && parsedModule.trim().length > 0) return parsedModule.trim();
  const known = PAGE_META_LOOKUP[pageId.toUpperCase()];
  if (known) return known.module;
  return formatPageName(pageId);
}

function processTableRows(rows: string[][], fileName: string, pageMap: Map<string, PageImport>) {
  if (!rows || rows.length === 0) return;

  const lowerName = fileName.toLowerCase();
  const firstRow = rows[0];
  const normalizedHeaders = firstRow.map(cleanHeaderToken);

  let pageIdIdx = -1;
  let pageNameIdx = -1;
  let moduleIdx = -1;
  let tagIdIdx = -1;
  let typeIdx = -1;
  let englishIdx = -1;
  const langColMap: { colIdx: number; langCode: string }[] = [];

  normalizedHeaders.forEach((h, idx) => {
    if (h === 'pageid' || h === 'page' || h === 'screencode' || h === 'screenid') {
      pageIdIdx = idx;
    } else if (h === 'pagename' || h === 'screenname' || h === 'title') {
      pageNameIdx = idx;
    } else if (h === 'module' || h === 'modulename' || h === 'section' || h === 'category') {
      moduleIdx = idx;
    } else if (h === 'tagid' || h === 'tagname' || h === 'tag' || h === 'key' || h === 'stringid' || h === 'token') {
      tagIdIdx = idx;
    } else if (h === 'type' || h === 'copytype' || h === 'element' || h === 'tagtype') {
      typeIdx = idx;
    } else if (h === 'tagcontent' || h === 'content' || h === 'tagtext' || h === 'tagstring' || h === 'english' || h === 'englishtext' || h === 'englishmaster' || h === 'master' || h === 'source' || h === 'en' || h === 'text' || h === 'string') {
      englishIdx = idx;
    } else {
      for (const [key, code] of Object.entries(KNOWN_LANGUAGES)) {
        if (h.includes(key)) {
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
      pageId = lowerName
        .replace(/_translations?\.(csv|tsv|txt|xlsx?)/, '')
        .replace(/[^a-z0-9]/g, '_')
        .toUpperCase() || "PAGE_DEFAULT";
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

function processSingleFile(file: InputFile, pageMap: Map<string, PageImport>) {
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
  else if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')) {
    const text = typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent);
    const rows = parseDelimitedRows(text);
    processTableRows(rows, fileName, pageMap);
  } else {
    // Default fallback: attempt delimited text parse
    const text = typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent);
    const rows = parseDelimitedRows(text);
    processTableRows(rows, fileName, pageMap);
  }
}

self.onmessage = (event: MessageEvent) => {
  try {
    const data = event.data;
    const files: InputFile[] = data.files 
      ? data.files 
      : (data.fileContent ? [{ fileName: data.fileName, fileContent: data.fileContent }] : []);

    if (files.length === 0) {
      throw new Error("No files provided for processing.");
    }

    const pageMap = new Map<string, PageImport>();

    for (const file of files) {
      processSingleFile(file, pageMap);
    }

    const pagesToUpload = Array.from(pageMap.values());

    if (pagesToUpload.length === 0) {
      throw new Error("No valid pages or tags could be parsed from the uploaded file(s).");
    }

    for (const p of pagesToUpload) {
      if (!p.pageId) {
        throw new Error("Parsed page is missing a valid Page ID.");
      }
      p.name = p.name || formatPageName(p.pageId);
      p.module = p.module || formatModuleName(p.pageId);
    }

    const totalTags = pagesToUpload.reduce((sum, p) => sum + p.tags.length, 0);

    self.postMessage({ 
      success: true, 
      pagesToUpload,
      summary: {
        totalFiles: files.length,
        totalPages: pagesToUpload.length,
        totalTags
      }
    });
  } catch (error: any) {
    self.postMessage({ success: false, error: error.message || "Failed to parse files." });
  }
};
