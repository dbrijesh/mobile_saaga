# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Saaga is a full-stack serverless e-commerce platform for Indian groceries in Singapore. It consists of three main components:
- **Mobile App**: React Native (Expo SDK ~54.0) with TypeScript for iOS/Android
- **Admin Dashboard**: React web app (Vite) with TypeScript
- **Backend**: AWS Serverless (Lambda, API Gateway, DynamoDB, Cognito) deployed in VPC with NAT Gateways

## Development Commands

### Initial Setup

```bash
# Install all workspace dependencies
npm run setup

# Convert Excel product data to JSON
npm run convert-data
```

### Backend (AWS Serverless)

```bash
cd backend
npm install

# Deploy to dev environment (requires STRIPE_SECRET_KEY env var)
export STRIPE_SECRET_KEY=sk_test_your_stripe_key
npm run deploy:dev

# Deploy to production
npm run deploy:prod

# Import products to DynamoDB after deployment
export PRODUCTS_TABLE=saaga-online-api-products-dev
export CATEGORIES_TABLE=saaga-online-api-categories-dev
export AWS_REGION=ap-southeast-1
npm run import-products

# View logs for a specific function
npm run logs -- -f functionName

# Invoke a function locally
npm run invoke -- -f functionName

# Run tests
npm test

# Lint code
npm lint
```

### Mobile App (React Native/Expo)

```bash
cd mobile
npm install

# Start Expo dev server
npx expo start

# Run on specific platforms
npm run ios
npm run android

# Type checking
npm run type-check

# Lint
npm run lint
```

**Configuration**: Update `mobile/app.json` extra section with AWS credentials from backend deployment output:
- `apiUrl`: API Gateway URL
- `cognitoUserPoolId`: From stack outputs
- `cognitoClientId`: From stack outputs
- `stripePublishableKey`: Stripe public key

### Admin Dashboard (React/Vite)

```bash
cd admin
npm install

# Start dev server (runs on port 3001)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

**Configuration**: Create `.env` file with `VITE_API_URL` pointing to API Gateway.

### Data Conversion Scripts

```bash
cd scripts
npm install

