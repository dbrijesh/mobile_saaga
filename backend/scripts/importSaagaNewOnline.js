/**
 * importSaagaNewOnline.js
 *
 * Upserts products from SaagaNewOnline.xlsx into DynamoDB.
 *
 * Matching strategy:
 *   - Products  : matched by normalised(name) + "|" + weight  (no SKU in this sheet)
 *   - Categories: fuzzy-matched against existing names; creates new only when no good match
 *   - Subcategories: fuzzy-matched within the resolved parent category
 *
 * On match → updates price, discountedPrice, discount, category, subCategory, stock, inStock, updatedAt
 * No match → inserts new product (preserves existing ids/images for matched items)
 * Existing products NOT in the sheet are left untouched.
 *
 * Usage:
 *   PRODUCTS_TABLE=saaga-online-api-products-dev \
 *   CATEGORIES_TABLE=saaga-online-api-categories-dev \
 *   SUBCATEGORIES_TABLE=saaga-online-api-subcategories-dev \
 *   AWS_REGION=ap-southeast-1 \
 *   node backend/scripts/importSaagaNewOnline.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  BatchWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const XLSX = require('xlsx');
const path = require('path');
const fs   = require('fs');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const ddb    = DynamoDBDocumentClient.from(client);

const PROD_TABLE   = process.env.PRODUCTS_TABLE   || 'saaga-online-api-products-dev';
const CAT_TABLE    = process.env.CATEGORIES_TABLE  || 'saaga-online-api-categories-dev';
const SUBCAT_TABLE = process.env.SUBCATEGORIES_TABLE || 'saaga-online-api-subcategories-dev';

// ── string helpers ────────────────────────────────────────────────────────────

function cleanStr(s) {
  return (s == null ? '' : String(s)).trim().replace(/\s+/g, ' ');
}

/** Normalise to lowercase alphanumeric+spaces for fuzzy matching */
function normKey(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
}

/** Product dedup key: normalised name + "|" + weight-as-string */
function productKey(name, weight) {
  return `${normKey(name)}|${String(weight).trim()}`;
}

const NOT_ABBREV = new Set(['all','are','is','it','was','has','for','the','and','but','not','yes','no','can','get','new','old','fry','mix','dry','oil','cut','raw','bar','cup','bag','box','tin','set','kit','gel','our','per','rich','plus','free','good','best','pure','mild','fine','dark','lite','mini','full','soft','hard','gold','real','fresh','from','into','with','over','just']);
const SMALL      = new Set(['a','an','the','and','or','of','in','on','at','to','for','with','by','from','into','&']);

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

function roundPrice(p) {
  const n = parseFloat(p);
  return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
}

function padId(n)  { return `PROD-${String(n).padStart(6, '0')}`; }
function padSku(n) { return `SKU-${String(n).padStart(6, '0')}`; }

// ── fuzzy category matching ───────────────────────────────────────────────────

/**
 * Returns a similarity score [0..1] between two normalised strings.
 * Uses word-overlap (Jaccard-like) so word order doesn't matter.
 */
function similarity(a, b) {
  const wa = new Set(normKey(a).split(' ').filter(Boolean));
  const wb = new Set(normKey(b).split(' ').filter(Boolean));
  if (wa.size === 0 && wb.size === 0) return 1;
  if (wa.size === 0 || wb.size === 0) return 0;
  const intersection = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return intersection / union;
}

/**
 * Find the best matching name from a list of candidates.
 * Returns { match: candidateName, score } or null if below threshold.
 */
