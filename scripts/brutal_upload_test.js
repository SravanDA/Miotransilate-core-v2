/**
 * Brutal Upload & Parsing Test Suite
 * Tests every edge case, format, delimiter, quote escaping, Unicode, and real Mock LS datasets.
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
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
        if (nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
        currentRow = [];
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
  }

  return rows;
}

function parseFile(fileContent, fileName) {
  let pagesToUpload = [];
  const lowerName = (fileName || "").toLowerCase();

  if (lowerName.endsWith('.json')) {
    const parsed = JSON.parse(fileContent);
    if (Array.isArray(parsed)) {
      pagesToUpload = parsed;
    } else if (parsed.pages && Array.isArray(parsed.pages)) {
      pagesToUpload = parsed.pages;
    } else if (parsed.page || parsed.pageId) {
      pagesToUpload = [parsed];
    } else {
      throw new Error("Invalid JSON structure. Expected a list of pages or catalog object.");
    }
  } else if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt') || lowerName.endsWith('.xls') || lowerName.endsWith('.xlsx')) {
    const rows = parseDelimitedRows(fileContent);
    if (rows.length === 0) {
      throw new Error("The uploaded file contains no data rows.");
    }

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

    const pageMap = new Map();

    for (const row of dataRows) {
      if (!row || row.length === 0 || !row.some(c => c.trim().length > 0)) continue;

      let pageId = "";
      let pageName = "";
      let moduleName = "";

      if (pageIdIdx === -999) {
        pageId = lowerName
          .replace(/_translations?\.(csv|tsv|txt)/, '')
          .replace(/[^a-z0-9]/g, '_')
          .toUpperCase() || "PAGE_DEFAULT";
        pageName = formatPageName(pageId);
        moduleName = formatModuleName(pageId);
      } else {
        pageId = (row[pageIdIdx >= 0 ? pageIdIdx : 0] || "").trim().toUpperCase();
        if (!pageId) continue;
        
        pageName = pageNameIdx >= 0 && row[pageNameIdx] 
          ? row[pageNameIdx].trim() 
          : formatPageName(pageId);
          
        moduleName = moduleIdx >= 0 && row[moduleIdx]
          ? row[moduleIdx].trim()
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

      const tagId = tagIdIdx >= 0 && row[tagIdIdx] ? row[tagIdIdx].trim() : "";
      const english = englishIdx >= 0 && row[englishIdx] ? row[englishIdx].trim() : "";
      let copyType = typeIdx >= 0 && row[typeIdx] ? row[typeIdx].trim() : "General";

      if (copyType.length > 30 || copyType.includes(" ")) {
        copyType = "General";
      }

      if (tagId || english) {
        const generatedTagId = tagId || `TAG_${pageId}_${pageMap.get(pageId).tags.length + 1}`;
        
        const values = {};
        for (const lang of langColMap) {
          const transText = (row[lang.colIdx] || "").trim();
          if (transText) {
            values[lang.langCode] = {
              text: transText,
              status: "Approved",
              confidence: 95
            };
          }
        }

        pageMap.get(pageId).tags.push({
          id: generatedTagId,
          type: copyType,
          english: english,
          values: Object.keys(values).length > 0 ? values : undefined
        });
      }
    }

    pagesToUpload = Array.from(pageMap.values());
  }

  for (const p of pagesToUpload) {
    if (!p.pageId) throw new Error("Missing pageId");
    p.name = p.name || formatPageName(p.pageId);
    p.module = p.module || formatModuleName(p.pageId);
  }

  return pagesToUpload;
}

// ───────────────────────────────────────────────
// TEST RUNNER
// ───────────────────────────────────────────────
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, extraInfo = "") {
  if (condition) {
    console.log(`  ${green('✓')} ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ${red('✗')} ${testName} ${extraInfo ? `\n    ${extraInfo}` : ''}`);
    testsFailed++;
  }
}

console.log(bold('\n================================================================'));
console.log(bold('        BRUTAL AUTOMATION TEST: UPLOAD, PARSING & SCHEMAS        '));
console.log(bold('================================================================\n'));

// --- TEST SUITE 1: Real Mock LS CSV Datasets ---
console.log(cyan('TEST SUITE 1: Real Mock Language Services CSV Datasets'));
const tagsDir = path.join(__dirname, '../tags');
const tagFiles = fs.readdirSync(tagsDir).filter(f => f.endsWith('.csv'));

const expectedCounts = {
  'CAMREW.csv': { pageId: 'CAMREW', name: 'Campaign & Rewards', module: 'Campaign & Rewards', minTags: 28 },
  'CUSINS1988866026849739700.csv': { pageId: 'CUSINS', name: 'Customer Insights', module: 'Customer Insights', minTags: 71 },
  'CUSWISH.csv': { pageId: 'CUSWISH', name: 'Customer Wishlist', module: 'Customer Wishlist', minTags: 27 },
  'POTSALESET.csv': { pageId: 'POTSALESET', name: 'POS / Sale Settings', module: 'POS / Sale Settings', minTags: 362 },
  'SERSET8595887364225503877.csv': { pageId: 'SERSET', name: 'Service Settings', module: 'Service Settings', minTags: 71 },
  'STAFFSET.csv': { pageId: 'STAFFSET', name: 'Staff Settings', module: 'Staff Settings', minTags: 274 }
};

for (const file of tagFiles) {
  const content = fs.readFileSync(path.join(tagsDir, file), 'utf8');
  const result = parseFile(content, file);
  const exp = expectedCounts[file];

  assert(result.length === 1, `[${file}] exactly 1 page parsed`);
  const page = result[0];
  if (exp) {
    assert(page.pageId === exp.pageId, `[${file}] pageId is ${exp.pageId} (got: ${page.pageId})`);
    assert(page.name === exp.name, `[${file}] page name is '${exp.name}' (got: '${page.name}')`);
    assert(page.module === exp.module, `[${file}] module is '${exp.module}' (got: '${page.module}')`);
    assert(page.tags.length >= exp.minTags, `[${file}] tag count ${page.tags.length} >= ${exp.minTags}`);
    
    // Check no tag ID has leaked english text
    const sampleTag = page.tags[0];
    assert(!sampleTag.id.includes(' '), `[${file}] tag ID has no spaces (got: '${sampleTag.id}')`);
    assert(sampleTag.english.length > 0, `[${file}] tag English is non-empty`);
    assert(sampleTag.type === 'General', `[${file}] default tag type is 'General'`);
  }
}

// --- TEST SUITE 2: RFC 4180 Quotes, Commas, and Escaping Stress Cases ---
console.log(cyan('\nTEST SUITE 2: RFC 4180 Escaping & Complex Strings'));

const complexCsv = `PageId,TagName,Tag Content
SERSET,TAG_COMPLEX_01,"This text contains, multiple commas, and semicolons; and tabs\tinside quotes."
SERSET,TAG_COMPLEX_02,"He said: ""You must enter '0.1 Qty' if 100 ml is used from a 1000 ml bottle."""
SERSET,TAG_COMPLEX_03,"First line of description
Second line with line break
Third line with more details"
SERSET,TAG_COMPLEX_04,"Trailing quote test: """"hello"""" end"`;

const complexResult = parseFile(complexCsv, 'complex.csv');
assert(complexResult[0].tags.length === 4, 'Complex CSV parses all 4 items');
assert(complexResult[0].tags[0].english === "This text contains, multiple commas, and semicolons; and tabs\tinside quotes.", 'Inner commas & tabs preserved');
assert(complexResult[0].tags[1].english === `He said: "You must enter '0.1 Qty' if 100 ml is used from a 1000 ml bottle."`, 'Escaped double quotes "" correctly unescaped to single "');
assert(complexResult[0].tags[2].english.includes('Second line with line break'), 'Multi-line cell inside quotes preserved');
assert(complexResult[0].tags[3].english === `Trailing quote test: ""hello"" end`, 'Double-escaped quotes preserved');

// --- TEST SUITE 3: Multilingual Unicode & RTL Characters ---
console.log(cyan('\nTEST SUITE 3: Non-ASCII, Unicode & Multilingual Encoding'));

const unicodeCsv = `PageId,TagName,Tag Content,Arabic (ar),Spanish (es),French (Canada) (fr),German (de)
CRM,TAG_ARABIC,Welcome to our luxury salon,مرحبًا بكم في صالوننا الفاخر,Bienvenido a nuestro salón de lujo,Bienvenue dans notre salon luxueux,Willkommen in unserem Luxussalon
CRM,TAG_TURKISH,Appointment scheduled successfully,تم حجز الموعد بنجاح,Cita programada con éxito,Rendez-vous planifié avec succès,Termin erfolgreich vereinbart
CRM,TAG_SPECIAL_CHARS,Special offer: 50% off & Free Gift! 🎉,عرض خاص: خصم 50٪ وهدية مجانية! 🎉,Oferta especial: ¡50% de descuento y regalo gratis! 🎉,Offre spéciale : 50 % de rabais et cadeau gratuit ! 🎉,Sonderangebot: 50 % Rabatt & Gratisgeschenk! 🎉`;

const unicodeResult = parseFile(unicodeCsv, 'unicode_export.csv');
assert(unicodeResult[0].tags.length === 3, 'Unicode CSV parsed 3 tags');
const arTag = unicodeResult[0].tags[0];
assert(arTag.values['ar'].text === 'مرحبًا بكم في صالوننا الفاخر', 'Arabic RTL translation parsed correctly');
assert(arTag.values['es'].text === 'Bienvenido a nuestro salón de lujo', 'Spanish translation parsed correctly');
assert(arTag.values['fr'].text === 'Bienvenue dans notre salon luxueux', 'French (Canada) translation parsed correctly');
assert(arTag.values['de'].text === 'Willkommen in unserem Luxussalon', 'German translation parsed correctly');
const emojiTag = unicodeResult[0].tags[2];
assert(emojiTag.english.includes('🎉'), 'Emoji and special symbols preserved');

// --- TEST SUITE 4: Tab-Separated (TSV) and Semicolon Delimiters ---
console.log(cyan('\nTEST SUITE 4: Alternative Delimiters (TSV and Semicolon)'));

const tsvContent = `PageId\tTagName\tTag Content\nSTAFFSET\tBTN_SHIFT\tGenerate Shift\nSTAFFSET\tLBL_EMAIL\tProvide valid email address`;
const tsvResult = parseFile(tsvContent, 'tags.tsv');
assert(tsvResult[0].tags.length === 2, 'TSV parsed 2 tags successfully');
assert(tsvResult[0].tags[0].id === 'BTN_SHIFT', 'TSV Tag ID correctly parsed');
assert(tsvResult[0].tags[0].english === 'Generate Shift', 'TSV English correctly parsed');

const semicolonContent = `PageId;TagName;Tag Content\nCUSWISH;TAG_WISHLIST;Customer Wishlist Items\nCUSWISH;TAG_SAVE;Save Changes`;
const semiResult = parseFile(semicolonContent, 'tags_semicolon.csv');
assert(semiResult[0].tags.length === 2, 'Semicolon CSV parsed 2 tags successfully');
assert(semiResult[0].tags[1].english === 'Save Changes', 'Semicolon English correctly parsed');

// --- TEST SUITE 5: Single-Page Export Format (Derives pageId from Filename) ---
console.log(cyan('\nTEST SUITE 5: Single-Page Export Delimited Format'));

const singlePageExport = `Tag ID,Type,English Master,Spanish (es),Arabic (ar)
TAG_POS_01,Button,Pay Now,Pagar Ahora,ادفع الآن
TAG_POS_02,Label,Total Due,Total a Pagar,المبلغ المستحق`;

const singlePageResult = parseFile(singlePageExport, 'pos_checkout_translations.csv');
assert(singlePageResult.length === 1, 'Single-page export parsed 1 page');
assert(singlePageResult[0].pageId === 'POS_CHECKOUT', 'Page ID derived from filename (POS_CHECKOUT)');
assert(singlePageResult[0].tags.length === 2, 'Single-page export parsed 2 tags');
assert(singlePageResult[0].tags[0].type === 'Button', 'Type preserved as Button');
assert(singlePageResult[0].tags[0].values['es'].text === 'Pagar Ahora', 'Spanish translation parsed');

// --- TEST SUITE 6: JSON Formats (Array, Catalog Object, Single Page) ---
console.log(cyan('\nTEST SUITE 6: JSON Multi-Format Compatibility'));

const jsonCatalog = JSON.stringify({
  exportVersion: "1.0",
  pages: [
    {
      pageId: "SERSET",
      name: "Service Settings",
      module: "Service Settings",
      tags: [
        { id: "TAG_01", type: "Button", english: "Save Service" }
      ]
    },
    {
      pageId: "STAFFSET",
      name: "Staff Settings",
      module: "Staff Settings",
      tags: [
        { id: "TAG_02", type: "Label", english: "Staff Name" }
      ]
    }
  ]
});

const jsonResult = parseFile(jsonCatalog, 'catalog.json');
assert(jsonResult.length === 2, 'JSON catalog parsed 2 pages');
assert(jsonResult[0].pageId === 'SERSET', 'Page 1 is SERSET');
assert(jsonResult[1].pageId === 'STAFFSET', 'Page 2 is STAFFSET');

// --- TEST SUITE 7: High-Volume Performance Stress Test (10,000 tags) ---
console.log(cyan('\nTEST SUITE 7: High-Volume Stress Test (10,000 rows)'));

let hugeCsv = 'PageId,TagName,Tag Content\n';
for (let i = 1; i <= 10000; i++) {
  const pId = `PAGE_${Math.floor(i / 200)}`;
  hugeCsv += `${pId},TAG_${i},"English translatable string for item ${i} with comma, and detail."\n`;
}

const startTime = Date.now();
const hugeResult = parseFile(hugeCsv, 'huge_catalog.csv');
const elapsed = Date.now() - startTime;

const totalTags = hugeResult.reduce((sum, p) => sum + p.tags.length, 0);
assert(totalTags === 10000, `Successfully parsed 10,000 tags across ${hugeResult.length} pages`);
assert(elapsed < 200, `High-volume 10,000 tag parsing completed in ${elapsed}ms (< 200ms target)`);

// --- FINAL SUMMARY ---
console.log(bold('\n================================================================'));
console.log(bold(`        TEST RESULTS: ${green(`${testsPassed} PASSED`)} | ${testsFailed > 0 ? red(`${testsFailed} FAILED`) : green('0 FAILED')}`));
console.log(bold('================================================================\n'));

if (testsFailed > 0) {
  process.exit(1);
}
