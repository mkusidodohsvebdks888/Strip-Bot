/** Strip's CC Switch adapter. Transport only; does not replace your local API adapter. */
export interface CcSwitchStatus {
  reachable: boolean;
  endpoint: string;
  connection: 'ready' | 'proxy-only' | 'offline';
  codex: {
    found: boolean;
    model: string | null;
    provider: string | null;
    routesThroughCcSwitch: boolean;
  };
  note: string;
}

const BASE = '/api/cc-switch';
const ENABLED_KEY = 'strip.ccswitch.enabled.v1';

export function isCcSwitchEnabled(): boolean {
  return window.localStorage.getItem(ENABLED_KEY) === '1';
}
export function setCcSwitchEnabled(value: boolean): void {
  window.localStorage.setItem(ENABLED_KEY, value ? '1' : '0');
}

export async function inspectCcSwitch(): Promise<CcSwitchStatus> {
  const res = await fetch(`${BASE}/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Bridge responded with HTTP ${res.status}`);
  return res.json() as Promise<CcSwitchStatus>;
}

export interface CcSwitchResponse {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string } | string;
}

export function extractResponseText(response: CcSwitchResponse): string {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output ?? []).flatMap(item => item.content ?? [])
    .filter(c => c.type === 'output_text' && typeof c.text === 'string')
    .map(c => c.text ?? '')
    .join('\n');
}

/** Makes a real model call and may use paid tokens. Only invoke after explicit user action. */
export async function sendCcSwitchResponse(input: string, model?: string, signal?: AbortSignal): Promise<CcSwitchResponse> {
  if (!isCcSwitchEnabled()) throw new Error('请先在连接页面开启 CC Switch。');
  const result = await fetch(`${BASE}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Strip-Bridge': '1' },
    body: JSON.stringify({ input, model: model || undefined, stream: false }),
    signal,
  });
  const raw = await result.text();
  let data: CcSwitchResponse;
  try { data = JSON.parse(raw) as CcSwitchResponse; }
  catch { data = { error: raw.slice(0, 2000) || `HTTP ${result.status}` }; }
  if (!result.ok) {
    const message = typeof data.error === 'string' ? data.error : data.error?.message;
    throw new Error(message || `CC Switch responded HTTP ${result.status}`);
  }
  return data;
}
