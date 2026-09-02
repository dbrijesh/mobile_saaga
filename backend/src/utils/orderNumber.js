const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const PREFIX = 'SB-';
const PAD_LENGTH = 9;

const formatOrderNumber = (n) => `${PREFIX}${String(n).padStart(PAD_LENGTH, '0')}`;

/**
 * Atomically increments the shared order counter and returns the new
 * human-readable order number (e.g. SB-000000001). DynamoDB's ADD update
 * expression is atomic, so concurrent order creations never collide.
 */
const getNextOrderNumber = async () => {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: process.env.COUNTERS_TABLE,
      Key: { counterId: 'orderNumber' },
      UpdateExpression: 'ADD #value :inc',
      ExpressionAttributeNames: { '#value': 'value' },
      ExpressionAttributeValues: { ':inc': 1 },
      ReturnValues: 'UPDATED_NEW',
    })
  );
  return formatOrderNumber(result.Attributes.value);
};

module.exports = { getNextOrderNumber, formatOrderNumber };
