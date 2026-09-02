const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { corsHeaders } = require('../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

const getUserId = (event) => {
  return event.requestContext.authorizer.claims.sub;
};

/**
 * Get user's wishlist
 */
module.exports.getWishlist = async (event) => {
  try {
    const userId = getUserId(event);

    const command = new QueryCommand({
      TableName: process.env.WISHLIST_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    const result = await docClient.send(command);

    // Fetch product details for each wishlist item
    const itemsWithDetails = await Promise.all(
      result.Items.map(async (item) => {
        const productCommand = new GetCommand({
          TableName: process.env.PRODUCTS_TABLE,
          Key: { id: item.productId },
        });
        const productResult = await docClient.send(productCommand);

        return {
          ...item,
          product: productResult.Item,
        };
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        items: itemsWithDetails,
        itemCount: itemsWithDetails.length,
      }),
    };
  } catch (error) {
    console.error('Error getting wishlist:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve wishlist', details: error.message }),
    };
  }
};

/**
 * Add item to wishlist
 */
module.exports.addToWishlist = async (event) => {
  try {
    const userId = getUserId(event);
    const { productId } = JSON.parse(event.body);

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

    // Already in wishlist — return as-is (idempotent)
    const existingCommand = new GetCommand({
      TableName: process.env.WISHLIST_TABLE,
      Key: { userId, productId },
    });
    const existingResult = await docClient.send(existingCommand);

    if (existingResult.Item) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          message: 'Item already in wishlist',
          item: existingResult.Item,
        }),
      };
    }

    const wishlistItem = {
      userId,
      productId,
      addedAt: new Date().toISOString(),
    };

    await docClient.send(new PutCommand({
      TableName: process.env.WISHLIST_TABLE,
      Item: wishlistItem,
    }));

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Item added to wishlist',
        item: wishlistItem,
      }),
    };
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not add item to wishlist', details: error.message }),
    };
  }
};

/**
 * Remove item from wishlist
 */
module.exports.removeFromWishlist = async (event) => {
  try {
    const userId = getUserId(event);
    const { itemId } = event.pathParameters;

    await docClient.send(new DeleteCommand({
      TableName: process.env.WISHLIST_TABLE,
      Key: { userId, productId: itemId },
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Item removed from wishlist' }),
    };
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not remove item from wishlist', details: error.message }),
    };
  }
};

/**
 * Clear entire wishlist
 */
module.exports.clearWishlist = async (event) => {
  try {
    const userId = getUserId(event);

    const result = await docClient.send(new QueryCommand({
      TableName: process.env.WISHLIST_TABLE,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    }));

    await Promise.all(
      result.Items.map(item =>
        docClient.send(new DeleteCommand({
          TableName: process.env.WISHLIST_TABLE,
          Key: { userId, productId: item.productId },
        }))
      )
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Wishlist cleared' }),
    };
  } catch (error) {
    console.error('Error clearing wishlist:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not clear wishlist', details: error.message }),
    };
  }
};

/**
 * Move an item from the wishlist to the cart.
 * Removes the wishlist entry and adds/increments the cart entry.
 * Body: { quantity? } — defaults to 1.
 */
module.exports.moveToCart = async (event) => {
  try {
    const userId = getUserId(event);
    const { itemId } = event.pathParameters;
    const body = event.body ? JSON.parse(event.body) : {};
    const quantity = body.quantity || 1;

    const wishlistCommand = new GetCommand({
      TableName: process.env.WISHLIST_TABLE,
      Key: { userId, productId: itemId },
    });
    const wishlistResult = await docClient.send(wishlistCommand);

    if (!wishlistResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Item not found in wishlist' }),
      };
    }

    const existingCartCommand = new GetCommand({
      TableName: process.env.CART_TABLE,
      Key: { userId, productId: itemId },
    });
    const existingCartResult = await docClient.send(existingCartCommand);

    let cartItem;
    if (existingCartResult.Item) {
      const updateResult = await docClient.send(new UpdateCommand({
        TableName: process.env.CART_TABLE,
        Key: { userId, productId: itemId },
        UpdateExpression: 'SET quantity = quantity + :qty, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':qty': quantity,
          ':updatedAt': new Date().toISOString(),
        },
        ReturnValues: 'ALL_NEW',
      }));
      cartItem = updateResult.Attributes;
    } else {
      cartItem = {
        userId,
        productId: itemId,
        quantity,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await docClient.send(new PutCommand({
        TableName: process.env.CART_TABLE,
        Item: cartItem,
      }));
    }

    await docClient.send(new DeleteCommand({
      TableName: process.env.WISHLIST_TABLE,
      Key: { userId, productId: itemId },
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Item moved to cart',
        item: cartItem,
      }),
    };
  } catch (error) {
    console.error('Error moving item to cart:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not move item to cart', details: error.message }),
    };
  }
};
