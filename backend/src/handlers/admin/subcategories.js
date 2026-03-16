const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { corsHeaders } = require('../../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Get all subcategories (Admin)
 */
module.exports.getAllSubCategories = async (event) => {
  try {
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

/**
 * Create subcategory (Admin)
 */
module.exports.createSubCategory = async (event) => {
  try {
    const { name, parentCategoryName, description, icon } = JSON.parse(event.body);

    if (!name || !parentCategoryName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Subcategory name and parent category are required' }),
      };
    }

    const subcategory = {
      id: `SUBCAT-${uuidv4()}`,
      name,
      parentCategoryName,
      description: description || '',
      icon: icon || '📂',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: process.env.SUBCATEGORIES_TABLE,
      Item: subcategory,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Subcategory created successfully',
        subcategory,
      }),
    };
  } catch (error) {
    console.error('Error creating subcategory:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not create subcategory', details: error.message }),
    };
  }
};

/**
 * Update subcategory (Admin)
 * If name changes, updates all products using this subcategory
 */
module.exports.updateSubCategory = async (event) => {
  try {
    const { id } = event.pathParameters;
    const updates = JSON.parse(event.body);

    // Check if subcategory exists
    const getCommand = new GetCommand({
      TableName: process.env.SUBCATEGORIES_TABLE,
      Key: { id },
    });
    const existing = await docClient.send(getCommand);

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Subcategory not found' }),
      };
    }

    const oldSubCategoryName = existing.Item.name;
    const oldParentCategoryName = existing.Item.parentCategoryName;
    const newSubCategoryName = updates.name;

    // Build update expression
    const updateExpression = [];
    const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };
    const expressionAttributeNames = { '#updatedAt': 'updatedAt' };

    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt' && updates[key] !== undefined && updates[key] !== null) {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = updates[key];
        expressionAttributeNames[`#${key}`] = key;
      }
    });

    updateExpression.push('#updatedAt = :updatedAt');

    const command = new UpdateCommand({
      TableName: process.env.SUBCATEGORIES_TABLE,
      Key: { id },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    let updatedProducts = 0;

    // If subcategory name changed, update all products using this subcategory
    if (newSubCategoryName && newSubCategoryName !== oldSubCategoryName) {
      console.log(`Subcategory name changed from "${oldSubCategoryName}" to "${newSubCategoryName}"`);

      const scanCommand = new ScanCommand({
        TableName: process.env.PRODUCTS_TABLE,
        FilterExpression: 'subCategory = :oldName AND category = :categoryName',
        ExpressionAttributeValues: {
          ':oldName': oldSubCategoryName,
          ':categoryName': oldParentCategoryName,
        },
      });

      const productsResult = await docClient.send(scanCommand);
      const affectedProducts = productsResult.Items || [];

      if (affectedProducts.length > 0) {
        console.log(`Updating ${affectedProducts.length} products to new subcategory name`);

        const updatePromises = affectedProducts.map(product => {
          const updateProductCommand = new UpdateCommand({
            TableName: process.env.PRODUCTS_TABLE,
            Key: { id: product.id },
            UpdateExpression: 'SET subCategory = :newName, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':newName': newSubCategoryName,
              ':updatedAt': new Date().toISOString(),
            },
          });
          return docClient.send(updateProductCommand);
        });

        await Promise.all(updatePromises);
        updatedProducts = affectedProducts.length;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Subcategory updated successfully',
        subcategory: result.Attributes,
        updatedProducts,
      }),
    };
  } catch (error) {
    console.error('Error updating subcategory:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not update subcategory', details: error.message }),
    };
  }
};

/**
 * Delete subcategory (Admin)
 * Clears subCategory field from products using this subcategory
 */
module.exports.deleteSubCategory = async (event) => {
  try {
    const { id } = event.pathParameters;

    // Get subcategory details before deletion
    const getCommand = new GetCommand({
      TableName: process.env.SUBCATEGORIES_TABLE,
      Key: { id },
    });
    const subcategoryResult = await docClient.send(getCommand);

    if (!subcategoryResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Subcategory not found' }),
      };
    }

    const subcategoryName = subcategoryResult.Item.name;
    const parentCategoryName = subcategoryResult.Item.parentCategoryName;

    // Find all products using this subcategory
    const scanCommand = new ScanCommand({
      TableName: process.env.PRODUCTS_TABLE,
      FilterExpression: 'subCategory = :subcategoryName AND category = :categoryName',
      ExpressionAttributeValues: {
        ':subcategoryName': subcategoryName,
        ':categoryName': parentCategoryName,
      },
    });

    const productsResult = await docClient.send(scanCommand);
    const affectedProducts = productsResult.Items || [];

    // Clear subcategory from products (set to empty string)
    if (affectedProducts.length > 0) {
      console.log(`Clearing subcategory from ${affectedProducts.length} products`);

      const updatePromises = affectedProducts.map(product => {
        const updateCommand = new UpdateCommand({
          TableName: process.env.PRODUCTS_TABLE,
          Key: { id: product.id },
          UpdateExpression: 'SET subCategory = :empty, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':empty': '',
            ':updatedAt': new Date().toISOString(),
          },
        });
        return docClient.send(updateCommand);
      });

      await Promise.all(updatePromises);
    }

    // Delete the subcategory
    const deleteCommand = new DeleteCommand({
      TableName: process.env.SUBCATEGORIES_TABLE,
      Key: { id },
    });

    await docClient.send(deleteCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Subcategory deleted successfully',
        clearedProducts: affectedProducts.length,
      }),
    };
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not delete subcategory', details: error.message }),
    };
  }
};
