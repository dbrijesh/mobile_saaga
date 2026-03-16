import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import type { AuthStackParamList } from '../../types';
import Button from '../../components/Button';

type WelcomeScreenProps = {
  navigation: StackNavigationProp<AuthStackParamList, 'Welcome'>;
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to</Text>
          <Text style={styles.appName}>Saaga Groceries</Text>
          <Text style={styles.subtitle}>Fresh Indian groceries delivered to your door in Singapore</Text>
        </View>

        <View style={styles.buttons}>
          <Button
            title="Sign In"
            onPress={() => navigation.navigate('SignIn')}
          />
          <View style={{ height: 16 }} />
          <Button
            title="Create Account"
            variant="outline"
            onPress={() => navigation.navigate('SignUp')}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: '#333',
    marginBottom: 8,
  },
  appName: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FF6B35',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  buttons: {
    marginBottom: 32,
  },
});
