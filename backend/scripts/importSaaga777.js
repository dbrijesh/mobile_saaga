/**
 * importSaaga777.js
 * Adds products from "SAAGA 777 - PRODUCTS.xlsx" to DynamoDB.
 *
 * - Deduplicates exact-duplicate rows within the sheet (same name+weight+category+price)
 * - Matches categories/subcategories case-insensitively against existing DB entries
 *   (creates new ones only if no match exists) — avoids duplicate category names
 * - Assigns fresh, sequential SKUs/PROD ids continuing from the current max in DynamoDB
 *   — guarantees uniqueness against existing products and within this batch
 * - Skips any row whose normalised name+weight already exists in DynamoDB
 *
 * Usage:
 *   PRODUCTS_TABLE=saaga-online-api-products-dev \
 *   CATEGORIES_TABLE=saaga-online-api-categories-dev \
 *   SUBCATEGORIES_TABLE=saaga-online-api-subcategories-dev \
 *   AWS_REGION=ap-southeast-1 \
 *   node backend/scripts/importSaaga777.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const ddb    = DynamoDBDocumentClient.from(client);

const PROD_TABLE   = process.env.PRODUCTS_TABLE;
const CAT_TABLE    = process.env.CATEGORIES_TABLE;
const SUBCAT_TABLE = process.env.SUBCATEGORIES_TABLE;

// ─── category/subcategory normalisation for known messy variants ─────────────
const CAT_MAP = {
  'bakery biscuits and juice': 'Bakery, Biscuits & Juice',
  'instant food & sauce':      'Instant Food & Snacks',
  'instant food and sauce':    'Instant Food & Snacks',
  'instant food and snacks':   'Instant Food & Snacks',
};
const SUBCAT_MAP = {
  'ready to eat': 'Ready to Eat',
};

function normKey(s) { return (s || '').toString().toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim(); }
function cleanStr(s) { return (s == null ? '' : String(s)).trim().replace(/\s+/g, ' '); }

function normUnit(s) {
  const u = (s || '').toString().toLowerCase().trim().replace(/\.$/, '');
  if (u === 'ltr' || u === 'litre') return 'L';
  if (u === 'gram' || u === 'grams' || u === 'gm') return 'g';
  if (u === 'kilo' || u === 'kilogram') return 'kg';
  if (u === 'piece' || u === 'pieces' || u === 'pcs') return 'pcs';
  return u;
}

function roundPrice(p) {
  const n = parseFloat(p);
  return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
}

function padId(n)  { return `PROD-${String(n).padStart(6, '0')}`; }
function padSku(n) { return `SKU-${String(n).padStart(6, '0')}`; }

// ─── DynamoDB helpers ─────────────────────────────────────────────────────────
async function scanAll(table) {
  const items = []; let lastKey;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: table, ExclusiveStartKey: lastKey }));
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

// ─── main ─────────────────────────────────────────────────────────────────────
async function run() {
  const now = new Date().toISOString();

  // 1. Read Excel
  console.log('📊 Reading SAAGA 777 - PRODUCTS.xlsx...');
  const wb   = XLSX.readFile(path.join(__dirname, '../../SAAGA 777 - PRODUCTS.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { defval: '' });
  console.log(`   ${rows.length} raw rows`);

  // 2. Drop exact-duplicate rows within the sheet (same name+weight+category+price)
  const seenRowKeys = new Set();
  const dedupedRows = [];
  let rowDupSkipped = 0;
  for (const row of rows) {
    const name = cleanStr(row['PRODUCT NAME']);
    if (!name) continue;
    const rowKey = [normKey(name), String(row['WEIGHT']).trim(), normKey(row['CATEGORY']), roundPrice(row['PRICE'])].join('|');
    if (seenRowKeys.has(rowKey)) { rowDupSkipped++; continue; }
    seenRowKeys.add(rowKey);
    dedupedRows.push(row);
  }
  console.log(`   ${rowDupSkipped} exact-duplicate row(s) skipped, ${dedupedRows.length} unique rows remain`);

  // 3. Scan existing DynamoDB state
  console.log('\n🔍 Scanning existing DynamoDB tables...');
  const existingProducts = await scanAll(PROD_TABLE);
  const existingCats     = await scanAll(CAT_TABLE);
  const existingSubcats  = await scanAll(SUBCAT_TABLE);
  console.log(`   ${existingProducts.length} products, ${existingCats.length} categories, ${existingSubcats.length} subcategories`);

  const existingByNameWeight = new Map();
  let maxProdNum = 0, maxSkuNum = 0;
  for (const p of existingProducts) {
    existingByNameWeight.set(`${normKey(p.name)}|${String(p.weight).trim()}`, p);
    const pn = parseInt((p.id  || '').replace('PROD-', '')) || 0;
    const sn = parseInt((p.sku || '').replace(/^SKU-0*/, '')) || 0;
    if (pn <= 999999) maxProdNum = Math.max(maxProdNum, pn);
    if (sn <= 999999) maxSkuNum  = Math.max(maxSkuNum, sn);
  }
  let nextProd = maxProdNum + 1;
  let nextSku  = maxSkuNum + 1;
  console.log(`   Next PROD id: ${padId(nextProd)}, next SKU: ${padSku(nextSku)}`);

  // Category/subcategory case-insensitive lookup maps (avoid duplicate names)
  const catByLower    = new Map(existingCats.map(c => [c.name.toLowerCase(), c]));
  const subcatByKey   = new Map(existingSubcats.map(s => [`${s.parentCategoryName.toLowerCase()}||${s.name.toLowerCase()}`, s]));
  let maxCatNum    = Math.max(0, ...existingCats.map(c => parseInt(c.id.replace('CAT-', '')) || 0));
  let maxSubcatNum = Math.max(0, ...existingSubcats.map(s => parseInt(s.id.replace('SUBCAT-', '')) || 0));

  function resolveCategory(raw) {
    const cleaned = cleanStr(raw);
    const mapped  = CAT_MAP[cleaned.toLowerCase()] || cleaned;
    const existing = catByLower.get(mapped.toLowerCase());
    if (existing) return existing.name;
    // No match — create new category (kept generic-case as given)
    maxCatNum++;
    const newCat = {
      id: `CAT-${String(maxCatNum).padStart(4, '0')}`,
      name: mapped,
      slug: mapped.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
      productCount: 0,
      imageUrl: '',
      featured: false,
    };
    catByLower.set(mapped.toLowerCase(), newCat);
    newCatItems.push(newCat);
    console.log(`   + NEW category: "${mapped}" (no existing match for "${raw}")`);
    return newCat.name;
  }

  function resolveSubcategory(resolvedCat, raw) {
    const cleaned = cleanStr(raw);
    if (!cleaned) return '';
    const mapped = SUBCAT_MAP[cleaned.toLowerCase()] || cleaned;
    const key = `${resolvedCat.toLowerCase()}||${mapped.toLowerCase()}`;
    const existing = subcatByKey.get(key);
    if (existing) return existing.name;
    maxSubcatNum++;
    const newSub = {
      id: `SUBCAT-${String(maxSubcatNum).padStart(4, '0')}`,
      name: mapped,
      parentCategoryName: resolvedCat,
      slug: mapped.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
      productCount: 0,
    };
    subcatByKey.set(key, newSub);
    newSubcatItems.push(newSub);
    console.log(`   + NEW subcategory: "${mapped}" under [${resolvedCat}] (no existing match for "${raw}")`);
    return newSub.name;
  }

  const newCatItems    = [];
  const newSubcatItems = [];

  // 4. Build product objects, skipping anything already in DynamoDB (name+weight match)
  console.log('\n🔨 Processing products...');
  const toInsert = [];
  const catCountDelta    = new Map();
  const subcatCountDelta = new Map();
  let dbDupSkipped = 0;

  for (const row of dedupedRows) {
    const name   = cleanStr(row['PRODUCT NAME']);
    const weight = String(row['WEIGHT'] || '').trim();
    const dbKey  = `${normKey(name)}|${weight}`;

    if (existingByNameWeight.has(dbKey)) {
      dbDupSkipped++;
      console.log(`   ⏭  Skipping "${name}" (${weight}) — already exists as ${existingByNameWeight.get(dbKey).id}`);
      continue;
    }

    const category    = resolveCategory(row['CATEGORY']);
    const subCategory = resolveSubcategory(category, row['SUB- CATEGORY']);
    const unit         = normUnit(row['UNIT']);
    const price         = roundPrice(row['PRICE']);
    const discountPct   = roundPrice(row['DISCOUNT%'] || 0);
    const dp             = roundPrice(row['DP'] || price);
    const stock          = parseInt(row['STOCK'], 10) || 100;
    const description   = cleanStr(row['DESCRIPTION']) || `${name} - Premium quality Indian grocery product`;

    const id  = padId(nextProd++);
    const sku = padSku(nextSku++);

    const product = {
      id,
      name,
      description,
      category,
      subCategory,
      brand: '',
      unit,
      weight,
      price,
      discountedPrice: dp,
      discountPercent: discountPct,
      originalPrice: null,
      currency: 'SGD',
      stock,
      inStock: stock > 0,
      imageUrl: '',
      images: [],
      sku,
      barcode: '',
      tags: [],
      featured: false,
      discount: discountPct,
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    toInsert.push(product);
    existingByNameWeight.set(dbKey, product); // guard against dupes later in this same batch too
    catCountDelta.set(category, (catCountDelta.get(category) || 0) + 1);
    if (subCategory) {
      const scKey = `${category}||${subCategory}`;
      subcatCountDelta.set(scKey, (subcatCountDelta.get(scKey) || 0) + 1);
    }
  }

  console.log(`\n   ${toInsert.length} new products to insert (${dbDupSkipped} skipped as already in DB)`);

  // 5. Write new products
  if (toInsert.length > 0) {
    console.log('\n📝 Writing new products to DynamoDB...');
    await batchWrite(PROD_TABLE, toInsert.map(p => ({ PutRequest: { Item: p } })));
    console.log(`   ✅ ${toInsert.length} products written`);
  }

  // 6. Update category/subcategory product counts (existing + new)
  console.log('\n📁 Updating category counts...');
  const catUpdates = [];
  for (const [name, delta] of catCountDelta.entries()) {
    const cat = catByLower.get(name.toLowerCase());
    catUpdates.push({ ...cat, productCount: (cat.productCount || 0) + delta });
  }
  for (const nc of newCatItems) {
    if (!catUpdates.find(c => c.id === nc.id)) catUpdates.push(nc);
  }
  if (catUpdates.length > 0) {
    await batchWrite(CAT_TABLE, catUpdates.map(c => ({ PutRequest: { Item: c } })));
    console.log(`   ✅ ${catUpdates.length} categories updated (${newCatItems.length} new)`);
  }

  console.log('📂 Updating subcategory counts...');
  const subcatUpdates = [];
  for (const [key, delta] of subcatCountDelta.entries()) {
    const [catName, subName] = key.split('||');
    const sc = subcatByKey.get(`${catName.toLowerCase()}||${subName.toLowerCase()}`);
    subcatUpdates.push({ ...sc, productCount: (sc.productCount || 0) + delta });
  }
  for (const ns of newSubcatItems) {
    if (!subcatUpdates.find(s => s.id === ns.id)) subcatUpdates.push(ns);
  }
  if (subcatUpdates.length > 0) {
    await batchWrite(SUBCAT_TABLE, subcatUpdates.map(s => ({ PutRequest: { Item: s } })));
    console.log(`   ✅ ${subcatUpdates.length} subcategories updated (${newSubcatItems.length} new)`);
  }

  // 7. Refresh local JSON snapshot files
  console.log('\n💾 Refreshing local JSON snapshots...');
  const dataDir = path.join(__dirname, '../data');
  const allProducts   = await scanAll(PROD_TABLE);
  const allCategories = await scanAll(CAT_TABLE);
  const allSubcats    = await scanAll(SUBCAT_TABLE);
  fs.writeFileSync(path.join(dataDir, 'products.json'),      JSON.stringify(allProducts, null, 2));
  fs.writeFileSync(path.join(dataDir, 'categories.json'),    JSON.stringify(allCategories, null, 2));
  fs.writeFileSync(path.join(dataDir, 'subcategories.json'), JSON.stringify(allSubcats, null, 2));
  fs.writeFileSync(path.join(dataDir, 'stats.json'), JSON.stringify({
    totalProducts:   allProducts.length,
    totalCategories: allCategories.length,
    lastSynced:      now,
    categoriesBreakdown: allCategories.map(c => ({ category: c.name, count: c.productCount })),
  }, null, 2));

  // 8. Summary
  console.log('\n✅ Import complete!');
  console.log(`   Rows in file        : ${rows.length}`);
  console.log(`   Duplicate rows in file skipped : ${rowDupSkipped}`);
  console.log(`   Already-in-DB skipped          : ${dbDupSkipped}`);
  console.log(`   Inserted                       : ${toInsert.length}`);
  console.log(`   New categories                 : ${newCatItems.length} ${newCatItems.map(c => c.name).join(', ')}`);
  console.log(`   New subcategories              : ${newSubcatItems.length} ${newSubcatItems.map(s => `${s.parentCategoryName} > ${s.name}`).join(', ')}`);
  console.log(`   Total products in DB now       : ${allProducts.length}`);
}

run().catch(err => { console.error('\n❌', err); process.exit(1); });
