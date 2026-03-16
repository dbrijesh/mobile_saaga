const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { corsHeaders } = require('../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Get available shipping dates for customers
 * Returns active dates with available capacity, sorted by date
 */
module.exports.getAvailableDates = async (event) => {
  try {
    const command = new ScanCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
    });

    const result = await docClient.send(command);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Filter for active dates with capacity, future/today dates, and open order windows
    const availableDates = result.Items
      .filter(item => {
        // Check if order window is still open (if orderWindowCloseDate is set)
        const orderWindowOpen = !item.orderWindowCloseDate || item.orderWindowCloseDate >= today;

        return item.status === 'active' &&
               item.currentOrders < item.capacity &&
               item.date >= today &&
               orderWindowOpen;
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        dates: availableDates,
        count: availableDates.length,
      }),
    };
  } catch (error) {
    console.error('Error getting available shipping dates:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve shipping dates', details: error.message }),
    };
  }
};
