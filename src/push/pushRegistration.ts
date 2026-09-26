import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { apiClient } from '../api/client';

const DEVICE_ID_KEY = 'observador_push_device_id';
const REVOCATION_QUEUE_KEY = 'observador_push_revocation_queue';
const REGISTER_ENDPOINT = '/me/push-tokens';
const consumedResponseKeys = new Set<string>();

type StoredRegistration = { id: number; userId: number; deviceId: string; token: string; platform: 'android' | 'ios' };

export type PushRegistrationResult =
  | { status: 'registered'; deviceId: string; id: number }
  | { status: 'unsupported' | 'expo_go' | 'permission_denied' | 'missing_project_id' | 'unavailable' | 'pending_revocation' | 'failed'; reason?: string };

const storage = {
  async get(key: string): Promise<string | null> {
    return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

const configuredProjectId = () =>
  process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ||
  ((Constants as any).expoConfig?.extra?.eas?.projectId as string | undefined) ||
  ((Constants as any).easConfig?.projectId as string | undefined);
const isExpoGo = () => (Constants as any).appOwnership === 'expo';
const isNativePhysicalDevice = () =>
  Platform.OS === 'android' || Platform.OS === 'ios' ? (Constants as any).isDevice !== false : false;
const authConfig = (accessToken?: string) => accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined;
const registrationKey = (userId: number) => `observador_push_registration_${userId}`;

type PendingRevocation = { id: number; userId: number };

const readRevocationQueue = async (): Promise<PendingRevocation[]> => {
  const raw = await storage.get(REVOCATION_QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PendingRevocation[];
    return Array.isArray(parsed)
      ? parsed.filter(item => Number.isSafeInteger(item?.id) && item.id > 0 && Number.isSafeInteger(item?.userId) && item.userId > 0)
      : [];
  } catch { return []; }
};

const writeRevocationQueue = async (queue: PendingRevocation[]) => {
  if (queue.length === 0) return storage.remove(REVOCATION_QUEUE_KEY);
  return storage.set(REVOCATION_QUEUE_KEY, JSON.stringify(queue));
};

const enqueueRevocation = async (userId: number, id: number) => {
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isSafeInteger(id) || id <= 0) return;
  const queue = await readRevocationQueue();
  if (!queue.some(item => item.userId === userId && item.id === id)) {
    queue.push({ userId, id });
    await writeRevocationQueue(queue);
  }
};

const queueCurrentRegistration = async (userId: number) => {
  const key = registrationKey(userId);
  const raw = await storage.get(key);
  if (!raw) return;
  try {
    const registration = JSON.parse(raw) as StoredRegistration;
    if (registration.userId === userId) {
      await enqueueRevocation(userId, registration.id);
      await storage.remove(key);
    }
  } catch { /* Preserve no invalid token material; valid queue entries remain. */ }
};

export const queuePushRevocation = async (userId: number) => queueCurrentRegistration(userId);

const drainRevocations = async (userId: number, accessToken: string): Promise<boolean> => {
  if (!accessToken) return false;
  const queue = await readRevocationQueue();
  const mine = queue.filter(item => item.userId === userId);
  if (mine.length === 0) return true;
  const retained: PendingRevocation[] = queue.filter(item => item.userId !== userId);
  for (const item of mine) {
    try {
      const response = await apiClient.delete(`/me/push-tokens/${item.id}`, { ...authConfig(accessToken), timeout: 2500 });
      if (response.status !== 204) retained.push(item);
    } catch (error: any) {
      if (error?.response?.status !== 404) retained.push(item);
    }
  }
  await writeRevocationQueue(retained);
  return !retained.some(item => item.userId === userId);
};

export const getStableDeviceId = async (): Promise<string> => {
  const existing = await storage.get(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = Crypto.randomUUID();
  await storage.set(DEVICE_ID_KEY, deviceId);
  return deviceId;
};

export const getValidatedPushRoute = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const value = (data as Record<string, unknown>).concurso_id ?? (data as Record<string, unknown>).concursoId;
  const id = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? `/concurso/${id}` : null;
};

export const subscribeToPushNotifications = (onRoute: (route: string) => void) => {
  if (!isNativePhysicalDevice()) return () => undefined;
  const received = Notifications.addNotificationReceivedListener(() => undefined);
  const handleResponse = (event: Notifications.NotificationResponse) => {
    const request = event.notification.request;
    const responseKey = `${request.identifier}:${event.actionIdentifier}:${JSON.stringify(request.content.data || {})}`;
    if (consumedResponseKeys.has(responseKey)) return;
    consumedResponseKeys.add(responseKey);
    const route = getValidatedPushRoute(request.content.data);
    if (route) onRoute(route);
  };
  const response = Notifications.addNotificationResponseReceivedListener(event => {
    handleResponse(event);
  });
  void Notifications.getLastNotificationResponseAsync().then(last => {
    if (last) handleResponse(last);
  }).catch(() => undefined);
  return () => { received.remove(); response.remove(); };
};

export async function registerPushNotifications(options: { projectId?: string; userId: number; accessToken?: string }): Promise<PushRegistrationResult> {
  if (Platform.OS === 'web') return { status: 'unsupported' };
  if (isExpoGo()) return { status: 'expo_go', reason: 'development_build_required' };
  if (!isNativePhysicalDevice()) return { status: 'unavailable' };
  const projectId = options.projectId || configuredProjectId();
  if (!projectId) return { status: 'missing_project_id' };
  try {
    await queueCurrentRegistration(options.userId);
    if (!options.accessToken || !(await drainRevocations(options.userId, options.accessToken))) {
      return { status: 'pending_revocation', reason: 'revocation_retry_required' };
    }
    const current = await Notifications.getPermissionsAsync();
    const permission = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
    if (permission.status !== 'granted') return { status: 'permission_denied' };
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return { status: 'unavailable', reason: 'empty_token' };
    const deviceId = await getStableDeviceId();
    const platform = Platform.OS as 'android' | 'ios';
    const response = await apiClient.post(REGISTER_ENDPOINT, { device_id: deviceId, token, platform, provider: 'expo' }, authConfig(options.accessToken));
    const id = Number(response.data?.id);
    if (!Number.isSafeInteger(id) || id <= 0) return { status: 'failed', reason: 'missing_registration_id' };
    await storage.set(registrationKey(options.userId), JSON.stringify({ id, userId: options.userId, deviceId, token, platform } satisfies StoredRegistration));
    return { status: 'registered', deviceId, id };
  } catch { return { status: 'failed' }; }
}

export async function revokePushNotifications(options: { accessToken?: string; userId?: number } = {}): Promise<boolean> {
  if (!options.userId) return false;
  await queueCurrentRegistration(options.userId);
  const queued = await readRevocationQueue();
  if (!queued.some(item => item.userId === options.userId)) return false;
  return !!options.accessToken && drainRevocations(options.userId, options.accessToken);
}
