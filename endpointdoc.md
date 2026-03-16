# Saaga Online API Documentation

**Last Updated:** January 4, 2026
**Version:** 1.0
**Environment:** Development

---

## 🔑 AWS Configuration

### **Cognito Authentication**
```
Region: ap-southeast-1
User Pool ID: ap-southeast-1_1BQKFzF5m
App Client ID: 55rqmd54dphlke870t28ma9nju
```

### **API Gateway**
```
Base URL: https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev
Region: ap-southeast-1
```

### **Stripe (Payments)**
```
Publishable Key: pk_test_your_publishable_key_here
Secret Key: (Server-side only, do not expose in mobile app)
```
*Note: You'll need to update this with your actual Stripe publishable key*

### **S3 Product Images**
```
Bucket URL: https://saaga-online-api-product-images-dev.s3.ap-southeast-1.amazonaws.com
Image URL Format: https://saaga-online-api-product-images-dev.s3.ap-southeast-1.amazonaws.com/products/{filename}
```

---

## 🔐 Authentication Flow

### **1. User Registration**
Use Cognito SDK for your platform to register users with email and password.

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number

### **2. User Login**
After successful login with Cognito, you'll receive:
- **ID Token** (JWT) - Use this in `Authorization: Bearer {token}` header
- **Access Token**
- **Refresh Token**

### **3. API Authentication**
For all authenticated endpoints, include:
```
Authorization: Bearer {ID_TOKEN_FROM_COGNITO}
```

### **4. Token Expiration**
- ID tokens expire after **1 hour**
- Use refresh tokens to get new ID tokens without re-login

---

## 📡 API Endpoints

### **Public Endpoints** (No Authentication Required)

#### **Products**

**Get All Products**
```
GET /products

Query Parameters:
  - limit (optional, number, default: 20)
  - lastEvaluatedKey (optional, string, for pagination)

Response:
{
  "products": [Product],
  "count": number,
  "lastEvaluatedKey": string (if more results available)
}
```

**Get Product by ID**
```
GET /products/{id}

Path Parameters:
  - id: Product ID (string)

Response:
{
  "product": Product
}
```

**Search Products**
```
GET /products/search

Query Parameters:
  - q: Search query (string, searches name, description, tags)
  - limit (optional, number)

Response:
{
  "products": [Product],
  "count": number
}
```

**Get Products by Category**
```
GET /products/category/{category}

Path Parameters:
  - category: Category name (string)

Query Parameters:
  - limit (optional, number)

Response:
{
  "products": [Product],
  "count": number
}
```

#### **Categories**

**Get All Categories**
```
GET /categories

Response:
{
  "categories": [Category],
  "count": number
}
```

#### **Support**

**Get FAQs**
```
GET /support/faqs

Response:
{
  "faqs": [FAQ]
}
```

---

### **Authenticated Endpoints** (Require Authorization Header)

#### **Cart Management**

**Get User Cart**
```
GET /cart

Headers:
  Authorization: Bearer {token}

Response:
{
  "items": [CartItem],
  "totalAmount": number,
  "count": number
}
```

**Add Item to Cart**
```
POST /cart

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "productId": "string",
  "quantity": number
}

Response:
{
  "message": "Item added to cart",
  "item": CartItem
}
```

**Update Cart Item**
```
PUT /cart/{itemId}

Path Parameters:
  - itemId: Cart item ID (composite: userId#productId)

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "quantity": number
}

Response:
{
  "message": "Cart item updated",
  "item": CartItem
}
```

**Remove Item from Cart**
```
DELETE /cart/{itemId}

Path Parameters:
  - itemId: Cart item ID

Headers:
  Authorization: Bearer {token}

Response:
{
  "message": "Item removed from cart"
}
```

**Clear Cart**
```
DELETE /cart

Headers:
  Authorization: Bearer {token}

Response:
{
  "message": "Cart cleared"
}
```

#### **Orders**

**Create Order**
```
POST /orders

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "items": [
    {
      "productId": "string",
      "productName": "string",
      "quantity": number,
      "price": number
    }
  ],
  "shippingAddress": {
    "fullName": "string",
    "addressLine1": "string",
    "addressLine2": "string" (optional),
    "city": "string",
    "postalCode": "string",
    "phone": "string"
  },
  "paymentMethod": "stripe",
  "paymentIntentId": "string",
  "totalAmount": number,
  "notes": "string" (optional)
}

Response:
{
  "message": "Order created successfully",
  "order": Order
}
```

