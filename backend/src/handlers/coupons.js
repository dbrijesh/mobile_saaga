const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { corsHeaders } = require('../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Validate a coupon code and return discount details
 * Public endpoint for customers during checkout
 */
module.exports.validateCoupon = async (event) => {
  try {
    const { code, orderTotal } = JSON.parse(event.body);

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Coupon code is required' }),
      };
    }

    if (!orderTotal || orderTotal <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid order total is required' }),
      };
    }

    // Query coupon by code
    const command = new QueryCommand({
      TableName: process.env.COUPONS_TABLE,
      IndexName: 'CodeIndex',
      KeyConditionExpression: 'code = :code',
      ExpressionAttributeValues: {
        ':code': code.toUpperCase(),
      },
    });

    const result = await docClient.send(command);

    if (!result.Items || result.Items.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'Invalid coupon code'
        }),
      };
    }

    const coupon = result.Items[0];

    // Check if coupon is active
    if (coupon.status !== 'active') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'This coupon is no longer active'
        }),
      };
    }

    // Check expiry date
    if (coupon.expiryDate) {
      const today = new Date().toISOString().split('T')[0];
      if (coupon.expiryDate < today) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            valid: false,
            error: 'This coupon has expired'
          }),
        };
      }
    }

    // Check usage limit
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          valid: false,
          error: 'This coupon has reached its usage limit'
        }),
      };
    }

    // Check minimum purchase amount
    if (coupon.minPurchaseAmount && orderTotal < coupon.minPurchaseAmount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          valid: false,
          error: `Minimum purchase amount of SGD ${coupon.minPurchaseAmount.toFixed(2)} required`
        }),
      };
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = orderTotal * (coupon.discountValue / 100);
      // Apply max discount cap if set
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else if (coupon.discountType === 'fixed') {
      discountAmount = coupon.discountValue;
      // Discount can't exceed order total
      if (discountAmount > orderTotal) {
        discountAmount = orderTotal;
      }
    }

    const finalAmount = orderTotal - discountAmount;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        coupon: {
          couponId: coupon.couponId,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          description: coupon.description,
        },
        discount: {
          discountAmount: parseFloat(discountAmount.toFixed(2)),
          originalTotal: parseFloat(orderTotal.toFixed(2)),
          finalTotal: parseFloat(finalAmount.toFixed(2)),
        },
      }),
    };
  } catch (error) {
    console.error('Error validating coupon:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        valid: false,
        error: 'Could not validate coupon',
        details: error.message
      }),
    };
  }
};

/**
 * Helper function to apply coupon and increment usage count
 * Called internally by order creation
 */
const applyCoupon = async (couponId) => {
  try {
    const command = new UpdateCommand({
      TableName: process.env.COUPONS_TABLE,
      Key: { couponId },
      UpdateExpression: 'SET usageCount = usageCount + :inc, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    await docClient.send(command);
    return true;
  } catch (error) {
    console.error('Error applying coupon:', error);
    return false;
  }
};

module.exports.applyCoupon = applyCoupon;
