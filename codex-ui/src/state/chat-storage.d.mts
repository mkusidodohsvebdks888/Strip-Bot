import type {Chat} from '../domain/chat';
export const storageKeys: {readonly config:string; readonly chats:string; readonly active:string};
export function readStored<T>(storage: Storage, key: string, fallback: T): T;
export function restoreChats(storage: Storage): Chat[];
export function persistChats(storage: Storage, chats: Chat[], active: string | null): void;
export function exportRecords(storage: Storage): Record<string,string>;
