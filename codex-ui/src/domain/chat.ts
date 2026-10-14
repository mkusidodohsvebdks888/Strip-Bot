export type Config = {
  provider: string;
  endpoint: string;
  model: string;
  systemPrompt: string;
  /** Page02 browser-ai-bridge provider id (chatgpt / deepseek / …). */
  bridgeProvider?: string;
  /** Forwarded as enableSearch to the bridge. */
  enableSearch?: boolean;
};
export type BridgeModel = { id: string; label: string; provider?: string; kind?: string };
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  status?: string;
  files?: string[];
};
export type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};
export const EFFORT_OPTIONS = [
  { value: "low", label: "快速", description: "关闭深度思考（enableReasoning=false）" },
  { value: "medium", label: "自动", description: "不干预，用桥接默认" },
  { value: "high", label: "思考", description: "开启深度思考（enableReasoning=true）" },
];
export const ENVIRONMENT_OPTIONS = [
  { value: "local", label: "本地", description: "仅请求本机 API" },
];
export const PERMISSION_OPTIONS = [
  { value: "on-request", label: "按需批准", description: "发送前由你确认" },
];

export const presets: Record<string, { endpoint: string; model: string }> = {
  responses: {
    endpoint: "http://127.0.0.1:3010/v1/responses",
    model: "chatgpt",
  },
  openai: {
    endpoint: "http://127.0.0.1:3010/v1/chat/completions",
    model: "chatgpt",
  },
  ollama: { endpoint: "http://127.0.0.1:11434/api/chat", model: "qwen2.5:3b" },
  simple: { endpoint: "http://127.0.0.1:8000/api/chat", model: "local-model" },
};
const BRIDGE_ENDPOINT = "http://127.0.0.1:3010/v1/chat/completions";
export const BRIDGE_PROVIDERS = ["chatgpt", "gemini", "claude", "grok", "qwen", "deepseek"];
export const initial: Config = {
  provider: "openai",
  ...presets.openai,
  systemPrompt: "你是一个清晰、准确的中文 AI 助手。",
  bridgeProvider: "chatgpt",
  enableSearch: false,
};
/**
 * Older builds defaulted to POST /v1/responses on the same bridge port, but the
 * bridge only implements /v1/chat/completions. Upgrade that stored default once
 * so an existing profile keeps working; anything else is left untouched.
 */
export function migrateConfig(config: Config): Config {
  if (
    config.provider === "responses" &&
    /^https?:\/\/127\.0\.0\.1:3010\/v1\/responses\/?$/.test(config.endpoint || "")
  ) {
    return {
      ...config,
      provider: "openai",
      endpoint: BRIDGE_ENDPOINT,
      bridgeProvider: config.bridgeProvider || "chatgpt",
    };
  }
  return config;
}
