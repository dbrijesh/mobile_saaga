const XLSX = require('xlsx');
const path = require('path');

// Common short English words that should NOT be treated as abbreviations
const NOT_ABBREV = new Set([
  'all','are','is','it','was','has','for','the','and','but','not','yes','no',
  'can','get','new','old','one','two','hot','red','top','big','low','fry','mix',
  'dry','oil','cut','raw','rte','bar','cup','bag','box','tin','set','kit','gel',
  'our','use','add','run','put','let','try','buy','see','say','may','own','per',
  'rich','plus','free','good','best','pure','mild','fine','dark','lite','mini',
  'full','soft','hard','gold','real','fresh','from','into','with','over','just',
]);

// Words to lowercase in the middle of a title (unless first word)
const SMALL_WORDS = new Set(['a','an','the','and','or','of','in','on','at','to','for','with','by','from','into','&']);

function titleCase(str) {
  if (!str) return str;
  return str.replace(/\S+/g, (word, offset) => {
    if (word === '&') return '&';
    if (/\d/.test(word)) return word;  // preserve tokens with digits: 500g, No.1, 100%

    const lower = word.toLowerCase();

    // Preserve short all-caps brand abbreviations (MTR, BRU, VVD, KLF, etc.)
    // but only if not a common English word
    if (
      word.length >= 2 && word.length <= 3 &&
      word === word.toUpperCase() &&
      /^[A-Z]+$/.test(word) &&
      !NOT_ABBREV.has(lower)
    ) return word;

    // Keep small connector words lowercase (unless first word)
    if (offset > 0 && SMALL_WORDS.has(lower)) return lower;

    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

function applyTitleCase() {
  const filePath = path.join(__dirname, '../products/latestproducts.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Products'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headers = data[0];
  const nameIdx     = headers.indexOf('Name');
  const catIdx      = headers.indexOf('Category');
  const subcatIdx   = headers.indexOf('Subcategory');

  let changed = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    ['Name', 'Category', 'Subcategory'].forEach(col => {
      const idx = headers.indexOf(col);
      if (idx >= 0 && row[idx]) {
        const before = row[idx];
        const after  = titleCase(String(before));
        if (before !== after) { row[idx] = after; changed++; }
      }
    });
  }

  // Rebuild sheet preserving header
  const newWs = XLSX.utils.aoa_to_sheet(data);
  newWs['!cols'] = ws['!cols'];
  wb.Sheets['Products'] = newWs;
  XLSX.writeFile(wb, filePath);

  console.log(`✅ Title case applied — ${changed} cells updated`);
  console.log(`📁 Saved: products/latestproducts.xlsx`);

  // Quick sanity check
  const check = XLSX.utils.sheet_to_json(newWs).slice(0, 8);
  console.log('\nSample names after:');
  check.forEach(r => console.log(`  "${r.Name}"  [${r.Category}]  {${r.Subcategory}}`));
}

applyTitleCase();
