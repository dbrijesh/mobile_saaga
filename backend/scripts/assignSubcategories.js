const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

/**
 * Intelligently assign subcategory based on product name and category
 */
function assignSubcategory(productName, category) {
  const name = productName.toLowerCase();

  // Oils & Ghee
  if (category === 'Oils & Ghee') {
    if (name.includes('ghee')) return 'Ghee';
    if (name.includes('oil')) return 'Cooking Oil';
  }

  // Rice & Grains
  if (category === 'Rice & Grains') {
    if (name.includes('basmati')) return 'Basmati Rice';
    if (name.includes('brown rice')) return 'Brown Rice';
    if (name.includes('rice')) return 'Other Rice';
  }

  // Spices
  if (category === 'Spices') {
    // Ground/Powder spices
    if (name.includes('powder') || name.includes('ground') ||
        name.includes('turmeric') || name.includes('chilli') ||
        name.includes('coriander') || name.includes('cumin') ||
        name.includes('haldi') || name.includes('mirchi')) {
      return 'Ground Spices';
    }
    // Spice mixes/masalas
    if (name.includes('masala') || name.includes('mix') ||
        name.includes('garam') || name.includes('curry')) {
      return 'Spice Mixes';
    }
    // Whole spices (default for spices)
    return 'Whole Spices';
  }

  // Lentils & Pulses
  if (category === 'Lentils & Pulses') {
    if (name.includes('chickpea') || name.includes('chana') ||
        name.includes('kabuli') || name.includes('garbanzo')) {
      return 'Chickpeas';
    }
    if (name.includes('dal') || name.includes('dhal') ||
        name.includes('lentil') || name.includes('toor') ||
        name.includes('moong') || name.includes('urad') ||
        name.includes('masoor')) {
      return 'Dal';
    }
    return 'Other Pulses';
  }

  // Flours
  if (category === 'Flours') {
    if (name.includes('wheat') || name.includes('atta')) {
      return 'Wheat Flour';
    }
    return 'Other Flours';
  }

  // Snacks
  if (category === 'Snacks') {
    if (name.includes('sweet') || name.includes('halwa') ||
        name.includes('ladoo') || name.includes('jaggery')) {
      return 'Sweet Snacks';
    }
    return 'Savory Snacks';
  }

  // Beverages
  if (category === 'Beverages') {
    if (name.includes('tea') || name.includes('chai')) {
      return 'Tea';
    }
    if (name.includes('coffee')) {
      return 'Coffee';
    }
    return 'Other Beverages';
  }

  // Pickles & Condiments
  if (category === 'Pickles & Condiments') {
    if (name.includes('pickle') || name.includes('achar')) {
      return 'Pickles';
    }
    if (name.includes('chutney') || name.includes('sauce')) {
      return 'Chutneys & Sauces';
    }
    return 'Pickles'; // Default to pickles
  }

  // No subcategory assigned
  return '';
}

/**
 * Update products with intelligent subcategory assignments
 */
async function assignSubcategoriesToProducts() {
  try {
    console.log('🔍 Fetching all products from DynamoDB...');

    // Scan all products
    const scanCommand = new ScanCommand({
      TableName: PRODUCTS_TABLE,
    });

    const result = await docClient.send(scanCommand);
    const products = result.Items || [];

    console.log(`Found ${products.length} products to process\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    const categoryStats = {};

    // Process each product
    for (const product of products) {
      const subcategory = assignSubcategory(product.name, product.category);

      if (!subcategory) {
        skippedCount++;
        console.log(`   ⊘ Skipped: "${product.name}" (${product.category}) - No matching subcategory`);
        continue;
      }

      // Update product with subcategory
      const updateCommand = new UpdateCommand({
        TableName: PRODUCTS_TABLE,
        Key: { id: product.id },
        UpdateExpression: 'SET subCategory = :subCategory, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':subCategory': subcategory,
          ':updatedAt': new Date().toISOString(),
        },
      });

      await docClient.send(updateCommand);
      updatedCount++;

      // Track stats
      const key = `${product.category} → ${subcategory}`;
      categoryStats[key] = (categoryStats[key] || 0) + 1;

      console.log(`   ✓ Updated: "${product.name}" → ${subcategory}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 Assignment Summary:');
    console.log('='.repeat(80));
    console.log(`Total products processed: ${products.length}`);
    console.log(`Products updated: ${updatedCount}`);
    console.log(`Products skipped: ${skippedCount}`);

    console.log('\n📈 Breakdown by Category → Subcategory:');
    Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([key, count]) => {
        console.log(`   ${key}: ${count} products`);
      });

    console.log('\n✅ Subcategory assignment completed successfully!\n');

  } catch (error) {
    console.error('❌ Error assigning subcategories:', error);
    process.exit(1);
  }
}

// Run the script
assignSubcategoriesToProducts();
