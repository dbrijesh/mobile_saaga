import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  inStock: boolean;
}

interface InventoryState {
  products: Product[];
  loading: boolean;
}

const initialState: InventoryState = {
  products: [],
  loading: false,
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setProducts: (state, action: PayloadAction<Product[]>) => {
      state.products = action.payload;
      state.loading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setProducts, setLoading } = inventorySlice.actions;
export default inventorySlice.reducer;
