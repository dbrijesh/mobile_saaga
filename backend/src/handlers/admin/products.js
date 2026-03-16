const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { corsHeaders, successResponse, errorResponse } = require('../../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Create new product (Admin only)
 */
module.exports.createProduct = async (event) => {
  try {
    const productData = JSON.parse(event.body);

    const product = {
      id: `PROD-${uuidv4()}`,
      ...productData,
      price: parseFloat(productData.price),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Item: product,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Product created successfully',
        product,
      }),
    };
  } catch (error) {
    console.error('Error creating product:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not create product', details: error.message }),
    };
  }
};

/**
 * Update product (Admin only)
 */
module.exports.updateProduct = async (event) => {
  try {
    console.log('Update product request:', JSON.stringify(event, null, 2));

    const { id } = event.pathParameters;
    const updates = JSON.parse(event.body);

    console.log('Product ID:', id);
    console.log('Updates:', JSON.stringify(updates, null, 2));

    // Check if product exists
    const getCommand = new GetCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: { id },
    });
    const existing = await docClient.send(getCommand);

    if (!existing.Item) {
      console.log('Product not found:', id);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Product not found' }),
      };
    }

    // Build update expression
    const updateExpression = [];
    const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };
    const expressionAttributeNames = { '#updatedAt': 'updatedAt' };

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt' && updates[key] !== undefined && updates[key] !== null) {
        updateExpression.push(`#${key} = :${key}`);
        if (key === 'price') {
          expressionAttributeValues[`:${key}`] = parseFloat(updates[key]);
        } else if (key === 'stock') {
          expressionAttributeValues[`:${key}`] = parseInt(updates[key]);
        } else {
          expressionAttributeValues[`:${key}`] = updates[key];
        }
        expressionAttributeNames[`#${key}`] = key;
      }
    });

    updateExpression.push('#updatedAt = :updatedAt');

    console.log('Update expression:', updateExpression.join(', '));
    console.log('Expression attribute values:', JSON.stringify(expressionAttributeValues, null, 2));
    console.log('Expression attribute names:', JSON.stringify(expressionAttributeNames, null, 2));

    const command = new UpdateCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: { id },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    console.log('Product updated successfully:', id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Product updated successfully',
        product: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error updating product:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Could not update product',
        details: error.message,
        name: error.name,
        stack: error.stack
      }),
    };
  }
};

/**
 * Delete product (Admin only)
 */
module.exports.deleteProduct = async (event) => {
  try {
    const { id } = event.pathParameters;

    const command = new DeleteCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: { id },
    });

    await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Product deleted successfully' }),
    };
  } catch (error) {
    console.error('Error deleting product:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not delete product', details: error.message }),
    };
  }
};
