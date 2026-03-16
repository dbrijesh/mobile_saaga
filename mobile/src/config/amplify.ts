import { Amplify } from 'aws-amplify';
import config from './index';

export const configureAmplify = () => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.cognito.userPoolId,
        userPoolClientId: config.cognito.clientId,
        signUpVerificationMethod: 'code',
        loginWith: {
          email: true,
        },
      },
    },
  });
};
