import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { StripeProvider } from '@stripe/stripe-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from './src/store';
import { configureAmplify } from './src/config/amplify';
import config from './src/config';
import RootNavigator from './src/navigation/RootNavigator';
import { loadUser } from './src/store/slices/authSlice';

// Configure Amplify
configureAmplify();

export default function App() {
  useEffect(() => {
    // Try to load existing user session on app start
    store.dispatch(loadUser());
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <StripeProvider publishableKey={config.stripe.publishableKey}>
          <RootNavigator />
          <StatusBar style="auto" />
        </StripeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
