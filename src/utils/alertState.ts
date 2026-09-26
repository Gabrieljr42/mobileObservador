type PendingOperation = { op?: string; entity_key?: string | number | null };

/** Keeps only rows that still have a local alert operation awaiting sync. */
export const mergePendingAlerts = <T extends { id: number | string }>(
  serverAlerts: T[],
  currentAlerts: T[],
  pending: PendingOperation[],
): T[] => {
  const pendingIds = new Set(
    pending
      .filter(item => item.op === 'alert_create' || item.op === 'alert_update')
      .map(item => String(item.entity_key)),
  );
  if (!pendingIds.size) return serverAlerts;
  const visibleIds = new Set(serverAlerts.map(item => String(item.id)));
  const retained = currentAlerts.filter(item => pendingIds.has(String(item.id)) && !visibleIds.has(String(item.id)));
  return [...serverAlerts, ...retained];
};
