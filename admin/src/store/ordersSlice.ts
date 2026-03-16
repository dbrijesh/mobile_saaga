import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Order {
  orderId: string;
  userId: string;
  items: any[];
  totalAmount: number;
  status: string;
  paymentStatus: string;
  createdAt: string;
  shippingAddress: any;
}

interface OrdersState {
  orders: Order[];
  loading: boolean;
  stats: {
    totalOrders: number;
    totalRevenue: number;
    statusBreakdown: Record<string, number>;
  };
}

const initialState: OrdersState = {
  orders: [],
  loading: false,
  stats: {
    totalOrders: 0,
    totalRevenue: 0,
    statusBreakdown: {},
  },
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders: (state, action: PayloadAction<{ orders: Order[]; stats: any }>) => {
      state.orders = action.payload.orders;
      state.stats = action.payload.stats;
      state.loading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

export const { setOrders, setLoading } = ordersSlice.actions;
export default ordersSlice.reducer;
