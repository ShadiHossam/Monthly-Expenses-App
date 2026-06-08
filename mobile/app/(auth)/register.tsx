import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function RegisterScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const { api } = await import('../../lib/api');
      const res = await api.register(username.trim(), password, email.trim() || undefined);
      const { storage } = await import('../../lib/storage');
      await storage.setToken(res.token);
      // login() will re-call me() and set user
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-ft-background dark:bg-ve-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-ft-primary dark:bg-ve-primary-dim items-center justify-center mb-4">
              <Text className="text-white dark:text-ve-background text-2xl font-bold">F</Text>
            </View>
            <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Create account</Text>
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1">
              Start tracking your expenses
            </Text>
          </View>

          <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 gap-4">
            {error ? (
              <View className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2">
                <Text className="text-red-600 dark:text-ve-error text-sm">{error}</Text>
              </View>
            ) : null}

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                Username <Text className="text-ft-error">*</Text>
              </Text>
              <TextInput
                className="w-full px-3 py-3 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Choose a username"
                placeholderTextColor="#6f7a6d"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                Email <Text className="text-ft-outline dark:text-ve-on-surface-variant">(optional)</Text>
              </Text>
              <TextInput
                className="w-full px-3 py-3 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Enter email"
                placeholderTextColor="#6f7a6d"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">
                Password <Text className="text-ft-error">*</Text>
              </Text>
              <TextInput
                className="w-full px-3 py-3 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Choose a password"
                placeholderTextColor="#6f7a6d"
              />
            </View>

            <Pressable
              onPress={handleRegister}
              disabled={loading || !username.trim() || !password}
              className="w-full py-3.5 rounded-xl bg-ft-primary dark:bg-ve-primary-dim items-center justify-center mt-1"
              style={({ pressed }) => ({ opacity: pressed || loading ? 0.7 : 1 })}
            >
              {loading
                ? <ActivityIndicator color="white" size="small" />
                : <Text className="text-white dark:text-ve-background font-semibold">Create account</Text>
              }
            </Pressable>
          </View>

          <View className="flex-row justify-center mt-6 gap-1">
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant">
              Already have an account?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="text-sm text-ft-primary dark:text-ve-primary font-semibold">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
