/**
 * fixSubcategories.js
 * Re-syncs subcategories table using parentCategoryName (the GSI key).
 * Reads product list from backend/data/products.json.
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const fs   = require('fs');
const path = require('path');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const ddb    = DynamoDBDocumentClient.from(client);
const TABLE  = process.env.SUBCATEGORIES_TABLE;

async function scanAll() {
  const items = [];
  let lastKey;
  do {
    const res = await ddb.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: lastKey }));
    items.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function batchWrite(requests) {
  for (let i = 0; i < requests.length; i += 25) {
    await ddb.send(new BatchWriteCommand({ RequestItems: { [TABLE]: requests.slice(i, i + 25) } }));
  }
}

async function run() {
  // Build subcategory groups from products.json
  const products = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/products.json'), 'utf8'));
  const groups = {};
  for (const p of products) {
    if (!p.subCategory) continue;
    const key = `${p.category}||${p.subCategory}`;
    if (!groups[key]) groups[key] = { parentCategoryName: p.category, name: p.subCategory, count: 0 };
    groups[key].count++;
  }
  console.log(`Built ${Object.keys(groups).length} subcategory groups from products`);

  // Scan existing subcategories
  console.log('Scanning existing subcategories...');
  const existing = await scanAll();
  console.log(`Found ${existing.length} existing subcategory items`);

  // Delete ALL existing subcategories (wipe and rewrite cleanly)
  if (existing.length > 0) {
    await batchWrite(existing.map(s => ({ DeleteRequest: { Key: { id: s.id } } })));
    console.log(`Deleted ${existing.length} stale subcategory items`);
  }

  // Write fresh subcategories with correct parentCategoryName field
  let counter = 0;
  const newSubcats = Object.values(groups).map(({ parentCategoryName, name, count }) => {
    counter++;
    return {
      id:                 `SUBCAT-${String(counter).padStart(4, '0')}`,
      name,
      parentCategoryName,
      slug:               name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
      productCount:       count,
    };
  });

  await batchWrite(newSubcats.map(s => ({ PutRequest: { Item: s } })));
  console.log(`✅ Written ${newSubcats.length} subcategories with correct parentCategoryName field`);

  // Show sample per category
  const byCat = {};
  newSubcats.forEach(s => { (byCat[s.parentCategoryName] = byCat[s.parentCategoryName] || []).push(s.name); });
  Object.entries(byCat).sort().forEach(([cat, names]) =>
    console.log(`  [${cat}] ${names.join(', ')}`)
  );
}

run().catch(err => { console.error('❌ Error:', err); process.exit(1); });
