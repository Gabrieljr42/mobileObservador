import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'observador_access_token';
const REFRESH_TOKEN_KEY = 'observador_refresh_token';
const OFFLINE_ACCOUNT_KEY = 'observador_offline_account';
const ACTIVE_SESSION_KEY = 'observador_active_session';

type CachedUser = {
  id: number;
  name: string;
  email: string;
  [key: string]: any;
};

type OfflineAccount = {
  email: string;
  salt: string;
  verifier: string;
  user: CachedUser;
  saved_at: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const makeVerifier = async (email: string, password: string, salt: string) =>
  Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}\u0000${normalizeEmail(email)}\u0000${password}`,
  );

const setItem = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

const getItem = async (key: string) => {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
};

const deleteItem = async (key: string) => {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

export const saveToken = async (token: string) => setItem(ACCESS_TOKEN_KEY, token);
export const getStoredToken = async (): Promise<string | null> => getItem(ACCESS_TOKEN_KEY);
export const saveRefreshToken = async (token: string) => setItem(REFRESH_TOKEN_KEY, token);
export const getStoredRefreshToken = async (): Promise<string | null> => getItem(REFRESH_TOKEN_KEY);

// Refresh handles an expired access token; it must not erase the remembered account.
export const clearToken = async () => deleteItem(ACCESS_TOKEN_KEY);

export const rememberOfflineAccount = async (email: string, password: string, user: CachedUser) => {
  const salt = Crypto.randomUUID();
  const verifier = await makeVerifier(email, password, salt);
  const account: OfflineAccount = {
    email: normalizeEmail(email),
    salt,
    verifier,
    user,
    saved_at: new Date().toISOString(),
  };
  await setItem(OFFLINE_ACCOUNT_KEY, JSON.stringify(account));
};

export const verifyOfflineAccount = async (email: string, password: string): Promise<CachedUser | null> => {
  const raw = await getItem(OFFLINE_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    const account = JSON.parse(raw) as OfflineAccount;
    if (account.email !== normalizeEmail(email)) return null;
    const verifier = await makeVerifier(email, password, account.salt);
    return verifier === account.verifier ? account.user : null;
  } catch {
    return null;
  }
};

export const getRememberedUser = async (): Promise<CachedUser | null> => {
  const raw = await getItem(OFFLINE_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as OfflineAccount).user ?? null;
  } catch {
    return null;
  }
};

export const updateRememberedUser = async (user: CachedUser) => {
  const raw = await getItem(OFFLINE_ACCOUNT_KEY);
  if (!raw) return;
  try {
    const account = JSON.parse(raw) as OfflineAccount;
    await setItem(OFFLINE_ACCOUNT_KEY, JSON.stringify({ ...account, user }));
  } catch {
    // A future online login can recreate a corrupt remembered-account entry.
  }
};

export const setSessionActive = async (active: boolean) => setItem(ACTIVE_SESSION_KEY, active ? '1' : '0');
export const isSessionActive = async () => (await getItem(ACTIVE_SESSION_KEY)) === '1';

// Logout closes only the local UI session so the same trusted account can relogin offline.
export const closeLocalSession = async () => setSessionActive(false);

export const forgetOfflineAccount = async () => {
  await Promise.all([
    deleteItem(ACCESS_TOKEN_KEY),
    deleteItem(REFRESH_TOKEN_KEY),
    deleteItem(OFFLINE_ACCOUNT_KEY),
    deleteItem(ACTIVE_SESSION_KEY),
  ]);
};
