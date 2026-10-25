// Defaults checked against the linked vendor documentation on 2026-10-17.
// API providers describe the key's destination, not just model ownership.
export const apiPresets=[
  {id:'openai',name:'OpenAI 官方',baseUrl:'https://api.openai.com/v1',model:'gpt-5-mini',protocol:'responses',note:'使用 OpenAI 平台 API Key；ChatGPT 订阅登录不适用于此入口。',docs:'https://developers.openai.com/api/docs/models/gpt-5-mini'},
  {id:'openrouter',name:'OpenRouter',baseUrl:'https://openrouter.ai/api/v1',model:'openai/gpt-4o-mini',protocol:'openai',note:'从 OpenRouter 模型目录中自动选择可用模型。',docs:'https://openrouter.ai/docs/quickstart'},
  {id:'groq',name:'GroqCloud',baseUrl:'https://api.groq.com/openai/v1',model:'llama-3.3-70b-versatile',protocol:'openai',note:'从 GroqCloud 模型目录中自动选择可用模型。',docs:'https://console.groq.com/docs/openai'},
  {id:'deepseek',name:'DeepSeek 官方',baseUrl:'https://api.deepseek.com',model:'deepseek-flash',protocol:'responses',note:'使用官方 Responses 接口；只需输入 DeepSeek API Key。',docs:'https://api-docs.deepseek.com/guides/responses_api/'},
  {id:'google',name:'Google Gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta/openai',model:'gemini-3.8-flash',protocol:'openai',note:'使用 Google AI Studio 的 Gemini API Key。',docs:'https://ai.google.dev/gemini-api/docs/openai'},
  {id:'qwen-cn',name:'通义千问 · 北京',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',model:'qwen-plus',protocol:'openai',note:'使用北京地域百炼 API Key。Coding Plan 专用密钥需使用其专用地址，请在连接配置中修改。',docs:'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope'},
  {id:'qwen-sg',name:'通义千问 · 新加坡',baseUrl:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',model:'qwen-plus',protocol:'openai',note:'使用新加坡地域百炼 API Key；不同地域的密钥不能混用。',docs:'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope'},
  {id:'custom',name:'其他 / 自定义兼容服务',baseUrl:'',model:'',protocol:'openai',note:'填写服务提供的地址、模型与 API Key。支持 Responses 或 Chat Completions。',docs:''},
];
