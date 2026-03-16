# Saaga Online - Deployment Summary

**Deployment Date:** January 4, 2026
**Application Name:** Saaga Online (formerly Saaga Groceries)
**AWS Region:** ap-southeast-1 (Singapore)

---

## ✅ Deployment Complete

All AWS resources have been successfully created and deployed in your new AWS account with Lambda functions secured in a private VPC.

---

## 🏗️ Infrastructure Overview

### VPC Configuration
- **VPC CIDR:** 10.0.0.0/16
- **Public Subnets:**
  - 10.0.1.0/24 (ap-southeast-1a)
  - 10.0.2.0/24 (ap-southeast-1b)
- **Private Subnets (Lambda):**
  - 10.0.11.0/24 (ap-southeast-1a)
  - 10.0.12.0/24 (ap-southeast-1b)
- **NAT Gateways:** 2 (High Availability across AZs)
- **Security:** Lambda functions deployed in private subnets with egress-only internet access

---

## 🔑 AWS Resources Created

### 1. API Gateway
- **Endpoint:** https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev
- **Type:** REST API
- **CORS:** Enabled for all origins
- **Endpoints:** 30 API endpoints (Products, Cart, Orders, Addresses, Payments, Admin)

### 2. Cognito User Pool
- **User Pool ID:** ap-southeast-1_1BQKFzF5m
- **Client ID:** 55rqmd54dphlke870t28ma9nju
- **Authentication:** Email-based login with password requirements
- **Admin User Created:**
  - **Email:** admin@saaga.com
  - **Password:** Admin@123
  - **Status:** Active (password permanent)

### 3. DynamoDB Tables
All tables use PAY_PER_REQUEST billing mode:

| Table Name | Primary Key | GSI | Items |
|-----------|-------------|-----|-------|
| saaga-online-api-products-dev | id | CategoryIndex | 280 products |
| saaga-online-api-categories-dev | id | - | 9 categories |
| saaga-online-api-orders-dev | orderId | UserOrdersIndex | - |
| saaga-online-api-cart-dev | userId, productId | - | - |
| saaga-online-api-addresses-dev | addressId | UserAddressesIndex | - |
| saaga-online-api-users-dev | userId | - | - |

### 4. S3 Buckets
- **Product Images:** saaga-online-api-product-images-dev
  - Public read access enabled
  - CORS configured
  - Image URL format: `https://saaga-online-api-product-images-dev.s3.ap-southeast-1.amazonaws.com/products/{uuid}.{ext}`

- **Admin Dashboard:** saaga-online-admin-dashboard-1767537943
  - Static website hosting enabled
  - Public read access enabled
  - **URL:** http://saaga-online-admin-dashboard-1767537943.s3-website-ap-southeast-1.amazonaws.com

### 5. Lambda Functions (30 functions)
All Lambda functions are:
- **Runtime:** Node.js 18.x
- **Memory:** 512 MB
- **Timeout:** 30 seconds
- **VPC:** Deployed in private subnets
- **Size:** 7.6 MB each (includes all dependencies)

Functions include:
- Product APIs (getProducts, getProductById, searchProducts, getProductsByCategory)
- Cart APIs (getCart, addToCart, updateCartItem, removeFromCart, clearCart)
- Order APIs (createOrder, getOrders, getOrderById, updateOrderStatus)
- Address APIs (getAddresses, createAddress, updateAddress, deleteAddress)
- Payment APIs (createPaymentIntent, confirmPayment)
- User APIs (getUserProfile, updateUserProfile)
- Support APIs (submitSupportTicket, getFAQs)
- Admin APIs (products, orders, inventory, upload)

---

## 📱 Application Configurations

### Mobile App (React Native/Expo)
**File:** `mobile/app.json`

Configuration updated with:
```json
{
  "name": "Saaga Online",
  "slug": "saaga-online",
  "extra": {
    "apiUrl": "https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev",
    "cognitoUserPoolId": "ap-southeast-1_1BQKFzF5m",
    "cognitoClientId": "55rqmd54dphlke870t28ma9nju",
    "awsRegion": "ap-southeast-1"
  }
}
```

### Admin Dashboard (React/Vite)
**File:** `admin/.env`

```
VITE_API_URL=https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev
```

**Deployed URL:** http://saaga-online-admin-dashboard-1767537943.s3-website-ap-southeast-1.amazonaws.com

---

## 🔐 Admin Access

### Admin Dashboard Login
1. Open: http://saaga-online-admin-dashboard-1767537943.s3-website-ap-southeast-1.amazonaws.com
2. Email: admin@saaga.com
3. Password: Admin@123

### Features Available:
- View all products with real-time inventory
- Edit product details (name, description, category, price, stock, images)
- Upload product images to S3
- Manage categories
- View and manage orders
- Dashboard analytics

---

## 📊 Data Imported

