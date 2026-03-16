const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, UpdateCommand, DeleteCommand, GetCommand, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { corsHeaders } = require('../../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Get all coupons (Admin only)
 */
module.exports.getAllCoupons = async (event) => {
  try {
    const command = new ScanCommand({
      TableName: process.env.COUPONS_TABLE,
    });

    const result = await docClient.send(command);

    // Sort by createdAt descending (newest first)
    const coupons = result.Items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        coupons,
        count: coupons.length,
      }),
    };
  } catch (error) {
    console.error('Error getting all coupons:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve coupons', details: error.message }),
    };
  }
};

/**
 * Get specific coupon by ID (Admin only)
 */
module.exports.getCouponById = async (event) => {
  try {
    const { id } = event.pathParameters;

    const command = new GetCommand({
      TableName: process.env.COUPONS_TABLE,
      Key: { couponId: id },
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Coupon not found' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        coupon: result.Item,
      }),
    };
  } catch (error) {
    console.error('Error getting coupon:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve coupon', details: error.message }),
    };
  }
};

/**
 * Create new coupon (Admin only)
 */
module.exports.createCoupon = async (event) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minPurchaseAmount,
      maxDiscountAmount,
      expiryDate,
      usageLimit,
      description
    } = JSON.parse(event.body);

    // Validation
    if (!code || !discountType || !discountValue) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Code, discount type, and discount value are required' }),
      };
    }

    // Validate discount type
    const validDiscountTypes = ['percentage', 'fixed'];
    if (!validDiscountTypes.includes(discountType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Discount type must be either percentage or fixed' }),
      };
    }

    // Validate discount value
    if (discountValue <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Discount value must be greater than 0' }),
      };
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Percentage discount cannot exceed 100%' }),
      };
    }

    // Check if code already exists
    const checkCommand = new QueryCommand({
      TableName: process.env.COUPONS_TABLE,
      IndexName: 'CodeIndex',
      KeyConditionExpression: 'code = :code',
      ExpressionAttributeValues: {
        ':code': code.toUpperCase(),
      },
    });

    const existing = await docClient.send(checkCommand);
    if (existing.Items && existing.Items.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'A coupon with this code already exists' }),
      };
    }

    const coupon = {
      couponId: uuidv4(),
      code: code.toUpperCase(),
      discountType,
      discountValue: parseFloat(discountValue),
      minPurchaseAmount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : 0,
      maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
      expiryDate: expiryDate || null,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      usageCount: 0,
      status: 'active',
      description: description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: process.env.COUPONS_TABLE,
      Item: coupon,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Coupon created successfully',
        coupon,
      }),
    };
  } catch (error) {
    console.error('Error creating coupon:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not create coupon', details: error.message }),
    };
  }
};

/**
 * Update coupon (Admin only)
 */
module.exports.updateCoupon = async (event) => {
  try {
    const { id } = event.pathParameters;
    const updates = JSON.parse(event.body);

    // Check if coupon exists
    const getCommand = new GetCommand({
      TableName: process.env.COUPONS_TABLE,
      Key: { couponId: id },
    });
    const existing = await docClient.send(getCommand);

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Coupon not found' }),
      };
    }

    // Build update expression
    const updateExpression = [];
    const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };
    const expressionAttributeNames = { '#updatedAt': 'updatedAt' };

    // Allowed fields to update
    const allowedFields = [
      'description',
      'status',
      'expiryDate',
      'usageLimit',
      'minPurchaseAmount',
      'maxDiscountAmount',
    ];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key) && updates[key] !== undefined && updates[key] !== null) {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = updates[key];
        expressionAttributeNames[`#${key}`] = key;
      }
    });

    if (updateExpression.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No valid fields to update' }),
      };
    }

    updateExpression.push('#updatedAt = :updatedAt');

    const command = new UpdateCommand({
      TableName: process.env.COUPONS_TABLE,
      Key: { couponId: id },
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
        message: 'Coupon updated successfully',
        coupon: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error updating coupon:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not update coupon', details: error.message }),
    };
  }
};

/**
 * Delete coupon (Admin only)
 * Soft delete by setting status to 'deleted'
 */
module.exports.deleteCoupon = async (event) => {
  try {
    const { id } = event.pathParameters;

    // Check if coupon exists
    const getCommand = new GetCommand({
      TableName: process.env.COUPONS_TABLE,
      Key: { couponId: id },
    });
    const existing = await docClient.send(getCommand);

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Coupon not found' }),
      };
    }

    // Soft delete by updating status
    const command = new UpdateCommand({
      TableName: process.env.COUPONS_TABLE,
      Key: { couponId: id },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'deleted',
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Coupon deleted successfully',
        coupon: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error deleting coupon:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not delete coupon', details: error.message }),
    };
  }
};
