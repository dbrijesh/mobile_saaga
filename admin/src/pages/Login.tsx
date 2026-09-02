import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { login } from '../store/authSlice';
import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';
import './Login.css';

const poolData = {
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID
};

const userPool = new CognitoUserPool(poolData);

const Login: React.FC = () => {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const authenticationData = {
      Username: email,
      Password: password,
    };

    const authenticationDetails = new AuthenticationDetails(authenticationData);

    const userData = {
      Username: email,
      Pool: userPool,
    };

    const user = new CognitoUser(userData);

    user.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        const idToken = result.getIdToken().getJwtToken();
        const accessToken = result.getAccessToken().getJwtToken();

        // Store tokens in localStorage
        localStorage.setItem('authToken', idToken);
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('userEmail', email);

        // Update Redux state
        dispatch(login({
          email,
          name: result.getIdToken().payload.name || 'Admin User',
        }));

        setLoading(false);
      },
      onFailure: (err) => {
        console.error('Login error:', err);
        setError(err.message || 'Login failed. Please check your credentials.');
        setLoading(false);
      },
      newPasswordRequired: () => {
        // User needs to set a new password
        setCognitoUser(user);
        setNeedsPasswordChange(true);
        setLoading(false);
      },
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    if (cognitoUser) {
      cognitoUser.completeNewPasswordChallenge(newPassword, {}, {
        onSuccess: (result) => {
          const idToken = result.getIdToken().getJwtToken();
          const accessToken = result.getAccessToken().getJwtToken();

          // Store tokens in localStorage
          localStorage.setItem('authToken', idToken);
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('userEmail', email);

          // Update Redux state
          dispatch(login({
            email,
            name: result.getIdToken().payload.name || 'Admin User',
          }));

          setLoading(false);
        },
        onFailure: (err) => {
          console.error('Password change error:', err);
          setError(err.message || 'Failed to change password');
          setLoading(false);
        },
      });
    }
  };

  if (needsPasswordChange) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>🔐 Change Password</h1>
            <p>Please set a new password for your account</p>
          </div>

          <form onSubmit={handlePasswordChange} className="login-form">
            {error && <div className="error-message">{error}</div>}

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                required
                minLength={8}
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>

            <div className="password-requirements">
              <p>Password must contain:</p>
              <ul>
                <li>At least 8 characters</li>
                <li>At least 1 uppercase letter</li>
                <li>At least 1 lowercase letter</li>
                <li>At least 1 number</li>
              </ul>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Changing Password...' : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>🛒 Saaga Admin</h1>
          <p>Sign in to manage your store</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@saaga.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

      </div>
    </div>
  );
};

export default Login;
