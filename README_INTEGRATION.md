# Saaga Groceries - Integration Documentation Summary

This document provides an overview of all the integration documentation available for building mobile or web apps that connect to the Saaga Groceries backend.

---

## 📚 Documentation Files

### 1. **BACKEND_CONFIGURATION.md** ⭐ START HERE
**What it contains:**
- ✅ **Complete deployed URLs** for all endpoints
- ✅ **AWS Cognito credentials** (User Pool ID, Client ID)
- ✅ **Ready-to-use configuration objects** for JavaScript, Python, Dart, Swift, Kotlin
- ✅ **cURL examples** for testing each endpoint
- ✅ **Authentication setup code** for AWS Cognito

**Use this for:** Getting the actual deployed backend URLs and credentials to configure your app.

### 2. **API_DOCUMENTATION.md**
**What it contains:**
- ✅ Complete API reference for all 30+ endpoints
- ✅ Request/response examples with sample data
- ✅ Query parameters and headers
- ✅ Data models with TypeScript interfaces
- ✅ Error responses and status codes
- ✅ Payment flow diagram

**Use this for:** Understanding what each endpoint does and what data it expects/returns.

### 3. **MOBILE_INTEGRATION_GUIDE.md**
**What it contains:**
- ✅ Step-by-step integration guide
- ✅ Complete authentication implementation (AWS Amplify + vanilla SDK)
- ✅ **Copy-paste ready API service layer** (JavaScript/TypeScript)
- ✅ Stripe payment integration examples
- ✅ Complete user flow examples (browse, cart, checkout, orders)
- ✅ State management recommendations (Redux, React Query)
- ✅ Testing guide and troubleshooting

**Use this for:** Building your mobile app from scratch with working code examples.

### 4. **Configuration Files**

#### `env.example`
Environment variables format - copy to your project:
```bash
API_BASE_URL=https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev
COGNITO_USER_POOL_ID=ap-southeast-1_iORsaH7z5
COGNITO_CLIENT_ID=1okf8v98qb005jvr14lalhankj
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

#### `config.example.json`
JSON configuration format - use in your app:
```json
{
  "api": {
    "baseUrl": "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev"
  },
  "cognito": {
    "userPoolId": "ap-southeast-1_iORsaH7z5",
    "clientId": "1okf8v98qb005jvr14lalhankj"
  }
}
```

#### `POSTMAN_COLLECTION.json`
Import this into Postman to test all API endpoints with pre-configured requests.

---

## 🚀 Quick Start Guide

### Step 1: Get Your Configuration
1. Open **BACKEND_CONFIGURATION.md**
2. Copy the configuration object for your platform (JavaScript, Python, Dart, Swift, Kotlin)
3. Add it to your project

### Step 2: Set Up Authentication
1. Install AWS Amplify or amazon-cognito-identity-js:
   ```bash
   npm install aws-amplify
   ```

2. Configure Cognito (from **BACKEND_CONFIGURATION.md**):
   ```javascript
   import { Amplify } from 'aws-amplify';

   Amplify.configure({
     Auth: {
       region: 'ap-southeast-1',
       userPoolId: 'ap-southeast-1_iORsaH7z5',
       userPoolWebClientId: '1okf8v98qb005jvr14lalhankj'
     }
   });
   ```

### Step 3: Create API Service
1. Copy the API service layer from **MOBILE_INTEGRATION_GUIDE.md**
2. Save as `api.service.js` in your project
3. Import and use:
   ```javascript
   import ApiService from './api.service';

   const products = await ApiService.getProducts({ limit: 10 });
   ```

### Step 4: Test the Connection
1. Test public endpoint (no auth):
   ```javascript
   const products = await ApiService.getProducts();
   console.log('Products:', products);
   ```

2. Sign up a test user:
   ```javascript
   await Auth.signUp({
     username: 'test@example.com',
     password: 'TestPass123',
     attributes: { email: 'test@example.com', name: 'Test User' }
   });
   ```

3. Test authenticated endpoint:
   ```javascript
   await ApiService.addToCart('PROD-000001', 2);
   const cart = await ApiService.getCart();
   console.log('Cart:', cart);
   ```

---

## 🎯 Backend Endpoints Summary

### Deployed API Gateway URL
```
https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev
```

### Public Endpoints (No Auth)
| Endpoint | Description |
|----------|-------------|
| `GET /products` | List all products with filtering/sorting |
| `GET /products/{id}` | Get product details |
| `GET /products/search?q=query` | Search products |
| `GET /products/category/{category}` | Get products by category |
| `GET /categories` | List all categories |
| `GET /support/faqs` | Get FAQs |

### Authenticated Endpoints (JWT Required)
| Endpoint | Description |
|----------|-------------|
| `GET /cart` | Get user's cart |
| `POST /cart` | Add item to cart |
| `PUT /cart/{productId}` | Update cart item |
| `DELETE /cart/{productId}` | Remove from cart |
| `DELETE /cart` | Clear cart |
| `POST /orders` | Create order |
| `GET /orders` | Get user's orders |
| `GET /orders/{orderId}` | Get order details |
| `POST /payment/intent` | Create payment intent |
| `POST /payment/confirm` | Confirm payment |
| `GET /addresses` | Get addresses |
| `POST /addresses` | Create address |
| `PUT /addresses/{id}` | Update address |
| `DELETE /addresses/{id}` | Delete address |
| `GET /user/profile` | Get profile |
| `PUT /user/profile` | Update profile |

---

## 🔑 AWS Cognito Details

```
Region: ap-southeast-1
User Pool ID: ap-southeast-1_iORsaH7z5
Client ID: 1okf8v98qb005jvr14lalhankj
```

**Required User Attributes:**
- Email (required, used as username)
- Name (required)
- Phone Number (optional, format: +6512345678)

**Password Requirements:**
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- Symbols optional

---

## 💳 Stripe Configuration

```
Publishable Key: pk_test_your_publishable_key_here
```

**⚠️ Note:** Replace with your actual Stripe test or live key.

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Requires Auth: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

---

## 📱 Testing the Integration

### Using cURL (No Auth)
```bash
curl "https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev/products?limit=5"
```

### Using Postman
1. Import `POSTMAN_COLLECTION.json`
2. Set variable `jwtToken` after signing in
3. Test all endpoints

### Using JavaScript/TypeScript
See **MOBILE_INTEGRATION_GUIDE.md** for complete examples.

---

## 🔧 Development Workflow

### For React Native Apps
1. **Authentication**: Use AWS Amplify or amazon-cognito-identity-js
2. **API Calls**: Copy API service layer from MOBILE_INTEGRATION_GUIDE.md
3. **Payment**: Use @stripe/stripe-react-native
4. **State Management**: Use Redux Toolkit (see mobile/src/store/) or React Query

### For Flutter Apps
1. **Authentication**: Use amplify_auth_cognito package
2. **API Calls**: Use http or dio package
3. **Payment**: Use flutter_stripe package
4. **Configuration**: Use config.example.json format

### For Native iOS Apps
1. **Authentication**: Use AWSMobileClient SDK
2. **API Calls**: Use URLSession or Alamofire
3. **Payment**: Use Stripe iOS SDK
4. **Configuration**: Use Swift config from BACKEND_CONFIGURATION.md

### For Native Android Apps
1. **Authentication**: Use AWS Amplify Android SDK
2. **API Calls**: Use Retrofit or OkHttp
3. **Payment**: Use Stripe Android SDK
4. **Configuration**: Use Kotlin config from BACKEND_CONFIGURATION.md

---

## 📊 Data Flow Example

### Complete Checkout Flow
```
1. Browse Products
   └─ GET /products

