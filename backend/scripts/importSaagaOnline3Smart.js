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
 * Normalize string for fuzzy matching (removes case, spaces, special chars)
 */
function normalizeForMatching(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, '')  // Remove all spaces
    .replace(/[&,\-_]/g, '');  // Remove special chars
}

/**
 * Find best matching category from existing categories
 */
function findMatchingCategory(categoryName, existingCategories) {
  if (!categoryName) return null;

  const normalized = normalizeForMatching(categoryName);

  // Try exact normalized match first
  const exactMatch = existingCategories.find(cat =>
    normalizeForMatching(cat.name) === normalized
  );

  if (exactMatch) {
    console.log(`   ✓ Matched "${categoryName}" to existing "${exactMatch.name}"`);
    return exactMatch.name;
  }

  // No match found
  console.log(`   ⚠ No match found for "${categoryName}"`);
  return null;
}

/**
 * Find best matching subcategory from existing subcategories
 */
function findMatchingSubcategory(subcategoryName, existingSubcategories) {
  if (!subcategoryName) return null;

  const normalized = normalizeForMatching(subcategoryName);

  // Try exact normalized match first
  const exactMatch = existingSubcategories.find(sub =>
    normalizeForMatching(sub.name) === normalized
  );

  if (exactMatch) {
    console.log(`   ✓ Matched subcategory "${subcategoryName}" to existing "${exactMatch.name}"`);
    return exactMatch.name;
  }

  // No match found
  console.log(`   ⚠ No match found for subcategory "${subcategoryName}"`);
  return null;
}

/**
 * Normalize name for storage
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name).trim().replace(/\s+/g, ' ');
}

/**
 * Get existing categories and subcategories
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
 * Import to DynamoDB in batches
 */
async function importBatch(tableName, items, batchName) {
  if (items.length === 0) {
    console.log(`\n⊘ No new ${batchName} to import`);
    return;
  }

  console.log(`\n📦 Importing ${items.length} ${batchName}...`);

  const batches = [];
  for (let i = 0; i < items.length; i += 25) {
    batches.push(items.slice(i, i + 25));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const params = {
      RequestItems: {
        [tableName]: batch.map(item => ({
          PutRequest: { Item: item }
        }))
      }
    };

    await docClient.send(new BatchWriteCommand(params));
    console.log(`   ✓ Imported batch ${i + 1}/${batches.length} (${batch.length} items)`);
  }

  console.log(`   ✅ Successfully imported ${items.length} ${batchName}`);
}

/**
 * Main import function
 */
