import React, { createContext, useContext, useState, useEffect } from 'react';
import { getStoredToken, saveToken, clearToken } from '../storage/auth';
import { login as loginApi, register as registerApi, getMe } from '../api/auth';

type User = {
  id: number;
  name: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (e: string, p: string) => Promise<void>;
  register: (n: string, e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = await getStoredToken();
        if (storedToken) {
          setTokenState(storedToken);
          // try fetch user
          const me = await getMe();
          setUser(me);
        }
      } catch (error) {
        // invalid token or network error
        await clearToken();
        setTokenState(null);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await loginApi(email, pass);
    await saveToken(res.access_token);
    setTokenState(res.access_token);
    setUser(res.user);
  };

  const register = async (name: string, email: string, pass: string) => {
    const res = await registerApi(name, email, pass);
    await saveToken(res.access_token);
    setTokenState(res.access_token);
    setUser(res.user);
  };

  const logout = async () => {
    await clearToken();
    setTokenState(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      await logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
