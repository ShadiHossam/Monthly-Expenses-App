import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { api } from '../../lib/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View className="flex-1 bg-ft-background dark:bg-ve-background justify-center px-6">
        <View className="items-center gap-4">
          <View className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-ve-surface items-center justify-center">
            <Text className="text-3xl">✉️</Text>
          </View>
          <Text className="text-xl font-bold text-ft-on-surface dark:text-ve-on-surface text-center">
            Check your email
          </Text>
          <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant text-center">
            We've sent a password reset link to {email}
          </Text>
          <Link href="/(auth)/login" asChild>
            <Pressable className="mt-4 px-8 py-3 rounded-xl border border-ft-outline-variant dark:border-ve-outline">
              <Text className="text-sm font-semibold text-ft-on-surface dark:text-ve-on-surface">Back to sign in</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-ft-background dark:bg-ve-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="flex-1 justify-center px-6 py-12">
          <View className="mb-8">
            <Text className="text-2xl font-bold text-ft-on-surface dark:text-ve-on-surface">Reset password</Text>
            <Text className="text-sm text-ft-on-surface-variant dark:text-ve-on-surface-variant mt-1">
              Enter your email and we'll send a reset link.
            </Text>
          </View>

          <View className="bg-ft-surface dark:bg-ve-surface border border-ft-outline-variant dark:border-ve-outline rounded-2xl p-5 gap-4">
            {error ? (
              <View className="bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
                <Text className="text-red-600 dark:text-ve-error text-sm">{error}</Text>
              </View>
            ) : null}

            <View className="gap-1.5">
              <Text className="text-xs font-medium text-ft-on-surface-variant dark:text-ve-on-surface-variant">Email</Text>
              <TextInput
                className="w-full px-3 py-3 rounded-xl border border-ft-outline-variant dark:border-ve-outline bg-ft-surface-low dark:bg-ve-surface-high text-ft-on-surface dark:text-ve-on-surface text-sm"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Enter your email"
                placeholderTextColor="#6f7a6d"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={loading || !email.trim()}
              className="w-full py-3.5 rounded-xl bg-ft-primary dark:bg-ve-primary-dim items-center justify-center"
              style={({ pressed }) => ({ opacity: pressed || loading ? 0.7 : 1 })}
            >
              {loading
                ? <ActivityIndicator color="white" size="small" />
                : <Text className="text-white dark:text-ve-background font-semibold">Send reset link</Text>
              }
            </Pressable>
          </View>

          <Link href="/(auth)/login" asChild>
            <Pressable className="items-center mt-6">
              <Text className="text-sm text-ft-primary dark:text-ve-primary">← Back to sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
