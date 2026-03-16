const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const ORDERS_TABLE = process.env.ORDERS_TABLE;
const CATEGORIES_TABLE = process.env.CATEGORIES_TABLE;
const SUBCATEGORIES_TABLE = process.env.SUBCATEGORIES_TABLE;

/**
 * Delete all items from a DynamoDB table
 */
async function deleteAllItemsFromTable(tableName, keyName) {
  try {
    console.log(`\n🗑️  Deleting all items from ${tableName}...`);

    // Scan all items
    const scanCommand = new ScanCommand({
      TableName: tableName,
    });

    const result = await docClient.send(scanCommand);
    const items = result.Items || [];

    if (items.length === 0) {
      console.log(`   ℹ️  Table is already empty`);
      return 0;
    }

    console.log(`   Found ${items.length} items to delete`);

    // Delete in batches of 25 (DynamoDB limit)
    const batches = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    let deletedCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      const deleteRequests = batch.map(item => ({
        DeleteRequest: {
          Key: { [keyName]: item[keyName] }
        }
      }));

      const params = {
        RequestItems: {
          [tableName]: deleteRequests
        }
      };

      await docClient.send(new BatchWriteCommand(params));
      deletedCount += batch.length;

      console.log(`   ✓ Deleted batch ${i + 1}/${batches.length} (${batch.length} items)`);
    }

    console.log(`   ✅ Successfully deleted ${deletedCount} items from ${tableName}`);
    return deletedCount;

  } catch (error) {
    console.error(`   ❌ Error deleting from ${tableName}:`, error.message);
    return 0;
  }
}

/**
 * Main function to delete all data
 */
async function deleteAllData() {
  console.log('🚨 WARNING: This will delete ALL data from the following tables:');
  console.log(`   - ${PRODUCTS_TABLE}`);
  console.log(`   - ${ORDERS_TABLE}`);
  console.log(`   - ${CATEGORIES_TABLE}`);
  console.log(`   - ${SUBCATEGORIES_TABLE}`);
  console.log('\n⏳ Starting deletion in 3 seconds...\n');

  // Wait 3 seconds to allow user to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));

  const startTime = Date.now();

  // Delete from all tables
  const productsDeleted = await deleteAllItemsFromTable(PRODUCTS_TABLE, 'id');
  const ordersDeleted = await deleteAllItemsFromTable(ORDERS_TABLE, 'orderId');
  const categoriesDeleted = await deleteAllItemsFromTable(CATEGORIES_TABLE, 'id');
  const subcategoriesDeleted = await deleteAllItemsFromTable(SUBCATEGORIES_TABLE, 'id');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(80));
  console.log('📊 Deletion Summary:');
  console.log('='.repeat(80));
  console.log(`Products deleted: ${productsDeleted}`);
  console.log(`Orders deleted: ${ordersDeleted}`);
  console.log(`Categories deleted: ${categoriesDeleted}`);
  console.log(`Subcategories deleted: ${subcategoriesDeleted}`);
  console.log(`Total items deleted: ${productsDeleted + ordersDeleted + categoriesDeleted + subcategoriesDeleted}`);
  console.log(`Time taken: ${duration}s`);
  console.log('\n✅ All data deleted successfully!\n');
}

// Run the script
deleteAllData().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
