const { corsHeaders } = require('../utils/cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { sendOrderConfirmationEmail, sendOrderStatusEmail } = require('../utils/email');
const { createOrderRecord } = require('../utils/createOrderRecord');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

const getUserId = (event) => event.requestContext.authorizer.claims.sub;
const getUserEmail = (event) => event.requestContext.authorizer.claims.email;

// Orders created before customerEmail was stored on the order need a fallback lookup
const resolveCustomerEmail = async (order) => {
  if (order.customerEmail) return order.customerEmail;
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: process.env.USERS_TABLE, Key: { userId: order.userId } })
    );
    return result.Item?.email || null;
  } catch (err) {
    console.error('Could not resolve customer email for status update:', err.message);
    return null;
  }
};

/**
 * Create a new order (legacy endpoint — new checkout uses POST /payment/confirm instead)
 */
module.exports.createOrder = async (event) => {
  try {
    const userId = getUserId(event);
    const userEmail = getUserEmail(event);
    const {
      items,
      shippingAddress,
      paymentIntentId,
      totalAmount,
      notes,
      shippingDateId,
      couponId,
      couponCode,
      discountAmount,
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

    const orderId = paymentIntentId || uuidv4();

    let result;
    try {
      result = await createOrderRecord(orderId, userId, {
        items, shippingAddress, totalAmount, notes,
        shippingDateId, couponId, couponCode, discountAmount, paymentIntentId,
        customerEmail: userEmail,
      });
    } catch (error) {
      if (error.message.includes('shipping date')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
      }
      throw error;
    }

    if (!result.alreadyExisted) {
      try {
        await sendOrderConfirmationEmail(result.order, userEmail);
      } catch (err) {
        console.error('Order email error:', err.message);
      }
    }

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ message: 'Order created successfully', order: result.order }),
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

    try {
      const email = await resolveCustomerEmail(result.Attributes);
      await sendOrderStatusEmail(result.Attributes, email, 'cancelled');
    } catch (err) {
      console.error('Order status email error:', err.message);
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

    try {
      const email = await resolveCustomerEmail(result.Attributes);
      await sendOrderStatusEmail(result.Attributes, email, status, trackingNumber);
    } catch (err) {
      console.error('Order status email error:', err.message);
    }

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
