import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { storage } from '../lib/storage';
import { api } from '../lib/api';
import { authEmitter } from '../lib/authEvents';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    await storage.deleteToken();
    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    // Listen for 401s from anywhere in the app
    const handleUnauthorized = () => {
      const wasLoggedIn = !!userRef.current;
      logout();
      if (wasLoggedIn) {
        Alert.alert('Session expired', 'Please sign in again.');
      }
    };
    authEmitter.on('unauthorized', handleUnauthorized);
    return () => authEmitter.off('unauthorized', handleUnauthorized);
  }, [logout]);

  useEffect(() => {
    (async () => {
      const savedToken = await storage.getToken();
      if (!savedToken) { setIsLoading(false); return; }
      setToken(savedToken);
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        await storage.deleteToken();
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    await storage.setToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const setSession = useCallback(async (newToken: string, newUser: User) => {
    await storage.setToken(newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!user, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
