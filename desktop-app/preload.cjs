'use strict';
const { ipcRenderer } = require('electron');
const storage = ipcRenderer.sendSync('stripbot-initial-storage');
// Seed only a fresh desktop profile. Never overwrite the user's desktop data.
try {
  if (!localStorage.getItem('lucent_conversations_v1') && storage && typeof storage === 'object') {
    for (const key of ['lucent_settings_v1', 'lucent_conversations_v1', 'lucent_active_chat_v1']) {
      if (typeof storage[key] === 'string' && !localStorage.getItem(key)) localStorage.setItem(key, storage[key]);
    }
  }
} catch {}
