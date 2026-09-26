import { useSyncExternalStore } from 'react';

let revision = 0;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => revision;

// Notify only after a checkpoint commits, so readers see one consistent cache.
export const checkpointCommitted = () => {
  revision += 1;
  listeners.forEach(listener => listener());
};
export const useSyncRevision = () => useSyncExternalStore(subscribe, snapshot, () => 0);