**Get User Orders**
```
GET /orders

Headers:
  Authorization: Bearer {token}

Query Parameters:
  - limit (optional, number, default: 20)
  - status (optional, string: pending|confirmed|processing|shipped|delivered|cancelled)

Response:
{
  "orders": [Order],
  "count": number
}
```

**Get Order by ID**
```
GET /orders/{orderId}

Path Parameters:
  - orderId: Order ID (string)

Headers:
  Authorization: Bearer {token}

Response:
Order
```

**Update Order Status**
```
PUT /orders/{orderId}/status

Path Parameters:
  - orderId: Order ID (string)

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "status": "string" (pending|confirmed|processing|shipped|delivered|cancelled),
  "trackingNumber": "string" (optional)
}

Response:
{
  "message": "Order status updated",
  "order": Order
}
```

#### **Addresses**

**Get User Addresses**
```
GET /addresses

Headers:
  Authorization: Bearer {token}

Response:
{
  "addresses": [Address],
  "count": number
}
```

**Create Address**
```
POST /addresses

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "fullName": "string",
  "addressLine1": "string",
  "addressLine2": "string" (optional),
  "city": "string",
  "postalCode": "string",
  "phone": "string",
  "isDefault": boolean
}

Response:
{
  "message": "Address created successfully",
  "address": Address
}
```

**Update Address**
```
PUT /addresses/{addressId}

Path Parameters:
  - addressId: Address ID (string)

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "fullName": "string",
  "addressLine1": "string",
  "addressLine2": "string" (optional),
  "city": "string",
  "postalCode": "string",
  "phone": "string",
  "isDefault": boolean
}

Response:
{
  "message": "Address updated successfully",
  "address": Address
}
```

**Delete Address**
```
DELETE /addresses/{addressId}

Path Parameters:
  - addressId: Address ID (string)

Headers:
  Authorization: Bearer {token}

Response:
{
  "message": "Address deleted successfully"
}
```

#### **Payments (Stripe)**

**Create Payment Intent**
```
POST /payment/intent

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "amount": number (in cents, e.g., 5000 for SGD 50.00)
}

Response:
{
  "clientSecret": "string",
  "paymentIntentId": "string"
}
```

**Confirm Payment**
```
POST /payment/confirm

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "paymentIntentId": "string"
}

Response:
{
  "message": "Payment confirmed",
  "payment": PaymentIntent
}
```

#### **User Profile**

**Get User Profile**
```
GET /user/profile

Headers:
  Authorization: Bearer {token}

Response:
{
  "userId": "string",
  "email": "string",
  "name": "string",
  "phone": "string",
  "preferences": object
}
```

**Update User Profile**
```
PUT /user/profile

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "name": "string",
  "phone": "string",
  "preferences": object (optional)
}

Response:
{
  "message": "Profile updated successfully",
  "user": User
}
```

#### **Support**

**Submit Support Ticket**
```
POST /support/ticket

Headers:
  Authorization: Bearer {token}
  Content-Type: application/json

Body:
{
  "subject": "string",
  "message": "string",
  "priority": "string" (optional: low, medium, high)
}

Response:
{
  "message": "Support ticket created",
  "ticket": Ticket
}
```

---

## 📦 Data Models

### **Product**
```json
{
  "id": "PROD-xxx",
  "name": "Basmati Rice",
  "description": "Premium quality basmati rice",
  "category": "Rice & Grains",
  "price": 15.50,
  "stock": 100,
  "inStock": true,
  "sku": "SKU-001",
  "imageUrl": "https://saaga-online-api-product-images-dev.s3.ap-southeast-1.amazonaws.com/products/xxx.jpg",
  "unit": "kg",
  "weight": "5kg",
  "tags": ["rice", "basmati", "premium"],
  "createdAt": "2026-01-04T10:00:00.000Z",
  "updatedAt": "2026-01-04T10:00:00.000Z"
}
```

### **Category**
```json
{
  "id": "CAT-xxx",
  "name": "Rice & Grains",
  "description": "Premium rice and grain products",
  "icon": "🌾",
  "createdAt": "2026-01-04T10:00:00.000Z",
  "updatedAt": "2026-01-04T10:00:00.000Z"
}
```

