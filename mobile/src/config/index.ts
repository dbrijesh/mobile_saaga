import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

export const config = {
  apiUrl: extra.apiUrl || 'http://localhost:3000/dev',
  apiKey: extra.apiKey || '',
  cognito: {
    userPoolId: extra.cognitoUserPoolId || '',
    clientId: extra.cognitoClientId || '',
    region: extra.awsRegion || 'ap-southeast-1',
  },
  stripe: {
    publishableKey: extra.stripePublishableKey || '',
  },
};

export default config;
