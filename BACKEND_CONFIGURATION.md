# Saaga Groceries - Backend Configuration

This file contains all the actual deployed backend URLs, credentials, and endpoint details for integration with any mobile or web application.

---

## 🔧 Environment Configuration

### AWS Region
```
ap-southeast-1 (Singapore)
```

### API Gateway Base URL
```
https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev
```

### AWS Cognito Configuration
```javascript
{
  "region": "ap-southeast-1",
  "userPoolId": "ap-southeast-1_iORsaH7z5",
  "clientId": "1okf8v98qb005jvr14lalhankj"
}
```

### Stripe Configuration
```javascript
{
  "publishableKey": "pk_test_your_publishable_key_here"
}
```

**⚠️ Note:** Replace the Stripe publishable key with your actual test or live key.

---

## 📋 Complete Endpoint Reference

All endpoints below use the base URL: `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev`

### 🔓 Public Endpoints (No Authentication Required)

#### Products

| Method | Endpoint | Full URL |
|--------|----------|----------|
| GET | `/products` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products` |
| GET | `/products/{id}` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products/{id}` |
| GET | `/products/search` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products/search` |
| GET | `/products/category/{category}` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products/category/{category}` |

**Examples:**
```bash
# Get all products
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products?limit=10"

# Get product by ID
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products/PROD-000001"

# Search products
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products/search?q=rice"

# Get products by category
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products/category/Rice"
```

#### Categories

| Method | Endpoint | Full URL |
|--------|----------|----------|
| GET | `/categories` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/categories` |

**Example:**
```bash
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/categories"
```

#### Support

| Method | Endpoint | Full URL |
|--------|----------|----------|
| GET | `/support/faqs` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/support/faqs` |

**Example:**
```bash
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/support/faqs"
```

---

### 🔐 Authenticated Endpoints (Require JWT Token)

**All authenticated requests must include:**
```
Authorization: Bearer {JWT_TOKEN}
```

#### Cart

| Method | Endpoint | Full URL |
|--------|----------|----------|
| GET | `/cart` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart` |
| POST | `/cart` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart` |
| PUT | `/cart/{productId}` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart/{productId}` |
| DELETE | `/cart/{productId}` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart/{productId}` |
| DELETE | `/cart` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart` |

**Examples:**
```bash
# Get cart
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart"

# Add to cart
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":"PROD-000001","quantity":2}' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart"

# Update cart item
curl -X PUT \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"quantity":5}' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart/PROD-000001"

# Remove from cart
curl -X DELETE \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart/PROD-000001"

# Clear cart
curl -X DELETE \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart"
```

#### Orders

| Method | Endpoint | Full URL |
|--------|----------|----------|
| POST | `/orders` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/orders` |
| GET | `/orders` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/orders` |
| GET | `/orders/{orderId}` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/orders/{orderId}` |
| PUT | `/orders/{orderId}/status` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/orders/{orderId}/status` |

**Examples:**
```bash
# Create order
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId":"PROD-000001","name":"Rice","price":18.5,"quantity":2,"subtotal":37}],
    "shippingAddress": {"name":"John Doe","phone":"+6512345678","street":"123 Orchard Rd","city":"Singapore","postalCode":"238858","country":"Singapore"},
    "paymentMethod": "stripe",
    "paymentIntentId": "pi_XXXXX",
    "totalAmount": 37.00
  }' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/orders"

# Get user orders
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/orders"

# Get order by ID
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/orders/550e8400-e29b-41d4-a716-446655440000"

# Update order status
curl -X PUT \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/orders/550e8400-e29b-41d4-a716-446655440000/status"
```

#### Payment

| Method | Endpoint | Full URL |
|--------|----------|----------|
| POST | `/payment/intent` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/payment/intent` |
| POST | `/payment/confirm` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/payment/confirm` |

**Examples:**
```bash
# Create payment intent
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":85.50,"currency":"sgd"}' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/payment/intent"

# Confirm payment
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paymentIntentId":"pi_XXXXX"}' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/payment/confirm"
```

#### Addresses

| Method | Endpoint | Full URL |
|--------|----------|----------|
| GET | `/addresses` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/addresses` |
| POST | `/addresses` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/addresses` |
| PUT | `/addresses/{addressId}` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/addresses/{addressId}` |
| DELETE | `/addresses/{addressId}` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/addresses/{addressId}` |

**Examples:**
```bash
# Get addresses
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/addresses"

