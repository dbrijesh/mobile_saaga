const { corsHeaders } = require('../../utils/cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { sendOrderStatusEmail } = require('../../utils/email');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

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
 * Get all orders (Admin only)
 * In production, you should verify the user has admin role
 */
module.exports.getAllOrders = async (event) => {
  try {
    const { limit = '50', status, startDate, endDate } = event.queryStringParameters || {};

    const params = {
      TableName: process.env.ORDERS_TABLE,
      Limit: parseInt(limit),
    };

    const command = new ScanCommand(params);
    const result = await docClient.send(command);

    let orders = result.Items;

    // Filter by status
    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    // Filter by date range
    if (startDate) {
      orders = orders.filter(order => new Date(order.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      orders = orders.filter(order => new Date(order.createdAt) <= new Date(endDate));
    }

    // Sort by creation date (newest first)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Calculate statistics
    const stats = {
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0),
      statusBreakdown: orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {}),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        orders,
        stats,
        count: orders.length,
      }),
    };
  } catch (error) {
    console.error('Error getting all orders:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve orders', details: error.message }),
    };
  }
};

/**
 * Admin cancel order — no user ownership check, broader status allowance
 */
module.exports.cancelOrder = async (event) => {
  try {
    const { orderId } = event.pathParameters;

    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.ORDERS_TABLE,
      Key: { orderId },
    }));

    if (!getResult.Item) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Order not found' }) };
    }

    const order = getResult.Item;

    if (['delivered', 'cancelled'].includes(order.status)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Cannot cancel an order that is already ${order.status}` }),
      };
    }

    const now = new Date().toISOString();

    await docClient.send(new UpdateCommand({
      TableName: process.env.ORDERS_TABLE,
      Key: { orderId },
      UpdateExpression: 'SET #status = :status, updatedAt = :now, cancelledAt = :now',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'cancelled', ':now': now },
    }));

    // Release shipping date capacity if applicable
    if (order.shippingDateId) {
      try {
        await docClient.send(new UpdateCommand({
          TableName: process.env.SHIPPING_DATES_TABLE,
          Key: { shippingDateId: order.shippingDateId },
          UpdateExpression: 'SET currentOrders = currentOrders - :dec, #status = :active, updatedAt = :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':dec': 1, ':active': 'active', ':now': now },
        }));
      } catch (err) {
        console.error('Error releasing shipping date capacity:', err);
      }
    }

    const cancelledOrder = { ...order, status: 'cancelled', cancelledAt: now };

    try {
      const email = await resolveCustomerEmail(cancelledOrder);
      await sendOrderStatusEmail(cancelledOrder, email, 'cancelled');
    } catch (err) {
      console.error('Order status email error:', err.message);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Order cancelled successfully', order: cancelledOrder }),
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
