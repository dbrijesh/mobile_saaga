// Product Types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  stock: number;
  unit?: string;
  brand?: string;
  featured?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  productCount?: number;
}

// Cart Types
export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  userId: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

// Order Types
export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Order {
  orderId: string;
  userId: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentIntentId?: string;
  shippingAddress: Address;
  createdAt: string;
  updatedAt?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

// Address Types
export interface Address {
  addressId: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

// User Types
export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: string;
  updatedAt?: string;
}

// Auth Types
export interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

// Redux State Types
export interface ProductsState {
  items: Product[];
  categories: Category[];
  selectedCategory: string | null;
  loading: boolean;
  error: string | null;
}

export interface CartState {
  items: CartItem[];
  loading: boolean;
  error: string | null;
}

export interface OrdersState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  error: string | null;
}

export interface AddressesState {
  addresses: Address[];
  defaultAddress: Address | null;
  loading: boolean;
  error: string | null;
}

// Support Types
export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface SupportTicket {
  ticketId: string;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
  updatedAt?: string;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Categories: undefined;
  Cart: undefined;
  Profile: undefined;
};

export type ProductStackParamList = {
  ProductList: { category?: string };
  ProductDetails: { productId: string };
  Search: undefined;
};

export type CheckoutStackParamList = {
  Checkout: undefined;
  SelectAddress: undefined;
  AddAddress: undefined;
  Payment: undefined;
};

export type OrderStackParamList = {
  Orders: undefined;
  OrderDetails: { orderId: string };
};

export type AddressStackParamList = {
  Addresses: undefined;
  AddAddress: undefined;
  EditAddress: { addressId: string };
};
