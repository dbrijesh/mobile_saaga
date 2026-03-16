import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import ordersReducer from './ordersSlice';
import inventoryReducer from './inventorySlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    orders: ordersReducer,
    inventory: inventoryReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