function bestMatch(target, candidates, threshold = 0.5) {
  let best = null, bestScore = -1;
  for (const c of candidates) {
    const s = similarity(target, c);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return bestScore >= threshold ? { match: best, score: bestScore } : null;
}

// ── DynamoDB helpers ──────────────────────────────────────────────────────────

async function scanAll(tableName) {
  const items = []; let lastKey;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: tableName, ExclusiveStartKey: lastKey }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function batchWrite(tableName, requests) {
  for (let i = 0; i < requests.length; i += 25) {
    await ddb.send(new BatchWriteCommand({
      RequestItems: { [tableName]: requests.slice(i, i + 25) },
    }));
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function run() {
  const now = new Date().toISOString();

  // 1. Read Excel ──────────────────────────────────────────────────────────────
  const xlsxPath = path.join(__dirname, '../../SaagaNewOnline.xlsx');
  console.log(`\n📊 Reading ${xlsxPath}`);
  const wb   = XLSX.readFile(xlsxPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`   ${rows.length} rows`);

  // 2. Scan existing DynamoDB products ─────────────────────────────────────────
  console.log('\n🔍 Scanning existing products...');
  const existingProducts = await scanAll(PROD_TABLE);
  console.log(`   ${existingProducts.length} existing products`);

  // Build lookup: productKey → existing item
  const existingByKey = new Map();
  let maxProdNum = 0, maxSkuNum = 0;
  for (const item of existingProducts) {
    const key = productKey(item.name, item.weight);
    existingByKey.set(key, item);
    const pn = parseInt((item.id  || '').replace('PROD-', '')) || 0;
    const sn = parseInt((item.sku || '').replace(/^SKU-0*/,  '')) || 0;
    if (pn <= 999999) maxProdNum = Math.max(maxProdNum, pn);
    if (sn <= 999999) maxSkuNum  = Math.max(maxSkuNum, sn);
  }
  let nextProd = maxProdNum + 1;
  let nextSku  = maxSkuNum  + 1;
  console.log(`   Max PROD num: ${maxProdNum} → next new: ${nextProd}`);

  // 3. Scan existing categories ─────────────────────────────────────────────────
  console.log('\n🔍 Scanning existing categories...');
  const existingCats = await scanAll(CAT_TABLE);
  const catByName    = new Map(existingCats.map(c => [c.name, c])); // name → item
  let maxCatNum = existingCats.length;
  console.log(`   ${existingCats.length} existing categories: ${[...catByName.keys()].join(', ')}`);

  // 4. Scan existing subcategories ───────────────────────────────────────────────
  console.log('\n🔍 Scanning existing subcategories...');
  const existingSubcats  = await scanAll(SUBCAT_TABLE);
  // key: "parentName||subcatName" → item
  const subcatByKey = new Map(existingSubcats.map(s => [`${s.parentCategoryName}||${s.name}`, s]));
  let maxSubcatNum = existingSubcats.length;
  console.log(`   ${existingSubcats.length} existing subcategories`);

  // 5. Resolve categories from Excel ─────────────────────────────────────────────
  // Collect unique raw category names from Excel
  const rawCatNames = [...new Set(rows.map(r => cleanStr(r['CATEGORY'])).filter(Boolean))];
  console.log(`\n📁 Excel categories: ${rawCatNames.join(', ')}`);

  // catResolutionMap: rawExcelCatName → resolved DB category name (existing or new)
  const catResolutionMap   = new Map(); // rawExcel → resolvedName
  const subcatResolutionMap = new Map(); // "rawCat||rawSub" → resolvedName

  // Accumulate new categories/subcategories to create
  const newCatItems    = []; // new category DynamoDB items
  const newSubcatItems = []; // new subcategory DynamoDB items
  // Updated product counts per resolved category/subcat name
  const catProductCount    = new Map();
  const subcatProductCount = new Map(); // "resolvedCat||resolvedSub"

  for (const rawCat of rawCatNames) {
    const normalised = titleCase(cleanStr(rawCat));
    const existingNames = [...catByName.keys()];
    const found = bestMatch(normalised, existingNames, 0.5);

    let resolvedCat;
    if (found) {
      resolvedCat = found.match;
      console.log(`   "${rawCat}" → matched existing "${resolvedCat}" (score ${found.score.toFixed(2)})`);
    } else {
      // No good match — create new category
      resolvedCat = normalised;
      maxCatNum++;
      const newCat = {
        id:           `CAT-${String(maxCatNum).padStart(4, '0')}`,
        name:         resolvedCat,
        slug:         resolvedCat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
        productCount: 0,
        imageUrl:     '',
        featured:     false,
      };
      newCatItems.push(newCat);
      catByName.set(resolvedCat, newCat);
      console.log(`   "${rawCat}" → NEW category "${resolvedCat}"`);
    }
    catResolutionMap.set(rawCat, resolvedCat);
  }

  // 6. Resolve subcategories from Excel ───────────────────────────────────────────
  const rawSubcatPairs = [...new Set(
    rows.map(r => `${cleanStr(r['CATEGORY'])}||${cleanStr(r['SUB CATEGORY'])}`)
  )];

  for (const pair of rawSubcatPairs) {
    const [rawCat, rawSub] = pair.split('||');
    if (!rawSub) continue;
    const resolvedCat = catResolutionMap.get(rawCat);
    const normSub     = titleCase(cleanStr(rawSub));

    // Find matching subcat within the resolved parent category
    const sameCatSubs = existingSubcats
      .filter(s => s.parentCategoryName === resolvedCat)
      .map(s => s.name);

    const found = bestMatch(normSub, sameCatSubs, 0.5);
    let resolvedSub;
    if (found) {
      resolvedSub = found.match;
      console.log(`   [${resolvedCat}] "${rawSub}" → matched "${resolvedSub}" (score ${found.score.toFixed(2)})`);
    } else {
      // New subcategory under this parent
      resolvedSub = normSub;
      maxSubcatNum++;
      const newSubcat = {
        id:                 `SUBCAT-${String(maxSubcatNum).padStart(4, '0')}`,
        name:               resolvedSub,
        parentCategoryName: resolvedCat,
        slug:               resolvedSub.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
        productCount:       0,
      };
      newSubcatItems.push(newSubcat);
      subcatByKey.set(`${resolvedCat}||${resolvedSub}`, newSubcat);
      existingSubcats.push(newSubcat); // keep list up-to-date for subsequent iterations
      console.log(`   [${resolvedCat}] "${rawSub}" → NEW subcategory "${resolvedSub}"`);
    }
    subcatResolutionMap.set(pair, resolvedSub);
  }

  // 7. Build upserted product list ────────────────────────────────────────────────
  console.log('\n🔨 Processing products...');
  const toPut  = []; // items to PutRequest
  let updated = 0, inserted = 0, skipped = 0;

  for (const row of rows) {
    const rawName = cleanStr(row['PRODUCT NAME '] || row['PRODUCT NAME']);
    if (!rawName) { skipped++; continue; }

    const name        = titleCase(rawName);
    const rawCat      = cleanStr(row['CATEGORY']);
    const rawSub      = cleanStr(row['SUB CATEGORY']);
    const price       = roundPrice(row['PRICE']);
    const discountPct = roundPrice(row['DISCOUNT '] || row['DISCOUNT'] || 0);
    const weight      = String(row['WEIGHT'] || '').trim();
    const stockYes    = (String(row['STOCK'] || '').toLowerCase().trim() === 'yes');
    const stock       = stockYes ? 100 : 0;
    const inStock     = stock > 0;

    const resolvedCat = catResolutionMap.get(rawCat) || titleCase(rawCat);
    const pairKey     = `${rawCat}||${rawSub}`;
    const resolvedSub = subcatResolutionMap.get(pairKey) || titleCase(rawSub);

    const discountedPrice = discountPct > 0
      ? roundPrice(price * (1 - discountPct / 100))
      : price;

    // Track product counts
    catProductCount.set(resolvedCat, (catProductCount.get(resolvedCat) || 0) + 1);
    if (resolvedSub) {
      const scKey = `${resolvedCat}||${resolvedSub}`;
      subcatProductCount.set(scKey, (subcatProductCount.get(scKey) || 0) + 1);
    }

    const key      = productKey(name, weight);
    const existing = existingByKey.get(key);

    if (existing) {
      // UPDATE — preserve id, sku, imageUrl, images, description, brand, rating, reviewCount, createdAt
      toPut.push({
        ...existing,
        name,           // normalised title case (may fix casing)
        category:       resolvedCat,
        subCategory:    resolvedSub,
        price,
        discountedPrice,
        discountPercent: discountPct,
        discount:       discountPct,
        stock,
        inStock,
        updatedAt:      now,
      });
      updated++;
    } else {
      // INSERT — new product
      const id  = padId(nextProd++);
      const sku = padSku(nextSku++);
      toPut.push({
        id,
        name,
        description:     `${name} - Premium quality Indian grocery product`,
        category:        resolvedCat,
        subCategory:     resolvedSub,
        brand:           '',
        unit:            'g',
        weight,
        price,
        discountedPrice,
        discountPercent: discountPct,
        originalPrice:   null,
        currency:        'SGD',
        stock,
        inStock,
        imageUrl:        '',
        images:          [],
        sku,
        barcode:         '',
        tags:            [],
        featured:        false,
        discount:        discountPct,
        rating:          0,
        reviewCount:     0,
        createdAt:       now,
        updatedAt:       now,
      });
      inserted++;
    }
  }
  console.log(`   ✅ ${updated} to update, ${inserted} to insert, ${skipped} skipped (blank name)`);

  // 8. Write products ─────────────────────────────────────────────────────────────
  if (toPut.length > 0) {
    console.log(`\n📝 Writing ${toPut.length} products to DynamoDB...`);
    await batchWrite(PROD_TABLE, toPut.map(p => ({ PutRequest: { Item: p } })));
    console.log('   ✅ Done');
  }

  // 9. Update category productCounts & write new categories ──────────────────────
  console.log('\n📁 Updating categories...');
  const catUpdates = [];
  for (const [name, count] of catProductCount.entries()) {
    const existing = catByName.get(name);
    if (existing) {
      catUpdates.push({ ...existing, productCount: (existing.productCount || 0) + count });
    }
  }
  // Also include brand-new categories (already in catByName, but need to write them)
  for (const newCat of newCatItems) {
    const updated = catUpdates.find(c => c.id === newCat.id);
    if (!updated) catUpdates.push(newCat); // no products resolved to it (edge case)
  }
  if (catUpdates.length > 0) {
    await batchWrite(CAT_TABLE, catUpdates.map(c => ({ PutRequest: { Item: c } })));
    console.log(`   ✅ ${catUpdates.length} categories updated/created`);
  }

  // 10. Update subcategory productCounts & write new subcategories ───────────────
  console.log('\n📂 Updating subcategories...');
  const subcatUpdates = [];
  for (const [key, count] of subcatProductCount.entries()) {
    const existing = subcatByKey.get(key);
    if (existing) {
      subcatUpdates.push({ ...existing, productCount: (existing.productCount || 0) + count });
    }
  }
  for (const newSub of newSubcatItems) {
    const key = `${newSub.parentCategoryName}||${newSub.name}`;
    const already = subcatUpdates.find(s => `${s.parentCategoryName}||${s.name}` === key);
    if (!already) subcatUpdates.push(newSub);
  }
  if (subcatUpdates.length > 0) {
    await batchWrite(SUBCAT_TABLE, subcatUpdates.map(s => ({ PutRequest: { Item: s } })));
    console.log(`   ✅ ${subcatUpdates.length} subcategories updated/created`);
  }

  // 11. Summary ───────────────────────────────────────────────────────────────────
  console.log('\n✅ Import complete!');
  console.log(`   Products  : ${updated} updated, ${inserted} inserted (${skipped} skipped)`);
  console.log(`   Categories: ${catUpdates.length} written (${newCatItems.length} new)`);
  console.log(`   Subcats   : ${subcatUpdates.length} written (${newSubcatItems.length} new)`);

  if (newCatItems.length)    console.log('   New categories   :', newCatItems.map(c => c.name).join(', '));
  if (newSubcatItems.length) console.log('   New subcategories:', newSubcatItems.map(s => `${s.parentCategoryName} > ${s.name}`).join(', '));
}

run().catch(err => { console.error('\n❌', err); process.exit(1); });
