'use strict';
const fs = require('node:fs');
const path = require('node:path');
function registerStorageMigration(ipcMain, baseUrl, workspace) {
  ipcMain.on('stripbot-initial-storage', event => {
    event.returnValue = {};
    if (!workspace || !event.senderFrame?.url.startsWith(`${baseUrl}/`)) return;
    try {
      const file = path.join(workspace,'.runtime','desktop-migration.json');
      if (fs.statSync(file).size > 10 * 1024 * 1024) return;
      const source = JSON.parse(fs.readFileSync(file,'utf8'));
      event.returnValue = Object.fromEntries(['lucent_settings_v1','lucent_conversations_v1','lucent_active_chat_v1']
        .filter(key => typeof source[key] === 'string').map(key => [key,source[key]]));
    } catch {}
  });
}
module.exports = {registerStorageMigration};
