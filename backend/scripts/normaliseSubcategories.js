/**
 * normaliseSubcategories.js
 * Merges duplicate subcategory names in products (DynamoDB + products.json)
 * then rebuilds the subcategories table cleanly.
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const fs   = require('fs');
const path = require('path');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const ddb    = DynamoDBDocumentClient.from(client);
const PROD_TABLE   = process.env.PRODUCTS_TABLE;
const SUBCAT_TABLE = process.env.SUBCATEGORIES_TABLE;

// canonical subcategory names — key: old value (lowercase), value: canonical
const SUBCAT_MAP = {
  'dhall':                    'Dal',
  'flour':                    'Flour & Millets',
  'rajma chole and others':   'Rajma Chole & Others',
  'dishwashing and gel bar':  'Dishwashing Gel & Bar',
  'oats and dates':           'Oats & Dates',
  'vermicili & poha':         'Vermicelli & Poha',
};

function normalise(sub) {
  if (!sub) return sub;
  return SUBCAT_MAP[sub.trim().toLowerCase()] || sub.trim();
}

async function scanAll(table) {
  const items = [];
  let lastKey;
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

async function run() {
  const now = new Date().toISOString();

  // 1. Scan all products
  console.log('🔍 Scanning products...');
  const products = await scanAll(PROD_TABLE);
  console.log(`   ${products.length} products found`);

  // 2. Find products with stale subcategory values
  const toFix = products.filter(p => p.subCategory && SUBCAT_MAP[p.subCategory.trim().toLowerCase()]);
  console.log(`   ${toFix.length} products need subcategory rename`);

  // 3. Update each affected product in DynamoDB
  if (toFix.length > 0) {
    console.log('✏️  Updating products...');
    let done = 0;
    for (const p of toFix) {
      const newSub = normalise(p.subCategory);
      await ddb.send(new UpdateCommand({
        TableName: PROD_TABLE,
        Key: { id: p.id },
        UpdateExpression: 'SET subCategory = :s, updatedAt = :u',
        ExpressionAttributeValues: { ':s': newSub, ':u': now },
      }));
      done++;
      if (done % 50 === 0) console.log(`   ${done}/${toFix.length}...`);
    }
    console.log(`   ✅ Updated ${toFix.length} products`);
  }

  // 4. Update products.json
  console.log('💾 Updating products.json...');
  const jsonPath = path.join(__dirname, '../data/products.json');
  const jsonProducts = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let jsonChanged = 0;
  jsonProducts.forEach(p => {
    const norm = normalise(p.subCategory);
    if (norm !== p.subCategory) { p.subCategory = norm; jsonChanged++; }
  });
  fs.writeFileSync(jsonPath, JSON.stringify(jsonProducts, null, 2));
  console.log(`   ${jsonChanged} entries updated in products.json`);

  // 5. Update latestproducts.xlsx
  console.log('📊 Updating latestproducts.xlsx...');
  const XLSX = require('xlsx');
  const xlsxPath = path.join(__dirname, '../../products/latestproducts.xlsx');
  const wb   = XLSX.readFile(xlsxPath);
  const ws   = wb.Sheets['Products'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const subIdx = rows[0].indexOf('Subcategory');
  let xlsxChanged = 0;
  for (let i = 1; i < rows.length; i++) {
    const norm = normalise(rows[i][subIdx]);
    if (norm !== rows[i][subIdx]) { rows[i][subIdx] = norm; xlsxChanged++; }
  }
  const newWs = XLSX.utils.aoa_to_sheet(rows);
  newWs['!cols'] = ws['!cols'];
  wb.Sheets['Products'] = newWs;
  XLSX.writeFile(wb, xlsxPath);
  console.log(`   ${xlsxChanged} cells updated in latestproducts.xlsx`);

  // 6. Rebuild subcategories table cleanly
  console.log('\n📂 Rebuilding subcategories table...');
  const groups = {};
  jsonProducts.forEach(p => {
    if (!p.subCategory) return;
    const key = `${p.category}||${p.subCategory}`;
    if (!groups[key]) groups[key] = { parentCategoryName: p.category, name: p.subCategory, count: 0 };
    groups[key].count++;
  });

  const existing = await scanAll(SUBCAT_TABLE);
  if (existing.length > 0) {
    await batchWrite(SUBCAT_TABLE, existing.map(s => ({ DeleteRequest: { Key: { id: s.id } } })));
  }

  let counter = 0;
  const newSubcats = Object.values(groups).map(({ parentCategoryName, name, count }) => ({
    id:                 `SUBCAT-${String(++counter).padStart(4, '0')}`,
    name,
    parentCategoryName,
    slug:               name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
    productCount:       count,
  }));

  await batchWrite(SUBCAT_TABLE, newSubcats.map(s => ({ PutRequest: { Item: s } })));
  console.log(`   ✅ ${newSubcats.length} subcategories written`);

  // Summary
  const byCat = {};
  newSubcats.forEach(s => { (byCat[s.parentCategoryName] = byCat[s.parentCategoryName] || []).push(`${s.name}(${s.productCount})`); });
  console.log('\nFinal subcategories:');
  Object.entries(byCat).sort().forEach(([cat, subs]) => console.log(`  [${cat}] ${subs.join(', ')}`));
}

run().catch(err => { console.error('❌', err); process.exit(1); });
