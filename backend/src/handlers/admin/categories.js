const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { corsHeaders, successResponse, errorResponse } = require('../../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Get all categories with accurate product counts
 */
module.exports.getAllCategories = async (event) => {
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

/**
 * Create new category (Admin only)
 */
module.exports.createCategory = async (event) => {
  try {
    const { name, description, icon } = JSON.parse(event.body);

    if (!name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Category name is required' }),
      };
    }

    const category = {
      id: `CAT-${uuidv4()}`,
      name,
      description: description || '',
      icon: icon || '📦',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: process.env.CATEGORIES_TABLE,
      Item: category,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Category created successfully',
        category,
      }),
    };
  } catch (error) {
    console.error('Error creating category:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not create category', details: error.message }),
    };
  }
};

/**
 * Update category (Admin only)
 * If category name changes, updates all products using this category
 */
module.exports.updateCategory = async (event) => {
  try {
    const { id } = event.pathParameters;
    const updates = JSON.parse(event.body);

    // Check if category exists
    const getCommand = new GetCommand({
      TableName: process.env.CATEGORIES_TABLE,
      Key: { id },
    });
    const existing = await docClient.send(getCommand);

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Category not found' }),
      };
    }

    const oldCategoryName = existing.Item.name;
    const newCategoryName = updates.name;

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
      TableName: process.env.CATEGORIES_TABLE,
      Key: { id },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    // If category name changed, update all products using this category
    if (newCategoryName && newCategoryName !== oldCategoryName) {
      console.log(`Category name changed from "${oldCategoryName}" to "${newCategoryName}"`);

      // Find all products using the old category name
      const scanCommand = new ScanCommand({
        TableName: process.env.PRODUCTS_TABLE,
        FilterExpression: 'category = :oldName',
        ExpressionAttributeValues: {
          ':oldName': oldCategoryName,
        },
      });

      const productsResult = await docClient.send(scanCommand);
      const affectedProducts = productsResult.Items || [];

      if (affectedProducts.length > 0) {
        console.log(`Updating ${affectedProducts.length} products to new category name`);

        const updatePromises = affectedProducts.map(product => {
          const updateProductCommand = new UpdateCommand({
            TableName: process.env.PRODUCTS_TABLE,
            Key: { id: product.id },
            UpdateExpression: 'SET category = :newName, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':newName': newCategoryName,
              ':updatedAt': new Date().toISOString(),
            },
          });
          return docClient.send(updateProductCommand);
        });

        await Promise.all(updatePromises);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Category updated successfully',
        category: result.Attributes,
        updatedProducts: newCategoryName && newCategoryName !== oldCategoryName ?
          (await docClient.send(new ScanCommand({
            TableName: process.env.PRODUCTS_TABLE,
            FilterExpression: 'category = :oldName',
            ExpressionAttributeValues: { ':oldName': oldCategoryName },
          }))).Items?.length || 0 : 0,
      }),
    };
  } catch (error) {
    console.error('Error updating category:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not update category', details: error.message }),
    };
  }
};

/**
 * Ensure Uncategorised category exists
 */
const ensureUncategorisedCategory = async () => {
  try {
    // Check if Uncategorised category exists
    const scanCommand = new ScanCommand({
      TableName: process.env.CATEGORIES_TABLE,
      FilterExpression: '#name = :uncategorised',
      ExpressionAttributeNames: {
        '#name': 'name',
      },
      ExpressionAttributeValues: {
        ':uncategorised': 'Uncategorised',
      },
    });

    const result = await docClient.send(scanCommand);

    if (result.Items && result.Items.length > 0) {
      return; // Already exists
    }

    // Create Uncategorised category
    const category = {
      id: `CAT-${uuidv4()}`,
      name: 'Uncategorised',
      description: 'Products without a category',
      icon: '📦',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const putCommand = new PutCommand({
      TableName: process.env.CATEGORIES_TABLE,
      Item: category,
    });

    await docClient.send(putCommand);
    console.log('Created Uncategorised category');
  } catch (error) {
    console.error('Error ensuring Uncategorised category:', error);
    // Don't throw - we'll use the category name even if creation fails
  }
};

/**
 * Delete category (Admin only)
 * Automatically reassigns products to "Uncategorised"
 */
module.exports.deleteCategory = async (event) => {
  try {
    const { id } = event.pathParameters;

    // Get the category name before deletion
    const getCommand = new GetCommand({
      TableName: process.env.CATEGORIES_TABLE,
      Key: { id },
    });
    const categoryResult = await docClient.send(getCommand);

    if (!categoryResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Category not found' }),
      };
    }

    const categoryName = categoryResult.Item.name;

    // Ensure Uncategorised category exists
    await ensureUncategorisedCategory();

    // Find and delete all subcategories for this category
    const subCategoriesScanCommand = new ScanCommand({
      TableName: process.env.SUBCATEGORIES_TABLE,
      FilterExpression: 'parentCategoryName = :categoryName',
      ExpressionAttributeValues: {
        ':categoryName': categoryName,
      },
    });

    const subCategoriesResult = await docClient.send(subCategoriesScanCommand);
    const subcategoriesToDelete = subCategoriesResult.Items || [];

    if (subcategoriesToDelete.length > 0) {
      console.log(`Deleting ${subcategoriesToDelete.length} subcategories`);

      const deleteSubCategoryPromises = subcategoriesToDelete.map(subcat => {
        const deleteSubCatCommand = new DeleteCommand({
          TableName: process.env.SUBCATEGORIES_TABLE,
          Key: { id: subcat.id },
        });
        return docClient.send(deleteSubCatCommand);
      });

      await Promise.all(deleteSubCategoryPromises);
    }

    // Find all products using this category
    const scanCommand = new ScanCommand({
      TableName: process.env.PRODUCTS_TABLE,
      FilterExpression: 'category = :categoryName',
      ExpressionAttributeValues: {
        ':categoryName': categoryName,
      },
    });

    const productsResult = await docClient.send(scanCommand);
    const affectedProducts = productsResult.Items || [];

    // Update all products to Uncategorised
    if (affectedProducts.length > 0) {
      console.log(`Reassigning ${affectedProducts.length} products to Uncategorised`);

      const updatePromises = affectedProducts.map(product => {
        const updateCommand = new UpdateCommand({
          TableName: process.env.PRODUCTS_TABLE,
          Key: { id: product.id },
          UpdateExpression: 'SET category = :uncategorised, subCategory = :empty, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':uncategorised': 'Uncategorised',
            ':empty': '',
            ':updatedAt': new Date().toISOString(),
          },
        });
        return docClient.send(updateCommand);
      });

      await Promise.all(updatePromises);
    }

    // Delete the category
    const deleteCommand = new DeleteCommand({
      TableName: process.env.CATEGORIES_TABLE,
      Key: { id },
    });

    await docClient.send(deleteCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Category deleted successfully',
        reassignedProducts: affectedProducts.length,
      }),
    };
  } catch (error) {
    console.error('Error deleting category:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not delete category', details: error.message }),
    };
  }
};
