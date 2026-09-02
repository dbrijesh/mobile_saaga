/**
 * One-time backfill: assigns sequential SB-000000001-style order numbers to
 * existing orders (oldest first, by createdAt) that don't have one yet, then
 * leaves the shared counter at the last value assigned so new orders continue
 * the sequence.
 *
 * Usage:
 *   ORDERS_TABLE=saaga-online-api-orders-dev \
 *   COUNTERS_TABLE=saaga-online-api-counters-dev \
 *   AWS_REGION=ap-southeast-1 \
 *   node scripts/backfillOrderNumbers.js
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-southeast-1' });
const docClient = DynamoDBDocumentClient.from(client);

const ORDERS_TABLE = process.env.ORDERS_TABLE;
const COUNTERS_TABLE = process.env.COUNTERS_TABLE;
const PREFIX = 'SB-';
const PAD_LENGTH = 9;
const formatOrderNumber = (n) => `${PREFIX}${String(n).padStart(PAD_LENGTH, '0')}`;

async function scanAllOrders() {
  let items = [];
  let startKey;
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: ORDERS_TABLE, ExclusiveStartKey: startKey })
    );
    items = items.concat(result.Items);
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return items;
}

async function main() {
  if (!ORDERS_TABLE || !COUNTERS_TABLE) {
    console.error('ORDERS_TABLE and COUNTERS_TABLE env vars are required');
    process.exit(1);
  }

  const orders = await scanAllOrders();
  const missingNumbers = orders
    .filter((o) => !o.orderNumber)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  console.log(`Found ${orders.length} total orders, ${missingNumbers.length} missing an order number.`);

  if (missingNumbers.length === 0) {
    console.log('Nothing to backfill.');
    return;
  }

  let assigned = 0;
  let lastValue = 0;
  for (const order of missingNumbers) {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: COUNTERS_TABLE,
        Key: { counterId: 'orderNumber' },
        UpdateExpression: 'ADD #value :inc',
        ExpressionAttributeNames: { '#value': 'value' },
        ExpressionAttributeValues: { ':inc': 1 },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    lastValue = result.Attributes.value;
    const orderNumber = formatOrderNumber(lastValue);

    await docClient.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE,
        Key: { orderId: order.orderId },
        UpdateExpression: 'SET orderNumber = :on',
        ExpressionAttributeValues: { ':on': orderNumber },
      })
    );

    assigned++;
    console.log(`  ${order.orderId} -> ${orderNumber} (createdAt ${order.createdAt})`);
  }

  console.log(`Backfilled ${assigned} orders. Counter now at ${lastValue}. New orders will start at ${formatOrderNumber(lastValue + 1)}.`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
