const { corsHeaders } = require('../utils/cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Update product inventory (Admin only)
 */
module.exports.updateInventory = async (event) => {
  try {
    const { productId } = event.pathParameters;
    const { stock, operation = 'set' } = JSON.parse(event.body);

    // Check if product exists
    const getCommand = new GetCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: { id: productId },
    });
    const existing = await docClient.send(getCommand);

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Product not found' }),
      };
    }

    let updateExpression;
    let expressionAttributeValues;

    switch (operation) {
      case 'add':
        updateExpression = 'SET stock = stock + :stock, inStock = :inStock, updatedAt = :updatedAt';
        expressionAttributeValues = {
          ':stock': stock,
          ':inStock': (existing.Item.stock + stock) > 0,
          ':updatedAt': new Date().toISOString(),
        };
        break;
      case 'subtract':
        updateExpression = 'SET stock = stock - :stock, inStock = :inStock, updatedAt = :updatedAt';
        expressionAttributeValues = {
          ':stock': stock,
          ':inStock': (existing.Item.stock - stock) > 0,
          ':updatedAt': new Date().toISOString(),
        };
        break;
      case 'set':
      default:
        updateExpression = 'SET stock = :stock, inStock = :inStock, updatedAt = :updatedAt';
        expressionAttributeValues = {
          ':stock': stock,
          ':inStock': stock > 0,
          ':updatedAt': new Date().toISOString(),
        };
        break;
    }

    const command = new UpdateCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: { id: productId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Inventory updated successfully',
        product: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error updating inventory:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not update inventory', details: error.message }),
    };
  }
};
