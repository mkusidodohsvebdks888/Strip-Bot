'use strict';
const fs = require('node:fs');
const path = require('node:path');

function findWorkspace(resources) {
  if (process.env.STRIPBOT_WORKSPACE_ROOT) return path.resolve(process.env.STRIPBOT_WORKSPACE_ROOT);
  let candidate = resources;
  for (let i = 0; i < 7; i++, candidate = path.dirname(candidate)) {
    if (fs.existsSync(path.join(candidate, 'codex-ui', 'package.json'))) return candidate;
  }
  return null;
}

/** A lease distinguishes a reused service from a service owned by this process. */
async function startLocalService({resources, workspace, dataRoot, port = 3060,agentExecutable}) {
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const response = await fetch(`${baseUrl}/api/health`, {signal:AbortSignal.timeout(1500)});
    const info = await response.json();
    if (response.ok && info.service === 'stripbot-gateway' && info.version === '1.5.1' && info.capabilities?.agent === 'codex-app-server' && info.capabilities?.ccswitch && info.capabilities?.ccOnly && info.capabilities?.ccSwitchOnly && info.capabilities?.connectionOptions && info.capabilities?.chatgptLogin) {
      return {baseUrl, owned:false, close:async () => {}};
    }
  } catch {}
  const {createGateway} = require(path.join(resources, 'backend', 'gateway.cjs'));
  const server = createGateway({
    agentRoot:workspace || dataRoot || resources,
    agentExecutable,
    publicDir:path.join(resources, 'public'), ccOnly:true,ccSwitchOnly:true,connectionOptions:true,chatgptLogin:true,
    defaults:{provider:'ccswitch', endpoint:'http://127.0.0.1:15721/v1/responses', model:''},
  });
  await new Promise((resolve,reject) => {
    const fail = error => reject(error.code === 'EADDRINUSE' ? new Error(`端口 ${port} 已被其他服务占用。请关闭旧版 Strip Bot 服务后重试。`) : error);
    server.once('error',fail);
    server.listen(port,'127.0.0.1',() => {server.removeListener('error',fail); resolve();});
  });
  return {baseUrl, owned:true, close:() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections?.();
  })};
}
module.exports = {findWorkspace, startLocalService};