async function importSaagaOnline3() {
  try {
    console.log('📊 Reading SaagaOnline3.xlsx...\n');

    const workbook = XLSX.readFile(path.join(__dirname, '../../SaagaOnline3.xlsx'));
    console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`);

    const sheetName = workbook.SheetNames[0];
    console.log(`Using sheet: ${sheetName}\n`);

    const worksheet = workbook.Sheets[sheetName];
    const allData = XLSX.utils.sheet_to_json(worksheet, {defval: '', header: 1});

    // Extract headers and data rows
    const headers = allData[0];
    const dataRows = allData.slice(1);

    // Convert to objects
    const rawData = dataRows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    }).filter(row => row['PRODUCT NAME ']); // Filter out empty rows

    console.log(`Found ${rawData.length} products\n`);

    // Get existing data
    console.log('🔍 Checking existing categories and subcategories...');
    const existing = await getExistingData();
    console.log(`   Existing categories: ${existing.categories.length}`);
    console.log(`   Existing subcategories: ${existing.subcategories.length}`);
    console.log(`   Existing products: ${existing.products.length}\n`);

    // Build category mapping (Excel name -> DynamoDB name)
    console.log('🔗 Mapping categories...');
    const categoryMapping = new Map();
    const uniqueExcelCategories = [...new Set(rawData.map(r => normalizeName(r['CATEGORY '])).filter(c => c))];

    uniqueExcelCategories.forEach(excelCat => {
      const matchedCat = findMatchingCategory(excelCat, existing.categories);
      if (matchedCat) {
        categoryMapping.set(excelCat, matchedCat);
      } else {
        categoryMapping.set(excelCat, excelCat); // Use as-is if no match
      }
    });

    // Build subcategory mapping (Excel name -> DynamoDB name)
    console.log('\n🔗 Mapping subcategories...');
    const subcategoryMapping = new Map();
    const uniqueExcelSubcategories = [...new Set(rawData.map(r => normalizeName(r['SUB- CATEGORY'])).filter(c => c))];

    uniqueExcelSubcategories.forEach(excelSub => {
      const matchedSub = findMatchingSubcategory(excelSub, existing.subcategories);
      if (matchedSub) {
        subcategoryMapping.set(excelSub, matchedSub);
      } else {
        subcategoryMapping.set(excelSub, excelSub); // Use as-is if no match
      }
    });

    // Collect unique mapped categories and subcategories
    const existingCategoryNames = new Set(existing.categories.map(c => c.name));
    const existingSubcategoryNames = new Set(existing.subcategories.map(s => s.name));

    // Determine new categories to create
    const newCategories = [];
    let nextCatId = existing.categories.length + 1;

    const mappedCategories = new Set(categoryMapping.values());
    mappedCategories.forEach(catName => {
      if (!existingCategoryNames.has(catName)) {
        newCategories.push({
          id: `CAT-${String(nextCatId).padStart(4, '0')}`,
          name: catName,
          slug: catName.toLowerCase().replace(/\s+/g, '-').replace(/[,&]/g, ''),
          description: '',
          icon: '',
          featured: false,
          productCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        existingCategoryNames.add(catName);
        nextCatId++;
      }
    });

    // Determine new subcategories to create
    const newSubcategories = [];
    let nextSubId = existing.subcategories.length + 1;

    const subcategoryParentMap = new Map();
    rawData.forEach(row => {
      const excelSub = normalizeName(row['SUB- CATEGORY']);
      const excelCat = normalizeName(row['CATEGORY ']);
      if (excelSub && excelCat) {
        const mappedSub = subcategoryMapping.get(excelSub);
        const mappedCat = categoryMapping.get(excelCat);
        if (mappedSub && mappedCat && !subcategoryParentMap.has(mappedSub)) {
          subcategoryParentMap.set(mappedSub, mappedCat);
        }
      }
    });

    subcategoryParentMap.forEach((parentCat, subName) => {
      if (!existingSubcategoryNames.has(subName)) {
        newSubcategories.push({
          id: `SUBCAT-${String(nextSubId).padStart(6, '0')}`,
          name: subName,
          parentCategoryName: parentCat,
          description: '',
          icon: '📦',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        existingSubcategoryNames.add(subName);
        nextSubId++;
      }
    });

    // Create products with mapped categories
    let nextProdId = existing.products.length + 1;
    const products = rawData.map(row => {
      const name = normalizeName(row['PRODUCT NAME ']);
      const excelCategory = normalizeName(row['CATEGORY ']);
      const excelSubcategory = normalizeName(row['SUB- CATEGORY']);

      const category = categoryMapping.get(excelCategory) || excelCategory;
      const subcategory = subcategoryMapping.get(excelSubcategory) || excelSubcategory;

      const price = parseFloat(row['PRICE']) || 0;
      const discountPercent = parseFloat(row['DISCOUNT%']) || 0;
      const discountedPrice = parseFloat(row['DP']) || price;
      const stock = parseInt(row['STOCK']) || 100;
      const inStock = row['Yes'] === 'Yes' || row['Yes'] === 'yes' || stock > 0;
      const unit = row['UNIT'] || 'g';
      const weight = row['WEIGHT'] || '';
      const description = row['DESCRIPTION'] || `${name} - Premium quality Indian grocery product`;

      const product = {
        id: `PROD-${String(nextProdId).padStart(6, '0')}`,
        name: name,
        description: String(description).trim(),
        category: category,
        subCategory: subcategory,
        brand: '',
        unit: String(unit).trim(),
        weight: String(weight),
        price: discountedPrice,
        originalPrice: price,
        currency: 'SGD',
        stock: stock,
        inStock: inStock,
        imageUrl: '',
        images: [],
        sku: `SKU-${String(nextProdId).padStart(6, '0')}`,
        barcode: '',
        tags: [],
        featured: false,
        discount: discountPercent,
        discountPercent: discountPercent,
        discountedPrice: discountedPrice,
        hasDiscount: discountPercent > 0,
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      nextProdId++;
      return product;
    });

    console.log('\n📊 Import Summary:');
    console.log(`   New Categories: ${newCategories.length}`);
    newCategories.forEach(cat => console.log(`      - ${cat.name}`));
    console.log(`   New Subcategories: ${newSubcategories.length}`);
    newSubcategories.forEach(sub => console.log(`      - ${sub.name} (parent: ${sub.parentCategoryName})`));
    console.log(`   New Products: ${products.length}`);

    // Import to DynamoDB
    await importBatch(CATEGORIES_TABLE, newCategories, 'categories');
    await importBatch(SUBCATEGORIES_TABLE, newSubcategories, 'subcategories');
    await importBatch(PRODUCTS_TABLE, products, 'products');

    console.log('\n' + '='.repeat(80));
    console.log('✅ SaagaOnline3 import completed successfully!');
    console.log('='.repeat(80));
    console.log(`Total Categories: ${existing.categories.length + newCategories.length}`);
    console.log(`Total Subcategories: ${existing.subcategories.length + newSubcategories.length}`);
    console.log(`Total Products: ${existing.products.length + products.length}`);

  } catch (error) {
    console.error('❌ Error importing SaagaOnline3 data:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the import
importSaagaOnline3();