# Convert Excel to JSON (outputs to backend/data/)
npm run convert
```

## Architecture

### State Management
- Both mobile and admin use **Redux Toolkit** for state management
- Mobile app slices: `auth`, `products`, `cart`, `orders`, `addresses`
- Admin slices: Similar structure for dashboard data

### Authentication Flow
- AWS Cognito handles user authentication
- Mobile app uses `amazon-cognito-identity-js` for auth operations
- JWT tokens from Cognito are passed in `Authorization` header to API Gateway
- API Gateway uses Cognito Authorizer to validate tokens

### API Structure
All Lambda handlers are in `backend/src/handlers/`:
- `products.js` - Product CRUD and search
- `categories.js` - Category management
- `cart.js` - Shopping cart operations
- `orders.js` - Order creation and retrieval (includes shipping date integration)
- `addresses.js` - User address management
- `payment.js` - Stripe payment intent creation and confirmation
- `users.js` - User profile management
- `support.js` - FAQs and support tickets
- `shipping-dates.js` - Public endpoint for available shipping dates
- `admin/` - Admin-only endpoints (orders, products, inventory, shipping dates, categories)

### DynamoDB Schema

**Products Table**
- Primary Key: `id` (String)
- GSI: `CategoryIndex` - partition: `category`, sort: `createdAt`

**Orders Table**
- Primary Key: `orderId` (String)
- GSI: `UserOrdersIndex` - partition: `userId`, sort: `createdAt`

**Cart Table**
- Composite Key: `userId` (partition), `productId` (sort)

**Addresses Table**
- Primary Key: `addressId` (String)
- GSI: `UserAddressesIndex` - partition: `userId`

**Users Table**
- Primary Key: `userId` (String)

**Categories Table**
- Primary Key: `id` (String)

**ShippingDates Table**
- Primary Key: `shippingDateId` (String)
- GSI: `DateIndex` - partition: `date` (YYYY-MM-DD format)
- Attributes: date, capacity, currentOrders, status ('active'|'full'|'cancelled'), notes

### API Authorization
- **Public endpoints**: `/products/*`, `/categories`, `/support/faqs`, `/shipping-dates/available`
- **Authenticated endpoints**: All others require Cognito JWT in Authorization header
- **Admin endpoints**: `/admin/*` (additional authorization checks should be implemented)

### Payment Flow
1. Mobile app calls `POST /payment/intent` with amount
2. Backend creates Stripe PaymentIntent and returns client secret
3. Mobile app collects payment with Stripe React Native SDK
4. Mobile app calls `POST /payment/confirm` after successful payment
5. Backend verifies payment and creates order

## Key Development Notes

### Backend Development
- Serverless Framework v3 manages all infrastructure as code in `serverless.yml`
- Lambda functions use Node.js 18.x runtime (512MB memory, 30s timeout)
- DynamoDB uses PAY_PER_REQUEST billing mode
- CORS is enabled for all endpoints
- Region is hardcoded to `ap-southeast-1` (Singapore)
- **VPC Architecture**: Lambda functions run in private subnets with NAT Gateways for internet access
  - 2 Availability Zones (AZ a & b) for high availability
  - Public subnets (10.0.1.0/24, 10.0.2.0/24) host NAT Gateways
  - Private subnets (10.0.11.0/24, 10.0.12.0/24) host Lambda functions
  - Security groups control egress traffic

### Mobile Development
- Expo SDK ~54.0.0
- Configuration in `app.json` uses `extra` field for runtime config
- Access config via `import Constants from 'expo-constants'; Constants.expoConfig.extra`
- Navigation uses React Navigation v7 (Stack + Bottom Tabs)
- Stripe integration uses `@stripe/stripe-react-native`
- Uses AWS Amplify v6 for Cognito authentication

### Data Import Process
1. Product data starts in Excel file: `Saaga_Export_ProductNdPriceList_V01_15Dec2025.xlsx`
2. Run `npm run convert-data` from root to generate JSON files in `backend/data/`
3. Deploy backend infrastructure first
4. Run `npm run import-products` from backend to populate DynamoDB tables

### Environment Variables
Required for backend deployment:
- `STRIPE_SECRET_KEY` - Stripe secret key (mandatory for deployment)

Auto-generated during deployment (referenced in serverless.yml):
- Service name: `saaga-online-api`
- All DynamoDB table names follow pattern: `saaga-online-api-{resource}-{stage}`
- S3 bucket: `saaga-online-api-product-images-{stage}`

## Deployment Workflow

1. Convert product data (if Excel file updated)
2. Deploy backend and note output values (API URL, Cognito Pool ID/Client ID)
3. Update mobile `app.json` with backend output values
4. Update admin `.env` with API URL
5. Test mobile app with `npx expo start`
6. Test admin dashboard with `npm run dev`
7. For production: Deploy backend to prod stage, then build mobile apps with EAS

## Important Architectural Notes

### VPC Deployment Costs
- NAT Gateways are deployed in 2 AZs for high availability
- NAT Gateways incur hourly charges (~$0.045/hour per gateway = ~$65/month for both)
- Consider removing VPC configuration in `serverless.yml` for dev environments to reduce costs
- VPC is required if Lambda needs to access resources in private subnets

### Admin Authentication
- Admin dashboard currently uses Cognito authentication
- Admin endpoints under `/admin/*` require Cognito JWT tokens
- Consider implementing role-based authorization (admin role checks) for production use

### Image Storage
- S3 bucket has public access blocked
- Images should be accessed via signed URLs or CloudFront distribution
- Admin upload endpoint at `/admin/upload/image` handles image uploads

## Testing

Backend includes Jest configuration but tests need to be implemented. Test files should be colocated with handlers or in a `__tests__` directory.
