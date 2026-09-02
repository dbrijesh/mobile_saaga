# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Saaga is a full-stack serverless e-commerce platform for Indian groceries in Singapore. It consists of three main components:
- **Mobile App**: React Native (Expo SDK ~54.0) with TypeScript for iOS/Android
- **Admin Dashboard**: React web app (Vite) with TypeScript, deployed to S3 bucket `saaga-admin-dashboard`
- **Backend**: AWS Serverless (Lambda, API Gateway, DynamoDB, Cognito) in `ap-southeast-1`

> **IMPORTANT — Mobile app repo:** a `mobile/` directory exists in this workspace, but it is **not** where live mobile app changes are made. The user maintains the actual mobile app in a separate repository elsewhere. Do **not** edit files under `mobile/` when implementing a feature — instead, make the backend (and admin, if applicable) changes here, then describe in plain terms what needs to change in the mobile app (new fields on existing API responses, new endpoints to call, etc.) so the user can apply it in their other repo.

> **Deployment stages:** only the `dev` stage (`saaga-online-api-dev`) is real and live — it's what `admin/.env` points to and almost certainly what the mobile app points to. A `prod` stage was accidentally created once as an empty, disconnected stack and was torn down. Do not deploy to `prod` without explicitly confirming with the user first; default to `dev`.

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

# Deploy to dev environment
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

