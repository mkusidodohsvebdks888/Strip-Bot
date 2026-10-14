export const storageKeys = Object.freeze({config:'lucent_settings_v1', chats:'lucent_conversations_v1', active:'lucent_active_chat_v1'});
export function readStored(storage, key, fallback) {
  try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}
/** Discard invalid records, keep valid history, recover interrupted generations. */
export function restoreChats(storage) {
  const value = readStored(storage, storageKeys.chats, []);
  if (!Array.isArray(value)) return [];
  return value.filter(c => c && typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.messages))
    .map(c => ({...c, updatedAt:Number.isFinite(c.updatedAt) ? c.updatedAt : 0,
      messages:c.messages.filter(m => m && typeof m.id === 'string' && ['user','assistant'].includes(m.role) && typeof m.content === 'string')
        .map(m => ({...m, status:m.status === 'streaming' ? 'stopped' : m.status})),
    }));
}
/** Debouncing belongs to the React owner; this module performs one snapshot write. */
export function persistChats(storage, chats, active) {
  storage.setItem(storageKeys.chats, JSON.stringify(chats));
  storage.setItem(storageKeys.active, JSON.stringify(active));
}
export function exportRecords(storage) {
  return Object.fromEntries(Object.values(storageKeys).map(key => [key, storage.getItem(key)]).filter(([,value]) => value !== null));
}
