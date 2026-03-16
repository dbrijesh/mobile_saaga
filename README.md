# 🛒 Saaga Indian Groceries - Complete E-Commerce Platform

A modern, full-stack serverless e-commerce platform for Indian groceries in Singapore, built with React Native (mobile), React (admin dashboard), and AWS serverless architecture.

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)

## ✨ Features

### Mobile App (React Native)
- 📱 Cross-platform (iOS & Android)
- 🔐 AWS Cognito authentication (sign up, sign in, forgot password)
- 🛍️ Product browsing with categories and search
- 🛒 Shopping cart management
- 💳 Stripe payment integration
- 📍 Address management
- 📦 Order tracking
- 💬 Help & support with FAQs
- 🎨 Modern, sleek UI with smooth animations

### Admin Dashboard (React Web)
- 📊 Real-time analytics dashboard
- 📦 Order management with status updates
- 📋 Inventory control
- 📈 Revenue and sales charts
- 🔍 Advanced filtering and search

### Backend (AWS Serverless)
- ⚡ AWS Lambda functions
- 🚪 API Gateway REST APIs
- 💾 DynamoDB for data storage
- 🔒 Cognito for authentication
- 💳 Stripe payment processing
- 📦 S3 for image storage
- 🚀 CloudFront CDN

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Mobile App (React Native)              │
│  - iOS & Android                                         │
│  - Redux Toolkit State Management                       │
│  - React Navigation                                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ HTTPS/REST
                 │
┌────────────────▼────────────────────────────────────────┐
│              AWS API Gateway                             │
│  - REST API Endpoints                                    │
│  - Cognito Authorizer                                    │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
┌────────▼──────┐  ┌─────▼──────────┐
│ AWS Lambda    │  │ AWS Cognito    │
│ Functions     │  │ User Pool      │
└───────┬───────┘  └────────────────┘
        │
        │
┌───────▼──────────────────────────────┐
│   DynamoDB Tables                     │
│   - Products                          │
│   - Users                             │
│   - Orders                            │
│   - Cart                              │
│   - Addresses                         │
│   - Categories                        │
└───────────────────────────────────────┘
```

## 🛠️ Tech Stack

### Mobile App
- **Framework**: React Native (Expo)
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation
- **Payment**: Stripe React Native SDK
- **Authentication**: AWS Cognito
- **HTTP Client**: Axios

### Admin Dashboard
- **Framework**: React
- **Build Tool**: Vite
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Routing**: React Router
- **Charts**: Recharts
- **Date Handling**: date-fns

### Backend
- **Platform**: AWS Serverless
- **Functions**: AWS Lambda (Node.js 18.x)
- **API**: AWS API Gateway
- **Database**: AWS DynamoDB
- **Auth**: AWS Cognito
- **Storage**: AWS S3
- **CDN**: AWS CloudFront
- **Payments**: Stripe
- **IaC**: Serverless Framework

## 📁 Project Structure

```
mobilesaaga/
├── backend/                    # AWS Serverless Backend
│   ├── src/
│   │   └── handlers/          # Lambda function handlers
│   │       ├── products.js
│   │       ├── cart.js
│   │       ├── orders.js
│   │       ├── addresses.js
│   │       ├── payment.js
│   │       ├── users.js
│   │       ├── support.js
│   │       └── admin/         # Admin-only endpoints
│   ├── data/                  # Converted product data (JSON)
│   ├── scripts/               # Utility scripts
│   ├── serverless.yml         # Serverless config
│   └── package.json
│
├── mobile/                     # React Native Mobile App
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── navigation/        # Navigation config
│   │   ├── screens/           # App screens
│   │   │   ├── auth/
│   │   │   ├── main/
│   │   │   ├── product/
│   │   │   ├── checkout/
│   │   │   ├── orders/
│   │   │   ├── address/
│   │   │   └── support/
│   │   ├── services/          # API & Auth services
│   │   ├── store/             # Redux store & slices
│   │   ├── theme/             # Colors & theming
│   │   └── types/             # TypeScript types
│   ├── App.tsx
│   ├── app.json
│   └── package.json
│
├── admin/                      # Admin Web Dashboard
│   ├── src/
│   │   ├── components/        # Shared components
│   │   ├── pages/             # Dashboard pages
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Orders.tsx
│   │   │   ├── Inventory.tsx
│   │   │   └── Login.tsx
│   │   └── store/             # Redux store
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── scripts/                    # Data conversion scripts
│   ├── convertExcelToJson.js # Excel to JSON converter
│   └── package.json
│
└── Saaga_Export_ProductNdPriceList_V01_15Dec2025.xlsx
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- AWS CLI configured with credentials
- Stripe account
- Expo CLI (for React Native development)
- iOS Simulator (Mac) or Android Emulator

### 1. Convert Product Data

```bash
cd scripts
npm install
npm run convert
```

This creates JSON files in `backend/data/`:
- `products.json` - All products
- `categories.json` - All categories
- `products-by-category.json` - Products grouped by category
- `stats.json` - Product statistics

### 2. Deploy Backend