### Products
- **Total:** 280 products
- **Categories:**
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

## 🧪 API Testing

### Test Endpoints

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

**Get Products by Category:**
```bash
curl "https://cfrgxy85j4.execute-api.ap-southeast-1.amazonaws.com/dev/products/category/Spices"
```

### Test Results
✅ Products endpoint: Working (280 products available)
✅ Categories endpoint: Working (9 categories available)
✅ CORS headers: Properly configured
✅ Lambda VPC connectivity: Verified via API Gateway

---

## 🔒 Security Features

### Network Security
1. **Private Subnets:** All Lambda functions run in private subnets
2. **NAT Gateways:** Provide secure outbound internet access for AWS service calls
3. **Security Groups:** Lambda functions have egress-only rules
4. **No Direct Internet Access:** Lambda functions cannot be accessed directly from the internet

### Authentication
1. **Cognito User Pool:** Email/password authentication
2. **JWT Tokens:** API Gateway validates tokens for protected endpoints
3. **Admin Authorization:** Admin endpoints require valid Cognito tokens

### API Security
1. **CORS:** Configured to allow cross-origin requests
2. **HTTPS:** All API calls use TLS encryption
3. **Rate Limiting:** API Gateway default limits apply

---

## 💰 Cost Estimation

### Monthly Costs (Estimated for Development/Low Traffic)

| Service | Estimated Cost |
|---------|---------------|
| VPC (NAT Gateways) | ~$65/month (2 NAT Gateways @ $0.045/hour) |
| Lambda | $0-5/month (first 1M requests free) |
| API Gateway | $0-5/month (first 1M requests free) |
| DynamoDB | $0-5/month (PAY_PER_REQUEST, minimal usage) |
| S3 | $1-3/month (storage + requests) |
| Cognito | Free (up to 50,000 MAUs) |
| **Total** | **~$70-85/month** |

**Note:** NAT Gateways are the primary cost. For production, consider:
- Using VPC endpoints for DynamoDB and S3 (reduces NAT Gateway data transfer costs)
- Single NAT Gateway in production if high availability isn't critical

---

## 🚀 Next Steps

### For Mobile App Development
1. Start Expo dev server:
   ```bash
   cd mobile
   npx expo start
   ```

2. Test on emulator/device

3. Build for production:
   ```bash
   npx eas build --platform android
   npx eas build --platform ios
   ```

### For Backend Updates
1. Make changes to Lambda handlers in `backend/src/handlers/`

2. Deploy changes:
   ```bash
   cd backend
   export STRIPE_SECRET_KEY=sk_test_YOUR_STRIPE_SECRET_KEY_HERE
   npx serverless deploy
   ```

### For Admin Dashboard Updates
1. Make changes in `admin/src/`

2. Build and deploy:
   ```bash
   cd admin
   npm run build
   aws s3 sync dist/ s3://saaga-online-admin-dashboard-1767537943/
   ```

---

## 📝 Important Notes

1. **VPC Considerations:**
   - Lambda cold starts may be slightly longer due to ENI creation
   - NAT Gateways provide secure internet access but add cost
   - Consider VPC endpoints for frequently accessed AWS services

2. **Stripe Integration:**
   - Update `STRIPE_SECRET_KEY` in environment for production
   - Update mobile app `stripePublishableKey` in `app.json`

3. **Image Upload:**
   - Images are uploaded directly to S3 as base64
   - Public read access is enabled on the product images bucket
   - Image URLs are returned immediately after upload

4. **Cognito:**
   - Users can self-register via mobile app
   - Admin user has full access to admin dashboard
   - Implement admin role checks in Lambda for production

---

## 🆘 Troubleshooting

### API Returns 502 Bad Gateway
- Check Lambda logs: `aws logs tail /aws/lambda/saaga-online-api-dev-{functionName} --follow`
- Verify Lambda has internet access via NAT Gateway
- Check Security Group rules

### Images Not Loading
- Verify S3 bucket policy allows public read
- Check image URL format
- Ensure bucket Block Public Access is disabled

### Admin Dashboard Not Loading
- Check S3 bucket policy
- Verify static website hosting is enabled
- Check browser console for errors

### Lambda Timeout Issues
- Check NAT Gateway is properly configured
- Verify route tables are correct
- Increase Lambda timeout if needed

---

## 📞 Support

For AWS-specific issues:
- Check CloudWatch Logs for Lambda errors
- Use CloudFormation console to review stack resources
- Review API Gateway execution logs

For application issues:
- Check console logs in browser developer tools
- Review mobile app logs in Expo
- Test API endpoints with curl/Postman

---

---

## 🔧 Issue Resolution & Feature Updates

### Admin Login Authentication Fix (January 4, 2026)

**Issue:** Admin dashboard was authenticating against the old Cognito user pool instead of the new one, causing 401 errors when uploading images.

