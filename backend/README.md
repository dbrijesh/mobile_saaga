# Saaga Groceries Backend

Serverless backend API for Saaga Indian Groceries mobile app built with AWS Lambda, API Gateway, DynamoDB, and Cognito.

## Architecture

- **AWS Lambda**: Serverless compute for API handlers
- **API Gateway**: RESTful API endpoints
- **DynamoDB**: NoSQL database for products, orders, cart, addresses
- **Cognito**: User authentication and authorization
- **S3**: Product image storage
- **Stripe**: Payment processing

## Setup

### Prerequisites

- Node.js 18+
- AWS CLI configured with credentials
- Serverless Framework

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
AWS_REGION=ap-southeast-1
```

### Deploy

```bash
# Deploy to dev environment
npm run deploy:dev

# Deploy to production
npm run deploy:prod
```

### Import Products

First, convert the Excel file to JSON:

```bash
cd ../scripts
npm install
npm run convert
```

Then import to DynamoDB:

```bash
cd ../backend
export PRODUCTS_TABLE=saaga-groceries-api-products-dev
export CATEGORIES_TABLE=saaga-groceries-api-categories-dev
npm run import-products
```

## API Endpoints

### Public Endpoints

- `GET /products` - Get all products
- `GET /products/{id}` - Get product by ID
- `GET /products/search?q={query}` - Search products
- `GET /products/category/{category}` - Get products by category
- `GET /categories` - Get all categories
- `GET /support/faqs` - Get FAQs

### Authenticated Endpoints (Require Cognito JWT)

#### Cart
- `GET /cart` - Get user cart
- `POST /cart` - Add item to cart
- `PUT /cart/{itemId}` - Update cart item
- `DELETE /cart/{itemId}` - Remove item from cart
- `DELETE /cart` - Clear cart

#### Orders
- `POST /orders` - Create order
- `GET /orders` - Get user orders
- `GET /orders/{orderId}` - Get order details
- `PUT /orders/{orderId}/status` - Update order status

#### Addresses
- `GET /addresses` - Get user addresses
- `POST /addresses` - Create address
- `PUT /addresses/{addressId}` - Update address
- `DELETE /addresses/{addressId}` - Delete address

#### Payment
- `POST /payment/intent` - Create Stripe payment intent
- `POST /payment/confirm` - Confirm payment

#### User Profile
- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile

#### Support
- `POST /support/ticket` - Submit support ticket

### Admin Endpoints

- `GET /admin/orders` - Get all orders
- `POST /admin/products` - Create product
- `PUT /admin/products/{id}` - Update product
- `DELETE /admin/products/{id}` - Delete product
- `PUT /admin/inventory/{productId}` - Update inventory

## Testing Locally

```bash
npm run offline
```

## Project Structure

```
backend/
├── src/
│   └── handlers/
│       ├── products.js
│       ├── categories.js
│       ├── cart.js
│       ├── orders.js
│       ├── addresses.js
│       ├── payment.js
│       ├── users.js
│       ├── support.js
│       └── admin/
│           ├── orders.js
│           ├── products.js
│           └── inventory.js
├── scripts/
│   └── importProducts.js
├── data/
│   ├── products.json
│   ├── categories.json
│   └── stats.json
├── serverless.yml
└── package.json
```
