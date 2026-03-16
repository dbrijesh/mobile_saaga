const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const XLSX = require('xlsx');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const SUBCATEGORIES_TABLE = process.env.SUBCATEGORIES_TABLE;

/**
 * Parse Master Category sheet
 */
function parseMasterCategory(worksheet) {
  const rawData = XLSX.utils.sheet_to_json(worksheet);

  const categories = [];
  const subcategories = [];
  let currentCategory = null;
  let categoryIndex = 1;
  let subcategoryIndex = 1;

  rawData.forEach(row => {
    const mainCategory = row['__EMPTY_1'];
    const subCategory = row['__EMPTY_2'];

    // New main category
    if (mainCategory && mainCategory !== 'Main Category') {
      currentCategory = {
        id: `CAT-${String(categoryIndex).padStart(4, '0')}`,
        name: mainCategory.trim(),
        slug: mainCategory.trim().toLowerCase().replace(/\s+/g, '-'),
        description: '',
        icon: '',
        featured: false,
        productCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      categories.push(currentCategory);
      categoryIndex++;
    }

    // Subcategory
    if (subCategory && subCategory !== 'Sub Category' && currentCategory) {
      subcategories.push({
        id: `SUBCAT-${String(subcategoryIndex).padStart(6, '0')}`,
        name: subCategory.trim(),
        parentCategoryName: currentCategory.name,
        description: '',
        icon: '📦',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      subcategoryIndex++;
    }
  });

  return { categories, subcategories };
}

/**
 * Parse product sheet
 */
function parseProductSheet(worksheet, productIdStart) {
  const rawData = XLSX.utils.sheet_to_json(worksheet);
  const products = [];
  let productIndex = productIdStart;

  rawData.forEach(row => {
    const name = row['Name'] || row['__EMPTY_1'];
    const category = row['Category'] || row['__EMPTY_2'];
    const subcategory = row['Subcategory'] || row['__EMPTY_3'];
    const price = row['Price'] || row['__EMPTY_4'];
    const discountPercent = row['Discount %'] || row['__EMPTY_5'] || 0;
    const discountedPrice = row['Discounted Price'] || row['__EMPTY_6'];
    const stock = row['Stock'] || row['__EMPTY_7'] || 100;
    const inStock = row['In Stock'] || row['__EMPTY_8'];
    const unit = row['Unit'] || row['__EMPTY_9'] || 'g';
    const weight = row['Weight'] || row['__EMPTY_10'];
    const imageUrl = row['Image URL'] || row['__EMPTY_12'] || '';

    // Skip header rows and empty rows
    if (!name || name === 'Name' || name === 'SKU') {
      return;
    }

    const finalPrice = discountedPrice || price;
    const hasDiscount = discountPercent > 0;

    const product = {
      id: `PROD-${String(productIndex).padStart(6, '0')}`,
      name: String(name).trim(),
      description: `${String(name).trim()} - Premium quality Indian grocery product`,
      category: category ? String(category).trim() : 'Uncategorized',
      subCategory: subcategory ? String(subcategory).trim() : '',
      brand: '',
      unit: unit ? String(unit).trim() : 'g',
      weight: weight ? String(weight) : '',
      price: parseFloat(finalPrice) || 0,
      originalPrice: parseFloat(price) || 0,
      currency: 'SGD',
      stock: parseInt(stock) || 100,
      inStock: (inStock === 'Yes' || inStock === 'yes' || inStock === true || parseInt(stock) > 0),
      imageUrl: imageUrl ? String(imageUrl).trim() : '',
      images: [],
      sku: `SKU-${String(productIndex).padStart(6, '0')}`,
      barcode: '',
      tags: [],
      featured: false,
      discount: parseFloat(discountPercent) || 0,
      discountPercent: parseFloat(discountPercent) || 0,
      discountedPrice: parseFloat(finalPrice) || 0,
      hasDiscount: hasDiscount,
      rating: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    products.push(product);
    productIndex++;
  });

  return { products, nextProductId: productIndex };
}

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
async function importFromSaagaProducts() {
  try {
    console.log('📊 Reading SaagaProducts.xlsx...\n');

    const workbook = XLSX.readFile(path.join(__dirname, '../../SaagaProducts.xlsx'));

    // Parse Master Category
    const masterSheet = workbook.Sheets['Master Category'];
    const { categories, subcategories } = parseMasterCategory(masterSheet);

    console.log(`Found ${categories.length} categories and ${subcategories.length} subcategories`);

    // Parse product sheets
    let allProducts = [];
    let productIdCounter = 1;

    const productSheets = [
      'Atta & Daal',
      'Oil , Ghee & Masala ',
      'Milk, Cereals & Nuts'
    ];

    productSheets.forEach(sheetName => {
      if (workbook.Sheets[sheetName]) {
        console.log(`\nParsing sheet: ${sheetName}`);
        const { products, nextProductId } = parseProductSheet(
          workbook.Sheets[sheetName],
          productIdCounter
        );
        console.log(`   Found ${products.length} products`);
        allProducts = allProducts.concat(products);
        productIdCounter = nextProductId;
      }
    });

    console.log(`\n📊 Total Summary:`);
    console.log(`   Categories: ${categories.length}`);
    console.log(`   Subcategories: ${subcategories.length}`);
    console.log(`   Products: ${allProducts.length}`);

    // Import to DynamoDB
    await importBatch(CATEGORIES_TABLE, categories, 'categories');
    await importBatch(SUBCATEGORIES_TABLE, subcategories, 'subcategories');
    await importBatch(PRODUCTS_TABLE, allProducts, 'products');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Import completed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error importing data:', error);
    process.exit(1);
  }
}

// Run the import
importFromSaagaProducts();