### **Order**
```json
{
  "orderId": "ORD-xxx",
  "userId": "user-xxx",
  "items": [
    {
      "productId": "PROD-xxx",
      "productName": "Basmati Rice",
      "quantity": 2,
      "price": 15.50
    }
  ],
  "shippingAddress": {
    "fullName": "John Doe",
    "addressLine1": "123 Main St",
    "addressLine2": "Apt 4B",
    "city": "Singapore",
    "postalCode": "123456",
    "phone": "+65 9123 4567"
  },
  "totalAmount": 31.00,
  "status": "pending",
  "paymentStatus": "paid",
  "paymentMethod": "stripe",
  "paymentIntentId": "pi_xxx",
  "trackingNumber": "TRACK123",
  "notes": "Leave at door",
  "createdAt": "2026-01-04T10:00:00.000Z",
  "updatedAt": "2026-01-04T10:00:00.000Z",
  "estimatedDelivery": "2026-01-07T10:00:00.000Z"
}
```

**Order Status Values:**
- `pending` - Order created, awaiting confirmation
- `confirmed` - Order confirmed by admin
- `processing` - Order being prepared
- `shipped` - Order shipped to customer
- `delivered` - Order delivered successfully
- `cancelled` - Order cancelled

### **Cart Item**
```json
{
  "userId": "user-xxx",
  "productId": "PROD-xxx",
  "productName": "Basmati Rice",
  "price": 15.50,
  "quantity": 2,
  "imageUrl": "https://...",
  "addedAt": "2026-01-04T10:00:00.000Z"
}
```

### **Address**
```json
{
  "addressId": "ADDR-xxx",
  "userId": "user-xxx",
  "fullName": "John Doe",
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "city": "Singapore",
  "postalCode": "123456",
  "phone": "+65 9123 4567",
  "isDefault": true,
  "createdAt": "2026-01-04T10:00:00.000Z",
  "updatedAt": "2026-01-04T10:00:00.000Z"
}
```

### **Error Response**
```json
{
  "error": "Error message",
  "details": "Additional error details"
}
```

---

## 🔄 Sample Integration Code

### **JavaScript/TypeScript**

```javascript
// Configuration
const CONFIG = {
  API_BASE_URL: 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev',
  COGNITO_USER_POOL_ID: 'ap-southeast-1_1BQKFzF5m',
  COGNITO_CLIENT_ID: '55rqmd54dphlke870t28ma9nju',
  AWS_REGION: 'ap-southeast-1',
  STRIPE_PUBLISHABLE_KEY: 'pk_test_your_publishable_key_here'
};

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// Example: Get Products
async function getProducts(limit = 20) {
  return apiCall(`/products?limit=${limit}`);
}

// Example: Search Products
async function searchProducts(query) {
  return apiCall(`/products/search?q=${encodeURIComponent(query)}`);
}

// Example: Get User Cart (Authenticated)
async function getCart(authToken) {
  return apiCall('/cart', {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
}

// Example: Add to Cart (Authenticated)
async function addToCart(authToken, productId, quantity) {
  return apiCall('/cart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ productId, quantity })
  });
}

// Example: Create Order (Authenticated)
async function createOrder(authToken, orderData) {
  return apiCall('/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify(orderData)
  });
}

// Example: Create Payment Intent (Authenticated)
async function createPaymentIntent(authToken, amount) {
  return apiCall('/payment/intent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ amount })
  });
}
```

### **React Native Example with Cognito**

```javascript
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'ap-southeast-1_1BQKFzF5m',
  ClientId: '55rqmd54dphlke870t28ma9nju'
};

const userPool = new CognitoUserPool(poolData);

// Login Function
function loginUser(email, password) {
  return new Promise((resolve, reject) => {
    const authenticationData = {
      Username: email,
      Password: password
    };

    const authenticationDetails = new AuthenticationDetails(authenticationData);

    const userData = {
      Username: email,
      Pool: userPool
    };

    const cognitoUser = new CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        const idToken = result.getIdToken().getJwtToken();
        const accessToken = result.getAccessToken().getJwtToken();

        resolve({
          idToken,
          accessToken,
          user: cognitoUser
        });
      },
      onFailure: (err) => {
        reject(err);
      }
    });
  });
}

// Usage
async function example() {
  try {
    // Login
    const { idToken } = await loginUser('user@example.com', 'Password123');

    // Use token to fetch cart
    const cart = await getCart(idToken);
    console.log('Cart:', cart);

  } catch (error) {
    console.error('Error:', error);
  }
}
```

