import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useDispatch, useSelector } from 'react-redux';
import type { AuthStackParamList } from '../../types';
import type { AppDispatch, RootState } from '../../store';
import { signUpUser, confirmSignUpCode } from '../../store/slices/authSlice';
import Button from '../../components/Button';
import Input from '../../components/Input';

type SignUpScreenProps = {
  navigation: StackNavigationProp<AuthStackParamList, 'SignUp'>;
};

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { loading } = useSelector((state: RootState) => state.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSignUp = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    try {
      await dispatch(signUpUser({ email, password, name })).unwrap();
      setShowConfirmation(true);
      Alert.alert('Success', 'Please check your email for the confirmation code');
    } catch (err: any) {
      Alert.alert('Sign Up Failed', err || 'Please try again');
    }
  };

  const handleConfirmSignUp = async () => {
    if (!code) {
      Alert.alert('Error', 'Please enter the confirmation code');
      return;
    }

    try {
      await dispatch(confirmSignUpCode({ email, code })).unwrap();
      Alert.alert('Success', 'Account confirmed! You can now sign in.', [
        { text: 'OK', onPress: () => navigation.navigate('SignIn') }
      ]);
    } catch (err: any) {
      Alert.alert('Confirmation Failed', err || 'Invalid code');
    }
  };

  if (showConfirmation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Confirm Your Email</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Confirmation Code"
              placeholder="Enter 6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Button
              title="Confirm"
              onPress={handleConfirmSignUp}
              loading={loading}
            />

            <Button
              title="Back to Sign Up"
              variant="outline"
              onPress={() => setShowConfirmation(false)}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join Saaga Groceries today</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Input
              label="Password"
              placeholder="Enter your password (min 8 characters)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Input
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Button
              title="Sign Up"
              onPress={handleSignUp}
              loading={loading}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Text
              style={styles.link}
              onPress={() => navigation.navigate('SignIn')}
            >
              Sign In
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  link: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '600',
  },
});
