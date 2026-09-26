import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import axios from 'axios';
import { login as loginApi, register as registerApi } from '../api/auth';
import {
  closeLocalSession,
  clearToken,
  getRememberedUser,
  getStoredToken,
  isSessionActive,
  rememberOfflineAccount,
  saveRefreshToken,
  saveToken,
  setSessionActive,
  verifyOfflineAccount,
} from '../storage/auth';
import { getDb, setActiveUser } from '../db/database';
import { localUser } from '../db/repositories';
import { registerBackgroundSyncAsync } from '../sync/background';
import { syncIfDue, syncNow as runSyncNow } from '../sync/syncService';
import { queuePushRevocation, registerPushNotifications, revokePushNotifications, PushRegistrationResult } from '../push/pushRegistration';

type User = {
  id: number;
  name: string;
  email: string;
  [key: string]: any;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initializationError: string | null;
  retryInitialization: () => Promise<void>;
  login: (e: string, p: string) => Promise<void>;
  register: (n: string, e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncNow: () => Promise<void>;
  enablePushNotifications: () => Promise<PushRegistrationResult>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
      setIsLoading(true);
      setInitializationError(null);
      try {
        await getDb();
        const active = await isSessionActive();
        const remembered = await getRememberedUser();
        const storedToken = await getStoredToken();
        setTokenState(storedToken);

        if (active && remembered) {
          await setActiveUser(Number(remembered.id));
          setUser(remembered as User);
          await localUser.set(remembered);
          await registerBackgroundSyncAsync().catch(() => false);
          // Startup is also the reconnect signal: web may keep navigator.onLine
          // true across an API outage, so no online event is guaranteed.
          void syncIfDue(true);
        }
      } catch (error) {
        // Keep the user-facing message stable while retaining the concrete
        // storage/worker failure for local diagnosis (especially on web).
        console.error('[AuthProvider] initialization failed', error);
        setInitializationError('Não foi possível abrir os dados salvos neste aparelho. Feche outras abas do aplicativo e tente novamente.');
      } finally {
        setIsLoading(false);
      }
  }, []);

  useEffect(() => { void initialize(); }, [initialize]);

  const retryInitialization = async () => {
    // Failed web VFS initialization leaves the worker unusable; a new page
    // releases it and creates a fresh worker without deleting persisted data.
    if (Platform.OS === 'web') {
      window.location.reload();
      return;
    }
    await initialize();
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && user) void syncIfDue(true);
    });
    return () => subscription.remove();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const timer = setInterval(() => {
      void syncIfDue(false);
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [user]);

  const finishOnlineLogin = async (email: string, password: string, response: any) => {
    await saveToken(response.access_token);
    if (response.refresh_token) await saveRefreshToken(response.refresh_token);
    await rememberOfflineAccount(email, password, response.user);
    await setActiveUser(Number(response.user.id));
    await setSessionActive(true);
    await localUser.set(response.user);
    setTokenState(response.access_token);
    setUser(response.user);
    await registerBackgroundSyncAsync().catch(() => false);
    await runSyncNow().catch(() => undefined);
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await loginApi(email, password);
      await finishOnlineLogin(email, password, response);
      return;
    } catch (error) {
      // A real 401/403 must remain a failed login, even when the cache exists.
      if (axios.isAxiosError(error) && error.response && error.response.status < 500) throw error;
    }

    const offlineUser = await verifyOfflineAccount(email, password);
    if (!offlineUser) {
      const error: any = new Error('Servidor indisponível e estas credenciais ainda não foram validadas neste aparelho.');
      error.code = 'OFFLINE_LOGIN_UNAVAILABLE';
      throw error;
    }
    await setSessionActive(true);
    await setActiveUser(Number(offlineUser.id));
    await localUser.set(offlineUser);
    setUser(offlineUser as User);
    setTokenState(await getStoredToken());
    await registerBackgroundSyncAsync().catch(() => false);
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await registerApi(name, email, password);
    await finishOnlineLogin(email, password, response);
  };

  const logout = async () => {
    // Capture identity/credential before clearing the session. Revocation is
    // best effort and must never delay local logout or use a future account's token.
    const logoutUserId = user?.id;
    const logoutToken = await getStoredToken();
    if (logoutUserId) await queuePushRevocation(logoutUserId).catch(() => undefined);
    void revokePushNotifications({ userId: logoutUserId, accessToken: logoutToken }).catch(() => undefined);
    await closeLocalSession();
    await clearToken();
    setTokenState(null);
    setUser(null);
  };

  const enablePushNotifications = async () => {
    if (!user) return { status: 'failed' as const, reason: 'not_authenticated' };
    return registerPushNotifications({ userId: user.id, accessToken: await getStoredToken() || undefined });
  };

  const refreshUser = async () => {
    const cached = await localUser.get() || await getRememberedUser();
    if (cached) {
      setUser(cached as User);
      void syncIfDue(false);
    }
  };

  const forceSync = async () => {
    if (!user) return;
    await runSyncNow();
    const cached = await localUser.get();
    if (cached) setUser(cached as User);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      isLoading,
      initializationError,
      retryInitialization,
      login,
      register,
      logout,
      refreshUser,
      syncNow: forceSync,
      enablePushNotifications,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
