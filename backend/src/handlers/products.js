const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, GetCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { corsHeaders, successResponse, errorResponse } = require('../utils/cors');

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);

const headers = corsHeaders;

/**
 * Helper function to add discount calculation to products
 */
const addDiscountedPrice = (product) => {
  const discountPercent = product.discountPercent || 0;
  const originalPrice = product.price;

  if (discountPercent > 0) {
    const discountedPrice = originalPrice * (1 - discountPercent / 100);
    return {
      ...product,
      originalPrice,
      discountedPrice: parseFloat(discountedPrice.toFixed(2)),
      discountPercent,
      hasDiscount: true,
    };
  }

  return {
    ...product,
    originalPrice,
    discountedPrice: originalPrice,
    discountPercent: 0,
    hasDiscount: false,
  };
};

/**
 * Get all products with pagination
 */
module.exports.getProducts = async (event) => {
  try {
    const { limit = '20', lastKey, category, subCategory, featured, sort } = event.queryStringParameters || {};

    let params = {
      TableName: process.env.PRODUCTS_TABLE,
      Limit: parseInt(limit),
    };

    if (lastKey) {
      params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));
    }

    // Filter by category using GSI
    if (category) {
      params = {
        TableName: process.env.PRODUCTS_TABLE,
        IndexName: 'CategoryIndex',
        KeyConditionExpression: 'category = :category',
        ExpressionAttributeValues: {
          ':category': category,
        },
      };

      // Add FilterExpression for subcategory if provided
      if (subCategory) {
        params.FilterExpression = 'subCategory = :subCategory';
        params.ExpressionAttributeValues[':subCategory'] = subCategory;
        // Don't apply limit when filtering by subcategory - DynamoDB applies limit before filter
        // We'll limit the results after filtering instead
      } else {
        // Only apply limit when not filtering by subcategory
        params.Limit = parseInt(limit);
      }

      const command = new QueryCommand(params);
      const result = await docClient.send(command);

      let items = result.Items;

      // Filter featured if requested
      if (featured === 'true') {
        items = items.filter(item => item.featured === true);
      }

      // Apply client-side limit when filtering by subcategory
      if (subCategory) {
        items = items.slice(0, parseInt(limit));
      }

      // Add discounted prices to all products
      const productsWithDiscounts = items.map(addDiscountedPrice);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          products: productsWithDiscounts,
          lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
          count: productsWithDiscounts.length,
        }),
      };
    }

    // Scan all products
    const command = new ScanCommand(params);
    const result = await docClient.send(command);

    let items = result.Items;

    // Filter featured if requested
    if (featured === 'true') {
      items = items.filter(item => item.featured === true);
    }

    // Sort products
    if (sort) {
      switch (sort) {
        case 'price_asc':
          items.sort((a, b) => a.price - b.price);
          break;
        case 'price_desc':
          items.sort((a, b) => b.price - a.price);
          break;
        case 'name_asc':
          items.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'rating':
          items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          break;
        default:
          break;
      }
    }

    // Add discounted prices to all products
    const productsWithDiscounts = items.map(addDiscountedPrice);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products: productsWithDiscounts,
        lastKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
        count: productsWithDiscounts.length,
      }),
    };
  } catch (error) {
    console.error('Error getting products:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve products', details: error.message }),
    };
  }
};

/**
 * Get product by ID
 */
module.exports.getProductById = async (event) => {
  try {
    const { id } = event.pathParameters;

    const command = new GetCommand({
      TableName: process.env.PRODUCTS_TABLE,
      Key: { id },
    });

    const result = await docClient.send(command);

    if (!result.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Product not found' }),
      };
    }

    // Add discounted price
    const productWithDiscount = addDiscountedPrice(result.Item);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(productWithDiscount),
    };
  } catch (error) {
    console.error('Error getting product:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve product', details: error.message }),
    };
  }
};

/**
 * Search products by name, description, tags
 */
module.exports.searchProducts = async (event) => {
  try {
    const { q, limit = '20' } = event.queryStringParameters || {};

    if (!q) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Search query (q) is required' }),
      };
    }

    const searchTerm = q.toLowerCase();

    // Scan all products and filter in memory
    const command = new ScanCommand({
      TableName: process.env.PRODUCTS_TABLE,
    });

    const result = await docClient.send(command);

    const filteredProducts = result.Items.filter(product => {
      const nameMatch = product.name?.toLowerCase().includes(searchTerm);
      const descMatch = product.description?.toLowerCase().includes(searchTerm);
      const categoryMatch = product.category?.toLowerCase().includes(searchTerm);
      const brandMatch = product.brand?.toLowerCase().includes(searchTerm);
      const tagsMatch = product.tags?.some(tag => tag.toLowerCase().includes(searchTerm));

      return nameMatch || descMatch || categoryMatch || brandMatch || tagsMatch;
    }).slice(0, parseInt(limit));

    // Add discounted prices to all products
    const productsWithDiscounts = filteredProducts.map(addDiscountedPrice);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        products: productsWithDiscounts,
        count: productsWithDiscounts.length,
        query: q,
      }),
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not search products', details: error.message }),
    };
  }
};

/**
 * Get products by category
 */
module.exports.getProductsByCategory = async (event) => {
  try {
    const { category } = event.pathParameters;
    const { limit = '20', sort } = event.queryStringParameters || {};

    const command = new QueryCommand({
      TableName: process.env.PRODUCTS_TABLE,
      IndexName: 'CategoryIndex',
      KeyConditionExpression: 'category = :category',
      ExpressionAttributeValues: {
        ':category': decodeURIComponent(category),
      },
      Limit: parseInt(limit),
    });

    const result = await docClient.send(command);

    let items = result.Items;

    // Sort if requested
    if (sort) {
      switch (sort) {
        case 'price_asc':
          items.sort((a, b) => a.price - b.price);
          break;
        case 'price_desc':
          items.sort((a, b) => b.price - a.price);
          break;
        case 'name_asc':
          items.sort((a, b) => a.name.localeCompare(b.name));
          break;
        default:
          break;
      }
    }

    // Add discounted prices to all products
    const productsWithDiscounts = items.map(addDiscountedPrice);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        category: decodeURIComponent(category),
        products: productsWithDiscounts,
        count: productsWithDiscounts.length,
      }),
    };
  } catch (error) {
    console.error('Error getting products by category:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not retrieve products', details: error.message }),
    };
  }
};
