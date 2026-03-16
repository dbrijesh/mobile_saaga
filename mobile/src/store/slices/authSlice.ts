import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { signIn, signOut, signUp, confirmSignUp, fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
import type { AuthState, UserProfile } from '../../types';
import api from '../../services/api';

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  error: null,
};

export const signUpUser = createAsyncThunk(
  'auth/signUp',
  async (params: { email: string; password: string; name: string }, { rejectWithValue }) => {
    try {
      await signUp({
        username: params.email,
        password: params.password,
        options: {
          userAttributes: {
            email: params.email,
            name: params.name,
          },
        },
      });
      return { email: params.email };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Sign up failed');
    }
  }
);

export const confirmSignUpCode = createAsyncThunk(
  'auth/confirmSignUp',
  async ({ email, code }: { email: string; code: string }, { rejectWithValue }) => {
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      return { success: true };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Confirmation failed');
    }
  }
);

export const signInUser = createAsyncThunk(
  'auth/signIn',
  async (params: { email: string; password: string }, { rejectWithValue }) => {
    try {
      await signIn({ username: params.email, password: params.password });
      const userProfile = await api.getUserProfile();
      return userProfile;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Sign in failed');
    }
  }
);

export const signOutUser = createAsyncThunk('auth/signOut', async () => {
  await signOut();
});

export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { rejectWithValue }) => {
    try {
      const session = await fetchAuthSession();
      if (session.tokens) {
        const userProfile = await api.getUserProfile();
        return userProfile;
      }
      return rejectWithValue('No session');
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to load user');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (updates: Partial<UserProfile>, { rejectWithValue }) => {
    try {
      const response = await api.updateUserProfile(updates);
      return response.profile;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Update failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Sign Up
      .addCase(signUpUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signUpUser.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(signUpUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Sign In
      .addCase(signInUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signInUser.fulfilled, (state, action: PayloadAction<UserProfile>) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(signInUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Sign Out
      .addCase(signOutUser.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
      })
      // Load User
      .addCase(loadUser.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadUser.fulfilled, (state, action: PayloadAction<UserProfile>) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload;
      })
      .addCase(loadUser.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
      })
      // Update Profile
      .addCase(updateProfile.fulfilled, (state, action: PayloadAction<UserProfile>) => {
        state.user = action.payload;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
