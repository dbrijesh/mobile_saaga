import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { CartState, CartItem } from '../../types';
import api from '../../services/api';

const initialState: CartState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.getCart();
      return response.items;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch cart');
    }
  }
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async ({ productId, quantity }: { productId: string; quantity: number }, { rejectWithValue }) => {
    try {
      const item = await api.addToCart(productId, quantity);
      return item;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to add to cart');
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async ({ productId, quantity }: { productId: string; quantity: number }, { rejectWithValue }) => {
    try {
      const item = await api.updateCartItem(productId, quantity);
      return item;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update cart item');
    }
  }
);

export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async (productId: string, { rejectWithValue }) => {
    try {
      await api.removeFromCart(productId);
      return productId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to remove item');
    }
  }
);

export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async (_, { rejectWithValue }) => {
    try {
      await api.clearCart();
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to clear cart');
    }
  }
);

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Cart
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action: PayloadAction<CartItem[]>) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Add to Cart
      .addCase(addToCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addToCart.fulfilled, (state, action: PayloadAction<CartItem>) => {
        state.loading = false;
        const existingIndex = state.items.findIndex(item => item.productId === action.payload.productId);
        if (existingIndex >= 0) {
          state.items[existingIndex] = action.payload;
        } else {
          state.items.push(action.payload);
        }
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update Cart Item
      .addCase(updateCartItem.fulfilled, (state, action: PayloadAction<CartItem>) => {
        const index = state.items.findIndex(item => item.productId === action.payload.productId);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      // Remove from Cart
      .addCase(removeFromCart.fulfilled, (state, action: PayloadAction<string>) => {
        state.items = state.items.filter(item => item.productId !== action.payload);
      })
      // Clear Cart
      .addCase(clearCart.fulfilled, (state) => {
        state.items = [];
      });
  },
});

export const { clearError } = cartSlice.actions;
export default cartSlice.reducer;
