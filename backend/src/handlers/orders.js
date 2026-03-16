const { corsHeaders } = require('../utils/cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { applyCoupon } = require('./coupons');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Validate and reserve a shipping date for an order
 */
const validateAndReserveShippingDate = async (shippingDateId) => {
  if (!shippingDateId) {
    return null; // Shipping date is optional
  }

  try {
    // Get the shipping date
    const getCommand = new GetCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId },
    });

    const result = await docClient.send(getCommand);

    if (!result.Item) {
      throw new Error('Selected shipping date not found');
    }

    const shippingDate = result.Item;

    // Check if date is active and has capacity
    if (shippingDate.status !== 'active') {
      throw new Error('Selected shipping date is not available');
    }

    if (shippingDate.currentOrders >= shippingDate.capacity) {
      throw new Error('Selected shipping date is full');
    }

    // Increment currentOrders
    const newCurrentOrders = shippingDate.currentOrders + 1;
    const newStatus = newCurrentOrders >= shippingDate.capacity ? 'full' : 'active';

    const updateCommand = new UpdateCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId },
      UpdateExpression: 'SET currentOrders = :currentOrders, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':currentOrders': newCurrentOrders,
        ':status': newStatus,
        ':updatedAt': new Date().toISOString(),
      },
    });

    await docClient.send(updateCommand);

    return shippingDate.date;
  } catch (error) {
    throw error;
  }
};

const headers = corsHeaders;

const getUserId = (event) => {
  return event.requestContext.authorizer.claims.sub;
};

/**
 * Create a new order
 */
module.exports.createOrder = async (event) => {
  try {
    const userId = getUserId(event);
    const {
      items,
      shippingAddress,
      paymentMethod,
      paymentIntentId,
      totalAmount,
      notes,
      shippingDateId,
      couponId,
      couponCode,
      discountAmount
    } = JSON.parse(event.body);

    if (!items || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Order must contain at least one item' }),
      };
    }

    if (!shippingAddress) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Shipping address is required' }),
      };
    }

    // Validate and reserve shipping date if provided
    let selectedShippingDate = null;
    try {
      selectedShippingDate = await validateAndReserveShippingDate(shippingDateId);
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: error.message }),
      };
    }

    // Apply coupon if provided
    if (couponId) {
      const applied = await applyCoupon(couponId);
      if (!applied) {
        console.error('Failed to apply coupon, but continuing with order');
      }
    }

    const orderId = uuidv4();
    const order = {
      orderId,
      userId,
      items,
      shippingAddress,
      paymentMethod: paymentMethod || 'stripe',
      paymentIntentId,
      totalAmount: parseFloat(totalAmount),
      status: 'pending',
      paymentStatus: 'paid',
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
    };

    // Add shipping date fields if provided
    if (shippingDateId) {
      order.shippingDateId = shippingDateId;
      order.selectedShippingDate = selectedShippingDate;
    }

    // Add coupon fields if provided
    if (couponId && couponCode) {
      order.couponId = couponId;
      order.couponCode = couponCode;
      order.discountAmount = discountAmount ? parseFloat(discountAmount) : 0;
      order.subtotal = parseFloat(totalAmount) + parseFloat(discountAmount || 0);
    }

    const command = new PutCommand({
      TableName: process.env.ORDERS_TABLE,
      Item: order,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Order created successfully',
        order,
      }),
    };
  } catch (error) {
    console.error('Error creating order:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not create order', details: error.message }),
    };
  }
};

/**
 * Get user's orders
 */
module.exports.getOrders = async (event) => {
  try {
    const userId = getUserId(event);
    const { limit = '20', status } = event.queryStringParameters || {};

    const command = new QueryCommand({
      TableName: process.env.ORDERS_TABLE,
      IndexName: 'UserOrdersIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Sort by createdAt descending
      Limit: parseInt(limit),
    });

    const result = await docClient.send(command);

    let orders = result.Items;

    // Filter by status if provided
    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        orders,
        count: orders.length,
      }),
    };
  } catch (error) {
    console.error('Error getting orders:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve orders', details: error.message }),
    };
  }
};

/**
 * Get order by ID
 */
module.exports.getOrderById = async (event) => {
  try {
    const userId = getUserId(event);
    const { orderId } = event.pathParameters;

    const command = new GetCommand({
      TableName: process.env.ORDERS_TABLE,
      Key: { orderId },
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Order not found' }),
      };
    }

    // Verify order belongs to user
    if (result.Item.userId !== userId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error('Error getting order:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve order', details: error.message }),
    };
  }
};

/**
 * Update order status
 */
/**
 * Cancel an order (customer-facing endpoint)
 */
module.exports.cancelOrder = async (event) => {
  try {
    const userId = getUserId(event);
    const { orderId } = event.pathParameters;

    // Get the order to verify ownership and current status
    const getCommand = new GetCommand({
      TableName: process.env.ORDERS_TABLE,
      Key: { orderId },
    });

    const orderResult = await docClient.send(getCommand);

    if (!orderResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Order not found' }),
      };
    }

    const order = orderResult.Item;

    // Verify user owns this order
    if (order.userId !== userId) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You do not have permission to cancel this order' }),
      };
    }

    // Check if order can be cancelled (not shipped or delivered)
    const nonCancellableStatuses = ['shipped', 'delivered', 'cancelled'];
    if (nonCancellableStatuses.includes(order.status)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Cannot cancel order with status: ${order.status}` }),
      };
    }

    // Update order status to cancelled
    const updateCommand = new UpdateCommand({
      TableName: process.env.ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, cancelledAt = :cancelledAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'cancelled',
        ':updatedAt': new Date().toISOString(),
        ':cancelledAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(updateCommand);

    // If order had a shipping date, decrement the count
    if (order.shippingDateId) {
      try {
        const releaseCommand = new UpdateCommand({
          TableName: process.env.SHIPPING_DATES_TABLE,
          Key: { shippingDateId: order.shippingDateId },
          UpdateExpression: 'SET currentOrders = currentOrders - :dec, #status = :status, updatedAt = :updatedAt',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':dec': 1,
            ':status': 'active', // Set back to active since there's now capacity
            ':updatedAt': new Date().toISOString(),
          },
        });
        await docClient.send(releaseCommand);
      } catch (shippingError) {
        console.error('Error releasing shipping date capacity:', shippingError);
        // Don't fail the cancellation if this fails
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Order cancelled successfully',
        order: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error cancelling order:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not cancel order', details: error.message }),
    };
  }
};

module.exports.updateOrderStatus = async (event) => {
  try {
    const { orderId } = event.pathParameters;
    const { status, trackingNumber } = JSON.parse(event.body);

    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }),
      };
    }

    const updateExpression = ['SET #status = :status', 'updatedAt = :updatedAt'];
    const expressionAttributeValues = {
      ':status': status,
      ':updatedAt': new Date().toISOString(),
    };
    const expressionAttributeNames = {
      '#status': 'status',
    };

    if (trackingNumber) {
      updateExpression.push('trackingNumber = :trackingNumber');
      expressionAttributeValues[':trackingNumber'] = trackingNumber;
    }

    const command = new UpdateCommand({
      TableName: process.env.ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Order status updated',
        order: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error updating order status:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not update order status', details: error.message }),
    };
  }
};
