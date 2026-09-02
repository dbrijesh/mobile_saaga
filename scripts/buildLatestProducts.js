const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// ─── helpers ────────────────────────────────────────────────────────────────

// Category name normalisation map
const CATEGORY_MAP = {
  'chips and chocolates':       'Chips & Chocolates',
  'chips & chocolates':         'Chips & Chocolates',
  'cleaners and repellents':    'Cleaners & Repellents',
  'cleaners & repellents':      'Cleaners & Repellents',
  'instant food and snacks':    'Instant Food & Snacks',
  'instant food & snacks':      'Instant Food & Snacks',
  'instant food & sauce':       'Instant Food & Snacks',
  'milk cereal & nuts':         'Milk & Cereals & Nuts',
  'milk & cereals & nuts':      'Milk & Cereals & Nuts',
  'milk cereal and nuts':       'Milk & Cereals & Nuts',
  'oil , ghee & masala':        'Oil, Ghee & Masala',
  'oil & ghee & masala':        'Oil, Ghee & Masala',
  'oil, ghee & masala':         'Oil, Ghee & Masala',
  'oils & ghee':                'Oil, Ghee & Masala',
  'oil ghee & masala':          'Oil, Ghee & Masala',
  'tea, coffee & milk drinks':  'Beverages',
  'bakery biscuits and juice':  'Bakery, Biscuits & Juice',
  'bakery biscuits & juice':    'Bakery, Biscuits & Juice',
  'bath and body':              'Bath & Body',
  'bath & body':                'Bath & Body',
  'lentils & pulses':           'Atta & Dhall',
  'atta & dhall':               'Atta & Dhall',
  'atta & dal':                 'Atta & Dhall',
  'flours':                     'Atta & Dhall',
  'uncategorized':              'Uncategorized',
};

function normaliseCategory(raw) {
  const key = (raw || '').toString().toLowerCase().trim().replace(/\s+/g, ' ');
  return CATEGORY_MAP[key] || raw || 'Uncategorized';
}

function normName(s) {
  return (s || '').toString().toLowerCase().trim().replace(/[,\s]+$/, '').replace(/\s+/g, ' ');
}

// Compact key: remove all spaces/punctuation for fuzzy matching
function compactName(s) {
  return (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normUnit(s) {
  const u = (s || '').toString().toLowerCase().trim();
  if (u === 'ltr' || u === 'litre' || u === 'litr') return 'l';
  if (u === 'gram' || u === 'grams' || u === 'gm') return 'g';
  if (u === 'kilo' || u === 'kilos' || u === 'kilogram') return 'kg';
  if (u === 'piece' || u === 'pieces' || u === 'pcs') return 'pcs';
  if (u === 'ltr ') return 'l';
  return u.trim();
}

function normWeight(s) {
  return (s || '').toString().trim().replace(/\.0+$/, '');
}

function dedupKey(name, unit, weight) {
  return `${normName(name)}|${normUnit(unit)}|${normWeight(weight)}`;
}

function compactKey(name, unit, weight) {
  return `${compactName(name)}|${normUnit(unit)}|${normWeight(weight)}`;
}

function cleanStr(s) {
  return (s || '').toString().trim().replace(/[,\s]+$/, '').trim();
}

function toYesNo(val) {
  if (val === true || val === 'Yes' || val === 'yes' || val === 'YES') return 'Yes';
  if (typeof val === 'number' && val > 0) return 'Yes';
  return 'No';
}

function roundPrice(p) {
  const n = parseFloat(p);
  return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
}

// ─── CSV parser (handles quoted fields with commas) ──────────────────────────

function parseCsvLine(line) {
  const values = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; }
    else if (c === ',' && !inQ) { values.push(cur); cur = ''; }
    else { cur += c; }
  }
  values.push(cur);
  return values.map(v => v.trim());
}

function loadCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

// ─── normalise a raw row from any Excel source into a standard object ────────