### **Flutter/Dart Example**

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class SaagaAPI {
  static const String baseUrl = 'https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev';

  // Get Products
  static Future<Map<String, dynamic>> getProducts({int limit = 20}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/products?limit=$limit'),
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load products');
    }
  }

  // Get Cart (Authenticated)
  static Future<Map<String, dynamic>> getCart(String authToken) async {
    final response = await http.get(
      Uri.parse('$baseUrl/cart'),
      headers: {
        'Authorization': 'Bearer $authToken',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to load cart');
    }
  }

  // Add to Cart (Authenticated)
  static Future<Map<String, dynamic>> addToCart(
    String authToken,
    String productId,
    int quantity,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/cart'),
      headers: {
        'Authorization': 'Bearer $authToken',
        'Content-Type': 'application/json',
      },
      body: json.encode({
        'productId': productId,
        'quantity': quantity,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      throw Exception('Failed to add to cart');
    }
  }
}
```

---

## 📊 Current Database Content

**Products:** 280 products across 9 categories

**Categories:**
- Oils & Ghee (23 products)
- Pickles & Condiments (14 products)
- Snacks (2 products)
- Rice & Grains (25 products)
- Flours (2 products)
- Lentils & Pulses (27 products)
- Spices (66 products)
- Beverages (15 products)
- Uncategorized (106 products)

---

## ⚠️ Important Notes

### **CORS**
All endpoints have CORS enabled for cross-origin requests from any origin (`*`).

### **Rate Limiting**
- API Gateway default limits apply
- Consider implementing client-side rate limiting for better UX

### **Token Management**
- ID tokens expire after **1 hour**
- Store tokens securely (use secure storage, not plain text)
- Implement automatic token refresh using refresh tokens
- Never expose tokens in URLs or logs

### **Pagination**
- Default limit for list endpoints: 20 items
- Use `lastEvaluatedKey` from response for next page
- Max limit: 1000 items per request

### **Currency**
- All prices are in **SGD** (Singapore Dollars)
- Prices are stored as decimal numbers (e.g., 15.50)
- For Stripe, convert to cents: amount * 100

### **Image URLs**
- All product images are publicly accessible via S3
- Images are stored in `/products/` folder
- URL format: `https://saaga-online-api-product-images-dev.s3.ap-southeast-1.amazonaws.com/products/{filename}`

### **Error Handling**
All errors return a consistent format:
```json
{
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created successfully
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (valid token but insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### **Data Validation**
- Email addresses must be valid format
- Phone numbers should include country code (e.g., +65)
- Postal codes should be valid Singapore format
- Product quantities must be positive integers
- Prices must be positive decimal numbers

---

## 🧪 Testing

### **Test Credentials**
```
Email: admin@saaga.com
Password: Admin@123
```

### **Using cURL**

**Get Products:**
```bash
curl "https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev/products?limit=10"
```

**Get Categories:**
```bash
curl "https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev/categories"
```

**Search Products:**
```bash
curl "https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev/products/search?q=rice"
```

**Get Cart (Authenticated):**
```bash
curl "https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev/cart" \
  -H "Authorization: Bearer YOUR_ID_TOKEN"
```

**Create Order (Authenticated):**
```bash
curl -X POST "https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev/orders" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "PROD-xxx",
        "productName": "Basmati Rice",
        "quantity": 2,
        "price": 15.50
      }
    ],
    "shippingAddress": {
      "fullName": "John Doe",
      "addressLine1": "123 Main St",
      "city": "Singapore",
      "postalCode": "123456",
      "phone": "+65 9123 4567"
    },
    "paymentMethod": "stripe",
    "paymentIntentId": "pi_xxx",
    "totalAmount": 31.00
  }'
```

---

## 🔗 Additional Resources

- **Admin Dashboard:** http://saaga-online-admin-dashboard-1767537943.s3-website-ap-southeast-1.amazonaws.com
- **AWS Console:** [AWS Management Console](https://console.aws.amazon.com/)
- **Cognito Documentation:** [AWS Cognito Docs](https://docs.aws.amazon.com/cognito/)
- **Stripe Documentation:** [Stripe API Docs](https://stripe.com/docs/api)

---

## 📞 Support

For technical issues or questions:
1. Check CloudWatch Logs for Lambda errors
2. Review API Gateway execution logs
3. Test endpoints with curl/Postman
4. Verify JWT token validity and expiration

---

**Documentation Version:** 1.0
**Last Updated:** January 4, 2026
**Maintained By:** Development Team
