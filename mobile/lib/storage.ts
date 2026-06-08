import * as SecureStore from 'expo-secure-store';

export const storage = {
  getToken:    () => SecureStore.getItemAsync('auth_token'),
  setToken:    (t: string) => SecureStore.setItemAsync('auth_token', t),
  deleteToken: () => SecureStore.deleteItemAsync('auth_token'),
  getTheme:    () => SecureStore.getItemAsync('theme'),
  setTheme:    (v: 'light' | 'dark' | 'system') => SecureStore.setItemAsync('theme', v),
};