function normaliseExcelRow(raw, sourceFile) {
  // Try to find the name field
  const name = cleanStr(
    raw['Name'] || raw['PRODUCT NAME'] || raw['PRODUCT NAME '] || ''
  );
  if (!name) return null;

  const category = normaliseCategory(cleanStr(
    raw['Category'] || raw['CATEGORY'] || raw['CATEGORY '] || ''
  ));
  const subcategory = cleanStr(
    raw['Subcategory'] || raw['SUB- CATEGORY'] || raw['SUB-CATEGORY'] || ''
  );
  const price = roundPrice(
    raw['Price'] || raw['PRICE'] || raw['Discounted Price'] || raw['DP'] || 0
  );
  const discountPct = roundPrice(raw['Discount %'] || raw['DISCOUNT%'] || 0);
  const discountedPrice = roundPrice(
    raw['Discounted Price'] || raw['DP'] || price
  );
  const stock = parseInt(raw['Stock'] || raw['STOCK'] || 100, 10) || 100;
  const inStock = toYesNo(raw['In Stock'] || raw['Yes'] || stock > 0);
  const unit = normUnit(raw['Unit'] || raw['UNIT'] || 'g');
  const weight = normWeight(raw['Weight'] || raw['WEIGHT'] || '');
  const description = cleanStr(raw['Description'] || raw['DESCRIPTION'] || '');

  return { name, category, subcategory, price, discountPct, discountedPrice, stock, inStock, unit, weight, description, source: sourceFile };
}

// ─── load all Excel sources ──────────────────────────────────────────────────

function loadExcelSources() {
  const PRODUCTS_DIR = path.join(__dirname, '../products');
  const rows = [];

  const sources = [
    // { file, sheet, headerRow (0-based, default 0) }
    { file: 'Saaga Online (1).xlsx',    sheet: 'ATTA & DHALL' },
    { file: 'Saaga Online (1).xlsx',    sheet: 'OIL GHEE & MASALA ' },
    { file: 'Saaga Online (1).xlsx',    sheet: 'Kelloggs',          headerRow: 2 },
    { file: 'Saaga Online (1)-1.xlsx',  sheet: 'BAKERY BISCUITS AND JUICE ', headerRow: 1 },
    { file: 'Saaga Online New Products.xlsx', sheet: 'Sheet1' },
    { file: 'Saaga Online-1.xlsx',      sheet: 'MILK CEREAL NUTS ' },
    { file: 'Saaga Online-2.xlsx',      sheet: 'CHIPS AND CHOCOLATES ' },
    { file: 'Saaga Online-3.xlsx',      sheet: 'CLEANERS AND REPELLENTS ' },
    { file: 'Saaga Online_upload.xlsx', sheet: 'upload' },
  ];

  for (const { file, sheet, headerRow = 0 } of sources) {
    const filePath = path.join(PRODUCTS_DIR, file);
    if (!fs.existsSync(filePath)) { console.warn(`⚠ Missing: ${file}`); continue; }

    const wb = XLSX.readFile(filePath);
    if (!wb.Sheets[sheet]) { console.warn(`⚠ Sheet not found: ${file} [${sheet}]`); continue; }

    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 });
    const headers = raw[headerRow];
    if (!headers || headers.length === 0) continue;

    // Build objects from rows after the header row
    for (let i = headerRow + 1; i < raw.length; i++) {
      const rowArr = raw[i];
      if (!rowArr || rowArr.every(c => !c)) continue;
      const obj = {};
      headers.forEach((h, idx) => { if (h) obj[h] = rowArr[idx]; });
      const norm = normaliseExcelRow(obj, `${file}[${sheet}]`);
      if (norm) rows.push(norm);
    }

    console.log(`  Loaded ${file} [${sheet}]`);
  }

  return rows;
}

// ─── main ────────────────────────────────────────────────────────────────────

