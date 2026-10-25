'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_DEPLOY_ROOT = process.env.ASTRBOT_DEPLOY_ROOT || 'E:\\AstrBot\\qq-ai-bot-deploy';
const ADMIN_URL = 'http://127.0.0.1:6185/';
const NAPCAT_URL = 'http://127.0.0.1:6099/webui/';

function parseJson(text) {
  return JSON.parse(String(text || '').replace(/^\uFEFF/, ''));
}

async function readJson(file) {
  return parseJson(await fs.readFile(file, 'utf8'));
}

async function probe(fetchImpl, url, timeoutMs = 3000) {
  const started = Date.now();
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
    });
    await response.arrayBuffer();
    return {
      online: response.status >= 200 && response.status < 500,
      httpStatus: response.status,
      latencyMs: Date.now() - started,
      error: '',
    };
  } catch (error) {
    return {
      online: false,
      httpStatus: null,
      latencyMs: Date.now() - started,
      error: error?.name === 'TimeoutError' ? '连接超时' : '无法连接',
    };
  }
}

function modelStatus(config) {
  const modelConfig = config?.agent_runner?.config?.model || {};
  const providerId = modelConfig.provider_id || '';
  const providers = Array.isArray(config?.provider) ? config.provider : [];
  const sources = Array.isArray(config?.provider_sources) ? config.provider_sources : [];
  const provider = providers.find(item => item?.id === providerId) || {};
  const source = sources.find(item => item?.id === provider.provider_source_id) || {};
  return {
    providerId,
    model: provider.model || null,
    providerName: source.name || provider.name || null,
    type: source.type || provider.type || null,
    apiBase: source.api_base || provider.api_base || null,
    personaId: config?.agent_runner?.config?.persona?.persona_id || null,
  };
}

function createAstrBotPlugin({ deployRoot = DEFAULT_DEPLOY_ROOT, fetchImpl = fetch, now = Date.now } = {}) {
  async function status() {
    const configFile = path.join(deployRoot, 'data', 'cmd_config.json');
    const webuiFile = path.join(deployRoot, 'napcat', 'config', 'webui.json');
    let config = null;
    let webui = null;
    let configError = '';
    try { config = await readJson(configFile); }
    catch { configError = '无法读取 AstrBot 配置'; }
    try { webui = await readJson(webuiFile); }
    catch {}

    const [astrbot, napcat] = await Promise.all([
      probe(fetchImpl, ADMIN_URL),
      probe(fetchImpl, NAPCAT_URL),
    ]);
    const token = typeof webui?.token === 'string' ? webui.token.trim() : '';
    const napcatUrl = token ? `${NAPCAT_URL}?token=${encodeURIComponent(token)}` : NAPCAT_URL;
    return {
      id: 'astrbot-desktop',
      name: 'AstrBot QQ',
      version: '0.1.0',
      enabled: true,
      deployRoot,
      checkedAt: now(),
      services: { astrbot, napcat },
      model: modelStatus(config || {}),
      urls: { admin: ADMIN_URL, napcat: napcatUrl },
      configError,
    };
  }
  return { status };
}

module.exports = { createAstrBotPlugin, modelStatus, DEFAULT_DEPLOY_ROOT };