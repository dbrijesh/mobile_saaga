const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const SUBCATEGORIES_TABLE = process.env.SUBCATEGORIES_TABLE;

/**
 * Mapping of incorrect values to correct values
 */
const CATEGORY_FIXES = {
  'Oil , Ghee & Masala': 'Oil, Ghee & Masala'  // Remove space before comma
};

const SUBCATEGORY_FIXES = {
  'ATTA': 'Atta',
  'Powdered spices': 'Powdered Spices',
  'Whole spices': 'Whole Spices',
  'Dhall': 'Dal',
  'Rajma Chole and others': 'Rajma Chole & Others',
  'Salt and Sugar': 'Salt & Sugar'
};

/**
 * Fix category and subcategory mismatches
 */
async function fixMismatches() {
  try {
    console.log('🔍 Scanning products for mismatches...\n');

    const scanCommand = new ScanCommand({
      TableName: PRODUCTS_TABLE
    });

    const result = await docClient.send(scanCommand);
    const products = result.Items || [];

    console.log(`Found ${products.length} products to check\n`);

    let categoryFixed = 0;
    let subcategoryFixed = 0;
    let skipped = 0;

    for (const product of products) {
      let needsUpdate = false;
      let newCategory = product.category;
      let newSubCategory = product.subCategory;

      // Check category
      if (CATEGORY_FIXES[product.category]) {
        newCategory = CATEGORY_FIXES[product.category];
        needsUpdate = true;
        categoryFixed++;
      }

      // Check subcategory
      if (product.subCategory && SUBCATEGORY_FIXES[product.subCategory]) {
        newSubCategory = SUBCATEGORY_FIXES[product.subCategory];
        needsUpdate = true;
        subcategoryFixed++;
      }

      if (needsUpdate) {
        const updateCommand = new UpdateCommand({
          TableName: PRODUCTS_TABLE,
          Key: { id: product.id },
          UpdateExpression: 'SET category = :category, subCategory = :subCategory, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':category': newCategory,
            ':subCategory': newSubCategory || '',
            ':updatedAt': new Date().toISOString()
          }
        });

        await docClient.send(updateCommand);

        console.log(`✓ Fixed: ${product.name}`);
        if (product.category !== newCategory) {
          console.log(`   Category: "${product.category}" → "${newCategory}"`);
        }
        if (product.subCategory !== newSubCategory) {
          console.log(`   Subcategory: "${product.subCategory}" → "${newSubCategory}"`);
        }
      } else {
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Fix Summary:');
    console.log('='.repeat(80));
    console.log(`Total products: ${products.length}`);
    console.log(`Category fixes: ${categoryFixed}`);
    console.log(`Subcategory fixes: ${subcategoryFixed}`);
    console.log(`Products unchanged: ${skipped}`);
    console.log('\n✅ All mismatches fixed!\n');

    // Verify fixes
    console.log('🔍 Verifying fixes...\n');
    const verifyResult = await docClient.send(scanCommand);
    const verifyProducts = verifyResult.Items || [];

    const uniqueCategories = [...new Set(verifyProducts.map(p => p.category))];
    const uniqueSubcategories = [...new Set(verifyProducts.map(p => p.subCategory).filter(s => s))];

    console.log('Categories in products now:');
    uniqueCategories.forEach(c => console.log(`   - ${c}`));

    console.log('\nSubcategories in products now (sample):');
    uniqueSubcategories.slice(0, 10).forEach(s => console.log(`   - ${s}`));

  } catch (error) {
    console.error('❌ Error fixing mismatches:', error);
    process.exit(1);
  }
}

// Run the script
fixMismatches();
