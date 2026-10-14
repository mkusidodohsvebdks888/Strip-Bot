'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const {requireLocalUrl} = require('../providers.cjs');

async function proxyEnvironment(dataDir) {
  let config;
  try {config=JSON.parse(await fs.readFile(path.join(dataDir,'proxy.json'),'utf8'));}
  catch(error) {if(error.code === 'ENOENT') return {};throw new Error('OpenCode proxy.json is invalid.');}
  const url=requireLocalUrl(config.endpoint);
  if(url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('OpenCode proxy must be a plain loopback HTTP endpoint.');
  const endpoint=url.origin;
  return {HTTP_PROXY:endpoint,HTTPS_PROXY:endpoint,http_proxy:endpoint,https_proxy:endpoint,NO_PROXY:'localhost,127.0.0.1,::1,[::1]',no_proxy:'localhost,127.0.0.1,::1,[::1]'};
}
module.exports={proxyEnvironment};