**Root Cause:** Cognito credentials were hardcoded in `admin/src/pages/Login.tsx`:
```typescript
const poolData = {
  UserPoolId: 'ap-southeast-1_iORsaH7z5',  // OLD POOL
  ClientId: '1okf8v98qb005jvr14lalhankj'   // OLD CLIENT
};
```

**Solution:**
1. Updated `.env` file with new Cognito credentials
2. Modified `Login.tsx` to use environment variables:
   ```typescript
   const poolData = {
     UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
     ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID
   };
   ```
3. Created `vite-env.d.ts` for TypeScript type definitions
4. Rebuilt and redeployed admin dashboard to S3

**Status:** ✅ Fixed - Admin dashboard now authenticates with new Cognito pool

---

### Admin Dashboard Feature Enhancements (January 4, 2026)

**New Features Added:**

#### 1. Category Management
- **Backend:** Created full CRUD API endpoints for categories
  - `GET /admin/categories` - List all categories
  - `POST /admin/categories` - Create new category
  - `PUT /admin/categories/{id}` - Update category
  - `DELETE /admin/categories/{id}` - Delete category (with product check)
- **Frontend:** New Categories page with:
  - Grid view of all categories with icons
  - Add, edit, and delete functionality
  - Input validation and error handling
  - Authentication-protected API calls

#### 2. Product Management Enhancement
- **Backend:** Added create product endpoint (was already in code but verified)
  - `POST /admin/products` - Create new product
- **Frontend:** Enhanced Inventory page with:
  - "Add New Product" button and modal
  - Full product creation form with all fields
  - Image upload support for new products
  - Dynamic SKU generation for new products

#### 3. Order Status Update Fix
- **Issue:** Order status updates were failing with 401 errors
- **Root Cause:** Missing Authorization header in API call
- **Fix:** Updated `Orders.tsx` to include JWT token in status update requests
- **Status:** ✅ Fixed - Order status updates now work correctly

**Files Modified:**
- Backend:
  - `backend/src/handlers/admin/categories.js` (new)
  - `backend/serverless.yml` (added category endpoints)
- Frontend:
  - `admin/src/pages/Categories.tsx` (new)
  - `admin/src/pages/Categories.css` (new)
  - `admin/src/pages/Inventory.tsx` (enhanced)
  - `admin/src/pages/Inventory.css` (updated)
  - `admin/src/pages/Orders.tsx` (fixed)
  - `admin/src/App.tsx` (added route)
  - `admin/src/components/Layout.tsx` (added nav item)
  - `admin/src/vite-env.d.ts` (new)
  - `admin/.env` (updated with Cognito credentials)

**Deployment:**
- Backend: ✅ Deployed with 34 Lambda functions
- Admin Dashboard: ✅ Rebuilt and redeployed to S3

---

### Critical Bug Fix - Admin Orders 502 Error (January 4, 2026)

**Issue:** Admin Orders page returning 502 Bad Gateway error

**Root Cause:** Incorrect import path in `backend/src/handlers/admin/orders.js`
```javascript
// WRONG (was in admin subdirectory)
const { corsHeaders } = require('../utils/cors');

// CORRECT
const { corsHeaders } = require('../../utils/cors');
```

**Lambda Error Log:**
```
Runtime.ImportModuleError: Error: Cannot find module '../utils/cors'
```

**Solution:**
1. Fixed import path to use correct relative path `../../utils/cors`
2. Redeployed backend to AWS
3. Verified endpoint working correctly

**Status:** ✅ Fixed - Orders page now loads successfully

---

### Address API IAM Permissions Fix (January 4, 2026)

**Issue:** Address GET/POST endpoints returning 500/400 errors

**Root Cause:** Lambda IAM role missing DynamoDB Query permission for addresses table GSI (UserAddressesIndex)

**Error Pattern:**
- `GET /addresses` - 500 Internal Server Error
- `POST /addresses` - 400/500 errors when checking for existing default addresses

**Lambda IAM Policy Before:**
```yaml
Resource:
  - "arn:aws:dynamodb:...:table/addresses-table"
  - "arn:aws:dynamodb:...:table/products-table/index/*"
  - "arn:aws:dynamodb:...:table/orders-table/index/*"
  # MISSING: addresses-table/index/* permission
```

**Solution:**
Added missing index permission in `serverless.yml`:
```yaml
- "arn:aws:dynamodb:${self:provider.region}:*:table/${self:provider.environment.ADDRESSES_TABLE}/index/*"
```

This grants Lambda functions permission to:
- Query the `UserAddressesIndex` GSI to fetch user's addresses
- Check for existing default addresses during create/update operations
- Properly execute all address-related queries

**Status:** ✅ Fixed - Address endpoints now work correctly

---

**Deployment Status:** ✅ Complete and Verified
**Last Updated:** January 4, 2026
