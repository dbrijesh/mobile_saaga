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
 * Normalize category/subcategory names
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\s*,\s*/g, ', ')  // Normalize comma spacing
    .replace(/\s*&\s*/g, ' & ');  // Normalize ampersand spacing
}

/**
 * Normalize subcategory name with special rules
 */
function normalizeSubcategory(name) {
  if (!name) return '';
  let normalized = normalizeName(name);

  // Fix common issues
  if (normalized.toLowerCase() === 'atta') normalized = 'Atta';
  if (normalized.toLowerCase() === 'dhall') normalized = 'Dal';
  if (normalized.toLowerCase() === 'flour') normalized = 'Flour';
  if (normalized.toLowerCase().includes('powdered spices')) normalized = 'Powdered Spices';
  if (normalized.toLowerCase().includes('whole spices')) normalized = 'Whole Spices';
  if (normalized.toLowerCase().includes('rajma chole')) normalized = 'Rajma Chole & Others';
  if (normalized.toLowerCase().includes('salt and sugar')) normalized = 'Salt & Sugar';
  if (normalized.toLowerCase() === 'oil') normalized = 'Oil';
  if (normalized.toLowerCase() === 'ghee') normalized = 'Ghee';

  return normalized;
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
async function importSaagaOnline() {
  try {
    console.log('📊 Reading Saaga_Online_upload.xlsx...\n');

    const workbook = XLSX.readFile(path.join(__dirname, '../../Saaga_Online_upload.xlsx'));
    const worksheet = workbook.Sheets['upload'];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Found ${rawData.length} products\n`);

    // Get existing data
    console.log('🔍 Checking existing categories and subcategories...');
    const existing = await getExistingData();
    console.log(`   Existing categories: ${existing.categories.length}`);
    console.log(`   Existing subcategories: ${existing.subcategories.length}`);
    console.log(`   Existing products: ${existing.products.length}\n`);

    const existingCategoryNames = new Set(existing.categories.map(c => c.name));
    const existingSubcategoryNames = new Set(existing.subcategories.map(s => s.name));

    // Extract and normalize unique categories
    const categoryNames = [...new Set(rawData.map(row => normalizeName(row['CATEGORY '])).filter(c => c))];
    const newCategories = [];

    let nextCatId = existing.categories.length + 1;
    categoryNames.forEach(name => {
      if (!existingCategoryNames.has(name)) {
        newCategories.push({
          id: `CAT-${String(nextCatId).padStart(4, '0')}`,
          name: name,
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
      }
    });

    // Extract and normalize unique subcategories
    const subcategoryMap = new Map();
    rawData.forEach(row => {
      const subcat = normalizeSubcategory(row['SUB- CATEGORY']);
      const category = normalizeName(row['CATEGORY ']);
      if (subcat && category && !subcategoryMap.has(subcat)) {
        subcategoryMap.set(subcat, category);
      }
    });

    const newSubcategories = [];
    let nextSubId = existing.subcategories.length + 1;

    Array.from(subcategoryMap.entries()).forEach(([name, parentCategory]) => {
      if (!existingSubcategoryNames.has(name)) {
        newSubcategories.push({
          id: `SUBCAT-${String(nextSubId).padStart(6, '0')}`,
          name: name,
          parentCategoryName: parentCategory,
          description: '',
          icon: '📦',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        existingSubcategoryNames.add(name);
        nextSubId++;
      }
    });

    // Create products
    let nextProdId = existing.products.length + 1;
    const products = rawData.map(row => {
      const name = row['PRODUCT NAME '];
      const category = normalizeName(row['CATEGORY ']);
      const subcategory = normalizeSubcategory(row['SUB- CATEGORY']);
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
        name: String(name).trim(),
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

    console.log('📊 Import Summary:');
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
    console.log('✅ Saaga Online import completed successfully!');
    console.log('='.repeat(80));
    console.log(`Total Categories: ${existing.categories.length + newCategories.length}`);
    console.log(`Total Subcategories: ${existing.subcategories.length + newSubcategories.length}`);
    console.log(`Total Products: ${existing.products.length + products.length}`);

  } catch (error) {
    console.error('❌ Error importing Saaga Online data:', error);
    process.exit(1);
  }
}

// Run the import
importSaagaOnline();
