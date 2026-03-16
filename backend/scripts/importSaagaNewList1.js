const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const XLSX = require('xlsx');
const path = require('path');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const SUBCATEGORIES_TABLE = process.env.SUBCATEGORIES_TABLE;

/**
 * Normalize a name: trim, collapse whitespace
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*&\s*/g, ' & ');
}

/**
 * Title-case a string
 */
function toTitleCase(str) {
  const minorWords = new Set(['and', 'or', 'of', 'the', 'in', 'on', 'for', 'a', 'an']);
  return str
    .toLowerCase()
    .split(' ')
    .map((word, i) =>
      i === 0 || !minorWords.has(word)
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word
    )
    .join(' ');
}

/**
 * Normalize category name
 * Maps slight spelling/casing variants to canonical names
 */
function normalizeCategory(name) {
  if (!name) return '';
  const base = normalizeName(name);
  const lower = base.toLowerCase();

  if (lower.includes('bath') && lower.includes('body')) return 'Bath and Body';
  if (lower.includes('cleaner') || lower.includes('repellent')) return 'Cleaners and Repellents';

  return toTitleCase(base);
}

/**
 * Normalize subcategory name
 * Maps slight spelling/casing variants to canonical names
 */
function normalizeSubcategory(name) {
  if (!name) return '';
  const base = normalizeName(name);
  const lower = base.toLowerCase();

  if (lower.includes('detergent')) return 'Detergents';
  if (lower.includes('dishwash') || lower.includes('gel bar')) return 'Dishwashing and Gel Bar';
  if (lower.includes('lotion') || lower.includes('crem') || lower.includes('cream')) return 'Lotion and Cream';
  if (lower.includes('shampoo') || lower.includes('conditioner') || lower.includes('serum')) return 'Shampoo and Hair Care';

  return toTitleCase(base);
}

/**
 * Get existing data from DynamoDB
 */
async function getExistingData() {
  const [catResult, subResult, prodResult] = await Promise.all([
    docClient.send(new ScanCommand({ TableName: CATEGORIES_TABLE })),
    docClient.send(new ScanCommand({ TableName: SUBCATEGORIES_TABLE })),
    docClient.send(new ScanCommand({ TableName: PRODUCTS_TABLE }))
  ]);

  return {
    categories: catResult.Items || [],
    subcategories: subResult.Items || [],
    products: prodResult.Items || []
  };
}

/**
 * Import items to DynamoDB in batches of 25
 */
async function importBatch(tableName, items, batchName) {
  if (items.length === 0) {
    console.log(`\n⊘ No new ${batchName} to import`);
    return;
  }

  console.log(`\n📦 Importing ${items.length} ${batchName}...`);

  for (let i = 0; i < items.length; i += 25) {
    const batch = items.slice(i, i + 25);
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [tableName]: batch.map(item => ({ PutRequest: { Item: item } }))
      }
    }));
    console.log(`   ✓ Batch ${Math.floor(i / 25) + 1} (${batch.length} items)`);
  }

  console.log(`   ✅ Imported ${items.length} ${batchName}`);
}

/**
 * Main import function
 */
