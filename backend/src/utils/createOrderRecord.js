const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  BatchWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { applyCoupon, countCustomerCouponUsage } = require('../handlers/coupons');
const { getNextOrderNumber } = require('./orderNumber');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const enrichItemsWithProductData = async (items) => {
  return Promise.all(
    items.map(async (item) => {
      if (item.unit || item.weight) return item;
      try {
        const result = await docClient.send(
          new GetCommand({
            TableName: process.env.PRODUCTS_TABLE,
            Key: { id: item.productId },
            ProjectionExpression: 'unit, weight',
          })
        );
        if (result.Item) {
          return { ...item, unit: result.Item.unit || '', weight: result.Item.weight || '' };
        }
      } catch (err) {
        console.warn(`Could not enrich item ${item.productId}:`, err.message);
      }
      return item;
    })
  );
};

const validateAndReserveShippingDate = async (shippingDateId) => {
  if (!shippingDateId) return null;

  const result = await docClient.send(
    new GetCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId },
    })
  );

  if (!result.Item) throw new Error('Selected shipping date not found');

  const shippingDate = result.Item;
  if (shippingDate.status !== 'active') throw new Error('Selected shipping date is not available');
  if (shippingDate.currentOrders >= shippingDate.capacity) throw new Error('Selected shipping date is full');

  const newCurrentOrders = shippingDate.currentOrders + 1;
  await docClient.send(
    new UpdateCommand({
      TableName: process.env.SHIPPING_DATES_TABLE,
      Key: { shippingDateId },
      UpdateExpression: 'SET currentOrders = :currentOrders, #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':currentOrders': newCurrentOrders,
        ':status': newCurrentOrders >= shippingDate.capacity ? 'full' : 'active',
        ':updatedAt': new Date().toISOString(),
      },
    })
  );

  return shippingDate.date;
};

/**
 * Creates an order record in DynamoDB.
 *
 * @param {string} orderId     - Use paymentIntentId for idempotency (retries won't duplicate)
 * @param {string} userId
 * @param {object} orderData   - { items, shippingAddress, totalAmount, notes, shippingDateId, couponId, couponCode, discountAmount, paymentIntentId }
 * @returns {{ order, alreadyExisted }} - alreadyExisted=true when retrying an already-created order
 */
const createOrderRecord = async (orderId, userId, orderData) => {
  const {
    items,
    shippingAddress,
    totalAmount,
    notes,
    shippingDateId,
    couponId,
    couponCode,
    discountAmount,
    paymentIntentId,
    customerEmail,
  } = orderData;

  // Idempotency: return existing order if already created
  const existing = await docClient.send(
    new GetCommand({ TableName: process.env.ORDERS_TABLE, Key: { orderId } })
  );
  if (existing.Item) {
    return { order: existing.Item, alreadyExisted: true };
  }

  let selectedShippingDate = null;
  if (shippingDateId) {
    selectedShippingDate = await validateAndReserveShippingDate(shippingDateId);
  }

  if (couponId) {
    const couponResult = await docClient.send(
      new GetCommand({ TableName: process.env.COUPONS_TABLE, Key: { couponId } })
    );
    const coupon = couponResult.Item;
    if (!coupon) throw new Error('Coupon not found');
    if (coupon.status !== 'active') throw new Error('This coupon is no longer active');
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
      throw new Error('This coupon has reached its usage limit');
    }

    const orderSubtotal = parseFloat(totalAmount) + parseFloat(discountAmount || 0);
    if (coupon.minPurchaseAmount && orderSubtotal < coupon.minPurchaseAmount) {
      throw new Error(`Minimum purchase amount of SGD ${coupon.minPurchaseAmount.toFixed(2)} required for this coupon`);
    }

    if (coupon.perCustomerLimit) {
      const usedCount = await countCustomerCouponUsage(userId, couponId);
      if (usedCount >= coupon.perCustomerLimit) throw new Error('You have already used this coupon');
    }

    const applied = await applyCoupon(couponId);
    if (!applied) throw new Error('This coupon has reached its usage limit');
  }

  const enrichedItems = await enrichItemsWithProductData(items);
  const orderNumber = await getNextOrderNumber();

  const now = new Date().toISOString();
  const order = {
    orderId,
    orderNumber,
    userId,
    customerEmail: customerEmail || '',
    items: enrichedItems,
    shippingAddress,
    paymentMethod: 'stripe',
    paymentIntentId: paymentIntentId || orderId,
    totalAmount: parseFloat(totalAmount),
    status: 'pending',
    paymentStatus: 'paid',
    notes: notes || '',
    createdAt: now,
    updatedAt: now,
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  };

  if (shippingDateId) {
    order.shippingDateId = shippingDateId;
    order.selectedShippingDate = selectedShippingDate;
  }

  if (couponId && couponCode) {
    order.couponId = couponId;
    order.couponCode = couponCode;
    order.discountAmount = discountAmount ? parseFloat(discountAmount) : 0;
    order.subtotal = parseFloat(totalAmount) + parseFloat(discountAmount || 0);
  }

  await docClient.send(new PutCommand({ TableName: process.env.ORDERS_TABLE, Item: order }));

  // Clear the cart after order creation (non-blocking)
  try {
    const cartResult = await docClient.send(
      new QueryCommand({
        TableName: process.env.CART_TABLE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ProjectionExpression: 'userId, productId',
      })
    );
    if (cartResult.Items && cartResult.Items.length > 0) {
      const chunks = [];
      for (let i = 0; i < cartResult.Items.length; i += 25) {
        chunks.push(cartResult.Items.slice(i, i + 25));
      }
      await Promise.all(
        chunks.map((chunk) =>
          docClient.send(
            new BatchWriteCommand({
              RequestItems: {
                [process.env.CART_TABLE]: chunk.map((item) => ({
                  DeleteRequest: { Key: { userId: item.userId, productId: item.productId } },
                })),
              },
            })
          )
        )
      );
    }
  } catch (err) {
    console.error('Failed to clear cart after order:', err.message);
  }

  return { order, alreadyExisted: false };
};

module.exports = { createOrderRecord };
