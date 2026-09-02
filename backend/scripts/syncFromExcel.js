/**
 * syncFromExcel.js
 * Syncs DynamoDB products + categories to exactly match latestproducts.xlsx.
 * - Preserves existing PROD ids and imageUrls for SKU-matched products
 * - Generates new SKU + PROD id for unmatched products
 * - Deletes DynamoDB products not in the Excel sheet
 * - Renames "Uncategorized" → "Others"
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const XLSX = require('xlsx');
const fs   = require('fs');
const path = require('path');

const client    = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const ddb       = DynamoDBDocumentClient.from(client);
const PROD_TABLE = process.env.PRODUCTS_TABLE;
const CAT_TABLE  = process.env.CATEGORIES_TABLE;
const SUBCAT_TABLE = process.env.SUBCATEGORIES_TABLE;

// ─── helpers ─────────────────────────────────────────────────────────────────

async function scanAll(tableName) {
  const items = [];
  let lastKey;
  do {
    const res = await ddb.send(new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastKey,
    }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function batchWrite(tableName, requests) {
  for (let i = 0; i < requests.length; i += 25) {
    const chunk = requests.slice(i, i + 25);
    await ddb.send(new BatchWriteCommand({ RequestItems: { [tableName]: chunk } }));
  }
}

function padId(n)  { return `PROD-${String(n).padStart(6, '0')}`; }
function padSku(n) { return `SKU-${String(n).padStart(6, '0')}`; }

function roundPrice(p) {
  const n = parseFloat(p);
  return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function sync() {
  // 1. Read Excel sheet
  console.log('📊 Reading latestproducts.xlsx...');
  const wb   = XLSX.readFile(path.join(__dirname, '../../products/latestproducts.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Products']);
  console.log(`   ${rows.length} rows in Excel`);

  // 2. Scan DynamoDB for existing products
  console.log('\n🔍 Scanning DynamoDB products table...');
  const existingItems = await scanAll(PROD_TABLE);
  console.log(`   ${existingItems.length} items currently in DynamoDB`);

  // Build SKU → existing item map (for id + imageUrl lookup)
  const skuMap = new Map(); // sku → { id, imageUrl }
  let maxProdNum = 0;
  let maxSkuNum  = 0;

  for (const item of existingItems) {
    if (item.sku) skuMap.set(item.sku, { id: item.id, imageUrl: item.imageUrl || '' });
    const prodNum = parseInt((item.id  || '').replace('PROD-', '')) || 0;
    const skuNum  = parseInt((item.sku || '').replace(/^SKU-0*/, '')) || 0;
    if (prodNum <= 999999) maxProdNum = Math.max(maxProdNum, prodNum); // ignore runaway ids
    if (skuNum  <= 999999) maxSkuNum  = Math.max(maxSkuNum,  skuNum);
  }
  // Start new ids above current max
  let nextProdNum = maxProdNum + 1;
  let nextSkuNum  = maxSkuNum  + 1;

  console.log(`   Max existing PROD id: ${maxProdNum} → next: ${nextProdNum}`);
  console.log(`   Max existing SKU num: ${maxSkuNum}  → next: ${nextSkuNum}`);

  // 3. Build new product list
  console.log('\n🔨 Building new product list...');
  const now = new Date().toISOString();
  const newProducts   = [];
  const newProdIdSet  = new Set();
  let   skuReused = 0, skuNew = 0, imagePreserved = 0;

  for (const row of rows) {
    const excelSku   = (row['SKU'] || '').trim();
    const excelImage = (row['Image URL'] || '').trim();
    let   sku, prodId, imageUrl;

    if (excelSku && skuMap.has(excelSku)) {
      // Existing product — preserve PROD id
      const existing = skuMap.get(excelSku);
      prodId   = existing.id;
      sku      = excelSku;
      // Use Excel imageUrl if present, else preserve whatever DynamoDB had
      imageUrl = excelImage || existing.imageUrl || '';
      if (!excelImage && existing.imageUrl) imagePreserved++;
      skuReused++;
    } else {
      // New product — assign fresh ids
      prodId   = padId(nextProdNum++);
      sku      = excelSku || padSku(nextSkuNum++);
      imageUrl = excelImage;
      skuNew++;
    }

    const category = row['Category'] === 'Uncategorized' ? 'Others' : (row['Category'] || 'Others');
    const price    = roundPrice(row['Price']);
    const dp       = roundPrice(row['Discounted Price'] || row['Price']);
    const stock    = parseInt(row['Stock'], 10) || 100;

    newProducts.push({
      id:             prodId,
      name:           (row['Name'] || '').trim(),
      description:    (row['Description'] || `${row['Name']} - Premium quality Indian grocery product`).trim(),
      category,
      subCategory:    (row['Subcategory'] || '').trim(),
      brand:          '',
      unit:           (row['Unit'] || 'g').trim(),
      weight:         String(row['Weight'] || '').trim(),
      price,
      discountedPrice: dp,
      discountPercent: roundPrice(row['Discount %'] || 0),
      originalPrice:  null,
      currency:       'SGD',
      stock,
      inStock:        stock > 0,
      imageUrl,
      images:         imageUrl ? [imageUrl] : [],
      sku,
      barcode:        '',
      tags:           [],
      featured:       false,
      discount:       roundPrice(row['Discount %'] || 0),
      rating:         0,
      reviewCount:    0,
      createdAt:      now,
      updatedAt:      now,
    });

    newProdIdSet.add(prodId);
  }

  console.log(`   SKU reused: ${skuReused} | SKU new: ${skuNew}`);
  console.log(`   Images preserved from DynamoDB: ${imagePreserved}`);
  console.log(`   Total new product list: ${newProducts.length}`);

  // 4. Determine which DynamoDB items to delete
  const toDelete = existingItems.filter(item => !newProdIdSet.has(item.id));
  console.log(`\n🗑  Products to delete from DynamoDB: ${toDelete.length}`);

  // 5. Write new products to DynamoDB
  console.log('\n📝 Upserting products to DynamoDB...');
  const putRequests = newProducts.map(p => ({ PutRequest: { Item: p } }));
  await batchWrite(PROD_TABLE, putRequests);
  console.log(`   ✅ ${newProducts.length} products written`);

  // 6. Delete stale products
  if (toDelete.length > 0) {
    console.log('🗑  Deleting stale products...');
    const deleteRequests = toDelete.map(item => ({ DeleteRequest: { Key: { id: item.id } } }));
    await batchWrite(PROD_TABLE, deleteRequests);
    console.log(`   ✅ ${toDelete.length} products deleted`);
  }

  // 7. Build and sync categories
  console.log('\n📁 Syncing categories...');
  const catGroups = {};
  for (const p of newProducts) {
    if (!catGroups[p.category]) catGroups[p.category] = [];
    catGroups[p.category].push(p);
  }

  const existingCats  = await scanAll(CAT_TABLE);
  const existingCatMap = new Map(existingCats.map(c => [c.name, c]));
  let catCounter = existingCats.length;

  const newCategories = Object.keys(catGroups).sort().map(name => {
    if (existingCatMap.has(name)) {
      return { ...existingCatMap.get(name), productCount: catGroups[name].length };
    }
    catCounter++;
    return {
      id:           `CAT-${String(catCounter).padStart(4, '0')}`,
      name,
      slug:         name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
      productCount: catGroups[name].length,
      imageUrl:     '',
      featured:     false,
    };
  });

  // Upsert new categories
  await batchWrite(CAT_TABLE, newCategories.map(c => ({ PutRequest: { Item: c } })));

  // Delete old categories no longer present
  const newCatNames = new Set(newCategories.map(c => c.name));
  const staleCats   = existingCats.filter(c => !newCatNames.has(c.name));
  if (staleCats.length > 0) {
    await batchWrite(CAT_TABLE, staleCats.map(c => ({ DeleteRequest: { Key: { id: c.id } } })));
    console.log(`   Deleted ${staleCats.length} stale categories`);
  }
  console.log(`   ✅ ${newCategories.length} categories synced`);

  // 8. Sync subcategories
  if (SUBCAT_TABLE) {
    console.log('\n📂 Syncing subcategories...');
    const subcatGroups = {};
    for (const p of newProducts) {
      if (p.subCategory) {
        const key = `${p.category}||${p.subCategory}`;
        if (!subcatGroups[key]) subcatGroups[key] = { parentCategoryName: p.category, name: p.subCategory, count: 0 };
        subcatGroups[key].count++;
      }
    }
    const existingSubcats   = await scanAll(SUBCAT_TABLE);
    const existingSubcatMap = new Map(existingSubcats.map(s => [`${s.parentCategoryName}||${s.name}`, s]));
    let subcatCounter = existingSubcats.length;

    const newSubcats = Object.values(subcatGroups).map(({ parentCategoryName, name, count }) => {
      const key = `${parentCategoryName}||${name}`;
      if (existingSubcatMap.has(key)) {
        return { ...existingSubcatMap.get(key), productCount: count };
      }
      subcatCounter++;
      return {
        id:                 `SUBCAT-${String(subcatCounter).padStart(4, '0')}`,
        name,
        parentCategoryName,
        slug:               name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
        productCount:       count,
      };
    });

    await batchWrite(SUBCAT_TABLE, newSubcats.map(s => ({ PutRequest: { Item: s } })));
    const staleSubcats = existingSubcats.filter(s => {
      const key = `${s.parentCategoryName}||${s.name}`;
      return !subcatGroups[key];
    });
    if (staleSubcats.length > 0) {
      await batchWrite(SUBCAT_TABLE, staleSubcats.map(s => ({ DeleteRequest: { Key: { id: s.id } } })));
    }
    console.log(`   ✅ ${newSubcats.length} subcategories synced`);
  }

  // 9. Save updated JSON files
  console.log('\n💾 Saving updated data files...');
  const dataDir = path.join(__dirname, '../data');
  fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(newProducts, null, 2));
  fs.writeFileSync(path.join(dataDir, 'categories.json'), JSON.stringify(newCategories, null, 2));

  const stats = {
    totalProducts:   newProducts.length,
    totalCategories: newCategories.length,
    lastSynced:      now,
    categoriesBreakdown: newCategories.map(c => ({ category: c.name, count: c.productCount })),
  };
  fs.writeFileSync(path.join(dataDir, 'stats.json'), JSON.stringify(stats, null, 2));

  console.log('\n✅ Sync complete!');
  console.log(`   📦 Products in DynamoDB: ${newProducts.length} (+${skuNew} new, -${toDelete.length} deleted)`);
  console.log(`   📁 Categories: ${newCategories.length}`);
  console.log('\nCategory breakdown:');
  stats.categoriesBreakdown.forEach(c => console.log(`   ${String(c.count).padStart(4)} ${c.category}`));
}

sync().catch(err => { console.error('❌ Sync failed:', err); process.exit(1); });
