# Saaga Groceries API Documentation

**Base URL:** `https://{api-gateway-id}.execute-api.ap-southeast-1.amazonaws.com/dev`
**Region:** Singapore (ap-southeast-1)
**Authentication:** AWS Cognito (JWT tokens)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Products API](#products-api)
3. [Categories API](#categories-api)
4. [Cart API](#cart-api)
5. [Orders API](#orders-api)
6. [Payment API](#payment-api)
7. [Addresses API](#addresses-api)
8. [User Profile API](#user-profile-api)
9. [Support API](#support-api)
10. [Data Models](#data-models)

---

## Authentication

### AWS Cognito Configuration

The backend uses AWS Cognito for user authentication. You'll need these values from the deployment:

```javascript
{
  "userPoolId": "ap-southeast-1_XXXXXXXXX",
  "clientId": "XXXXXXXXXXXXXXXXXXXXXXXXXX",
  "region": "ap-southeast-1"
}
```

### Sign Up

Use AWS Amplify or amazon-cognito-identity-js to sign up users:

```javascript
// Required fields
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "phone_number": "+6512345678" // Optional
}
```

### Sign In

```javascript
// Returns JWT tokens
{
  "idToken": "eyJraWQiOiI...",
  "accessToken": "eyJraWQiOiI...",
  "refreshToken": "eyJjdHkiOiI..."
}
```

### Authenticated Requests

All protected endpoints require the JWT token in the Authorization header:

```
Authorization: Bearer {idToken}
```

---

## Products API

### 1. Get All Products

**Endpoint:** `GET /products`
**Auth Required:** No

**Query Parameters:**
- `limit` (number, default: 20) - Number of products per page
- `lastKey` (string) - Pagination cursor (from previous response)
- `category` (string) - Filter by category name
- `featured` (boolean) - Filter featured products only
- `sort` (string) - Sort order: `price_asc`, `price_desc`, `name_asc`, `rating`

**Example Request:**
```
GET /products?limit=10&category=Rice&sort=price_asc
```

**Response:**
```json
{
  "products": [
    {
      "id": "PROD-000001",
      "name": "Basmati Rice Premium",
      "description": "Long grain aromatic rice",
      "category": "Rice",
      "subCategory": "Basmati",
      "brand": "India Gate",
      "unit": "kg",
      "weight": "5",
      "price": 18.50,
      "originalPrice": 22.00,
      "currency": "SGD",
      "stock": 45,
      "inStock": true,
      "imageUrl": "https://...",
      "images": ["url1", "url2"],
      "sku": "SKU-000001",
      "barcode": "1234567890123",
      "tags": ["organic", "premium"],
      "featured": true,
      "discount": 16,
      "rating": 4.5,
      "reviewCount": 23,
      "createdAt": "2025-12-14T16:46:45.994Z",
      "updatedAt": "2025-12-14T16:46:45.994Z"
    }
  ],
  "lastKey": "eyJpZCI6IlBST0QtMDAwMDEwIn0=",
  "count": 10
}
```

### 2. Get Product by ID

**Endpoint:** `GET /products/{id}`
**Auth Required:** No

**Example Request:**
```
GET /products/PROD-000001
```

**Response:**
```json
{
  "id": "PROD-000001",
  "name": "Basmati Rice Premium",
  "price": 18.50,
  ...
}
```

### 3. Search Products

**Endpoint:** `GET /products/search`
**Auth Required:** No

**Query Parameters:**
- `q` (string, required) - Search query
- `limit` (number) - Results limit

**Example Request:**
```
GET /products/search?q=rice&limit=20
```

**Response:**
```json
{
  "products": [...],
  "count": 15
}
```

### 4. Get Products by Category

**Endpoint:** `GET /products/category/{category}`
**Auth Required:** No

**Example Request:**
```
GET /products/category/Rice
```

**Response:** Same as Get All Products

---

## Categories API

### Get All Categories

**Endpoint:** `GET /categories`
**Auth Required:** No

**Response:**
```json
{
  "categories": [
    {
      "id": "CAT-0001",
      "name": "Rice",
      "slug": "rice",
      "productCount": 45,
      "imageUrl": "https://...",
      "featured": true
    }
  ],
  "count": 12
}
```

---

## Cart API

All cart endpoints require authentication.

### 1. Get Cart

**Endpoint:** `GET /cart`
**Auth Required:** Yes

**Response:**
```json
{
  "items": [
    {
      "userId": "cognito-user-id",
      "productId": "PROD-000001",
      "quantity": 2,
      "addedAt": "2025-12-30T10:00:00.000Z",
      "updatedAt": "2025-12-30T10:05:00.000Z",
      "product": {
        "id": "PROD-000001",
        "name": "Basmati Rice Premium",
        "price": 18.50,
        ...
      },
      "subtotal": 37.00
    }
  ],
  "itemCount": 3,
  "total": 85.50
}
```

### 2. Add to Cart

**Endpoint:** `POST /cart`
**Auth Required:** Yes

**Request Body:**
```json
{
  "productId": "PROD-000001",
  "quantity": 2
}
```

**Response:**
```json
{
  "message": "Item added to cart",
  "item": {
    "userId": "cognito-user-id",
    "productId": "PROD-000001",
    "quantity": 2,
    "addedAt": "2025-12-30T10:00:00.000Z",
    "updatedAt": "2025-12-30T10:00:00.000Z"
  }
}
```

### 3. Update Cart Item

**Endpoint:** `PUT /cart/{productId}`
**Auth Required:** Yes

**Request Body:**
```json
{
  "quantity": 5
}
```

**Response:**
```json
{
  "message": "Cart item updated",
  "item": {...}
}
```

### 4. Remove from Cart

**Endpoint:** `DELETE /cart/{productId}`
**Auth Required:** Yes

**Response:**
```json
{
  "message": "Item removed from cart"
}
```

### 5. Clear Cart

**Endpoint:** `DELETE /cart`
**Auth Required:** Yes

**Response:**
```json
{
  "message": "Cart cleared"
}
```

---

## Orders API

All order endpoints require authentication.

### 1. Create Order

**Endpoint:** `POST /orders`
**Auth Required:** Yes

**Request Body:**
```json
{
  "items": [
    {
      "productId": "PROD-000001",
      "name": "Basmati Rice Premium",
      "price": 18.50,
      "quantity": 2,
      "subtotal": 37.00
    }
  ],
  "shippingAddress": {
    "name": "John Doe",
    "phone": "+6512345678",
    "street": "123 Orchard Road",
    "unit": "#12-34",
    "city": "Singapore",
    "postalCode": "238858",
    "country": "Singapore"
  },
  "paymentMethod": "stripe",
  "paymentIntentId": "pi_XXXXXXXXXX",
  "totalAmount": 85.50,
  "notes": "Please ring doorbell"
}
```

**Response:**
```json
{
  "message": "Order created successfully",
  "order": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "cognito-user-id",
    "items": [...],
    "shippingAddress": {...},
    "paymentMethod": "stripe",
    "paymentIntentId": "pi_XXXXXXXXXX",
    "totalAmount": 85.50,
    "status": "pending",
    "paymentStatus": "paid",
    "notes": "Please ring doorbell",
    "createdAt": "2025-12-30T10:00:00.000Z",
    "updatedAt": "2025-12-30T10:00:00.000Z",
    "estimatedDelivery": "2026-01-02T10:00:00.000Z"
  }
}
```

### 2. Get User Orders

**Endpoint:** `GET /orders`
**Auth Required:** Yes

**Query Parameters:**
- `limit` (number, default: 20)
- `status` (string) - Filter by status: `pending`, `processing`, `shipped`, `delivered`, `cancelled`

**Response:**
```json
{
  "orders": [
    {
      "orderId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "cognito-user-id",
      "items": [...],
      "totalAmount": 85.50,
      "status": "delivered",
      "createdAt": "2025-12-30T10:00:00.000Z",
      ...
    }
  ],
  "count": 5
}
```

### 3. Get Order by ID

**Endpoint:** `GET /orders/{orderId}`
**Auth Required:** Yes

**Response:**
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "cognito-user-id",
  "items": [...],
  "shippingAddress": {...},
  "totalAmount": 85.50,
  "status": "delivered",
  ...
}
```

### 4. Update Order Status

**Endpoint:** `PUT /orders/{orderId}/status`
**Auth Required:** Yes

**Request Body:**
```json
{
  "status": "cancelled"
}
```

**Response:**
```json
{
  "message": "Order status updated",
  "order": {...}
}
```

---

## Payment API

All payment endpoints require authentication.

### 1. Create Payment Intent

**Endpoint:** `POST /payment/intent`
**Auth Required:** Yes

**Request Body:**
```json
{
  "amount": 85.50,
  "currency": "sgd",
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "clientSecret": "pi_XXXX_secret_YYYY",
  "paymentIntentId": "pi_XXXXXXXXXX"
}
```

**Usage:**
1. Call this endpoint before checkout
2. Use `clientSecret` with Stripe mobile SDK to collect payment
3. After successful payment, call confirm endpoint

### 2. Confirm Payment

**Endpoint:** `POST /payment/confirm`
**Auth Required:** Yes

**Request Body:**
```json
{
  "paymentIntentId": "pi_XXXXXXXXXX"
}
```

**Response:**
```json
{
  "status": "succeeded",
  "amount": 85.50,
  "currency": "sgd",
  "metadata": {
    "userId": "cognito-user-id",
    "userEmail": "user@example.com",
    "orderId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

## Addresses API

All address endpoints require authentication.

### 1. Get Addresses

**Endpoint:** `GET /addresses`
**Auth Required:** Yes

**Response:**
```json
{
  "addresses": [
    {
      "addressId": "addr-XXXXXXXXXX",
      "userId": "cognito-user-id",
      "name": "Home",
      "recipientName": "John Doe",
      "phone": "+6512345678",
      "street": "123 Orchard Road",
      "unit": "#12-34",
      "city": "Singapore",
      "postalCode": "238858",
      "country": "Singapore",
      "isDefault": true,
      "createdAt": "2025-12-30T10:00:00.000Z",
      "updatedAt": "2025-12-30T10:00:00.000Z"
    }
  ],
  "count": 2
}
```

### 2. Create Address

**Endpoint:** `POST /addresses`
**Auth Required:** Yes

**Request Body:**
```json
{
  "name": "Office",
  "recipientName": "John Doe",
  "phone": "+6512345678",
  "street": "456 Robinson Road",
  "unit": "#05-12",
  "city": "Singapore",
  "postalCode": "068908",
  "country": "Singapore",
  "isDefault": false
}
```

**Response:**
```json
{
  "message": "Address created successfully",
  "address": {...}
}
```

### 3. Update Address

**Endpoint:** `PUT /addresses/{addressId}`
**Auth Required:** Yes

**Request Body:** Same as Create Address

**Response:**
```json
{
  "message": "Address updated successfully",
  "address": {...}
}
```

### 4. Delete Address

**Endpoint:** `DELETE /addresses/{addressId}`
**Auth Required:** Yes

**Response:**
```json
{
  "message": "Address deleted successfully"
}
```

---

## User Profile API

### 1. Get User Profile

**Endpoint:** `GET /user/profile`
**Auth Required:** Yes

**Response:**
```json
{
  "userId": "cognito-user-id",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+6512345678",
  "createdAt": "2025-12-30T10:00:00.000Z",
  "updatedAt": "2025-12-30T10:00:00.000Z"
}
```

### 2. Update User Profile

**Endpoint:** `PUT /user/profile`
**Auth Required:** Yes

**Request Body:**
```json
{
  "name": "John Smith",
  "phone": "+6587654321"
}
```

**Response:**
```json
{
  "message": "Profile updated successfully",
  "user": {...}
}
```

---

## Support API

### 1. Get FAQs

**Endpoint:** `GET /support/faqs`
**Auth Required:** No

**Response:**
```json
{
  "faqs": [
    {
      "id": "faq-001",
      "question": "What are your delivery hours?",
      "answer": "We deliver from 9 AM to 9 PM, 7 days a week.",
      "category": "Delivery"
    }
  ],
  "count": 10
}
```

### 2. Submit Support Ticket

**Endpoint:** `POST /support/ticket`
**Auth Required:** Yes

**Request Body:**
```json
{
  "subject": "Order not delivered",
  "message": "My order #12345 has not arrived yet",
  "category": "Delivery",
  "orderId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "message": "Support ticket submitted successfully",
  "ticket": {
    "ticketId": "TKT-XXXXXXXXXX",
    "userId": "cognito-user-id",
    "subject": "Order not delivered",
    "status": "open",
    "createdAt": "2025-12-30T10:00:00.000Z"
  }
}
```

---

## Data Models

### Product
```typescript
interface Product {
  id: string;                  // PROD-XXXXXX
  name: string;
  description: string;
  category: string;
  subCategory: string;
  brand: string;
  unit: string;                // kg, g, pcs, L, ml
  weight: string;
  price: number;               // SGD
  originalPrice: number | null;
  currency: string;            // SGD
  stock: number;
  inStock: boolean;
  imageUrl: string;
  images: string[];
  sku: string;
  barcode: string;
  tags: string[];
  featured: boolean;
  discount: number;            // percentage
  rating: number;              // 0-5
  reviewCount: number;
  createdAt: string;           // ISO 8601
  updatedAt: string;
}
```

### Category
```typescript
interface Category {
  id: string;                  // CAT-XXXX
  name: string;
  slug: string;
  productCount: number;
  imageUrl: string;
  featured: boolean;
}
```

### Order
```typescript
interface Order {
  orderId: string;             // UUID
  userId: string;              // Cognito sub
  items: OrderItem[];
  shippingAddress: Address;
  paymentMethod: string;       // stripe
  paymentIntentId: string;
  totalAmount: number;
  status: OrderStatus;         // pending, processing, shipped, delivered, cancelled
  paymentStatus: string;       // paid, pending, failed
  notes: string;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery: string;
}

interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
```

### Cart Item
```typescript
interface CartItem {
  userId: string;
  productId: string;
  quantity: number;
  addedAt: string;
  updatedAt: string;
  product?: Product;           // Populated when getting cart
  subtotal?: number;           // Calculated when getting cart
}
```

### Address
```typescript
interface Address {
  addressId: string;
  userId: string;
  name: string;                // Label: Home, Office, etc.
  recipientName: string;
  phone: string;
  street: string;
  unit: string;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (valid token but insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Getting Started

### 1. Deploy the Backend
```bash
cd backend
export STRIPE_SECRET_KEY=sk_test_your_key
npm run deploy:dev
```

### 2. Note the Output Values
After deployment, save these values:
- API Gateway URL
- Cognito User Pool ID
- Cognito Client ID

### 3. Configure Your Mobile App
Use the values from step 2 to configure authentication and API calls.

### 4. Test Authentication
1. Sign up a test user
2. Verify email (check spam folder)
3. Sign in to get JWT tokens
4. Use the ID token for authenticated API calls

### 5. Example: Fetch Products
```javascript
// No auth needed
fetch('https://your-api.execute-api.ap-southeast-1.amazonaws.com/dev/products?limit=10')
  .then(res => res.json())
  .then(data => console.log(data.products));
```

### 6. Example: Add to Cart
```javascript
// Auth required
fetch('https://your-api.execute-api.ap-southeast-1.amazonaws.com/dev/cart', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    productId: 'PROD-000001',
    quantity: 2
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## Payment Flow

1. **Add items to cart** → `POST /cart`
2. **Get cart total** → `GET /cart`
3. **Create payment intent** → `POST /payment/intent`
4. **Collect payment** → Use Stripe SDK with clientSecret
5. **Confirm payment** → `POST /payment/confirm`
6. **Create order** → `POST /orders` with paymentIntentId
7. **Clear cart** → `DELETE /cart`

---

## Notes

- All timestamps are in ISO 8601 format
- Currency is Singapore Dollars (SGD)
- Prices in payment intent are converted to cents automatically
- User ID is extracted from JWT token automatically
- CORS is enabled for all endpoints
- Pagination uses cursor-based approach (lastKey)
- All endpoints support JSON request/response format
