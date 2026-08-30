import { localPreferences } from '../db/repositories';

export const getPreferences = async () => localPreferences.get();
export const updatePreferences = async (preferences: any) => localPreferences.set(preferences);