async function importSaagaNewList1() {
  try {
    console.log('📊 Reading SaagaNewList1.xlsx...\n');

    const workbook = XLSX.readFile(path.join(__dirname, '../../SaagaNewList1.xlsx'));
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    console.log(`Found ${rawData.length} products in sheet: "${sheetName}"\n`);

    // --- Preview raw categories/subcategories before normalization ---
    const rawCats = [...new Set(rawData.map(r => r['CATEGORY ']))];
    const rawSubcats = [...new Set(rawData.map(r => r['SUB- CATEGORY']))];
    console.log('Raw categories:   ', rawCats);
    console.log('Raw subcategories:', rawSubcats);
    console.log('');

    // --- Get existing DynamoDB data ---
    console.log('🔍 Checking existing categories and subcategories...');
    const existing = await getExistingData();
    console.log(`   Existing categories:    ${existing.categories.length}`);
    console.log(`   Existing subcategories: ${existing.subcategories.length}`);
    console.log(`   Existing products:      ${existing.products.length}\n`);

    // Build sets of existing names (case-sensitive, already normalized)
    const existingCategoryNames = new Set(existing.categories.map(c => c.name));
    const existingSubcategoryNames = new Set(existing.subcategories.map(s => s.name));

    // --- Collect unique normalized categories ---
    const categoryNames = [...new Set(
      rawData.map(row => normalizeCategory(row['CATEGORY '])).filter(Boolean)
    )];

    let nextCatId = existing.categories.length + 1;
    const newCategories = [];

    categoryNames.forEach(name => {
      if (!existingCategoryNames.has(name)) {
        console.log(`   + New category: "${name}"`);
        newCategories.push({
          id: `CAT-${String(nextCatId).padStart(4, '0')}`,
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[,&]/g, ''),
          description: '',
          icon: '',
          featured: false,
          productCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        existingCategoryNames.add(name);
        nextCatId++;
      } else {
        console.log(`   = Category already exists: "${name}"`);
      }
    });

    // --- Collect unique normalized subcategories ---
    // Build a map: normalized subcategory name → normalized category name
    const subcategoryMap = new Map();
    rawData.forEach(row => {
      const subcat = normalizeSubcategory(row['SUB- CATEGORY']);
      const category = normalizeCategory(row['CATEGORY ']);
      if (subcat && category && !subcategoryMap.has(subcat)) {
        subcategoryMap.set(subcat, category);
      }
    });

    let nextSubId = existing.subcategories.length + 1;
    const newSubcategories = [];

    console.log('');
    Array.from(subcategoryMap.entries()).forEach(([name, parentCategory]) => {
      if (!existingSubcategoryNames.has(name)) {
        console.log(`   + New subcategory: "${name}" (parent: ${parentCategory})`);
        newSubcategories.push({
          id: `SUBCAT-${String(nextSubId).padStart(6, '0')}`,
          name,
          parentCategoryName: parentCategory,
          description: '',
          icon: '📦',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        existingSubcategoryNames.add(name);
        nextSubId++;
      } else {
        console.log(`   = Subcategory already exists: "${name}"`);
      }
    });

    // --- Build product records ---
    let nextProdId = existing.products.length + 1;
    const products = rawData.map(row => {
      const name = String(row['PRODUCT NAME '] || '').trim();
      const category = normalizeCategory(row['CATEGORY ']);
      const subcategory = normalizeSubcategory(row['SUB- CATEGORY']);
      const originalPrice = parseFloat(row['PRICE']) || 0;
      const discountedPrice = parseFloat(row['DP']) || originalPrice;
      const discountPercent = originalPrice > 0
        ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100)
        : 0;
      const stock = parseInt(row['STOCK']) || 100;
      const inStockRaw = String(row['Yes'] || '').trim().toUpperCase();
      const inStock = inStockRaw === 'YES' || inStockRaw === 'Y' || stock > 0;
      const unit = String(row['UNIT'] || 'g').trim();
      const weight = String(row['WEIGHT'] || '').trim();

      const product = {
        id: `PROD-${String(nextProdId).padStart(6, '0')}`,
        name,
        description: `${name} - Premium quality product`,
        category,
        subCategory: subcategory,
        brand: '',
        unit,
        weight,
        price: discountedPrice,
        originalPrice,
        currency: 'SGD',
        stock,
        inStock,
        imageUrl: '',
        images: [],
        sku: `SKU-${String(nextProdId).padStart(6, '0')}`,
        barcode: '',
        tags: [],
        featured: false,
        discount: discountPercent,
        discountPercent,
        discountedPrice,
        hasDiscount: discountPercent > 0,
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      nextProdId++;
      return product;
    });

    // --- Summary ---
    console.log('\n📊 Import Summary:');
    console.log(`   New categories:    ${newCategories.length}`);
    console.log(`   New subcategories: ${newSubcategories.length}`);
    console.log(`   Products to add:   ${products.length}`);

    // --- Import to DynamoDB ---
    await importBatch(CATEGORIES_TABLE, newCategories, 'categories');
    await importBatch(SUBCATEGORIES_TABLE, newSubcategories, 'subcategories');
    await importBatch(PRODUCTS_TABLE, products, 'products');

    console.log('\n' + '='.repeat(70));
    console.log('✅ SaagaNewList1 import completed successfully!');
    console.log('='.repeat(70));
    console.log(`Total Categories:    ${existing.categories.length + newCategories.length}`);
    console.log(`Total Subcategories: ${existing.subcategories.length + newSubcategories.length}`);
    console.log(`Total Products:      ${existing.products.length + products.length}`);

  } catch (error) {
    console.error('❌ Error importing SaagaNewList1 data:', error);
    process.exit(1);
  }
}

importSaagaNewList1();
