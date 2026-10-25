import {useLayoutEffect,useState} from 'react';

export type AppTheme = 'dark' | 'light';
const STORAGE_KEY = 'strip_ui_theme_v1';

function readStoredTheme(): AppTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark'; // Preserve the existing appearance if storage is unavailable.
  }
}

/** One setting shared by the API entry screen, workspace, and native dialogs. */
export function useAppTheme() {
  const [theme,setTheme] = useState<AppTheme>(readStoredTheme);
  useLayoutEffect(() => {
    document.documentElement.dataset.stripTheme = theme;
    document.documentElement.style.colorScheme = theme;
    try { window.localStorage.setItem(STORAGE_KEY,theme); } catch { /* private mode */ }
  },[theme]);
  return [theme,setTheme] as const;
}