2. Add to Cart
   └─ POST /cart (requires auth)

3. View Cart
   └─ GET /cart (requires auth)

4. Select/Create Address
   └─ POST /addresses (requires auth)

5. Create Payment Intent
   └─ POST /payment/intent (requires auth)

6. Collect Payment (Stripe SDK)
   └─ Use clientSecret from step 5

7. Confirm Payment
   └─ POST /payment/confirm (requires auth)

8. Create Order
   └─ POST /orders (requires auth)

9. Clear Cart
   └─ DELETE /cart (requires auth)

10. View Order History
    └─ GET /orders (requires auth)
```

---

## 🐛 Troubleshooting

### "Unauthorized" Error
**Problem:** Getting 401 on authenticated endpoints
**Solution:**
- Ensure JWT token is included in Authorization header
- Check token hasn't expired (1 hour expiry)
- Format: `Authorization: Bearer {token}`

### CORS Errors
**Problem:** Browser blocking requests
**Solution:** CORS is enabled on backend. Check:
- Using correct API Gateway URL
- Not using localhost in production
- Headers are properly set

### Products Not Loading
**Problem:** Empty products array
**Solution:** Import products to DynamoDB:
```bash
cd backend
export PRODUCTS_TABLE=saaga-groceries-api-products-dev
npm run import-products
```

### Payment Failing
**Problem:** Stripe payment not working
**Solution:**
- Check Stripe publishable key is correct
- Use test card: 4242 4242 4242 4242
- Ensure backend has STRIPE_SECRET_KEY env var

---

## 📞 Support

- **Backend Issues**: Check serverless deployment logs
- **API Questions**: See API_DOCUMENTATION.md
- **Integration Help**: See MOBILE_INTEGRATION_GUIDE.md
- **Configuration**: See BACKEND_CONFIGURATION.md

---

## 📝 Summary

You now have everything you need to build a mobile app:

✅ **Deployed Backend URL**: https://0vdwl01ssb.execute-api.ap-southeast-1.amazonaws.com/dev
✅ **Cognito Credentials**: User Pool ID and Client ID
✅ **30+ API Endpoints**: Products, Cart, Orders, Payment, etc.
✅ **Working Code Examples**: Authentication, API calls, Payment integration
✅ **Configuration Templates**: For all major platforms
✅ **Postman Collection**: For testing
✅ **Complete Documentation**: API reference, integration guide, troubleshooting

**Start with BACKEND_CONFIGURATION.md to get your credentials, then follow MOBILE_INTEGRATION_GUIDE.md to build your app!**
