import '../global.css';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter, useSegments, Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { UploadProvider } from '../context/UploadContext';
import { UploadProgressBadge } from '../components/layout/UploadProgressBadge';
import { UploadDoneToasts } from '../components/layout/UploadDoneToasts';

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const { isDark } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(app)/(tabs)/');
    }
  }, [isAuthenticated, isLoading, segments]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
      {isAuthenticated && (
        <>
          <UploadProgressBadge />
          <UploadDoneToasts />
        </>
      )}
    </View>
  );
}

function ThemeAwareProviders({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  return (
    <ThemeProvider onColorSchemeChange={setIsDark}>
      {children}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeAwareProviders>
            <UploadProvider>
              <RootNavigator />
            </UploadProvider>
          </ThemeAwareProviders>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
