const { corsHeaders } = require('../utils/cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand, DeleteCommand, GetCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

const getUserId = (event) => {
  return event.requestContext.authorizer.claims.sub;
};

/**
 * Get user's addresses
 */
module.exports.getAddresses = async (event) => {
  try {
    const userId = getUserId(event);

    const command = new QueryCommand({
      TableName: process.env.ADDRESSES_TABLE,
      IndexName: 'UserAddressesIndex',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
    });

    const result = await docClient.send(command);

    // Sort by default first, then by createdAt
    const addresses = result.Items.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        addresses,
        count: addresses.length,
      }),
    };
  } catch (error) {
    console.error('Error getting addresses:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve addresses', details: error.message }),
    };
  }
};

/**
 * Create new address
 */
module.exports.createAddress = async (event) => {
  try {
    const userId = getUserId(event);
    const {
      fullName,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country = 'Singapore',
      isDefault = false,
      label = 'Home',
    } = JSON.parse(event.body);

    if (!fullName || !phone || !addressLine1 || !city || !postalCode) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      const queryCommand = new QueryCommand({
        TableName: process.env.ADDRESSES_TABLE,
        IndexName: 'UserAddressesIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      });

      const existingAddresses = await docClient.send(queryCommand);

      await Promise.all(
        existingAddresses.Items.filter(addr => addr.isDefault).map(addr =>
          docClient.send(new UpdateCommand({
            TableName: process.env.ADDRESSES_TABLE,
            Key: { addressId: addr.addressId },
            UpdateExpression: 'SET isDefault = :false',
            ExpressionAttributeValues: {
              ':false': false,
            },
          }))
        )
      );
    }

    const addressId = uuidv4();
    const address = {
      addressId,
      userId,
      fullName,
      phone,
      addressLine1,
      addressLine2: addressLine2 || '',
      city,
      state: state || '',
      postalCode,
      country,
      isDefault,
      label,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const command = new PutCommand({
      TableName: process.env.ADDRESSES_TABLE,
      Item: address,
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Address created successfully',
        address,
      }),
    };
  } catch (error) {
    console.error('Error creating address:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not create address', details: error.message }),
    };
  }
};

/**
 * Update address
 */
module.exports.updateAddress = async (event) => {
  try {
    const userId = getUserId(event);
    const { addressId } = event.pathParameters;
    const updates = JSON.parse(event.body);

    // Verify address belongs to user
    const getCommand = new GetCommand({
      TableName: process.env.ADDRESSES_TABLE,
      Key: { addressId },
    });
    const existingAddress = await docClient.send(getCommand);

    if (!existingAddress.Item || existingAddress.Item.userId !== userId) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Address not found' }),
      };
    }

    // If setting as default, unset other defaults
    if (updates.isDefault === true) {
      const queryCommand = new QueryCommand({
        TableName: process.env.ADDRESSES_TABLE,
        IndexName: 'UserAddressesIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      });

      const allAddresses = await docClient.send(queryCommand);

      await Promise.all(
        allAddresses.Items.filter(addr => addr.addressId !== addressId && addr.isDefault).map(addr =>
          docClient.send(new UpdateCommand({
            TableName: process.env.ADDRESSES_TABLE,
            Key: { addressId: addr.addressId },
            UpdateExpression: 'SET isDefault = :false',
            ExpressionAttributeValues: {
              ':false': false,
            },
          }))
        )
      );
    }

    // Build update expression
    const updateExpression = [];
    const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };
    const expressionAttributeNames = {};

    Object.keys(updates).forEach(key => {
      if (key !== 'addressId' && key !== 'userId' && key !== 'createdAt') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = updates[key];
        expressionAttributeNames[`#${key}`] = key;
      }
    });

    updateExpression.push('updatedAt = :updatedAt');

    const command = new UpdateCommand({
      TableName: process.env.ADDRESSES_TABLE,
      Key: { addressId },
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
        message: 'Address updated successfully',
        address: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error updating address:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not update address', details: error.message }),
    };
  }
};

/**
 * Delete address
 */
module.exports.deleteAddress = async (event) => {
  try {
    const userId = getUserId(event);
    const { addressId } = event.pathParameters;

    // Verify address belongs to user
    const getCommand = new GetCommand({
      TableName: process.env.ADDRESSES_TABLE,
      Key: { addressId },
    });
    const existingAddress = await docClient.send(getCommand);

    if (!existingAddress.Item || existingAddress.Item.userId !== userId) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Address not found' }),
      };
    }

    const command = new DeleteCommand({
      TableName: process.env.ADDRESSES_TABLE,
      Key: { addressId },
    });

    await docClient.send(command);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Address deleted successfully' }),
    };
  } catch (error) {
    console.error('Error deleting address:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not delete address', details: error.message }),
    };
  }
};
