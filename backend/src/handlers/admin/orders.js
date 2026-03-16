const { corsHeaders } = require('../../utils/cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

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
