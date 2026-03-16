const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, GetCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { corsHeaders } = require('../../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Get all shipping dates (Admin only)
 * Returns all dates including cancelled/full ones
 */
module.exports.getAllDates = async (event) => {
  try {
    const command = new ScanCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
    });

    const result = await docClient.send(command);

    // Sort by date descending (newest first)
    const dates = result.Items.sort((a, b) => b.date.localeCompare(a.date));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        dates,
        count: dates.length,
      }),
    };
  } catch (error) {
    console.error('Error getting all shipping dates:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve shipping dates', details: error.message }),
    };
  }
};

/**
 * Get specific shipping date by ID (Admin only)
 */
module.exports.getDateById = async (event) => {
  try {
    const { id } = event.pathParameters;

    const command = new GetCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId: id },
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shipping date not found' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        date: result.Item,
      }),
    };
  } catch (error) {
    console.error('Error getting shipping date:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve shipping date', details: error.message }),
    };
  }
};

/**
 * Create new shipping date (Admin only)
 */
module.exports.createDate = async (event) => {
  try {
    const { date, capacity, notes, orderWindowCloseDate } = JSON.parse(event.body);

    // Validation
    if (!date || !capacity) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Date and capacity are required' }),
      };
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid date format. Use YYYY-MM-DD' }),
      };
    }

    // Validate orderWindowCloseDate if provided
    if (orderWindowCloseDate && !dateRegex.test(orderWindowCloseDate)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid order window close date format. Use YYYY-MM-DD' }),
      };
    }

    // Validate that orderWindowCloseDate is before or equal to delivery date
    if (orderWindowCloseDate && orderWindowCloseDate > date) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Order window close date must be before or equal to delivery date' }),
      };
    }

    // Validate capacity
    if (capacity <= 0 || !Number.isInteger(capacity)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Capacity must be a positive integer' }),
      };
    }

    const shippingDate = {
      shippingDateId: uuidv4(),
      date,
      orderWindowCloseDate: orderWindowCloseDate || null,
      capacity: parseInt(capacity),
      currentOrders: 0,
      status: 'active',
      notes: notes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Item: shippingDate,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Shipping date created successfully',
        date: shippingDate,
      }),
    };
  } catch (error) {
    console.error('Error creating shipping date:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not create shipping date', details: error.message }),
    };
  }
};

/**
 * Update shipping date (Admin only)
 */
module.exports.updateDate = async (event) => {
  try {
    const { id } = event.pathParameters;
    const updates = JSON.parse(event.body);

    // Check if shipping date exists
    const getCommand = new GetCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId: id },
    });
    const existing = await docClient.send(getCommand);

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shipping date not found' }),
      };
    }

    // Build update expression
    const updateExpression = [];
    const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };
    const expressionAttributeNames = { '#updatedAt': 'updatedAt' };

    Object.keys(updates).forEach(key => {
      if (key !== 'shippingDateId' && key !== 'createdAt' && updates[key] !== undefined && updates[key] !== null) {
        // Validate fields
        if (key === 'capacity' && (updates[key] <= 0 || !Number.isInteger(updates[key]))) {
          throw new Error('Capacity must be a positive integer');
        }
        if (key === 'status' && !['active', 'full', 'cancelled'].includes(updates[key])) {
          throw new Error('Invalid status. Must be active, full, or cancelled');
        }
        if (key === 'date') {
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(updates[key])) {
            throw new Error('Invalid date format. Use YYYY-MM-DD');
          }
        }

        updateExpression.push(`#${key} = :${key}`);

        if (key === 'capacity' || key === 'currentOrders') {
          expressionAttributeValues[`:${key}`] = parseInt(updates[key]);
        } else {
          expressionAttributeValues[`:${key}`] = updates[key];
        }
        expressionAttributeNames[`#${key}`] = key;
      }
    });

    updateExpression.push('#updatedAt = :updatedAt');

    const command = new UpdateCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId: id },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Shipping date updated successfully',
        date: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error updating shipping date:', error);
    return {
      statusCode: error.message.includes('Invalid') || error.message.includes('Capacity') ? 400 : 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Could not update shipping date', details: error.message }),
    };
  }
};

/**
 * Delete/Cancel shipping date (Admin only)
 * Soft delete by setting status to 'cancelled'
 */
module.exports.deleteDate = async (event) => {
  try {
    const { id } = event.pathParameters;

    // Check if shipping date exists
    const getCommand = new GetCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId: id },
    });
    const existing = await docClient.send(getCommand);

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shipping date not found' }),
      };
    }

    // Soft delete by setting status to cancelled
    const command = new UpdateCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId: id },
      UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'cancelled',
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Shipping date cancelled successfully',
        date: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error deleting shipping date:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not delete shipping date', details: error.message }),
    };
  }
};

/**
 * Get orders for a specific shipping date (Admin only)
 */
module.exports.getDateOrders = async (event) => {
  try {
    const { id } = event.pathParameters;

    // First, get the shipping date to get the date value
    const getDateCommand = new GetCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId: id },
    });
    const dateResult = await docClient.send(getDateCommand);

    if (!dateResult.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Shipping date not found' }),
      };
    }

    // Query orders table for orders with this shipping date
    const ordersCommand = new ScanCommand({
      TableName: process.env.ORDERS_TABLE,
      FilterExpression: 'shippingDateId = :shippingDateId',
      ExpressionAttributeValues: {
        ':shippingDateId': id,
      },
    });

    const ordersResult = await docClient.send(ordersCommand);

    // Sort orders by creation date descending
    const orders = ordersResult.Items.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        shippingDate: dateResult.Item,
        orders,
        count: orders.length,
      }),
    };
  } catch (error) {
    console.error('Error getting orders for shipping date:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve orders', details: error.message }),
    };
  }
};
