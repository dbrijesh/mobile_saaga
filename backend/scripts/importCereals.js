const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const XLSX = require('xlsx');
const path = require('path');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const SUBCATEGORIES_TABLE = process.env.SUBCATEGORIES_TABLE;

/**
 * Import to DynamoDB in batches
 */
async function importBatch(tableName, items, batchName) {
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
async function importCereals() {
  try {
    console.log('📊 Reading SaagaProducts_Cerreals.xlsx...\n');

    const workbook = XLSX.readFile(path.join(__dirname, '../../SaagaProducts_Cerreals.xlsx'));
    const worksheet = workbook.Sheets['Sheet1'];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    // Skip header row
    const data = rawData.filter(row =>
      row['__EMPTY_1'] &&
      row['__EMPTY_1'] !== 'Name' &&
      row['__EMPTY_2'] &&
      row['__EMPTY_2'] !== 'Category'
    );

    console.log(`Found ${data.length} products\n`);

    // Extract unique categories
    const categoryNames = [...new Set(data.map(row => row['__EMPTY_2']))];
    const categories = categoryNames.map((name, idx) => ({
      id: `CAT-${String(idx + 1).padStart(4, '0')}`,
      name: name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[,&]/g, ''),
      description: '',
      icon: '',
      featured: false,
      productCount: data.filter(row => row['__EMPTY_2'] === name).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Extract unique subcategories with parent categories
    const subcategoryMap = new Map();
    data.forEach(row => {
      const subcat = row['__EMPTY_3'];
      const category = row['__EMPTY_2'];
      if (subcat && !subcategoryMap.has(subcat)) {
        subcategoryMap.set(subcat, category);
      }
    });

    const subcategories = Array.from(subcategoryMap.entries()).map(([name, parentCategory], idx) => ({
      id: `SUBCAT-${String(idx + 1).padStart(6, '0')}`,
      name: name,
      parentCategoryName: parentCategory,
      description: '',
      icon: '📦',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    // Create products
    const products = data.map((row, idx) => {
      const name = row['__EMPTY_1'];
      const category = row['__EMPTY_2'];
      const subcategory = row['__EMPTY_3'] || '';
      const price = parseFloat(row['__EMPTY_4']) || 0;
      const discountPercent = parseFloat(row['__EMPTY_5']) || 0;
      const discountedPrice = parseFloat(row['__EMPTY_6']) || price;
      const stock = parseInt(row['__EMPTY_7']) || 100;
      const inStock = row['__EMPTY_8'] === 'Yes' || row['__EMPTY_8'] === 'yes' || stock > 0;
      const unit = row['__EMPTY_9'] || 'g';
      const weight = row['__EMPTY_10'] || '';
      const description = row['__EMPTY_11'] || `${name} - Premium quality Indian grocery product`;
      const imageUrl = row['__EMPTY_12'] || '';

      return {
        id: `PROD-${String(idx + 1).padStart(6, '0')}`,
        name: String(name).trim(),
        description: String(description).trim(),
        category: String(category).trim(),
        subCategory: subcategory ? String(subcategory).trim() : '',
        brand: '',
        unit: String(unit).trim(),
        weight: String(weight),
        price: discountedPrice,
        originalPrice: price,
        currency: 'SGD',
        stock: stock,
        inStock: inStock,
        imageUrl: imageUrl ? String(imageUrl).trim() : '',
        images: [],
        sku: `SKU-${String(idx + 1).padStart(6, '0')}`,
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
    });

    console.log('📊 Summary:');
    console.log(`   Categories: ${categories.length}`);
    categories.forEach(cat => console.log(`      - ${cat.name} (${cat.productCount} products)`));
    console.log(`   Subcategories: ${subcategories.length}`);
    subcategories.forEach(sub => console.log(`      - ${sub.name} (parent: ${sub.parentCategoryName})`));
    console.log(`   Products: ${products.length}`);

    // Import to DynamoDB
    await importBatch(CATEGORIES_TABLE, categories, 'categories');
    await importBatch(SUBCATEGORIES_TABLE, subcategories, 'subcategories');
    await importBatch(PRODUCTS_TABLE, products, 'products');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Cereals import completed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error importing cereals data:', error);
    process.exit(1);
  }
}

// Run the import
importCereals();