# Create address
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Home",
    "recipientName":"John Doe",
    "phone":"+6512345678",
    "street":"123 Orchard Road",
    "unit":"#12-34",
    "city":"Singapore",
    "postalCode":"238858",
    "country":"Singapore",
    "isDefault":true
  }' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/addresses"

# Update address
curl -X PUT \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Office","phone":"+6587654321"}' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/addresses/addr-XXXXX"

# Delete address
curl -X DELETE \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/addresses/addr-XXXXX"
```

#### User Profile

| Method | Endpoint | Full URL |
|--------|----------|----------|
| GET | `/user/profile` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/user/profile` |
| PUT | `/user/profile` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/user/profile` |

**Examples:**
```bash
# Get profile
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/user/profile"

# Update profile
curl -X PUT \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith","phone":"+6587654321"}' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/user/profile"
```

#### Support

| Method | Endpoint | Full URL |
|--------|----------|----------|
| POST | `/support/ticket` | `https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/support/ticket` |

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject":"Order not delivered",
    "message":"My order has not arrived",
    "category":"Delivery"
  }' \
  "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/support/ticket"
```

---

## 🔑 Authentication with AWS Cognito

### Cognito Endpoints

**Region:** `ap-southeast-1`

**User Pool ID:** `ap-southeast-1_iORsaH7z5`

**Client ID:** `1okf8v98qb005jvr14lalhankj`

### Sign Up (using AWS SDK)

```javascript
import {
  CognitoUserPool,
  CognitoUserAttribute
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'ap-southeast-1_iORsaH7z5',
  ClientId: '1okf8v98qb005jvr14lalhankj'
};

const userPool = new CognitoUserPool(poolData);

function signUp(email, password, name, phone) {
  const attributeList = [
    new CognitoUserAttribute({ Name: 'email', Value: email }),
    new CognitoUserAttribute({ Name: 'name', Value: name }),
    new CognitoUserAttribute({ Name: 'phone_number', Value: phone })
  ];

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributeList, null, (err, result) => {
      if (err) reject(err);
      else resolve(result.user);
    });
  });
}
```

### Sign In (using AWS SDK)

```javascript
import {
  CognitoUser,
  AuthenticationDetails
} from 'amazon-cognito-identity-js';

function signIn(email, password) {
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

  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        resolve({
          idToken: result.getIdToken().getJwtToken(),
          accessToken: result.getAccessToken().getJwtToken(),
          refreshToken: result.getRefreshToken().getToken()
        });
      },
      onFailure: (err) => reject(err)
    });
  });
}
```

### Using AWS Amplify (Simpler)

```javascript
import { Amplify, Auth } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'ap-southeast-1',
    userPoolId: 'ap-southeast-1_iORsaH7z5',
    userPoolWebClientId: '1okf8v98qb005jvr14lalhankj'
  }
});

// Sign up
await Auth.signUp({
  username: 'user@example.com',
  password: 'SecurePass123',
  attributes: {
    email: 'user@example.com',
    name: 'John Doe',
    phone_number: '+6512345678'
  }
});

// Sign in
const user = await Auth.signIn('user@example.com', 'SecurePass123');

// Get JWT token
const session = await Auth.currentSession();
const idToken = session.getIdToken().getJwtToken();
```

---

## 📱 Ready-to-Use Configuration Objects

### JavaScript/TypeScript

