'use strict';
const { ipcRenderer, contextBridge, webUtils } = require('electron');
const storage = ipcRenderer.sendSync('stripbot-initial-storage');
// Seed only a fresh desktop profile. Never overwrite the user's desktop data.
try {
  if (!localStorage.getItem('lucent_conversations_v1') && storage && typeof storage === 'object') {
    for (const key of ['lucent_settings_v1', 'lucent_conversations_v1', 'lucent_active_chat_v1']) {
      if (typeof storage[key] === 'string' && !localStorage.getItem(key)) localStorage.setItem(key, storage[key]);
    }
  }
} catch {}

// Expose only a validated theme choice. No general-purpose IPC is available to the page.
contextBridge.exposeInMainWorld('stripWindowAppearance', Object.freeze({
  sync(appearance) {
    if (appearance === 'warm' || appearance === 'white' || appearance === 'dark' || appearance === 'mist' || appearance === 'graphite') {
      ipcRenderer.send('stripbot:appearance', appearance);
    }
  },
}));

// Resolve a dropped File to its real local path without exposing general Electron APIs.
contextBridge.exposeInMainWorld('stripSkillFiles', Object.freeze({
  getPathForFile(file) {
    try { return webUtils.getPathForFile(file) || ''; } catch { return ''; }
  },
}));
// CSS can reserve space for OS-managed Minimize / Maximize / Close controls.
if (document.documentElement) document.documentElement.dataset.stripDesktop = 'true';
