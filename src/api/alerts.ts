import { localAlerts } from '../db/repositories';

export const getAlerts = async () => localAlerts.all();
export const createAlert = async (alert: any) => localAlerts.create(alert);
export const updateAlert = async (alertId: number, data: any) => localAlerts.update(alertId, data);
export const deleteAlert = async (alertId: number) => localAlerts.remove(alertId);

// Alert matching is server-owned; this compatibility method never starts a crawl.
export const runAlertsSync = async () => ({ processed_alerts: 0, created_notifications: 0, offline_first: true });
