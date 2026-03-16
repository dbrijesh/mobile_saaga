const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { corsHeaders } = require('../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Get all categories with accurate product counts
 */
module.exports.getCategories = async (event) => {
  try {
    // Get all categories
    const categoriesCommand = new ScanCommand({
      TableName: process.env.CATEGORIES_TABLE,
    });
    const categoriesResult = await docClient.send(categoriesCommand);

    // Get all products to count by category
    const productsCommand = new ScanCommand({
      TableName: process.env.PRODUCTS_TABLE,
      ProjectionExpression: 'category',
    });
    const productsResult = await docClient.send(productsCommand);

    // Count products per category
    const productCounts = {};
    productsResult.Items.forEach(product => {
      const cat = product.category;
      productCounts[cat] = (productCounts[cat] || 0) + 1;
    });

    // Add accurate productCount to each category
    const categories = categoriesResult.Items.map(category => ({
      ...category,
      productCount: productCounts[category.name] || 0,
    })).sort((a, b) => a.name.localeCompare(b.name));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        categories,
        count: categories.length,
      }),
    };
  } catch (error) {
    console.error('Error getting categories:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve categories', details: error.message }),
    };
  }
};
