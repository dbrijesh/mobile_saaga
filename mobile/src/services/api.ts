import axios, { AxiosInstance } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import config from '../config';
import type { Product, Category, CartItem, Order, Address, UserProfile, FAQ } from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: config.apiUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        try {
          const session = await fetchAuthSession();
          const token = session.tokens?.idToken?.toString();
          if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.log('No auth session available');
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - could trigger logout
        }
        return Promise.reject(error);
      }
    );
  }

  // Products
  async getProducts(params?: { limit?: number; category?: string; featured?: boolean; sort?: string }) {
    const response = await this.api.get('/products', { params });
    return response.data as { products: Product[]; total: number };
  }

  async getProductById(id: string) {
    const response = await this.api.get(`/products/${id}`);
    return response.data as Product;
  }

  async searchProducts(query: string, limit = 20) {
    const response = await this.api.get('/products/search', {
      params: { q: query, limit },
    });
    return response.data as { products: Product[]; total: number };
  }

  async getProductsByCategory(category: string, params?: { limit?: number; sort?: string }) {
    const response = await this.api.get(`/products/category/${category}`, { params });
    return response.data as { products: Product[]; total: number };
  }

  // Categories
  async getCategories() {
    const response = await this.api.get('/categories');
    return response.data as { categories: Category[] };
  }

  // Cart
  async getCart() {
    const response = await this.api.get('/cart');
    return response.data as { items: CartItem[] };
  }

  async addToCart(productId: string, quantity = 1) {
    const response = await this.api.post('/cart', { productId, quantity });
    return response.data as CartItem;
  }

  async updateCartItem(productId: string, quantity: number) {
    const response = await this.api.put(`/cart/${productId}`, { quantity });
    return response.data as CartItem;
  }

  async removeFromCart(productId: string) {
    const response = await this.api.delete(`/cart/${productId}`);
    return response.data;
  }

  async clearCart() {
    const response = await this.api.delete('/cart');
    return response.data;
  }

  // Orders
  async createOrder(orderData: {
    items: Array<{ productId: string; quantity: number }>;
    shippingAddressId: string;
    paymentIntentId?: string;
  }) {
    const response = await this.api.post('/orders', orderData);
    return response.data as Order;
  }

  async getOrders(params?: { limit?: number; status?: string }) {
    const response = await this.api.get('/orders', { params });
    return response.data as { orders: Order[] };
  }

  async getOrderById(orderId: string) {
    const response = await this.api.get(`/orders/${orderId}`);
    return response.data as Order;
  }

  // Addresses
  async getAddresses() {
    const response = await this.api.get('/addresses');
    return response.data as { addresses: Address[] };
  }

  async createAddress(address: Omit<Address, 'addressId' | 'userId' | 'createdAt'>) {
    const response = await this.api.post('/addresses', address);
    return response.data as Address;
  }

  async updateAddress(addressId: string, updates: Partial<Address>) {
    const response = await this.api.put(`/addresses/${addressId}`, updates);
    return response.data as Address;
  }

  async deleteAddress(addressId: string) {
    const response = await this.api.delete(`/addresses/${addressId}`);
    return response.data;
  }

  // Payment
  async createPaymentIntent(amount: number, currency = 'sgd', orderId?: string) {
    const response = await this.api.post('/payment/intent', {
      amount,
      currency,
      orderId,
    });
    return response.data as { clientSecret: string; paymentIntentId: string };
  }

  async confirmPayment(paymentIntentId: string) {
    const response = await this.api.post('/payment/confirm', { paymentIntentId });
    return response.data;
  }

  // User Profile
  async getUserProfile() {
    const response = await this.api.get('/user/profile');
    return response.data as UserProfile;
  }

  async updateUserProfile(updates: Partial<UserProfile>) {
    const response = await this.api.put('/user/profile', updates);
    return response.data as { profile: UserProfile };
  }

  // Support
  async getFAQs() {
    const response = await this.api.get('/support/faqs');
    return response.data as { faqs: FAQ[] };
  }

  async submitSupportTicket(ticket: { subject: string; message: string }) {
    const response = await this.api.post('/support/ticket', ticket);
    return response.data;
  }
}

export default new ApiService();