```bash
cd backend
npm install

# Set environment variables
export STRIPE_SECRET_KEY=sk_test_your_stripe_key

# Deploy to AWS
npm run deploy:dev

# Note the API Gateway URL and Cognito details from output
```

After deployment, you'll see output like:
```
endpoints:
  GET - https://abc123.execute-api.ap-southeast-1.amazonaws.com/dev/products
  ...

stack outputs:
  UserPoolId: ap-southeast-1_ABC123
  UserPoolClientId: abc123def456
  ApiGatewayUrl: https://abc123.execute-api.ap-southeast-1.amazonaws.com/dev
```

### 3. Import Products to DynamoDB

```bash
cd backend

# Set environment variables from deployment output
export PRODUCTS_TABLE=saaga-groceries-api-products-dev
export CATEGORIES_TABLE=saaga-groceries-api-categories-dev
export AWS_REGION=ap-southeast-1

npm run import-products
```

### 4. Configure Mobile App

Update `mobile/app.json` with your AWS and Stripe credentials:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://YOUR-API-GATEWAY-URL.execute-api.ap-southeast-1.amazonaws.com/dev",
      "cognitoUserPoolId": "ap-southeast-1_YOUR-POOL-ID",
      "cognitoClientId": "YOUR-CLIENT-ID",
      "stripePublishableKey": "pk_test_YOUR-STRIPE-KEY"
    }
  }
}
```

### 5. Run Mobile App

```bash
cd mobile
npm install

# Start Expo dev server
npx expo start

# Press 'i' for iOS simulator
# Press 'a' for Android emulator
```

### 6. Run Admin Dashboard

```bash
cd admin
npm install

# Create .env file
echo "VITE_API_URL=https://YOUR-API-GATEWAY-URL.execute-api.ap-southeast-1.amazonaws.com/dev" > .env

# Start dev server
npm run dev

# Open http://localhost:3001
# Login with any email/password (demo mode)
```

## 📦 Deployment

### Production Deployment

#### Backend

```bash
cd backend
npm run deploy:prod
```

#### Mobile App

```bash
cd mobile

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

#### Admin Dashboard

```bash
cd admin
npm run build

# Deploy to hosting (e.g., Vercel, Netlify, S3+CloudFront)
# dist/ folder contains the built app
```

## 📖 API Documentation

### Public Endpoints

- `GET /products` - List all products
- `GET /products/{id}` - Get product details
- `GET /products/search?q={query}` - Search products
- `GET /products/category/{category}` - Get products by category
- `GET /categories` - List all categories
- `GET /support/faqs` - Get FAQs

### Authenticated Endpoints (Require Cognito JWT)

#### Cart
- `GET /cart` - Get user cart
- `POST /cart` - Add item
- `PUT /cart/{itemId}` - Update quantity
- `DELETE /cart/{itemId}` - Remove item
- `DELETE /cart` - Clear cart

#### Orders
- `POST /orders` - Create order
- `GET /orders` - Get user orders
- `GET /orders/{orderId}` - Get order details

#### Addresses
- `GET /addresses` - List addresses
- `POST /addresses` - Create address
- `PUT /addresses/{id}` - Update address
- `DELETE /addresses/{id}` - Delete address

#### Payment
- `POST /payment/intent` - Create Stripe payment intent
- `POST /payment/confirm` - Confirm payment

### Admin Endpoints

- `GET /admin/orders` - Get all orders with stats
- `POST /admin/products` - Create product
- `PUT /admin/products/{id}` - Update product
- `DELETE /admin/products/{id}` - Delete product
- `PUT /admin/inventory/{productId}` - Update inventory

## 🎨 Key Features Implemented

### Mobile App
- ✅ Modern splash screen and onboarding
- ✅ Authentication flow (Sign Up, Sign In, Forgot Password)
- ✅ Home screen with featured products and categories
- ✅ Product browsing with search and filters
- ✅ Shopping cart with quantity management
- ✅ Address management (CRUD)
- ✅ Stripe payment integration
- ✅ Order tracking and history
- ✅ Help & Support with FAQs
- ✅ Profile management
- ✅ Smooth animations and transitions
- ✅ Error handling and loading states

### Admin Dashboard
- ✅ Analytics dashboard with charts
- ✅ Order management with status updates
- ✅ Inventory management
- ✅ Revenue tracking
- ✅ Low stock alerts
- ✅ Advanced filtering

### Backend
- ✅ Complete REST API
- ✅ DynamoDB data modeling
- ✅ Cognito authentication
- ✅ Stripe payment processing
- ✅ S3 image storage
- ✅ CloudFront CDN
- ✅ Error handling
- ✅ CORS configuration

## 💰 Cost Optimization

The serverless architecture ensures minimal costs:
- **Lambda**: Pay only for compute time
- **DynamoDB**: Pay-per-request pricing
- **API Gateway**: Pay per API call
- **S3**: Pay for storage used
- **Cognito**: Free tier: 50,000 MAUs

Estimated monthly cost for moderate traffic (1000 orders/month): **~$20-30 USD**

## 📄 License

This project is built for demonstration purposes. Customize as needed for your business.

## 👨‍💻 Author

Built with ❤️ using Claude Code

---

**Happy Selling! 🛒🎉**
