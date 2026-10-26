import {useEffect, useRef, useState} from 'react';

/** All appearance data stays on this computer; background files never reach the API. */
export type WallpaperFit = 'contain' | 'cover';
export interface WallpaperPreferences {
  fluidGlassEnabled: boolean;
  wallpaperEnabled: boolean;
  fit: WallpaperFit;
  softness: number; // 0-100: how gradually the image fades into the theme color
  opacity: number; // 35-100: how strongly the image is displayed
}

export interface WallpaperAsset {
  url: string;
  name: string;
  width: number;
  height: number;
}

export interface WallpaperController extends WallpaperPreferences {
  wallpaper: WallpaperAsset | null;
  wallpaperLoading: boolean;
  busy: boolean;
  error: string;
  disableWallpaper: () => void;
  enableWallpaper: () => void;
  enableFluidGlass: () => void;
  disableFluidGlass: () => void;
  uploadWallpaper: (file: File) => Promise<void>;
  removeWallpaper: () => Promise<void>;
  setFit: (fit: WallpaperFit) => void;
  setSoftness: (level: number) => void;
  setOpacity: (level: number) => void;
  clearError: () => void;
}

const STORAGE_KEY = 'strip_wallpaper_preferences_v1';
const DB_NAME = 'strip-bot-appearance';
const DB_STORE = 'wallpapers';
const DB_KEY = 'current';
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']);
const defaults: WallpaperPreferences = {fluidGlassEnabled: false, wallpaperEnabled: false, fit: 'contain', softness: 55, opacity: 95};

interface StoredWallpaper {id: string; blob: Blob; name: string; width: number; height: number}

function safeNumber(value: unknown, fallback: number, low: number, high: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
}
function readPreferences(): WallpaperPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    return {
      wallpaperEnabled: saved.wallpaperEnabled === true,
      fluidGlassEnabled: saved.fluidGlassEnabled === true,
      fit: saved.fit === 'cover' ? 'cover' : 'contain',
      softness: safeNumber(saved.softness, defaults.softness, 0, 100),
      opacity: safeNumber(saved.opacity, defaults.opacity, 35, 100),
    };
  } catch { return defaults; }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('当前环境不支持图片的本地持久化。'));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE, {keyPath: 'id'});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('图片存储无法打开。'));
    request.onblocked = () => reject(new Error('图片存储正在被其他窗口占用。'));
  });
}
async function readWallpaper(): Promise<StoredWallpaper | null> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(DB_KEY);
      request.onsuccess = () => resolve((request.result as StoredWallpaper | undefined) || null);
      request.onerror = () => reject(request.error || new Error('无法读取背景图片。'));
    });
  } finally { db.close(); }
}
async function updateWallpaper(record: StoredWallpaper | null): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(DB_STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('无法保存背景图片。'));
      transaction.onabort = () => reject(transaction.error || new Error('图片保存已中止。'));
      const store = transaction.objectStore(DB_STORE);
      if (record) store.put(record);
      else store.delete(DB_KEY);
    });
  } finally { db.close(); }
}
function getImageSize(blob: Blob): Promise<{width: number; height: number}> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const finish = () => URL.revokeObjectURL(url);
    image.onload = () => { const width = image.naturalWidth; const height = image.naturalHeight; finish(); width && height ? resolve({width, height}) : reject(new Error('图片尺寸无效。')); };
    image.onerror = () => { finish(); reject(new Error('图片无法解码，请更换 PNG、JPG 或 WebP 文件。')); };
    image.src = url;
  });
}

export function useWallpaper(): WallpaperController {
  const [preferences, setPreferences] = useState<WallpaperPreferences>(readPreferences);
  const [wallpaper, setWallpaper] = useState<WallpaperAsset | null>(null);
  const [wallpaperLoading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const activeUrl = useRef<string | null>(null);
  const changeNumber = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    const snapshot = changeNumber.current;
    void readWallpaper().then(record => {
      if (cancelled || snapshot !== changeNumber.current) return;
      if (!record) {
        setPreferences(state => ({...state, wallpaperEnabled: false}));
        return;
      }
      const url = URL.createObjectURL(record.blob);
      activeUrl.current = url;
      setWallpaper({url, name: record.name, width: record.width, height: record.height});
    }).catch(() => {
      if (!cancelled && snapshot === changeNumber.current) {setError('读取本地背景图片失败，请检查应用存储权限。'); setPreferences(state => ({...state, wallpaperEnabled: false}));}
    }).finally(() => {if (!cancelled) setLoading(false);});
    return () => {mounted.current = false;cancelled = true; if (activeUrl.current) URL.revokeObjectURL(activeUrl.current); activeUrl.current = null;};
  }, []);
  useEffect(() => {try {localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));} catch {/* The UI still works without preference persistence. */}}, [preferences]);
  const patch = (next: Partial<WallpaperPreferences>) => setPreferences(current => ({...current, ...next}));
  async function uploadWallpaper(file: File) {
    setError('');
    if (!SUPPORTED_MIMES.has(file.type)) {setError('请选择 JPG、PNG、WebP、GIF、AVIF 或 BMP 图片。'); return;}
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {setError('图片不能超过 30 MB，且不能为空。'); return;}
    const operation = ++changeNumber.current;
    setBusy(true);
    try {
      const size = await getImageSize(file);
      await updateWallpaper({id: DB_KEY, blob: file, name: file.name, width: size.width, height: size.height});
      if (!mounted.current || operation !== changeNumber.current) return;
      const url = URL.createObjectURL(file);
      const previous = activeUrl.current;
      activeUrl.current = url;
      setWallpaper({url, name: file.name, ...size});
      patch({wallpaperEnabled: true,fluidGlassEnabled:false});
      if (previous) URL.revokeObjectURL(previous);
    } catch (reason) {if (mounted.current && operation === changeNumber.current) setError(reason instanceof Error ? reason.message : '无法保存这张图片。');}
    finally {if (mounted.current && operation === changeNumber.current) setBusy(false);}
  }
  async function removeWallpaper() {
    const operation = ++changeNumber.current;
    setBusy(true);setError('');
    try {
      await updateWallpaper(null);
      if (!mounted.current || operation !== changeNumber.current) return;
      patch({wallpaperEnabled: false});
      setWallpaper(null);
      if (activeUrl.current) URL.revokeObjectURL(activeUrl.current);
      activeUrl.current = null;
    } catch (reason) {if (mounted.current && operation === changeNumber.current) setError(reason instanceof Error ? reason.message : '无法删除这张图片。');}
    finally {if (mounted.current && operation === changeNumber.current) setBusy(false);}
  }
  return {
    ...preferences, wallpaper, wallpaperLoading, busy, error,
    disableWallpaper: () => patch({wallpaperEnabled: false}),
    enableFluidGlass: () => patch({fluidGlassEnabled:true,wallpaperEnabled:false}),
    disableFluidGlass: () => patch({fluidGlassEnabled:false}),
    enableWallpaper: () => {if (wallpaper) patch({wallpaperEnabled: true,fluidGlassEnabled:false});},
    uploadWallpaper, removeWallpaper,
    setFit: fit => patch({fit}),
    setSoftness: softness => patch({softness: safeNumber(softness, defaults.softness, 0, 100)}),
    setOpacity: opacity => patch({opacity: safeNumber(opacity, defaults.opacity, 35, 100)}),
    clearError: () => setError(''),
  };
}
