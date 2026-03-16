const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const { corsHeaders, successResponse, errorResponse } = require('../../utils/cors');

const s3Client = new S3Client({ region: process.env.REGION });

/**
 * Generate a presigned URL for uploading images to S3
 */
module.exports.getUploadUrl = async (event) => {
  try {
    const { fileName, fileType } = JSON.parse(event.body || '{}');

    if (!fileName || !fileType) {
      return errorResponse(400, 'fileName and fileType are required');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return errorResponse(400, 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
    }

    // Generate unique file name
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `products/${uuidv4()}.${fileExtension}`;

    // Create presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: process.env.PRODUCT_IMAGES_BUCKET,
      Key: uniqueFileName,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

    // Generate the public URL (after upload completes)
    const imageUrl = `https://${process.env.PRODUCT_IMAGES_BUCKET}.s3.${process.env.REGION}.amazonaws.com/${uniqueFileName}`;

    return successResponse(200, {
      uploadUrl,
      imageUrl,
      fileName: uniqueFileName
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return errorResponse(500, 'Could not generate upload URL', error.message);
  }
};

/**
 * Upload image directly (alternative method using base64)
 */
module.exports.uploadImage = async (event) => {
  try {
    const { image, fileName, fileType } = JSON.parse(event.body || '{}');

    if (!image || !fileName || !fileType) {
      return errorResponse(400, 'image, fileName, and fileType are required');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return errorResponse(400, 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.');
    }

    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique file name
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `products/${uuidv4()}.${fileExtension}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.PRODUCT_IMAGES_BUCKET,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: fileType,
    });

    await s3Client.send(command);

    // Generate the S3 URL
    const imageUrl = `https://${process.env.PRODUCT_IMAGES_BUCKET}.s3.${process.env.REGION}.amazonaws.com/${uniqueFileName}`;

    return successResponse(200, {
      imageUrl,
      fileName: uniqueFileName,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return errorResponse(500, 'Could not upload image', error.message);
  }
};
