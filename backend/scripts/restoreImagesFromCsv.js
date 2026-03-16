const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const fs = require('fs');
const path = require('path');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

/**
 * Parse CSV file
 */
function parseCsv(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Parse CSV line (handling commas in quoted fields)
    const values = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Push last value

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return data;
}

/**
 * Restore product images from CSV export
 */
async function restoreImagesFromCsv() {
  try {
    console.log('🔍 Reading CSV file...');

    const csvPath = path.join(__dirname, '../../inventory_2026-01-19.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('❌ CSV file not found at:', csvPath);
      process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const csvData = parseCsv(csvContent);

    console.log(`Found ${csvData.length} products in CSV\n`);

    // Get all products from DynamoDB
    console.log('📊 Fetching products from DynamoDB...');
    const scanCommand = new ScanCommand({
      TableName: PRODUCTS_TABLE,
    });
    const result = await docClient.send(scanCommand);
    const products = result.Items || [];

    console.log(`Found ${products.length} products in DynamoDB\n`);

    // Create SKU to product ID mapping
    const skuToProductMap = {};
    products.forEach(product => {
      if (product.sku) {
        skuToProductMap[product.sku] = product.id;
      }
    });

    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;

    // Update products with image URLs from CSV
    for (const row of csvData) {
      const sku = row['SKU'];
      const imageUrl = row['Image URL'];

      if (!sku) {
        skippedCount++;
        continue;
      }

      // Find product by SKU
      const productId = skuToProductMap[sku];

      if (!productId) {
        console.log(`   ⚠ SKU not found in DB: ${sku}`);
        notFoundCount++;
        continue;
      }

      // Skip if no image URL
      if (!imageUrl || imageUrl.trim() === '') {
        skippedCount++;
        console.log(`   ⊘ No image URL for: ${sku}`);
        continue;
      }

      // Update product with image URL
      try {
        const updateCommand = new UpdateCommand({
          TableName: PRODUCTS_TABLE,
          Key: { id: productId },
          UpdateExpression: 'SET imageUrl = :imageUrl, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':imageUrl': imageUrl,
            ':updatedAt': new Date().toISOString(),
          },
        });

        await docClient.send(updateCommand);
        updatedCount++;
        console.log(`   ✓ Updated: ${sku} → ${row['Name']}`);
      } catch (error) {
        console.error(`   ❌ Error updating ${sku}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Image Restoration Summary:');
    console.log('='.repeat(80));
    console.log(`Total products in CSV: ${csvData.length}`);
    console.log(`Products updated: ${updatedCount}`);
    console.log(`Products skipped (no image): ${skippedCount}`);
    console.log(`Products not found in DB: ${notFoundCount}`);
    console.log('\n✅ Image restoration completed successfully!\n');

  } catch (error) {
    console.error('❌ Error restoring images:', error);
    process.exit(1);
  }
}

// Run the script
restoreImagesFromCsv();
