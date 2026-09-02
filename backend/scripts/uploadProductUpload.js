/**
 * uploadProductUpload.js
 * Adds products from "Saaga Online_Product Upload.xlsx" to DynamoDB.
 * - Reuses existing categories/subcategories if name matches (case-insensitive)
 * - Creates new categories/subcategories as needed
 * - Deletes "Aachi Ghee JAR 0.06" (PROD-000266)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');
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
  'chips and chocolates':          'Chips & Chocolates',
  'cleaners and repellents':       'Cleaners & Repellents',
  'instant food and snacks':       'Instant Food & Snacks',
  'instant food & sauce':          'Instant Food & Snacks',
  'instant food and sauce':        'Instant Food & Snacks',
  'milk cereal & nuts':            'Milk & Cereals & Nuts',
  'oil , ghee & masala':           'Oil & Ghee & Masala',
  'oil ghee & masala':             'Oil & Ghee & Masala',
  'bakery biscuits and juice':     'Bakery, Biscuits & Juice',
  'bath and body':                 'Bath & Body',
};

const SUBCAT_MAP = {
  'dishwashing and gel bar':       'Dishwashing Gel & Bar',
  'dishwashing gel & bar':         'Dishwashing Gel & Bar',
  'oats and dates':                'Oats & Dates',
  'rajma chole and others':        'Rajma Chole & Others',
  'vermicili & poha':              'Vermicelli & Poha',
  'vermicelli & poha':             'Vermicelli & Poha',
  'lotion and crem':               'Lotion & Cream',
  'lotion and cream':              'Lotion & Cream',
  'salt and sugar':                'Salt & Sugar',
  'bakery and biscuits':           'Bakery & Biscuits',
  'shampoo':                       'Shampoo',
  'bathing soap & shower gel':     'Bathing Soap & Shower Gel',
  'vadams and vathals':            'Vadams and Vathals',
};

function normaliseCategory(raw) {
  const key = (raw || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return CAT_MAP[key] || titleCase((raw || '').trim());
}

function normaliseSubcat(raw) {
  if (!raw) return '';
  const key = (raw || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return SUBCAT_MAP[key] || titleCase((raw || '').trim());
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

function cleanStr(s) { return (s || '').toString().trim().replace(/[,\s]+$/, '').trim(); }

function normUnit(s) {
  const u = (s || '').toString().toLowerCase().trim();
  if (u === 'ltr' || u === 'litre' || u === 'ltr ') return 'L';
  if (u === 'gram' || u === 'grams' || u === 'gm') return 'g';
  if (u === 'kilo' || u === 'kilogram') return 'kg';
  if (u === 'piece' || u === 'pieces' || u === 'pcs') return 'pcs';
  if (u === 'ml') return 'ml';
  return u.trim();
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

  // 1. Load existing data from JSON files
  const dataDir = path.join(__dirname, '../data');
  const existingProducts    = JSON.parse(fs.readFileSync(path.join(dataDir, 'products.json'), 'utf8'));
  const existingCategories  = JSON.parse(fs.readFileSync(path.join(dataDir, 'categories.json'), 'utf8'));
  const existingSubcats     = JSON.parse(fs.readFileSync(path.join(dataDir, 'subcategories.json'), 'utf8'));

  const maxProdNum = Math.max(...existingProducts.map(p => parseInt(p.id.replace('PROD-', '')) || 0));
  const maxSkuNum  = Math.max(...existingProducts.map(p => parseInt((p.sku || '').replace('SKU-', '')) || 0));
  let nextProd = maxProdNum + 1;
  let nextSku  = maxSkuNum  + 1;
  console.log(`Existing products: ${existingProducts.length}  (next PROD: ${nextProd})`);

  // Build lookup maps for categories/subcategories
  const catByName    = new Map(existingCategories.map(c => [c.name.toLowerCase(), c]));
  const subcatByKey  = new Map(existingSubcats.map(s => [`${s.parentCategoryName.toLowerCase()}||${s.name.toLowerCase()}`, s]));

  let maxCatNum    = Math.max(...existingCategories.map(c => parseInt(c.id.replace('CAT-', '')) || 0));
  let maxSubcatNum = Math.max(...existingSubcats.map(s => parseInt(s.id.replace('SUBCAT-', '')) || 0));

  // 2. Read Excel
  console.log('\n📊 Reading Saaga Online_Product Upload.xlsx...');
  const wb   = XLSX.readFile(path.join(__dirname, '../../Saaga Online_Product Upload.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1']);
  console.log(`   ${rows.length} rows`);

  // 3. Build new product objects
  const newProducts  = [];
  const catUpdates   = new Map(existingCategories.map(c => [c.id, { ...c }]));
  const subcatUpdates = new Map(existingSubcats.map(s => [s.id, { ...s }]));

  for (const row of rows) {
    const name        = titleCase(cleanStr(row['PRODUCT NAME '] || row['PRODUCT NAME'] || ''));
    const category    = normaliseCategory(row['CATEGORY '] || row['CATEGORY'] || '');
    const subCategory = normaliseSubcat(row['SUB- CATEGORY'] || row['SUB-CATEGORY'] || '');
    const unit        = normUnit(row['UNIT']);
    const weight      = String(row['WEIGHT'] || '').trim();
    const price       = roundPrice(row['PRICE']);
    const dp          = roundPrice(row['DP'] || row['PRICE']);
    const discPct     = roundPrice(row['DISCOUNT%'] || 0);
    const stock       = parseInt(row['STOCK'], 10) || 100;
    const description = cleanStr(row['DESCRIPTION'] || `${name} - Premium quality Indian grocery product`);

    if (!name || !category) continue;

    // Ensure category exists
    const catLower = category.toLowerCase();
    if (!catByName.has(catLower)) {
      const newCat = {
        id:           `CAT-${String(++maxCatNum).padStart(4, '0')}`,
        name:         category,
        slug:         category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
        productCount: 0,
        imageUrl:     '',
        featured:     false,
      };
      catByName.set(catLower, newCat);
      catUpdates.set(newCat.id, newCat);
      console.log(`   + New category: ${category}`);
    }

    // Ensure subcategory exists
    if (subCategory) {
      const subcatKey = `${catLower}||${subCategory.toLowerCase()}`;
      if (!subcatByKey.has(subcatKey)) {
        const newSub = {
          id:                 `SUBCAT-${String(++maxSubcatNum).padStart(4, '0')}`,
          name:               subCategory,
          parentCategoryName: category,
          slug:               subCategory.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
          productCount:       0,
        };
        subcatByKey.set(subcatKey, newSub);
        subcatUpdates.set(newSub.id, newSub);
        console.log(`   + New subcategory: ${subCategory} (under ${category})`);
      }
    }

    const prodId = padId(nextProd++);
    const sku    = padSku(nextSku++);

    newProducts.push({
      id:              prodId,
      name,
      description,
      category,
      subCategory,
      brand:           '',
      unit,
      weight,
      price,
      discountedPrice: dp,
      discountPercent: discPct,
      originalPrice:   null,
      currency:        'SGD',
      stock,
      inStock:         stock > 0,
      imageUrl:        '',
      images:          [],
      sku,
      barcode:         '',
      tags:            [],
      featured:        false,
      discount:        discPct,
      rating:          0,
      reviewCount:     0,
      createdAt:       now,
      updatedAt:       now,
    });
  }

  console.log(`\n   ${newProducts.length} new products to import`);

  // 4. Delete "Aachi Ghee JAR 0.06" (PROD-000266)
  const DELETE_ID = 'PROD-000266';
  console.log(`\n🗑  Deleting ${DELETE_ID} (Aachi Ghee JAR 0.06)...`);
  await ddb.send(new DeleteCommand({ TableName: PROD_TABLE, Key: { id: DELETE_ID } }));
  console.log(`   ✅ Deleted`);

  // 5. Write new products to DynamoDB
  console.log('\n📝 Importing new products to DynamoDB...');
  await batchWrite(PROD_TABLE, newProducts.map(p => ({ PutRequest: { Item: p } })));
  console.log(`   ✅ ${newProducts.length} products written`);

  // 6. Upsert new/updated categories to DynamoDB
  // Recalculate productCounts
  const allProducts = [...existingProducts.filter(p => p.id !== DELETE_ID), ...newProducts];
  const catCount = {};
  const subcatCount = {};
  for (const p of allProducts) {
    catCount[p.category] = (catCount[p.category] || 0) + 1;
    if (p.subCategory) {
      const k = `${p.category.toLowerCase()}||${p.subCategory.toLowerCase()}`;
      subcatCount[k] = (subcatCount[k] || 0) + 1;
    }
  }

  const allCats = [...catUpdates.values()].map(c => ({
    ...c, productCount: catCount[c.name] || 0,
  }));
  const allSubcats = [...subcatUpdates.values()].map(s => ({
    ...s, productCount: subcatCount[`${s.parentCategoryName.toLowerCase()}||${s.name.toLowerCase()}`] || 0,
  }));

  console.log('\n📁 Upserting categories...');
  await batchWrite(CAT_TABLE, allCats.map(c => ({ PutRequest: { Item: c } })));
  console.log(`   ✅ ${allCats.length} categories (${allCats.length - existingCategories.length} new)`);

  console.log('📂 Upserting subcategories...');
  await batchWrite(SUBCAT_TABLE, allSubcats.map(s => ({ PutRequest: { Item: s } })));
  console.log(`   ✅ ${allSubcats.length} subcategories (${allSubcats.length - existingSubcats.length} new)`);

  // 7. Save updated JSON files
  console.log('\n💾 Saving JSON files...');
  fs.writeFileSync(path.join(dataDir, 'products.json'),      JSON.stringify(allProducts, null, 2));
  fs.writeFileSync(path.join(dataDir, 'categories.json'),    JSON.stringify(allCats, null, 2));
  fs.writeFileSync(path.join(dataDir, 'subcategories.json'), JSON.stringify(allSubcats, null, 2));
  fs.writeFileSync(path.join(dataDir, 'stats.json'), JSON.stringify({
    totalProducts:   allProducts.length,
    totalCategories: allCats.length,
    lastSynced:      now,
    categoriesBreakdown: allCats.map(c => ({ category: c.name, count: c.productCount })),
  }, null, 2));

  console.log('\n✅ Upload complete!');
  console.log(`   📦 Total products: ${allProducts.length} (+${newProducts.length} new, -1 deleted)`);
  console.log(`   📁 Categories: ${allCats.length}`);
  console.log(`   📂 Subcategories: ${allSubcats.length}`);
  console.log('\nCategory breakdown:');
  allCats.forEach(c => console.log(`   ${String(c.productCount).padStart(4)}  ${c.name}`));
  console.log('\nSubcategories:');
  const byCat = {};
  allSubcats.forEach(s => { (byCat[s.parentCategoryName] = byCat[s.parentCategoryName] || []).push(`${s.name}(${s.productCount})`); });
  Object.entries(byCat).sort().forEach(([cat, subs]) => console.log(`  [${cat}] ${subs.join(', ')}`));
}

run().catch(err => { console.error('❌', err); process.exit(1); });
