const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

async function checkSubcategories() {
  const result = await docClient.send(new ScanCommand({
    TableName: 'saaga-online-api-products-dev',
    FilterExpression: 'category = :cat',
    ExpressionAttributeValues: {
      ':cat': 'Oil, Ghee & Masala'
    }
  }));

  const products = result.Items || [];
  console.log('Total Oil, Ghee & Masala products:', products.length);

  const subcategories = {};
  products.forEach(p => {
    const sub = p.subCategory || '(empty)';
    subcategories[sub] = (subcategories[sub] || 0) + 1;
  });

  console.log('\nSubcategory breakdown:');
  Object.entries(subcategories).forEach(([sub, count]) => {
    console.log(`  "${sub}": ${count} products`);
  });

  console.log('\nSample products with Oil subcategory:');
  const oilProducts = products.filter(p => p.subCategory && p.subCategory.toLowerCase().includes('oil'));
  oilProducts.slice(0, 3).forEach(p => {
    console.log(`  - ${p.name} | subCategory: "${p.subCategory}"`);
  });

  console.log('\nSample products with Powdered Spices:');
  const powderProducts = products.filter(p => p.subCategory && p.subCategory.toLowerCase().includes('powder'));
  powderProducts.slice(0, 3).forEach(p => {
    console.log(`  - ${p.name} | subCategory: "${p.subCategory}"`);
  });
}

checkSubcategories().catch(console.error);