```javascript
export const API_CONFIG = {
  baseUrl: 'https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev',
  region: 'ap-southeast-1',
  cognito: {
    userPoolId: 'ap-southeast-1_iORsaH7z5',
    clientId: '1okf8v98qb005jvr14lalhankj',
    region: 'ap-southeast-1'
  },
  stripe: {
    publishableKey: 'pk_test_your_publishable_key_here'
  }
};

// All endpoints
export const ENDPOINTS = {
  // Products
  PRODUCTS: '/products',
  PRODUCT_BY_ID: (id) => `/products/${id}`,
  SEARCH_PRODUCTS: '/products/search',
  PRODUCTS_BY_CATEGORY: (category) => `/products/category/${category}`,

  // Categories
  CATEGORIES: '/categories',

  // Cart
  CART: '/cart',
  CART_ITEM: (productId) => `/cart/${productId}`,

  // Orders
  ORDERS: '/orders',
  ORDER_BY_ID: (orderId) => `/orders/${orderId}`,
  ORDER_STATUS: (orderId) => `/orders/${orderId}/status`,

  // Payment
  PAYMENT_INTENT: '/payment/intent',
  PAYMENT_CONFIRM: '/payment/confirm',

  // Addresses
  ADDRESSES: '/addresses',
  ADDRESS_BY_ID: (addressId) => `/addresses/${addressId}`,

  // User
  USER_PROFILE: '/user/profile',

  // Support
  FAQS: '/support/faqs',
  SUPPORT_TICKET: '/support/ticket'
};
```

### Python

```python
API_CONFIG = {
    'base_url': 'https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev',
    'region': 'ap-southeast-1',
    'cognito': {
        'user_pool_id': 'ap-southeast-1_iORsaH7z5',
        'client_id': '1okf8v98qb005jvr14lalhankj',
        'region': 'ap-southeast-1'
    },
    'stripe': {
        'publishable_key': 'pk_test_your_publishable_key_here'
    }
}
```

### Dart/Flutter

```dart
class ApiConfig {
  static const String baseUrl = 'https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev';
  static const String region = 'ap-southeast-1';

  static const Map<String, String> cognito = {
    'userPoolId': 'ap-southeast-1_iORsaH7z5',
    'clientId': '1okf8v98qb005jvr14lalhankj',
    'region': 'ap-southeast-1',
  };

  static const Map<String, String> stripe = {
    'publishableKey': 'pk_test_your_publishable_key_here',
  };
}
```

### Swift/iOS

```swift
struct APIConfig {
    static let baseURL = "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev"
    static let region = "ap-southeast-1"

    struct Cognito {
        static let userPoolId = "ap-southeast-1_iORsaH7z5"
        static let clientId = "1okf8v98qb005jvr14lalhankj"
        static let region = "ap-southeast-1"
    }

    struct Stripe {
        static let publishableKey = "pk_test_your_publishable_key_here"
    }
}
```

### Kotlin/Android

```kotlin
object ApiConfig {
    const val BASE_URL = "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev"
    const val REGION = "ap-southeast-1"

    object Cognito {
        const val USER_POOL_ID = "ap-southeast-1_iORsaH7z5"
        const val CLIENT_ID = "1okf8v98qb005jvr14lalhankj"
        const val REGION = "ap-southeast-1"
    }

    object Stripe {
        const val PUBLISHABLE_KEY = "pk_test_your_publishable_key_here"
    }
}
```

### JSON Configuration File

```json
{
  "api": {
    "baseUrl": "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev",
    "region": "ap-southeast-1"
  },
  "cognito": {
    "userPoolId": "ap-southeast-1_iORsaH7z5",
    "clientId": "1okf8v98qb005jvr14lalhankj",
    "region": "ap-southeast-1"
  },
  "stripe": {
    "publishableKey": "pk_test_your_publishable_key_here"
  }
}
```

---

## 🧪 Testing the API

### Test Product Endpoint (No Auth)

```bash
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products?limit=5"
```

### Test Categories Endpoint (No Auth)

```bash
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/categories"
```

### Complete Test Flow

1. **Sign up a user** using AWS Cognito SDK
2. **Verify email** (check inbox for verification code)
3. **Sign in** to get JWT token
4. **Test authenticated endpoint:**
   ```bash
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/cart"
   ```

---

## 📝 Notes

- ✅ All endpoints return JSON
- ✅ CORS is enabled for all origins
- ✅ JWT tokens expire after 1 hour (use refresh token to renew)
- ✅ Currency is Singapore Dollars (SGD)
- ✅ All timestamps are ISO 8601 format
- ⚠️ This is a **DEV environment** - use for testing only
- ⚠️ Replace Stripe publishable key with your actual key

---

## 🔗 Related Documentation

- **API_DOCUMENTATION.md** - Complete API reference with request/response examples
- **MOBILE_INTEGRATION_GUIDE.md** - Step-by-step integration guide with code examples
- **CLAUDE.md** - Project overview and development commands