# Build and deploy to S3 (REQUIRED for changes to go live — admin runs from S3, not locally)
npm run build
aws s3 sync dist/ s3://saaga-admin-dashboard/ --delete
# Then hard-refresh browser with Ctrl+Shift+R
```

**Configuration**: `admin/.env` requires:
- `VITE_API_URL` — API Gateway URL
- `VITE_API_KEY` — API Gateway API key (needed for product endpoints which use `private: true`)

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

### Authentication Flow
- AWS Cognito User Pool: `ap-southeast-1_1BQKFzF5m`
- Mobile app uses AWS Amplify v6 for Cognito authentication
- JWT tokens from Cognito are passed in `Authorization: Bearer <token>` header
- API Gateway uses Cognito Authorizer to validate tokens
- Admin users created via: `aws cognito-idp admin-create-user` + `admin-set-user-password --permanent`

### API Structure
All Lambda handlers are in `backend/src/handlers/`:
- `products.js` - Product CRUD and search (all endpoints use `private: true` — require `x-api-key` header)
- `categories.js` - Category management
- `cart.js` - Shopping cart operations
- `orders.js` - Order creation and retrieval (legacy; new checkout uses `payment.js` confirm endpoint)
- `addresses.js` - User address management
- `payment.js` - Stripe payment intent creation + atomic order creation on confirm
- `users.js` - User profile management
- `support.js` - FAQs and support tickets
- `shipping-dates.js` - Public endpoint for available shipping dates
- `admin/orders.js` - Admin order management (get all, cancel)
- `admin/` - Admin-only endpoints (products, inventory, shipping dates, categories, subcategories, coupons)

### Shared Utilities
- `backend/src/utils/createOrderRecord.js` - Shared order creation logic used by both `payment.js` and `orders.js`. Handles: item enrichment (unit/weight from Products table), shipping date reservation, coupon application, cart clearing (BatchWrite), idempotency check, order number assignment.
- `backend/src/utils/email.js` - SES email utility. Sends order confirmation to customer + CC to `customercare@saagaonline.com` from `orders@saagaonline.com`. Displays `order.orderNumber` (falls back to `orderId` for legacy orders).
- `backend/src/utils/orderNumber.js` - Generates human-readable, sequential order numbers (`SB-000000001`, `SB-000000002`, ...) via an atomic DynamoDB `ADD` on the Counters table — race-safe under concurrent checkouts. Exports `getNextOrderNumber()` and `formatOrderNumber(n)`.

### Promotions / Coupons System
The Coupons table doubles as a promotions engine — there's no separate Promotions table.
- **Manual coupons**: standard code-based, entered by the customer at checkout.
- **Auto-apply promotions**: a coupon with `autoApply: true` is surfaced to the mobile app via the public `GET /promotions/active` endpoint (`private: true`, no Cognito — API key only) so it can show a live "X/Y claimed" counter without auth. Returns `{ active: false }` if no active auto-apply coupon exists.
- **Per-customer limit**: `perCustomerLimit` on the coupon caps how many times one Cognito user (`sub`) can redeem it — enforced by `countCustomerCouponUsage()` in `backend/src/handlers/coupons.js`, which queries `OrdersTable.UserOrdersIndex` filtered by `couponId`.
- **Global usage cap**: `usageLimit`/`usageCount` on the coupon is enforced atomically in `applyCoupon()` via a `ConditionExpression` on the `UpdateCommand`, so concurrent orders can't oversell a capped promotion (e.g. "first 100 orders").
- **Enforcement point**: the real gate is `createOrderRecord.js`, not `validateCoupon` (which is just a pre-checkout client-side check) — every order-creation path re-validates status/usage limit/min purchase/per-customer limit before applying the coupon.
- **Admin controls** (`backend/src/handlers/admin/coupons.js`, wired up in `admin/src/pages/Coupons.tsx`): `PUT /admin/coupons/{id}/enable` sets status to active **and resets `usageCount` to 0** (fresh redemption window each time it's turned on); `PUT /admin/coupons/{id}/disable` sets status to inactive without resetting the counter.

### Payment Flow (current — atomic)
1. Mobile calls `POST /payment/intent` with `{ amount, currency }`
2. Backend creates Stripe PaymentIntent, returns `{ clientSecret, paymentIntentId }`
3. Mobile collects payment with Stripe React Native SDK (direct to Stripe)
4. Mobile calls `POST /payment/confirm` with `{ paymentIntentId, items, shippingAddress, totalAmount, shippingDateId?, couponId?, ... }`
5. Backend verifies Stripe payment succeeded, creates DynamoDB order, clears cart, sends email
6. **Idempotent**: `paymentIntentId` is used as `orderId` — retrying returns existing order, no duplicates

The old `POST /orders` endpoint still exists as a fallback but the main checkout flow goes through `/payment/confirm`.

### Order Features
- **Cancel order**: Admin can cancel via `POST /admin/orders/{orderId}/cancel`. Releases shipping date capacity.
- **Order confirmation email**: Sent automatically on order creation to customer + CC to customercare@saagaonline.com
- **Item units/weights**: Enriched at order creation time from Products table (stored on order items)
- **Minimum order**: $5 (enforced in mobile CartScreen)
- **Order numbers**: every order gets a human-readable `orderNumber` (e.g. `SB-000000001`), assigned atomically at creation time via `backend/src/utils/orderNumber.js`. `orderId` (the Stripe `paymentIntentId`, used as the DynamoDB PK for idempotency) is unchanged — `orderNumber` is a separate, purely cosmetic display field shown in the admin dashboard, order emails, and (once the mobile repo is updated) the mobile app. Existing orders were one-time backfilled with `backend/scripts/backfillOrderNumbers.js` (assigns numbers in chronological `createdAt` order, then leaves the shared counter at the last value used so new orders continue the sequence — safe to re-run, it skips orders that already have a number).

### DynamoDB Schema

**Products Table** — PK: `id`; GSI: `CategoryIndex` (partition: `category`, sort: `createdAt`)

**Orders Table** — PK: `orderId` (= `paymentIntentId` for orders from the atomic flow); GSI: `UserOrdersIndex` (partition: `userId`, sort: `createdAt`)

**Cart Table** — Composite PK: `userId` (partition), `productId` (sort)

**Addresses Table** — PK: `addressId`; GSI: `UserAddressesIndex` (partition: `userId`)

**Users Table** — PK: `userId`

**Categories Table** — PK: `id`

**SubCategories Table** — PK: `id`; GSI: `ParentCategoryIndex` (partition: `parentCategoryName`)

**ShippingDates Table** — PK: `shippingDateId`; GSI: `DateIndex` (partition: `date` YYYY-MM-DD)
- Attributes: `date`, `capacity`, `currentOrders`, `status` ('active'|'full'|'cancelled'), `notes`

**Coupons Table** — PK: `couponId`; GSI: `CodeIndex` (partition: `code`), `StatusIndex` (partition: `status`)
- Attributes: `code`, `status` ('active'|'inactive'), `discountAmount`/`discountType`, `minPurchaseAmount`, `usageLimit`, `usageCount` (atomically incremented, capped via `ConditionExpression`), plus promotions-system additions `perCustomerLimit` (number|null), `autoApply` (bool), `enabledAt` (ISO string, set each time the coupon is enabled) — see "Promotions / Coupons System" above

**Counters Table** — PK: `counterId` (e.g. the item `{ counterId: 'orderNumber', value: N }` backs sequential order numbering). Written to exclusively via atomic DynamoDB `ADD` — never read-modify-write.

### API Authorization
- **Public endpoints**: `/support/faqs`, `/subcategories`
- **Private (API key) endpoints**: `/products/*` — require `x-api-key` header in addition to Cognito JWT
- **Authenticated endpoints**: All others require Cognito JWT in `Authorization` header
- **Admin endpoints**: `/admin/*` — require Cognito JWT (role-based checks not yet implemented)

## Key Development Notes

### npm Workspace Hoisting Issue (CRITICAL)
This repo uses npm workspaces. npm v10 hoists packages to root `node_modules`, which means Lambda bundles miss them.

**Packages that must exist in `backend/node_modules/` for Lambda to work:**
- `uuid` — used by order/category/etc handlers
- `stripe` — used by payment handler
- `qs` — internal dependency of `stripe`

If any of these are missing, Lambda throws `Cannot find module 'X'` and returns 502.

**Fix**: Copy from root to backend manually before deploying:
```bash
cp -r node_modules/uuid backend/node_modules/uuid
cp -r node_modules/stripe backend/node_modules/stripe
cp -r node_modules/qs backend/node_modules/qs
```

**Detection**: If Lambda bundle size is ~3.7-3.8 MB, packages are bundled correctly. If ~452 KB, they're missing.

### Admin Dashboard Deployment
- Admin runs from S3 bucket `saaga-admin-dashboard` — **not** from a local dev server in production
- Changes are NOT live until you run `npm run build` + `aws s3 sync dist/ s3://saaga-admin-dashboard/ --delete`
- After syncing, hard-refresh browser with `Ctrl+Shift+R`
- The admin fetches products using both `Authorization: Bearer <token>` AND `x-api-key: <key>` headers (products endpoints use `private: true`)
- **Dashboard (`admin/src/pages/Dashboard.tsx`) is 100% real-data — no mock/hardcoded numbers anywhere.** It pulls from three live endpoints in parallel (`GET /admin/orders`, `GET /products?all=true`, `GET /admin/coupons`) via `Promise.allSettled` so one failed call doesn't blank the whole page (failures surface as a warning banner instead of fake fallback data); every stat card and chart is computed client-side from the fetched arrays. Chart colors are a fixed-order, colorblind-safe palette validated with the dataviz skill's `validate_palette.js` against this app's actual dark surface (`#0c1628`, the `--card` var in `admin/src/index.css`) — keep using that palette (or re-validate) for any new charts added here. Note: Orders.tsx's pre-existing `getStatusColor()` status colors were checked too and do NOT pass validation, but were left as-is since they predate this work and are out of scope.

### Email (AWS SES)
- Domain identity `saagaonline.com` configured in SES (ap-southeast-1)
- DKIM CNAME records added to Route 53 hosted zone `saagaonline.com` (Z0817140R5I6R7XJE2XW)
- SPF TXT record added to Route 53
- From address: `orders@saagaonline.com`
- CC on all order emails: `customercare@saagaonline.com`
- **SES is in sandbox mode** — must request production access in AWS Console (SES → Account dashboard → Request production access) before sending to unverified recipients

### Backend Development
- Serverless Framework v3 manages all infrastructure as code in `serverless.yml`
- Lambda functions use Node.js 18.x runtime (512MB memory, 30s timeout)
- DynamoDB uses PAY_PER_REQUEST billing mode
- CORS is enabled for all endpoints
- Region: `ap-southeast-1` (Singapore)
- Stripe secret key stored in AWS Secrets Manager: `saaga-online-api/stripe-secret-key`
- VPC configuration was removed to reduce costs (no NAT Gateway charges)

### Mobile Development
- Expo SDK ~54.0.0
- Configuration in `app.json` uses `extra` field for runtime config
- Access config via `import Constants from 'expo-constants'; Constants.expoConfig.extra`
- Navigation uses React Navigation v7 (Stack + Bottom Tabs)
- Stripe integration uses `@stripe/stripe-react-native`
- Uses AWS Amplify v6 for Cognito authentication
- Minimum order: $5

### Data Import Process
1. Product data starts in Excel file: `Saaga_Export_ProductNdPriceList_V01_15Dec2025.xlsx`
2. Run `npm run convert-data` from root to generate JSON files in `backend/data/`
3. Deploy backend infrastructure first
4. Run `npm run import-products` from backend to populate DynamoDB tables

### Environment Variables
Backend env vars are set in `serverless.yml` provider.environment. Key ones:
- `STRIPE_SECRET_ARN` - ARN of Secrets Manager secret holding Stripe key
- `SES_FROM_EMAIL: orders@saagaonline.com`
- `SES_CC_EMAIL: customercare@saagaonline.com`
- All DynamoDB table names follow pattern: `saaga-online-api-{resource}-{stage}`

## Deployment Workflow

1. If adding new npm packages to backend, copy them to `backend/node_modules/` (see hoisting issue above)
2. Run `npm run deploy:dev` from `backend/`
3. If admin UI changed: `cd admin && npm run build && aws s3 sync dist/ s3://saaga-admin-dashboard/ --delete`
4. For mobile changes: rebuild/reload with Expo

## Important Architectural Notes

### Admin Authentication
- Admin dashboard uses Cognito authentication
- Admin endpoints under `/admin/*` require Cognito JWT tokens
- No role-based authorization yet — any valid Cognito user can hit admin endpoints

### Image Storage
- S3 bucket `saaga-online-api-product-images-dev` has public access blocked
- Images should be accessed via signed URLs or CloudFront distribution
- Admin upload endpoint at `/admin/upload/image` handles image uploads

## Testing

Backend includes Jest configuration but tests need to be implemented. Test files should be colocated with handlers or in a `__tests__` directory.
