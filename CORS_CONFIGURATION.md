# CORS Configuration - Complete ✅

## Summary

All API endpoints now return comprehensive CORS headers to allow cross-origin requests from any domain (including your mobile app frontend).

---

## CORS Headers Returned

Every API response now includes:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Content-Type: application/json
```

---

## What Was Changed

### 1. Created Centralized CORS Utility

**File:** `backend/src/utils/cors.js`

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
  'Content-Type': 'application/json'
};
```

### 2. Updated All Lambda Handlers

All handlers now import and use the centralized CORS headers:

- ✅ `products.js` - Product endpoints
- ✅ `categories.js` - Category endpoints
- ✅ `cart.js` - Cart endpoints
- ✅ `orders.js` - Order endpoints
- ✅ `addresses.js` - Address endpoints
- ✅ `payment.js` - Payment endpoints
- ✅ `users.js` - User profile endpoints
- ✅ `support.js` - Support endpoints
- ✅ `admin/products.js` - Admin product management
- ✅ `admin/orders.js` - Admin order management
- ✅ `admin/inventory.js` - Admin inventory management

---

## Testing CORS

### Test GET Request
```bash
curl -i "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products?limit=1"
```

**Response Headers:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
```

### Test OPTIONS Preflight Request
```bash
curl -X OPTIONS "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization"
```

**Response:** `200 OK` with all CORS headers

---

## Using the API from Your Mobile App

### JavaScript/TypeScript Example

```javascript
// Fetch products
const response = await fetch('https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products?limit=10', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data.products);
```

### With Authentication

```javascript
// Authenticated request (e.g., get cart)
const response = await fetch('https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${yourJwtToken}`
  }
});

const cart = await response.json();
```

### React Native / Expo Example

```javascript
import axios from 'axios';

const API_URL = 'https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev';

// Get products
async function getProducts() {
  try {
    const response = await axios.get(`${API_URL}/products?limit=20`);
    return response.data.products;
  } catch (error) {
    console.error('Error fetching products:', error);
    throw error;
  }
}

// Add to cart (authenticated)
async function addToCart(productId, quantity, token) {
  try {
    const response = await axios.post(
      `${API_URL}/cart`,
      { productId, quantity },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error adding to cart:', error);
    throw error;
  }
}
```

---

## API Endpoints

All endpoints support CORS:

### Public Endpoints (No Auth Required)
- `GET /products` - Get all products
- `GET /products/{id}` - Get product by ID
- `GET /products/search?q=term` - Search products
- `GET /products/category/{category}` - Get products by category
- `GET /categories` - Get all categories
- `GET /support/faqs` - Get FAQs

### Authenticated Endpoints (Require JWT Token)
- `GET /cart` - Get user's cart
- `POST /cart` - Add item to cart
- `PUT /cart/{itemId}` - Update cart item
- `DELETE /cart/{itemId}` - Remove from cart
- `DELETE /cart` - Clear cart
- `POST /orders` - Create order
- `GET /orders` - Get user's orders
- `GET /orders/{orderId}` - Get order details
- `GET /addresses` - Get user's addresses
- `POST /addresses` - Create address
- `PUT /addresses/{addressId}` - Update address
- `DELETE /addresses/{addressId}` - Delete address
- `POST /payment/intent` - Create payment intent
- `POST /payment/confirm` - Confirm payment
- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile

### Admin Endpoints (Require Admin JWT Token)
- `GET /admin/orders` - Get all orders
- `PUT /admin/products/{id}` - Update product
- `POST /admin/products` - Create product
- `DELETE /admin/products/{id}` - Delete product
- `PUT /admin/inventory/{productId}` - Update inventory

---

## Troubleshooting

### Issue: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Solution:** This should no longer occur. All endpoints now return proper CORS headers.

### Issue: "CORS policy: Request header field authorization is not allowed"

**Solution:** The `Authorization` header is now explicitly allowed in `Access-Control-Allow-Headers`.

### Issue: OPTIONS preflight failing

**Solution:** API Gateway handles OPTIONS requests automatically and returns proper CORS headers.

---

## Security Notes

- **`Access-Control-Allow-Origin: *`** - Allows requests from any domain. This is suitable for public APIs or during development.
- For production, consider restricting to specific domains:
  ```javascript
  'Access-Control-Allow-Origin': 'https://yourmobileapp.com'
  ```

- **`Access-Control-Allow-Credentials: true`** - Allows cookies and authentication headers.

---

## Deployment Status

✅ **Deployed:** December 31, 2025
✅ **Environment:** dev
✅ **Region:** ap-southeast-1 (Singapore)
✅ **All Lambda functions updated with CORS headers**

---

## Next Steps

1. **Test from your mobile app frontend**
2. **Verify all endpoints work cross-origin**
3. **Implement authentication flow** (see ADMIN_LOGIN_GUIDE.md for Cognito setup)
4. **Build your mobile app** using the API endpoints above

---

**API Base URL:**
```
https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev
```

**Status:** ✅ CORS Fully Configured and Working
