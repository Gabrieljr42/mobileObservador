import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { isSessionActive } from '../storage/auth';
import { syncIfDue } from './syncService';

export const BACKGROUND_SYNC_TASK = 'observador-hourly-checkpoint-sync';

if (!TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      if (!(await isSessionActive())) {
        return BackgroundTask.BackgroundTaskResult.Success;
      }
      await syncIfDue(false);
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.warn('Background checkpoint sync failed', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export const registerBackgroundSyncAsync = async () => {
  const available = await TaskManager.isAvailableAsync();
  if (!available) return false;
  const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  if (!registered) {
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, { minimumInterval: 60 });
  }
  return true;
};
