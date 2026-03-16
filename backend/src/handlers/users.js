const { corsHeaders } = require('../utils/cors');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { CognitoIdentityProviderClient, AdminGetUserCommand, AdminUpdateUserAttributesCommand } = require('@aws-sdk/client-cognito-identity-provider');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION });
const s3Client = new S3Client({ region: process.env.REGION });

const headers = corsHeaders;

const getUserId = (event) => {
  return event.requestContext.authorizer.claims.sub;
};

const getUsername = (event) => {
  return event.requestContext.authorizer.claims['cognito:username'];
};

/**
 * Get user profile
 */
module.exports.getUserProfile = async (event) => {
  try {
    const userId = getUserId(event);

    // Get user from DynamoDB
    const command = new GetCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      // If user doesn't exist in DynamoDB, create a profile from Cognito
      const username = getUsername(event);
      const cognitoCommand = new AdminGetUserCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: username,
      });

      const cognitoUser = await cognitoClient.send(cognitoCommand);

      const userProfile = {
        userId,
        email: cognitoUser.UserAttributes.find(attr => attr.Name === 'email')?.Value || '',
        name: cognitoUser.UserAttributes.find(attr => attr.Name === 'name')?.Value || '',
        phone: cognitoUser.UserAttributes.find(attr => attr.Name === 'phone_number')?.Value || '',
        profilePictureUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Create user profile in DynamoDB
      await docClient.send(new PutCommand({
        TableName: process.env.USERS_TABLE,
        Item: userProfile,
      }));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(userProfile),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve user profile', details: error.message }),
    };
  }
};

/**
 * Update user profile
 */
module.exports.updateUserProfile = async (event) => {
  try {
    const userId = getUserId(event);
    const username = getUsername(event);
    const updates = JSON.parse(event.body);

    // Update Cognito attributes
    const cognitoAttributes = [];
    if (updates.name) {
      cognitoAttributes.push({ Name: 'name', Value: updates.name });
    }
    if (updates.phone) {
      cognitoAttributes.push({ Name: 'phone_number', Value: updates.phone });
    }

    if (cognitoAttributes.length > 0) {
      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: process.env.USER_POOL_ID,
        Username: username,
        UserAttributes: cognitoAttributes,
      }));
    }

    // Build update expression for DynamoDB
    const updateExpression = [];
    const expressionAttributeValues = { ':updatedAt': new Date().toISOString() };
    const expressionAttributeNames = {};

    Object.keys(updates).forEach(key => {
      if (key !== 'userId' && key !== 'createdAt' && key !== 'email') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeValues[`:${key}`] = updates[key];
        expressionAttributeNames[`#${key}`] = key;
      }
    });

    updateExpression.push('updatedAt = :updatedAt');

    const command = new UpdateCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
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
        message: 'Profile updated successfully',
        profile: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error updating user profile:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not update user profile', details: error.message }),
    };
  }
};

/**
 * Upload profile picture
 */
module.exports.uploadProfilePicture = async (event) => {
  try {
    const userId = getUserId(event);
    const { image, fileName, fileType } = JSON.parse(event.body || '{}');

    if (!image || !fileName || !fileType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'image, fileName, and fileType are required' }),
      };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' }),
      };
    }

    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique file name
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `profile-pictures/${userId}-${uuidv4()}.${fileExtension}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.PRODUCT_IMAGES_BUCKET,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: fileType,
    });

    await s3Client.send(command);

    // Generate the S3 URL
    const profilePictureUrl = `https://${process.env.PRODUCT_IMAGES_BUCKET}.s3.${process.env.REGION}.amazonaws.com/${uniqueFileName}`;

    // Update user profile with new picture URL
    const updateCommand = new UpdateCommand({
      TableName: process.env.USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET profilePictureUrl = :url, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':url': profilePictureUrl,
        ':updatedAt': new Date().toISOString(),
      },
      ReturnValues: 'ALL_NEW',
    });

    const result = await docClient.send(updateCommand);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Profile picture uploaded successfully',
        profilePictureUrl,
        profile: result.Attributes,
      }),
    };
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not upload profile picture', details: error.message }),
    };
  }
};
