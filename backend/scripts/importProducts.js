const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const SUBCATEGORIES_TABLE = process.env.SUBCATEGORIES_TABLE;

/**
 * Import products and categories into DynamoDB
 */
async function importProducts() {
  try {
    console.log('📦 Starting product import...');

    // Read products and categories
    const productsPath = path.join(__dirname, '../data/products.json');
    const categoriesPath = path.join(__dirname, '../data/categories.json');

    if (!fs.existsSync(productsPath)) {
      console.error('❌ Products file not found. Run npm run convert in scripts folder first.');
      process.exit(1);
    }

    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

    console.log(`Found ${products.length} products and ${categories.length} categories`);

    // Import products in batches of 25 (DynamoDB limit)
    console.log('\n📝 Importing products...');
    const productBatches = [];
    for (let i = 0; i < products.length; i += 25) {
      productBatches.push(products.slice(i, i + 25));
    }

    for (let i = 0; i < productBatches.length; i++) {
      const batch = productBatches[i];
      const params = {
        RequestItems: {
          [PRODUCTS_TABLE]: batch.map(product => ({
            PutRequest: {
              Item: product,
            },
          })),
        },
      };

      await docClient.send(new BatchWriteCommand(params));
      console.log(`   ✓ Imported batch ${i + 1}/${productBatches.length} (${batch.length} products)`);
    }

    // Import categories
    console.log('\n📁 Importing categories...');
    const categoryBatches = [];
    for (let i = 0; i < categories.length; i += 25) {
      categoryBatches.push(categories.slice(i, i + 25));
    }

    for (let i = 0; i < categoryBatches.length; i++) {
      const batch = categoryBatches[i];
      const params = {
        RequestItems: {
          [CATEGORIES_TABLE]: batch.map(category => ({
            PutRequest: {
              Item: category,
            },
          })),
        },
      };

      await docClient.send(new BatchWriteCommand(params));
      console.log(`   ✓ Imported batch ${i + 1}/${categoryBatches.length} (${batch.length} categories)`);
    }

    // Import subcategories if file exists
    const subcategoriesPath = path.join(__dirname, '../data/subcategories.json');
    if (fs.existsSync(subcategoriesPath)) {
      console.log('\n📂 Importing subcategories...');
      const subcategories = JSON.parse(fs.readFileSync(subcategoriesPath, 'utf8'));

      const subCategoryBatches = [];
      for (let i = 0; i < subcategories.length; i += 25) {
        subCategoryBatches.push(subcategories.slice(i, i + 25));
      }

      for (let i = 0; i < subCategoryBatches.length; i++) {
        const batch = subCategoryBatches[i];
        const params = {
          RequestItems: {
            [SUBCATEGORIES_TABLE]: batch.map(subcategory => ({
              PutRequest: {
                Item: subcategory,
              },
            })),
          },
        };

        await docClient.send(new BatchWriteCommand(params));
        console.log(`   ✓ Imported batch ${i + 1}/${subCategoryBatches.length} (${batch.length} subcategories)`);
      }

      console.log('\n✅ Import completed successfully!');
      console.log(`   📦 ${products.length} products imported`);
      console.log(`   📁 ${categories.length} categories imported`);
      console.log(`   📂 ${subcategories.length} subcategories imported`);
    } else {
      console.log('\n✅ Import completed successfully!');
      console.log(`   📦 ${products.length} products imported`);
      console.log(`   📁 ${categories.length} categories imported`);
      console.log(`   ⚠️  No subcategories file found (skipped)`);
    }

  } catch (error) {
    console.error('❌ Error importing products:', error);
    process.exit(1);
  }
}

// Run import
importProducts();
