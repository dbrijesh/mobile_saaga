/**
 * freshImportFromExcel.js
 * Clears products, categories and subcategories tables then imports
 * fresh data from "Saaga Online New Products.xlsx".
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const ddb    = DynamoDBDocumentClient.from(client);

const PROD_TABLE   = process.env.PRODUCTS_TABLE;
const CAT_TABLE    = process.env.CATEGORIES_TABLE;
const SUBCAT_TABLE = process.env.SUBCATEGORIES_TABLE;

// ─── category normalisation ───────────────────────────────────────────────────
const CAT_MAP = {
  'instant food & sauce': 'Instant Food & Snacks',
  'instant food and sauce': 'Instant Food & Snacks',
};
function normaliseCategory(raw) {
  return CAT_MAP[(raw || '').toLowerCase().trim()] || (raw || '').trim();
}

// ─── title case ───────────────────────────────────────────────────────────────
const NOT_ABBREV = new Set([
  'all','are','is','it','was','has','for','the','and','but','not','yes','no',
  'can','get','new','old','fry','mix','dry','oil','cut','raw','bar','cup',
  'bag','box','tin','set','kit','gel','our','per','rich','plus','free','good',
  'best','pure','mild','fine','dark','lite','mini','full','soft','hard','gold',
  'real','fresh','from','into','with','over','just',
]);
const SMALL = new Set(['a','an','the','and','or','of','in','on','at','to','for','with','by','from','into','&']);

function titleCase(str) {
  if (!str) return str;
  return String(str).replace(/\S+/g, (word, offset) => {
    if (word === '&') return '&';
    if (/\d/.test(word)) return word;
    const lower = word.toLowerCase();
    if (word.length >= 2 && word.length <= 3 && word === word.toUpperCase() && /^[A-Z]+$/.test(word) && !NOT_ABBREV.has(lower)) return word;
    if (offset > 0 && SMALL.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

function cleanStr(s) {
  return (s || '').toString().trim().replace(/[,\s]+$/, '').trim();
}

function normUnit(s) {
  const u = (s || '').toString().toLowerCase().trim();
  if (u === 'ltr' || u === 'litre' || u === 'ltr ') return 'L';
  if (u === 'gram' || u === 'grams' || u === 'gm') return 'g';
  if (u === 'kilo' || u === 'kilogram') return 'kg';
  if (u === 'piece' || u === 'pieces' || u === 'pcs') return 'pcs';
  return u.trim();
}

function roundPrice(p) {
  const n = parseFloat(p);
  return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
}

function padId(n)  { return `PROD-${String(n).padStart(6, '0')}`; }
function padSku(n) { return `SKU-${String(n).padStart(6, '0')}`; }

// ─── DynamoDB helpers ─────────────────────────────────────────────────────────
async function scanAllIds(table, keyField) {
  const items = []; let lastKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: table,
      ProjectionExpression: keyField,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function batchWrite(table, requests) {
  for (let i = 0; i < requests.length; i += 25) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [table]: requests.slice(i, i + 25) } }));
  }
}

async function clearTable(table, keyField) {
  console.log(`  Scanning ${table}...`);
  const items = await scanAllIds(table, keyField);
  if (items.length === 0) { console.log(`  Already empty.`); return; }
  const delRequests = items.map(item => ({ DeleteRequest: { Key: { [keyField]: item[keyField] } } }));
  await batchWrite(table, delRequests);
  console.log(`  Deleted ${items.length} items from ${table}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function run() {
  const now = new Date().toISOString();

  // 1. Read Excel
  console.log('📊 Reading Saaga Online New Products.xlsx...');
  const wb   = XLSX.readFile(path.join(__dirname, '../../Saaga Online New Products.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1']);
  console.log(`   ${rows.length} raw rows`);

  // 2. No deduplication — every row has a unique SKU and is a distinct product
  const unique = rows;
  console.log(`   Importing all ${unique.length} rows (each SKU is unique)`);

  // 3. Build product objects
  const products = unique.map((row, idx) => {
    const name        = titleCase(cleanStr(row['PRODUCT NAME']));
    const category    = titleCase(normaliseCategory(row['CATEGORY']));
    const subCategory = titleCase(cleanStr(row['SUB- CATEGORY'] || ''));
    const unit        = normUnit(row['UNIT']);
    const weight      = String(row['WEIGHT'] || '').trim();
    const price       = roundPrice(row['PRICE']);
    const stock       = parseInt(row['STOCK'], 10) || 100;

    return {
      id:           padId(idx + 1),
      name,
      description:  `${name} - Premium quality Indian grocery product`,
      category,
      subCategory,
      brand:        '',
      unit,
      weight,
      price,
      discountedPrice: price,
      discountPercent: 0,
      originalPrice: null,
      currency:     'SGD',
      stock,
      inStock:      stock > 0,
      imageUrl:     '',
      images:       [],
      sku:          padSku(idx + 1),
      barcode:      '',
      tags:         [],
      featured:     false,
      discount:     0,
      rating:       0,
      reviewCount:  0,
      createdAt:    now,
      updatedAt:    now,
    };
  });

  // 4. Build categories
  const catGroups = {};
  products.forEach(p => {
    if (!catGroups[p.category]) catGroups[p.category] = [];
    catGroups[p.category].push(p);
  });
  const categories = Object.keys(catGroups).sort().map((name, idx) => ({
    id:           `CAT-${String(idx + 1).padStart(4, '0')}`,
    name,
    slug:         name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
    productCount: catGroups[name].length,
    imageUrl:     '',
    featured:     false,
  }));

  // 5. Build subcategories
  const subcatGroups = {};
  products.forEach(p => {
    if (!p.subCategory) return;
    const key = `${p.category}||${p.subCategory}`;
    if (!subcatGroups[key]) subcatGroups[key] = { parentCategoryName: p.category, name: p.subCategory, count: 0 };
    subcatGroups[key].count++;
  });
  const subcategories = Object.values(subcatGroups).map(({ parentCategoryName, name, count }, idx) => ({
    id:                 `SUBCAT-${String(idx + 1).padStart(4, '0')}`,
    name,
    parentCategoryName,
    slug:               name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
    productCount:       count,
  }));

  // 6. Clear all three tables
  console.log('\n🗑  Clearing existing data...');
  await clearTable(PROD_TABLE,   'id');
  await clearTable(CAT_TABLE,    'id');
  await clearTable(SUBCAT_TABLE, 'id');

  // 7. Import products
  console.log('\n📝 Importing products...');
  await batchWrite(PROD_TABLE, products.map(p => ({ PutRequest: { Item: p } })));
  console.log(`   ✅ ${products.length} products imported`);

  // 8. Import categories
  console.log('📁 Importing categories...');
  await batchWrite(CAT_TABLE, categories.map(c => ({ PutRequest: { Item: c } })));
  console.log(`   ✅ ${categories.length} categories imported`);

  // 9. Import subcategories
  console.log('📂 Importing subcategories...');
  await batchWrite(SUBCAT_TABLE, subcategories.map(s => ({ PutRequest: { Item: s } })));
  console.log(`   ✅ ${subcategories.length} subcategories imported`);

  // 10. Save JSON files
  const dataDir = path.join(__dirname, '../data');
  fs.writeFileSync(path.join(dataDir, 'products.json'),    JSON.stringify(products, null, 2));
  fs.writeFileSync(path.join(dataDir, 'categories.json'),  JSON.stringify(categories, null, 2));
  fs.writeFileSync(path.join(dataDir, 'subcategories.json'), JSON.stringify(subcategories, null, 2));
  fs.writeFileSync(path.join(dataDir, 'stats.json'), JSON.stringify({
    totalProducts:   products.length,
    totalCategories: categories.length,
    lastSynced:      now,
    categoriesBreakdown: categories.map(c => ({ category: c.name, count: c.productCount })),
  }, null, 2));

  console.log('\n✅ Fresh import complete!');
  console.log(`   📦 Products: ${products.length}`);
  console.log(`   📁 Categories: ${categories.length}`);
  console.log(`   📂 Subcategories: ${subcategories.length}`);
  console.log('\nCategory breakdown:');
  categories.forEach(c => console.log(`   ${String(c.productCount).padStart(4)}  ${c.name}`));
  console.log('\nSubcategories:');
  const byCat = {};
  subcategories.forEach(s => { (byCat[s.parentCategoryName] = byCat[s.parentCategoryName] || []).push(s.name); });
  Object.entries(byCat).sort().forEach(([cat, subs]) => console.log(`   [${cat}]  ${subs.join(', ')}`));
}

run().catch(err => { console.error('❌', err); process.exit(1); });
