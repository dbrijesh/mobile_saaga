import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { AddressesState, Address } from '../../types';
import api from '../../services/api';

const initialState: AddressesState = {
  addresses: [],
  defaultAddress: null,
  loading: false,
  error: null,
};

export const fetchAddresses = createAsyncThunk(
  'addresses/fetchAddresses',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.getAddresses();
      return response.addresses;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch addresses');
    }
  }
);

export const createAddress = createAsyncThunk(
  'addresses/createAddress',
  async (address: Omit<Address, 'addressId' | 'userId' | 'createdAt'>, { rejectWithValue }) => {
    try {
      const newAddress = await api.createAddress(address);
      return newAddress;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create address');
    }
  }
);

export const updateAddress = createAsyncThunk(
  'addresses/updateAddress',
  async ({ addressId, updates }: { addressId: string; updates: Partial<Address> }, { rejectWithValue }) => {
    try {
      const updatedAddress = await api.updateAddress(addressId, updates);
      return updatedAddress;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update address');
    }
  }
);

export const deleteAddress = createAsyncThunk(
  'addresses/deleteAddress',
  async (addressId: string, { rejectWithValue }) => {
    try {
      await api.deleteAddress(addressId);
      return addressId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete address');
    }
  }
);

const addressesSlice = createSlice({
  name: 'addresses',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Addresses
      .addCase(fetchAddresses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAddresses.fulfilled, (state, action: PayloadAction<Address[]>) => {
        state.loading = false;
        state.addresses = action.payload;
        state.defaultAddress = action.payload.find(addr => addr.isDefault) || null;
      })
      .addCase(fetchAddresses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Address
      .addCase(createAddress.fulfilled, (state, action: PayloadAction<Address>) => {
        state.addresses.push(action.payload);
        if (action.payload.isDefault) {
          state.defaultAddress = action.payload;
        }
      })
      // Update Address
      .addCase(updateAddress.fulfilled, (state, action: PayloadAction<Address>) => {
        const index = state.addresses.findIndex(addr => addr.addressId === action.payload.addressId);
        if (index >= 0) {
          state.addresses[index] = action.payload;
        }
        if (action.payload.isDefault) {
          state.defaultAddress = action.payload;
        }
      })
      // Delete Address
      .addCase(deleteAddress.fulfilled, (state, action: PayloadAction<string>) => {
        state.addresses = state.addresses.filter(addr => addr.addressId !== action.payload);
        if (state.defaultAddress?.addressId === action.payload) {
          state.defaultAddress = null;
        }
      });
  },
});

export const { clearError } = addressesSlice.actions;
export default addressesSlice.reducer;
