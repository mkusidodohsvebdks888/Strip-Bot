'use strict';
const fs = require('node:fs/promises'),path = require('node:path'),os = require('node:os');
const {httpError} = require('../../core/providers/index.cjs');
// Read public routing fields only. Never read auth.json or CC Switch's database.
function parsePublicConfig(source,port) {
  let section = '';const top = {},bases = {};
  for (const line of source.split(/\r?\n/)) {
    const head = line.match(/^\s*\[([^\]]+)\]\s*(?:#.*)?$/);
    if (head) {section = head[1].trim();continue;}
    const pair = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*["']([^"']*)["']\s*(?:#.*)?$/);
    if (!pair) continue;
    if (!section && ['model','model_provider'].includes(pair[1])) top[pair[1]] = pair[2];
    if (section.startsWith('model_providers.') && pair[1] === 'base_url') bases[section.slice(16).replace(/^"|"$/g,'')] = pair[2];
  }
  let routesThroughCcSwitch = false;
  try {const u = new URL(bases[top.model_provider]);routesThroughCcSwitch = u.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname) && Number(u.port || 80) === port && /^\/v1\/?$/.test(u.pathname);} catch {}
  return {model:top.model || null,provider:top.model_provider || null,routesThroughCcSwitch};
}
function createCcSwitch({port = Number(process.env.CC_SWITCH_PROXY_PORT || 15721),configPath = path.join(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'),'config.toml')} = {}) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('CC Switch 端口无效。');
  const endpoint = `http://127.0.0.1:${port}/v1/responses`;
  async function publicConfig() {
    try {return {...parsePublicConfig(await fs.readFile(configPath,'utf8'),port),found:true};}
    catch(error) {if (error.code !== 'ENOENT') throw httpError(500,'无法读取 Codex 的公开模型配置。');return {model:null,provider:null,routesThroughCcSwitch:false,found:false};}
  }
  return {endpoint,apiKey:'PROXY_MANAGED',async resolve(model) {
    const selected = model || (await publicConfig()).model;
    if (typeof selected !== 'string' || !/^[\w.\-/:]{1,150}$/.test(selected)) throw httpError(400,'请在 CC Switch 连接页填写模型名称，或先配置 Codex 模型。');
    return {provider:'responses',endpoint,model:selected,apiKey:'PROXY_MANAGED'};
  },async status() {
    const [codex,health] = await Promise.all([publicConfig(),fetch(`http://127.0.0.1:${port}/health`,{redirect:'manual',signal:AbortSignal.timeout(2500)}).then(async r => {await r.body?.cancel();return {reachable:true,httpStatus:r.status,healthy:r.ok};},() => ({reachable:false,healthy:false,httpStatus:null}))]);
    return {...health,modelVerification:'unverified',endpoint:endpoint.replace(/\/responses$/,''),codex,connection:health.healthy ? codex.routesThroughCcSwitch ? 'ready':'proxy-only':'offline',note:'只读模型配置；连接检测不代表模型调用或工具执行成功。'};
  }};
}
module.exports = {createCcSwitch,parsePublicConfig};
