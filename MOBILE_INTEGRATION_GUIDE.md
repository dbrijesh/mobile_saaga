# Mobile Integration Quick Start Guide

This guide helps you build a new mobile app frontend that connects to the Saaga Groceries backend.

## Prerequisites

### 1. Backend Deployment Information

After deploying the backend (`cd backend && npm run deploy:dev`), you'll receive:

```
Stack Outputs:
  UserPoolId: ap-southeast-1_XXXXXXXXX
  UserPoolClientId: XXXXXXXXXXXXXXXXXXXXXXXXXX
  ApiGatewayUrl: https://xxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/dev
```

Save these values - you'll need them for configuration.

### 2. Stripe Configuration

For payment processing, you'll need:
- **Stripe Publishable Key**: `pk_test_XXXXXXXXXX` (for frontend)
- **Stripe Secret Key**: `sk_test_XXXXXXXXXX` (already configured in backend)

---

## App Configuration

### Required Environment Variables

```javascript
export const config = {
  // API Configuration
  apiUrl: 'https://xxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/dev',

  // AWS Cognito Configuration
  cognito: {
    region: 'ap-southeast-1',
    userPoolId: 'ap-southeast-1_XXXXXXXXX',
    clientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
  },

  // Stripe Configuration
  stripe: {
    publishableKey: 'pk_test_XXXXXXXXXX'
  }
};
```

---

## Core Features Implementation

### 1. Authentication Setup

#### Option A: Using AWS Amplify (Recommended)

```bash
npm install aws-amplify amazon-cognito-identity-js
```

```javascript
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    region: 'ap-southeast-1',
    userPoolId: 'ap-southeast-1_XXXXXXXXX',
    userPoolWebClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
  }
});

// Sign Up
import { Auth } from 'aws-amplify';

async function signUp(email, password, name, phone) {
  try {
    const { user } = await Auth.signUp({
      username: email,
      password,
      attributes: {
        email,
        name,
        phone_number: phone // Format: +6512345678
      }
    });
    return user;
  } catch (error) {
    console.error('Sign up error:', error);
    throw error;
  }
}

// Confirm Sign Up (email verification code)
async function confirmSignUp(email, code) {
  try {
    await Auth.confirmSignUp(email, code);
  } catch (error) {
    console.error('Confirm error:', error);
    throw error;
  }
}

// Sign In
async function signIn(email, password) {
  try {
    const user = await Auth.signIn(email, password);
    return user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
}

// Get JWT Token
async function getToken() {
  try {
    const session = await Auth.currentSession();
    return session.getIdToken().getJwtToken();
  } catch (error) {
    console.error('Get token error:', error);
    return null;
  }
}

// Sign Out
async function signOut() {
  try {
    await Auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}
```

#### Option B: Using amazon-cognito-identity-js directly

```javascript
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute
} from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'ap-southeast-1_XXXXXXXXX',
  ClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX'
};

const userPool = new CognitoUserPool(poolData);

// Sign Up
function signUp(email, password, name, phone) {
  const attributeList = [
    new CognitoUserAttribute({ Name: 'email', Value: email }),
    new CognitoUserAttribute({ Name: 'name', Value: name }),
    new CognitoUserAttribute({ Name: 'phone_number', Value: phone })
  ];

  return new Promise((resolve, reject) => {
    userPool.signUp(email, password, attributeList, null, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.user);
      }
    });
  });
}

// Sign In
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
      onFailure: (err) => {
        reject(err);
      }
    });
  });
}
```

---

### 2. API Service Layer

Create a service layer to handle all API calls:

```javascript
// api.service.js
const API_URL = 'https://xxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/dev';

class ApiService {
  async getAuthToken() {
    // Get token from your auth service
    // Example: return await Auth.currentSession().getIdToken().getJwtToken();
    return localStorage.getItem('idToken'); // Or from secure storage
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add auth token if endpoint requires it
    if (options.requiresAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  // Products
  async getProducts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/products${query ? `?${query}` : ''}`);
  }

  async getProductById(id) {
    return this.request(`/products/${id}`);
  }

  async searchProducts(query) {
    return this.request(`/products/search?q=${encodeURIComponent(query)}`);
  }

  async getProductsByCategory(category) {
    return this.request(`/products/category/${category}`);
  }

  // Categories
  async getCategories() {
    return this.request('/categories');
  }

  // Cart (requires auth)
  async getCart() {
    return this.request('/cart', { requiresAuth: true });
  }

  async addToCart(productId, quantity) {
    return this.request('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
      requiresAuth: true
    });
  }

  async updateCartItem(productId, quantity) {
    return this.request(`/cart/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
      requiresAuth: true
    });
  }

  async removeFromCart(productId) {
    return this.request(`/cart/${productId}`, {
      method: 'DELETE',
      requiresAuth: true
    });
  }

  async clearCart() {
    return this.request('/cart', {
      method: 'DELETE',
      requiresAuth: true
    });
  }

  // Orders (requires auth)
  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
      requiresAuth: true
    });
  }

  async getOrders(status = null) {
    const query = status ? `?status=${status}` : '';
    return this.request(`/orders${query}`, { requiresAuth: true });
  }

  async getOrderById(orderId) {
    return this.request(`/orders/${orderId}`, { requiresAuth: true });
  }

  // Payment (requires auth)
  async createPaymentIntent(amount, currency = 'sgd', orderId = null) {
    return this.request('/payment/intent', {
      method: 'POST',
      body: JSON.stringify({ amount, currency, orderId }),
      requiresAuth: true
    });
  }

  async confirmPayment(paymentIntentId) {
    return this.request('/payment/confirm', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId }),
      requiresAuth: true
    });
  }

  // Addresses (requires auth)
  async getAddresses() {
    return this.request('/addresses', { requiresAuth: true });
  }

  async createAddress(addressData) {
    return this.request('/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData),
      requiresAuth: true
    });
  }

  async updateAddress(addressId, addressData) {
    return this.request(`/addresses/${addressId}`, {
      method: 'PUT',
      body: JSON.stringify(addressData),
      requiresAuth: true
    });
  }

  async deleteAddress(addressId) {
    return this.request(`/addresses/${addressId}`, {
      method: 'DELETE',
      requiresAuth: true
    });
  }

  // User Profile (requires auth)
  async getUserProfile() {
    return this.request('/user/profile', { requiresAuth: true });
  }

  async updateUserProfile(profileData) {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
      requiresAuth: true
    });
  }

  // Support
  async getFAQs() {
    return this.request('/support/faqs');
  }

  async submitSupportTicket(ticketData) {
    return this.request('/support/ticket', {
      method: 'POST',
      body: JSON.stringify(ticketData),
      requiresAuth: true
    });
  }
}

export default new ApiService();
```

---

### 3. Payment Integration with Stripe

#### React Native Example

```bash
npm install @stripe/stripe-react-native
```

```javascript
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import ApiService from './api.service';

// Wrap your app
function App() {
  return (
    <StripeProvider publishableKey="pk_test_XXXXXXXXXX">
      <YourApp />
    </StripeProvider>
  );
}

// In your checkout component
function CheckoutScreen() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    try {
      setLoading(true);

      // 1. Get cart total
      const cart = await ApiService.getCart();
      const amount = cart.total;

      // 2. Create payment intent
      const { clientSecret, paymentIntentId } = await ApiService.createPaymentIntent(amount);

      // 3. Initialize payment sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Saaga Groceries'
      });

      if (initError) {
        throw new Error(initError.message);
      }

      // 4. Present payment sheet
      const { error: paymentError } = await presentPaymentSheet();

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      // 5. Confirm payment
      const paymentResult = await ApiService.confirmPayment(paymentIntentId);

      if (paymentResult.status === 'succeeded') {
        // 6. Create order
        const order = await ApiService.createOrder({
          items: cart.items.map(item => ({
            productId: item.productId,
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
            subtotal: item.subtotal
          })),
          shippingAddress: selectedAddress,
          paymentMethod: 'stripe',
          paymentIntentId: paymentIntentId,
          totalAmount: amount,
          notes: deliveryNotes
        });

        // 7. Clear cart
        await ApiService.clearCart();

        // 8. Navigate to success screen
        navigation.navigate('OrderSuccess', { orderId: order.order.orderId });
      }

    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Failed', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button title="Pay Now" onPress={handleCheckout} disabled={loading} />
  );
}
```

---

## Complete User Flow Examples

### Browse Products Flow

```javascript
// 1. Get all categories
const categories = await ApiService.getCategories();

// 2. Get featured products for home screen
const featuredProducts = await ApiService.getProducts({
  featured: true,
  limit: 10
});

// 3. User selects a category
const riceProducts = await ApiService.getProductsByCategory('Rice');

// 4. User searches
const searchResults = await ApiService.searchProducts('basmati');

// 5. User views product details
const product = await ApiService.getProductById('PROD-000001');
```

### Shopping Cart Flow

```javascript
// 1. Add product to cart
await ApiService.addToCart('PROD-000001', 2);

// 2. View cart
const cart = await ApiService.getCart();
console.log(`Total: $${cart.total}, Items: ${cart.itemCount}`);

// 3. Update quantity
await ApiService.updateCartItem('PROD-000001', 5);

// 4. Remove item
await ApiService.removeFromCart('PROD-000002');
```

### Checkout Flow

```javascript
// 1. User is on cart screen
const cart = await ApiService.getCart();

// 2. Get saved addresses
const addresses = await ApiService.getAddresses();

// 3. User selects or creates new address
const newAddress = await ApiService.createAddress({
  name: 'Home',
  recipientName: 'John Doe',
  phone: '+6512345678',
  street: '123 Orchard Road',
  unit: '#12-34',
  city: 'Singapore',
  postalCode: '238858',
  country: 'Singapore',
  isDefault: true
});

// 4. Create payment intent
const { clientSecret, paymentIntentId } = await ApiService.createPaymentIntent(
  cart.total,
  'sgd'
);

// 5. Collect payment with Stripe
// (Use Stripe SDK as shown above)

// 6. Confirm payment
const paymentResult = await ApiService.confirmPayment(paymentIntentId);

// 7. Create order
const order = await ApiService.createOrder({
  items: cart.items.map(item => ({
    productId: item.productId,
    name: item.product.name,
    price: item.product.price,
    quantity: item.quantity,
    subtotal: item.subtotal
  })),
  shippingAddress: newAddress,
  paymentMethod: 'stripe',
  paymentIntentId: paymentIntentId,
  totalAmount: cart.total,
  notes: 'Please ring doorbell'
});

// 8. Clear cart
await ApiService.clearCart();

// 9. Show order confirmation
console.log('Order created:', order.order.orderId);
```

### Order History Flow

```javascript
// 1. Get all orders
const allOrders = await ApiService.getOrders();

// 2. Filter by status
const pendingOrders = await ApiService.getOrders('pending');

// 3. View order details
const orderDetails = await ApiService.getOrderById(orderId);

// 4. User cancels order (if still pending)
await ApiService.updateOrderStatus(orderId, 'cancelled');
```

---

## State Management Recommendations

### Option 1: Redux Toolkit (Current Implementation)

The existing React Native app uses Redux Toolkit. Check `mobile/src/store/` for slice examples.

### Option 2: React Query / TanStack Query

For simpler state management with automatic caching:

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ApiService from './api.service';

// Fetch products
function useProducts(params) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => ApiService.getProducts(params)
  });
}