function buildLatestProducts() {
  console.log('📂 Loading CSV master...');
  const csvRows = loadCsv(path.join(__dirname, '../products/inventory_2026-04-26 (1).csv'));
  console.log(`  ${csvRows.length} rows in CSV`);

  // Build CSV lookup: both regular + compact key → row (for SKU + imageUrl lookup)
  const csvLookup = new Map();
  const csvLookupCompact = new Map();
  for (const row of csvRows) {
    if (!row['Name']) continue;
    const k  = dedupKey(row['Name'], row['Unit'], row['Weight']);
    const kc = compactKey(row['Name'], row['Unit'], row['Weight']);
    if (!csvLookup.has(k))        csvLookup.set(k, row);
    if (!csvLookupCompact.has(kc)) csvLookupCompact.set(kc, row);
  }

  console.log('\n📊 Loading Excel sources...');
  const excelRows = loadExcelSources();
  console.log(`  ${excelRows.length} raw Excel rows\n`);

  // Deduplicate Excel rows: keep first occurrence of each name+unit+weight
  const seen = new Map();    // dedupKey → index in merged[]
  const merged = [];         // final product list

  let excelDups = 0;

  for (const row of excelRows) {
    const k = dedupKey(row.name, row.unit, row.weight);
    if (seen.has(k)) {
      // Already have this product — skip (first Excel source wins)
      excelDups++;
      continue;
    }

    // Look up SKU and imageUrl from CSV (try exact match then compact/fuzzy)
    const kc = compactKey(row.name, row.unit, row.weight);
    const csvMatch = csvLookup.get(k) || csvLookupCompact.get(kc);
    const sku = csvMatch?.['SKU'] || '';
    const imageUrl = csvMatch?.['Image URL'] || '';
    const description = row.description || csvMatch?.['Description'] || `${row.name} - Premium quality Indian grocery product`;

    merged.push({
      SKU: sku,
      Name: row.name,
      Category: row.category,
      Subcategory: row.subcategory,
      Price: row.price,
      'Discount %': row.discountPct,
      'Discounted Price': row.discountedPrice,
      Stock: row.stock,
      'In Stock': row.inStock,
      Unit: row.unit,
      Weight: row.weight,
      Description: description,
      'Image URL': imageUrl,
    });

    seen.set(k, merged.length - 1);
  }

  console.log(`Removed ${excelDups} intra-Excel duplicates`);

  // Include CSV products NOT already covered by any Excel sheet
  let csvOnly = 0;
  for (const row of csvRows) {
    if (!row['Name']) continue;
    const k = dedupKey(row['Name'], row['Unit'], row['Weight']);
    if (!seen.has(k)) {
      merged.push({
        SKU: row['SKU'] || '',
        Name: cleanStr(row['Name']),
        Category: normaliseCategory(row['Category'] || ''),
        Subcategory: row['Subcategory'] || '',
        Price: roundPrice(row['Price']),
        'Discount %': roundPrice(row['Discount %']),
        'Discounted Price': roundPrice(row['Discounted Price']),
        Stock: parseInt(row['Stock'], 10) || 100,
        'In Stock': row['In Stock'] || 'Yes',
        Unit: normUnit(row['Unit']),
        Weight: normWeight(row['Weight'] || ''),
        Description: row['Description'] || `${cleanStr(row['Name'])} - Premium quality Indian grocery product`,
        'Image URL': row['Image URL'] || '',
      });
      seen.set(k, merged.length - 1);
      csvOnly++;
    }
  }

  console.log(`Added ${csvOnly} CSV-only products (not in any Excel sheet)`);
  console.log(`\n✅ Total unique products: ${merged.length}`);

  // ─── write output Excel ───────────────────────────────────────────────────
  const ws = XLSX.utils.json_to_sheet(merged, {
    header: ['SKU','Name','Category','Subcategory','Price','Discount %','Discounted Price','Stock','In Stock','Unit','Weight','Description','Image URL'],
  });

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, // SKU
    { wch: 45 }, // Name
    { wch: 22 }, // Category
    { wch: 25 }, // Subcategory
    { wch: 8  }, // Price
    { wch: 10 }, // Discount %
    { wch: 16 }, // Discounted Price
    { wch: 8  }, // Stock
    { wch: 9  }, // In Stock
    { wch: 6  }, // Unit
    { wch: 8  }, // Weight
    { wch: 50 }, // Description
    { wch: 80 }, // Image URL
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const outPath = path.join(__dirname, '../products/latestproducts.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`\n📁 Saved: products/latestproducts.xlsx`);

  // Summary
  const withSku   = merged.filter(r => r.SKU).length;
  const withImage = merged.filter(r => r['Image URL']).length;
  const cats = [...new Set(merged.map(r => r.Category))].sort();
  console.log(`   SKU matched:   ${withSku}/${merged.length}`);
  console.log(`   Image matched: ${withImage}/${merged.length}`);
  console.log(`   Categories (${cats.length}): ${cats.join(', ')}`);
}

buildLatestProducts();
