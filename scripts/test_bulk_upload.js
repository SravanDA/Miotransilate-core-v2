const fs = require('fs');
const path = require('path');
const XLSX = require('../frontend/node_modules/xlsx');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

const PAGE_META_LOOKUP = {
  SERSET: { name: "Service Settings", module: "Service Settings" },
  CUSINS: { name: "Customer Insights", module: "Customer Insights" },
  CAMREW: { name: "Campaign & Rewards", module: "Campaign & Rewards" },
  POTSALESET: { name: "POS / Sale Settings", module: "POS / Sale Settings" },
  STAFFSET: { name: "Staff Settings", module: "Staff Settings" },
  CUSWISH: { name: "Customer Wishlist", module: "Customer Wishlist" }
};

const KNOWN_LANGUAGES = {
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

function parseDelimitedRows(text) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

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
          i++;
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

function cleanHeaderToken(header) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatPageName(pageId) {
  const known = PAGE_META_LOOKUP[pageId.toUpperCase()];
  if (known) return known.name;
  return pageId
    .split(/[_\-\s]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function formatModuleName(pageId, parsedModule) {
  if (parsedModule && parsedModule.trim().length > 0) return parsedModule.trim();
  const known = PAGE_META_LOOKUP[pageId.toUpperCase()];
  if (known) return known.module;
  return formatPageName(pageId);
}

function processTableRows(rows, fileName, pageMap) {
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
  const langColMap = [];

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

    const currentPage = pageMap.get(pageId);
    const tagId = tagIdIdx >= 0 && row[tagIdIdx] ? String(row[tagIdIdx]).trim() : "";
    const english = englishIdx >= 0 && row[englishIdx] ? String(row[englishIdx]).trim() : "";
    let copyType = typeIdx >= 0 && row[typeIdx] ? String(row[typeIdx]).trim() : "General";

    if (copyType.length > 30 || copyType.includes(" ")) {
      copyType = "General";
    }

    if (tagId || english) {
      const generatedTagId = tagId || `TAG_${pageId}_${currentPage.tags.length + 1}`;
      
      const values = {};
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

function processSingleFile(file, pageMap) {
  const { fileName, fileContent } = file;
  const lowerName = (fileName || "").toLowerCase();

  if (lowerName.endsWith('.json')) {
    const text = typeof fileContent === 'string' ? fileContent : Buffer.from(fileContent).toString('utf-8');
    const parsed = JSON.parse(text);
    const pages = Array.isArray(parsed) 
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
      const pageEntry = pageMap.get(pageId);
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
  } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const workbook = typeof fileContent === 'string'
      ? XLSX.read(fileContent, { type: 'binary' })
      : XLSX.read(fileContent, { type: 'buffer' });

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      processTableRows(sheetRows, fileName, pageMap);
    }
  } else {
    const text = typeof fileContent === 'string' ? fileContent : Buffer.from(fileContent).toString('utf-8');
    const rows = parseDelimitedRows(text);
    processTableRows(rows, fileName, pageMap);
  }
}

function runBulkTests() {
  console.log(bold(cyan("\n=== RUNNING BULK UPLOAD TESTS (CSV + XLS/XLSX) ===\n")));

  const mockLsDir = path.join(__dirname, '../tags');
  const filesToUpload = [];

  // 1. Load all 6 Mock LS CSV files
  const mockFiles = fs.readdirSync(mockLsDir).filter(f => f.endsWith('.csv'));
  for (const f of mockFiles) {
    const content = fs.readFileSync(path.join(mockLsDir, f), 'utf-8');
    filesToUpload.push({ fileName: f, fileContent: content });
  }

  // 2. Create an in-memory XLSX workbook with a custom page
  const wsData = [
    ["PageId", "TagName", "Tag Content", "Arabic"],
    ["INVOICE_SETTINGS", "INV_TITLE", "Invoice Configuration", "إعدادات الفاتورة"],
    ["INVOICE_SETTINGS", "INV_TAX_NUM", "Tax Registration Number", "الرقم الضريبي"],
    ["INVOICE_SETTINGS", "INV_BTN_SAVE", "Save Changes", "حفظ التغييرات"]
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  filesToUpload.push({ fileName: "custom_invoice.xlsx", fileContent: xlsxBuffer });

  console.log(`Loaded ${filesToUpload.length} files for bulk processing.`);

  const pageMap = new Map();
  for (const file of filesToUpload) {
    processSingleFile(file, pageMap);
  }

  const pages = Array.from(pageMap.values());
  const totalTags = pages.reduce((sum, p) => sum + p.tags.length, 0);

  console.log(bold(`\nParsed Result:`));
  console.log(`Total Pages: ${bold(green(pages.length))} (Expected 7)`);
  console.log(`Total Tags: ${bold(green(totalTags))} (Expected 837 tags)`);

  let passed = true;
  if (pages.length !== 7) {
    console.error(red(`❌ Expected 7 pages, got ${pages.length}`));
    passed = false;
  }

  const invoicePage = pages.find(p => p.pageId === "INVOICE_SETTINGS");
  if (!invoicePage || invoicePage.tags.length !== 3) {
    console.error(red(`❌ Failed to parse XLSX file!`));
    passed = false;
  } else {
    console.log(green(`✓ XLSX parsed successfully: INVOICE_SETTINGS (${invoicePage.tags.length} tags, Arabic translations included)`));
  }

  const serset = pages.find(p => p.pageId === "SERSET");
  if (!serset || serset.tags.length !== 72) {
    console.error(red(`❌ SERSET expected 72 tags, got ${serset ? serset.tags.length : 0}`));
    passed = false;
  } else {
    console.log(green(`✓ SERSET parsed successfully: 72 tags`));
  }

  if (passed) {
    console.log(bold(green("\n🎉 ALL BULK UPLOAD TESTS PASSED SUCCESSFULLY!\n")));
  } else {
    process.exit(1);
  }
}

runBulkTests();