// Add to cart
function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, quantity }) =>
      ApiService.addToCart(productId, quantity),
    onSuccess: () => {
      // Invalidate cart query to refetch
      queryClient.invalidateQueries(['cart']);
    }
  });
}

// Usage in component
function ProductScreen() {
  const { data, isLoading, error } = useProducts({ featured: true });
  const addToCart = useAddToCart();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <Error message={error.message} />;

  return (
    <View>
      {data.products.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={() => addToCart.mutate({
            productId: product.id,
            quantity: 1
          })}
        />
      ))}
    </View>
  );
}
```

---

## Testing the Integration

### 1. Test Authentication

```javascript
// Sign up new user
const user = await signUp(
  'test@example.com',
  'TestPass123',
  'Test User',
  '+6512345678'
);

// Confirm email (check email for code)
await confirmSignUp('test@example.com', '123456');

// Sign in
const session = await signIn('test@example.com', 'TestPass123');
console.log('Token:', session.idToken);
```

### 2. Test Product Fetching

```javascript
// Should work without auth
const products = await ApiService.getProducts({ limit: 5 });
console.log(`Fetched ${products.count} products`);
```

### 3. Test Cart (Requires Auth)

```javascript
// Must be signed in first
await ApiService.addToCart('PROD-000001', 2);
const cart = await ApiService.getCart();
console.log('Cart total:', cart.total);
```

---

## Common Issues and Solutions

### Issue: "Unauthorized" error on protected endpoints
**Solution:** Ensure you're including the JWT token in the Authorization header and the token hasn't expired.

### Issue: CORS errors
**Solution:** CORS is already enabled in the backend. Make sure you're using the correct API Gateway URL.

### Issue: Payment fails
**Solution:**
- Check Stripe publishable key is correct
- Ensure backend has valid Stripe secret key
- Test with Stripe test cards: `4242 4242 4242 4242`

### Issue: Products not loading
**Solution:** Ensure products are imported to DynamoDB:
```bash
cd backend
export PRODUCTS_TABLE=saaga-groceries-api-products-dev
export CATEGORIES_TABLE=saaga-groceries-api-categories-dev
npm run import-products
```

---

## Next Steps

1. **Set up authentication** using AWS Amplify or Cognito SDK
2. **Create the API service layer** with all endpoint methods
3. **Implement product browsing** (home, categories, search)
4. **Build shopping cart** functionality
5. **Integrate Stripe payment** for checkout
6. **Add order management** (view orders, order details)
7. **Implement user profile** and address management

For detailed API specifications, see `API_DOCUMENTATION.md`.
