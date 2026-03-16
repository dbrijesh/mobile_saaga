const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { corsHeaders } = require('../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Get all subcategories or filter by parent category
 * Public endpoint: GET /subcategories?category={categoryName}
 */
module.exports.getSubCategories = async (event) => {
  try {
    const { category } = event.queryStringParameters || {};

    if (category) {
      // Get subcategories for specific category using GSI
      const command = new QueryCommand({
        TableName: process.env.SUBCATEGORIES_TABLE,
        IndexName: 'ParentCategoryIndex',
        KeyConditionExpression: 'parentCategoryName = :categoryName',
        ExpressionAttributeValues: {
          ':categoryName': decodeURIComponent(category),
        },
      });
      const result = await docClient.send(command);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          subcategories: result.Items.sort((a, b) => a.name.localeCompare(b.name)),
          count: result.Items.length,
        }),
      };
    }

    // Get all subcategories
    const command = new ScanCommand({
      TableName: process.env.SUBCATEGORIES_TABLE,
    });
    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        subcategories: result.Items.sort((a, b) => a.name.localeCompare(b.name)),
        count: result.Items.length,
      }),
    };
  } catch (error) {
    console.error('Error getting subcategories:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve subcategories', details: error.message }),
    };
  }
};
