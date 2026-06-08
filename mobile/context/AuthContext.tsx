import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    await storage.deleteToken();
    setUser(null);
    setToken(null);
  }, []);

  useEffect(() => {
    // Listen for 401s from anywhere in the app
    authEmitter.on('unauthorized', logout);
    return () => authEmitter.off('unauthorized', logout);
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

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
