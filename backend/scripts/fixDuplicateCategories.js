const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const SUBCATEGORIES_TABLE = process.env.SUBCATEGORIES_TABLE;

// Category mapping: wrong name -> correct name
const CATEGORY_MAPPING = {
  'BAKERY BISCUITS AND JUICE': 'Bakery & Biscuits & Juice',
  'Chips and Chocolates': 'Chips & Chocolates',
  'Instant Food and Snacks': 'Instant Food & Snacks',
  'Bath and Body': 'Bath & Body'
};

// Subcategory parent updates
const SUBCATEGORY_UPDATES = {
  'Juice': 'Bakery & Biscuits & Juice',
  'Chocolates': 'Chips & Chocolates',
  'Noodles': 'Instant Food & Snacks',
  'Sauce': 'Instant Food & Snacks',
  'Pasta': 'Instant Food & Snacks',
  'Pickle': 'Instant Food & Snacks',
  'Jam': 'Instant Food & Snacks',
  'Ready to eat': 'Instant Food & Snacks',
  'Honey': 'Instant Food & Snacks',
  'Oral Care': 'Bath & Body',
  'Bathing soap & Shower Gel': 'Bath & Body',
  'Shampoo': 'Bath & Body'
};

async function fixDuplicateCategories() {
  try {
    console.log('🔧 Fixing duplicate categories...\n');

    // Step 0: Get categories and create correct ones if they don't exist
    console.log('📊 Scanning categories...');
    const categoriesResult = await docClient.send(new ScanCommand({
      TableName: CATEGORIES_TABLE
    }));
    const categories = categoriesResult.Items || [];
    console.log(`   Found ${categories.length} categories\n`);

    const existingCategoryNames = new Set(categories.map(c => c.name));
    const categoriesToCreate = [];
    let nextCatId = categories.length + 1;

    // Check if correct categories exist, create if not
    const correctCategoryNames = new Set(Object.values(CATEGORY_MAPPING));
    for (const correctName of correctCategoryNames) {
      if (!existingCategoryNames.has(correctName)) {
        console.log(`📝 Creating missing category "${correctName}"...`);
        const newCat = {
          id: `CAT-${String(nextCatId).padStart(4, '0')}`,
          name: correctName,
          slug: correctName.toLowerCase().replace(/\s+/g, '-').replace(/[,&]/g, ''),
          description: '',
          icon: '',
          featured: false,
          productCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        categoriesToCreate.push(newCat);
        existingCategoryNames.add(correctName);
        nextCatId++;
      }
    }

    // Import new categories if any
    if (categoriesToCreate.length > 0) {
      const params = {
        RequestItems: {
          [CATEGORIES_TABLE]: categoriesToCreate.map(item => ({
            PutRequest: { Item: item }
          }))
        }
      };
      await docClient.send(new BatchWriteCommand(params));
      console.log(`   ✅ Created ${categoriesToCreate.length} categories\n`);
    }

    // Step 1: Get all products
    console.log('📊 Scanning products...');
    const productsResult = await docClient.send(new ScanCommand({
      TableName: PRODUCTS_TABLE
    }));
    const products = productsResult.Items || [];
    console.log(`   Found ${products.length} products\n`);

    // Step 2: Update products with wrong category names
    let updatedCount = 0;
    for (const [wrongName, correctName] of Object.entries(CATEGORY_MAPPING)) {
      const productsToUpdate = products.filter(p => p.category === wrongName);
      console.log(`📝 Updating ${productsToUpdate.length} products from "${wrongName}" to "${correctName}"...`);

      for (const product of productsToUpdate) {
        await docClient.send(new UpdateCommand({
          TableName: PRODUCTS_TABLE,
          Key: { id: product.id },
          UpdateExpression: 'SET category = :newCategory, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':newCategory': correctName,
            ':updatedAt': new Date().toISOString()
          }
        }));
        updatedCount++;
        console.log(`   ✓ Updated ${product.name}`);
      }
    }
    console.log(`   ✅ Updated ${updatedCount} products\n`);

    // Step 3: Update subcategories with wrong parent category
    console.log('📊 Scanning subcategories...');
    const subcatsResult = await docClient.send(new ScanCommand({
      TableName: SUBCATEGORIES_TABLE
    }));
    const subcategories = subcatsResult.Items || [];
    console.log(`   Found ${subcategories.length} subcategories\n`);

    let subcatUpdatedCount = 0;
    for (const [subcatName, correctParent] of Object.entries(SUBCATEGORY_UPDATES)) {
      const subcatsToUpdate = subcategories.filter(s => s.name === subcatName);
      console.log(`📝 Updating subcategory "${subcatName}" to parent "${correctParent}"...`);

      for (const subcat of subcatsToUpdate) {
        await docClient.send(new UpdateCommand({
          TableName: SUBCATEGORIES_TABLE,
          Key: { id: subcat.id },
          UpdateExpression: 'SET parentCategoryName = :newParent, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':newParent': correctParent,
            ':updatedAt': new Date().toISOString()
          }
        }));
        subcatUpdatedCount++;
        console.log(`   ✓ Updated subcategory ${subcat.name} (${subcat.id})`);
      }
    }
    console.log(`   ✅ Updated ${subcatUpdatedCount} subcategories\n`);

    // Step 4: Delete duplicate categories
    console.log('📊 Re-scanning categories for deletion...');
    const categoriesResult2 = await docClient.send(new ScanCommand({
      TableName: CATEGORIES_TABLE
    }));
    const allCategories = categoriesResult2.Items || [];
    console.log(`   Found ${allCategories.length} categories\n`);

    const categoriesToDelete = allCategories.filter(c => Object.keys(CATEGORY_MAPPING).includes(c.name));
    console.log(`🗑️  Deleting ${categoriesToDelete.length} duplicate categories...`);

    for (const category of categoriesToDelete) {
      await docClient.send(new DeleteCommand({
        TableName: CATEGORIES_TABLE,
        Key: { id: category.id }
      }));
      console.log(`   ✓ Deleted category "${category.name}" (${category.id})`);
    }
    console.log(`   ✅ Deleted ${categoriesToDelete.length} duplicate categories\n`);

    // Step 5: Verify the fix
    console.log('🔍 Verifying fix...');
    const verifyProducts = await docClient.send(new ScanCommand({
      TableName: PRODUCTS_TABLE
    }));
    const verifyCategories = await docClient.send(new ScanCommand({
      TableName: CATEGORIES_TABLE
    }));

    console.log('\n📊 Final state:');
    console.log(`   Total categories: ${verifyCategories.Items.length}`);
    verifyCategories.Items.forEach(cat => {
      const productCount = verifyProducts.Items.filter(p => p.category === cat.name).length;
      console.log(`      - ${cat.name} (${productCount} products)`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ Duplicate categories fixed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error fixing duplicate categories:', error);
    process.exit(1);
  }
}

// Run the fix
fixDuplicateCategories();
