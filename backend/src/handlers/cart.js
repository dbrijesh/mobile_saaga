const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { corsHeaders } = require('../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

const getUserId = (event) => {
  return event.requestContext.authorizer.claims.sub;
};

/**
 * Get user's cart
 */
module.exports.getCart = async (event) => {
  try {
    const userId = getUserId(event);

    const command = new QueryCommand({
      TableName: process.env.CART_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    const result = await docClient.send(command);

    // Fetch product details for each cart item
    const cartItemsWithDetails = await Promise.all(
      result.Items.map(async (item) => {
        const productCommand = new GetCommand({
          TableName: process.env.PRODUCTS_TABLE,
          Key: { id: item.productId },
        });
        const productResult = await docClient.send(productCommand);

        return {
          ...item,
          product: productResult.Item,
          subtotal: parseFloat((productResult.Item.price * item.quantity).toFixed(2)),
        };
      })
    );

    const total = cartItemsWithDetails.reduce((sum, item) => sum + item.subtotal, 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: cartItemsWithDetails,
        itemCount: cartItemsWithDetails.length,
        total: parseFloat(total.toFixed(2)),
      }),
    };
  } catch (error) {
    console.error('Error getting cart:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve cart', details: error.message }),
    };
  }
};

/**
 * Add item to cart
 */
module.exports.addToCart = async (event) => {
  try {
    const userId = getUserId(event);
    const { productId, quantity = 1 } = JSON.parse(event.body);

    if (!productId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'productId is required' }),
      };
    }

    // Check if product exists
    const productCommand = new GetCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: { id: productId },
    });
    const productResult = await docClient.send(productCommand);

    if (!productResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Product not found' }),
      };
    }

    // Check if item already in cart
    const existingCommand = new GetCommand({
      TableName: process.env.CART_TABLE,
      Key: { userId, productId },
    });
    const existingResult = await docClient.send(existingCommand);

    if (existingResult.Item) {
      // Update quantity
      const updateCommand = new UpdateCommand({
        TableName: process.env.CART_TABLE,
        Key: { userId, productId },
        UpdateExpression: 'SET quantity = quantity + :qty, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':qty': quantity,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      });
      const updateResult = await docClient.send(updateCommand);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Cart updated',
          item: updateResult.Attributes,
        }),
      };
    }

    // Add new item to cart
    const cartItem = {
      userId,
      productId,
      quantity,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: process.env.CART_TABLE,
      Item: cartItem,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Item added to cart',
        item: cartItem,
      }),
    };
  } catch (error) {
    console.error('Error adding to cart:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not add item to cart', details: error.message }),
    };
  }
};

/**
 * Update cart item quantity
 */
module.exports.updateCartItem = async (event) => {
  try {
    const userId = getUserId(event);
    const { itemId } = event.pathParameters;
    const { quantity } = JSON.parse(event.body);

    if (quantity < 1) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Quantity must be at least 1' }),
      };
    }

    const command = new UpdateCommand({
      TableName: process.env.CART_TABLE,
      Key: { userId, productId: itemId },
      UpdateExpression: 'SET quantity = :qty, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':qty': quantity,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Cart item updated',
        item: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error updating cart item:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not update cart item', details: error.message }),
    };
  }
};

/**
 * Remove item from cart
 */
module.exports.removeFromCart = async (event) => {
  try {
    const userId = getUserId(event);
    const { itemId } = event.pathParameters;

    const command = new DeleteCommand({
      TableName: process.env.CART_TABLE,
      Key: { userId, productId: itemId },
    });

    await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Item removed from cart' }),
    };
  } catch (error) {
    console.error('Error removing from cart:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not remove item from cart', details: error.message }),
    };
  }
};

/**
 * Clear entire cart
 */
module.exports.clearCart = async (event) => {
  try {
    const userId = getUserId(event);

    // Get all cart items
    const queryCommand = new QueryCommand({
      TableName: process.env.CART_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    const result = await docClient.send(queryCommand);

    // Delete each item
    await Promise.all(
      result.Items.map(item =>
        docClient.send(new DeleteCommand({
          TableName: process.env.CART_TABLE,
          Key: { userId, productId: item.productId },
        }))
      )
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Cart cleared' }),
    };
  } catch (error) {
    console.error('Error clearing cart:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not clear cart', details: error.message }),
    };
  }
};
