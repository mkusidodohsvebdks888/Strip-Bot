(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const SETTINGS_KEY = 'lucent_settings_v1';
  const CHATS_KEY = 'lucent_conversations_v1';
  const ACTIVE_KEY = 'lucent_active_chat_v1';
  const PROVIDER_PRESETS = {
    responses: { endpoint: 'http://127.0.0.1:3010/v1/responses', model: 'chatgpt' },
    openai: { endpoint: 'http://127.0.0.1:8000/v1/chat/completions', model: 'local-model' },
    ollama: { endpoint: 'http://127.0.0.1:11434/api/chat', model: 'qwen2.5:3b' },
    simple: { endpoint: 'http://127.0.0.1:8000/api/chat', model: 'local-model' },
  };

  let config = {
    provider: 'openai',
    endpoint: PROVIDER_PRESETS.openai.endpoint,
    model: PROVIDER_PRESETS.openai.model,
    systemPrompt: '你是一个清晰、准确的中文 AI 助手。',
  };
  let conversations = [];
  let activeChatId = null;
  let generation = null;
  let toastTimer = 0;
  let lastSettingsFocus = null;

  function readStorage(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
  function saveState() {
    try {
      const compact = conversations.slice(0, 35).map(chat => ({
        ...chat,
        messages: chat.messages.slice(-90).map(message => ({ ...message, content: message.content.slice(0, 100000) })),
      }));
      localStorage.setItem(CHATS_KEY, JSON.stringify(compact));
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeChatId));
    } catch { toast('浏览器存储空间不足，本次消息可能无法保存。'); }
  }
  function uid() { return crypto.randomUUID?.() || `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`; }
  function currentChat() { return conversations.find(chat => chat.id === activeChatId) || null; }
  function setStatus(text, state = 'neutral') {
    $('apiStatus').textContent = text;
    $('apiDot').className = `status-dot ${state}`;
  }
  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }
  function timeLabel(date) {
    const value = Number(date) || Date.now();
    const d = new Date(value);
    if (new Date().toDateString() === d.toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  // Solar Icons Bold Duotone, by 480 Design (CC BY 4.0). Local SVG only.
  function svgIcon(which) {
    const icons = {
    "chat": "<svg aria-hidden=\"true\" focusable=\"false\"  xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.5\" class=\"solar solar-chat-round-dots-bold-duotone\"><path d=\"M12 23C18.0751 23 23 18.0751 23 12C23 5.92487 18.0751 1 12 1C5.92487 1 1 5.92487 1 12C1 13.7596 1.41318 15.4228 2.14781 16.8977C2.34303 17.2897 2.40801 17.7377 2.29483 18.1607L1.63966 20.6093C1.35525 21.6723 2.32772 22.6447 3.39068 22.3603L5.83932 21.7052C6.26233 21.592 6.71033 21.657 7.10228 21.8522C8.5772 22.5868 10.2404 23 12 23Z\" fill=\"currentColor\" style=\"color: var(--solar-secondary-color, currentColor); opacity: var(--solar-secondary-opacity, 0.5)\"/><path d=\"M10.9 12.0004C10.9 12.6079 11.3925 13.1004 12 13.1004C12.6075 13.1004 13.1 12.6079 13.1 12.0004C13.1 11.3929 12.6075 10.9004 12 10.9004C11.3925 10.9004 10.9 11.3929 10.9 12.0004Z\" fill=\"currentColor\"/>\n<path d=\"M6.5 12.0004C6.5 12.6079 6.99249 13.1004 7.6 13.1004C8.20751 13.1004 8.7 12.6079 8.7 12.0004C8.7 11.3929 8.20751 10.9004 7.6 10.9004C6.99249 10.9004 6.5 11.3929 6.5 12.0004Z\" fill=\"currentColor\"/>\n<path d=\"M15.3 12.0004C15.3 12.6079 15.7925 13.1004 16.4 13.1004C17.0075 13.1004 17.5 12.6079 17.5 12.0004C17.5 11.3929 17.0075 10.9004 16.4 10.9004C15.7925 10.9004 15.3 11.3929 15.3 12.0004Z\" fill=\"currentColor\"/></svg>",
    "trash": "<svg aria-hidden=\"true\" focusable=\"false\"  xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.5\" class=\"solar solar-trash-bin-trash-bold-duotone\"><path d=\"M11.5956 22.0001H12.4044C15.1871 22.0001 16.5785 22.0001 17.4831 21.1142C18.3878 20.2283 18.4803 18.7751 18.6654 15.8686L18.9321 11.6807C19.0326 10.1037 19.0828 9.31524 18.6289 8.81558C18.1751 8.31592 17.4087 8.31592 15.876 8.31592H8.12405C6.59127 8.31592 5.82488 8.31592 5.37105 8.81558C4.91722 9.31524 4.96744 10.1037 5.06788 11.6807L5.33459 15.8686C5.5197 18.7751 5.61225 20.2283 6.51689 21.1142C7.42153 22.0001 8.81289 22.0001 11.5956 22.0001Z\" fill=\"currentColor\" style=\"color: var(--solar-secondary-color, currentColor); opacity: var(--solar-secondary-opacity, 0.5)\"/><path d=\"M9.42578 11.4815C9.83777 11.4383 10.2049 11.7548 10.2461 12.1885L10.7461 17.4522C10.7871 17.8858 10.4862 18.2721 10.0742 18.3154C9.66223 18.3586 9.29511 18.0421 9.25391 17.6084L8.75391 12.3457C8.71269 11.9119 9.01362 11.5248 9.42578 11.4815Z\" fill=\"currentColor\"/>\n<path d=\"M14.5742 11.4815C14.9864 11.5248 15.2873 11.9119 15.2461 12.3457L14.7461 17.6084C14.7049 18.0422 14.3378 18.3586 13.9258 18.3154C13.5138 18.2721 13.2129 17.8858 13.2539 17.4522L13.7539 12.1885C13.7951 11.7548 14.1623 11.4384 14.5742 11.4815Z\" fill=\"currentColor\"/>\n<path d=\"M13.7393 2.00002C13.9618 1.99986 14.1558 1.99998 14.3389 2.03322C15.0621 2.16462 15.688 2.67737 16.0264 3.41603C16.112 3.60305 16.1729 3.8126 16.2432 4.05275L16.3584 4.44435C16.3778 4.51052 16.383 4.52913 16.3877 4.54396C16.5678 5.11018 17.1279 5.49355 17.6572 5.50881H20.2285C20.6545 5.50881 20.9999 5.90141 21 6.38576C21 6.87022 20.6546 7.26271 20.2285 7.26271H3.77148C3.34544 7.26271 3 6.87022 3 6.38576C3.00011 5.90141 3.3455 5.50881 3.77148 5.50881H6.43555C6.9649 5.49355 7.43218 5.11018 7.6123 4.54396C7.61702 4.52913 7.6222 4.51055 7.6416 4.44435L7.75684 4.05275C7.82709 3.8126 7.88799 3.60305 7.97363 3.41603C8.31193 2.67739 8.93792 2.16467 9.66113 2.03322C9.84415 1.99999 10.0383 1.99986 10.2607 2.00002H13.7393Z\" fill=\"currentColor\"/></svg>",
    "copy": "<svg aria-hidden=\"true\" focusable=\"false\"  xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke-width=\"1.5\" class=\"solar solar-copy-bold-duotone\"><path d=\"M4.17157 3.17157C3 4.34315 3 6.22876 3 10V12C3 15.7712 3 17.6569 4.17157 18.8284C4.78913 19.446 5.6051 19.738 6.79105 19.8761C6.59961 19.0353 6.59961 17.8796 6.59961 16.2167V11.3974C6.59961 8.6712 6.59961 7.3081 7.44314 6.46118C8.28667 5.61426 9.64432 5.61426 12.3596 5.61426H15.2396C16.8915 5.61426 18.0409 5.61426 18.8777 5.80494C18.7403 4.61146 18.4484 3.79154 17.8284 3.17157C16.6569 2 14.7712 2 11 2C7.22876 2 5.34315 2 4.17157 3.17157Z\" fill=\"currentColor\" style=\"color: var(--solar-secondary-color, currentColor); opacity: var(--solar-secondary-opacity, 0.5)\"/><path d=\"M6.59961 11.3974C6.59961 8.67119 6.59961 7.3081 7.44314 6.46118C8.28667 5.61426 9.64432 5.61426 12.3596 5.61426H15.2396C17.9549 5.61426 19.3125 5.61426 20.1561 6.46118C20.9996 7.3081 20.9996 8.6712 20.9996 11.3974V16.2167C20.9996 18.9429 20.9996 20.306 20.1561 21.1529C19.3125 21.9998 17.9549 21.9998 15.2396 21.9998H12.3596C9.64432 21.9998 8.28667 21.9998 7.44314 21.1529C6.59961 20.306 6.59961 18.9429 6.59961 16.2167V11.3974Z\" fill=\"currentColor\"/></svg>"
};
    const template = document.createElement('template');
    template.innerHTML = icons[which] || icons.chat;
    return template.content.firstElementChild;
  }

  function modelBrand(model, provider) {
    const value = String(model || '').toLowerCase();
    for (const [pattern, brand] of [ [/codex/, 'codex'], [/claude/, 'claude'],
      [/gemini/, 'gemini'], [/deepseek/, 'deepseek'], [/qwen|qwq/, 'qwen'],
      [/kimi|moonshot/, 'kimi'], [/chatgpt|gpt|^o[134](?:-|$)/, 'openai'] ]) {
      if (pattern.test(value)) return brand;
    }
    return provider === 'ollama' ? 'ollama' : null;
  }
  function modelIcon(model, provider) {
    const brand = modelBrand(model, provider);
    if (brand && window.MODEL_BRAND_ICONS[brand]) {
      const template = document.createElement('template');
      template.innerHTML = window.MODEL_BRAND_ICONS[brand];
      return template.content.firstElementChild;
    }
    const image = document.createElement('img');
    image.src = '/brand-logo.png'; image.alt = ''; image.className = 'model-brand-icon';
    return image;
  }
  function updateModelBadge() {
    $('activeModel').textContent = config.model;
    $('modelBrandIcon').replaceChildren(modelIcon(config.model, config.provider));
  }

  function renderConversations() {
    const list = $('conversationList');
    list.replaceChildren();
    $('chatCount').textContent = String(conversations.length);
    if (!conversations.length) {
      const empty = document.createElement('p');
      empty.className = 'conversation-empty';
      empty.textContent = '你的对话会显示在这里';
      list.append(empty);
      return;
    }
    for (const chat of conversations) {
      const item = document.createElement('div');
      item.className = `conversation-item${chat.id === activeChatId ? ' active' : ''}`;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', `打开会话：${chat.title}`);
      item.append(svgIcon('chat'));
      const name = document.createElement('span');
      name.className = 'conversation-name';
      name.textContent = chat.title;
      item.append(name);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete-conversation';
      remove.title = '删除会话';
      remove.setAttribute('aria-label', `删除会话：${chat.title}`);
      remove.append(svgIcon('trash'));
      remove.addEventListener('click', event => {
        event.stopPropagation();
        deleteChat(chat.id);
      });
      item.append(remove);
      item.addEventListener('click', () => selectChat(chat.id));
      item.addEventListener('keydown', event => {
        if (event.target === item && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); selectChat(chat.id);
        }
      });
      list.append(item);
    }
  }

  function makeMessageElement(message) {
    const wrapper = document.createElement('article');
    wrapper.className = `message ${message.role}${message.status === 'error' ? ' error' : ''}`;
    wrapper.dataset.messageId = message.id;
    const avatar = document.createElement('span');
    avatar.className = 'message-avatar';
    if (message.role === 'assistant') avatar.append(modelIcon(message.model, message.provider));
    else avatar.textContent = '你';
    const body = document.createElement('div');
    body.className = 'message-body';
    const name = document.createElement('div');
    name.className = 'message-name';
    name.textContent = `${message.role === 'assistant' ? '本地 AI' : '你'} · ${timeLabel(message.createdAt)}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    if (message.status === 'streaming' && !message.content) {
      const dots = document.createElement('span');
      dots.className = 'typing-dots';
      for (let i = 0; i < 3; i++) dots.append(document.createElement('i'));
      content.append(dots);
    } else {
      content.textContent = message.content || (message.role === 'assistant' ? '（没有收到文本）' : '');
    }
    body.append(name, content);
    if (message.role === 'assistant' && message.content && message.status !== 'streaming') {
      const actions = document.createElement('div');
      actions.className = 'message-actions';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.append(svgIcon('copy'), document.createTextNode('复制回复'));
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(message.content); toast('已复制到剪贴板'); }
        catch { toast('复制失败，请手动选择文本。'); }
      });
      actions.append(copy);
      if (message.status === 'stopped') {
        const hint = document.createElement('span');
        hint.className = 'stopped-hint'; hint.textContent = '已停止';
        actions.append(hint);
      }
      body.append(actions);
    }
    wrapper.append(avatar, body);
    return wrapper;
  }

  function scrollDown(force = false) {
    const area = $('messageScroll');
    if (!force && area.scrollHeight - area.scrollTop - area.clientHeight > 220) return;
    requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
  }
  function renderMessages() {
    const chat = currentChat();
    const anyMessages = !!(chat && chat.messages.length);
    $('emptyState').hidden = anyMessages;
    $('messages').hidden = !anyMessages;
    const el = $('messages');
    el.replaceChildren();
    if (anyMessages) {
      for (const message of chat.messages) el.append(makeMessageElement(message));
      scrollDown(true);
    }
  }
  function updateStreamingMessage(job) {
    if (activeChatId !== job.chatId) return;
    const target = Array.from($('messages').querySelectorAll('.message')).find(el => el.dataset.messageId === job.reply.id);
    if (!target) { renderMessages(); return; }
    target.querySelector('.message-content').textContent = job.reply.content;
    scrollDown();
  }
  function setGeneration(job) {
    generation = job;
    const running = !!job;
    $('sendIcon').hidden = running;
    $('stopIcon').hidden = !running;
    $('sendButton').setAttribute('aria-label', running ? '停止生成' : '发送消息');
    $('sendButton').title = running ? '停止生成' : '发送消息';
    updateSendEnabled();
  }
  function updateSendEnabled() {
    $('sendButton').disabled = !generation && !$('messageInput').value.trim();
  }
  function abortGeneration() {
    if (!generation) return;
    const job = generation;
    job.controller.abort();
    job.reply.status = 'stopped';
    if (!job.reply.content) job.reply.content = '已停止生成。';
    setGeneration(null);
    saveState();
    renderMessages();
  }
  function selectChat(id) {
    if (activeChatId === id) { closeSidebar(); return; }
    abortGeneration();
    activeChatId = id;
    saveState();
    renderConversations();
    renderMessages();
    closeSidebar();
  }
  function newChat() {
    abortGeneration();
    // Keep at most one unused blank chat, even after repeated clicks.
    conversations = conversations.filter(chat => chat.messages.length);
    const chat = { id: uid(), title: '新对话', createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
    conversations.unshift(chat);
    activeChatId = chat.id;
    $('messageInput').value = '';
    resizeInput();
    updateSendEnabled();
    saveState();
    renderConversations();
    renderMessages();
    closeSidebar();
    $('messageInput').focus();
  }
  function deleteChat(id) {
    if (generation?.chatId === id) abortGeneration();
    conversations = conversations.filter(chat => chat.id !== id);
    if (activeChatId === id) activeChatId = conversations[0]?.id || null;
    saveState();
    renderConversations();
    renderMessages();
  }

  function resizeInput() {
    const input = $('messageInput');
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 152) + 'px';
  }
  function validateEndpoint(value) {
    let url;
    try { url = new URL(value); } catch { return '请输入完整的本地 API 地址（例如 http://127.0.0.1:8000/v1/chat/completions）。'; }
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())) {
      return 'API 地址只能是 http(s)://127.0.0.1、localhost 或 [::1]。';
    }
    return '';
  }
  function showFeedback(text, type = '') {
    const area = $('settingsFeedback');
    area.textContent = text;
    area.className = `settings-feedback ${type}`;
  }
  function getFormConfig() {
    return {
      provider: $('providerSelect').value,
      endpoint: $('endpointInput').value.trim(),
      model: $('modelInput').value.trim(),
      systemPrompt: $('systemPromptInput').value.trim(),
    };
  }
  function updateForm() {
    $('providerSelect').value = config.provider;
    $('endpointInput').value = config.endpoint;
    $('modelInput').value = config.model;
    $('systemPromptInput').value = config.systemPrompt;
  }
  function openSettings() {
    lastSettingsFocus = document.activeElement;
    updateForm();
    showFeedback('');
    $('settingsBackdrop').hidden = false;
    $('endpointInput').focus();
  }
  function closeSettings() {
    $('settingsBackdrop').hidden = true;
    lastSettingsFocus?.focus?.();
  }
  function openSidebar() { $('sidebar').classList.add('open'); $('mobileOverlay').hidden = false; }
  function closeSidebar() { $('sidebar').classList.remove('open'); $('mobileOverlay').hidden = true; }

  function onSaveSettings(event) {
    event.preventDefault();
    const next = getFormConfig();
    const error = validateEndpoint(next.endpoint);
    if (error) return showFeedback(error, 'error');
    if (!next.model) return showFeedback('请输入模型名称。', 'error');
    config = next;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(config)); }
    catch { toast('浏览器无法保存 API 设置。'); }
    updateModelBadge();
    setStatus('API 待检测');
    closeSettings();
    toast('本地 API 配置已保存');
  }
  async function testConnection() {
    const next = getFormConfig();
    const error = validateEndpoint(next.endpoint);
    if (error) return showFeedback(error, 'error');
    if (!next.model) return showFeedback('请输入模型名称。', 'error');
    const button = $('testButton');
    button.disabled = true; button.textContent = '检测中...';
    showFeedback('正在检测本机 API 是否可连接...');
    try {
      const response = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '连接检测失败');
      showFeedback(data.message, data.ok ? 'success' : 'error');
      setStatus(data.ok ? '本地 API 可访问' : 'API 连接异常', data.ok ? 'success' : 'error');
    } catch (err) {
      showFeedback(err.message || '请求失败', 'error');
      setStatus('API 连接异常', 'error');
    } finally { button.disabled = false; button.textContent = '检测连接'; }
  }
  async function streamReply(job, payload) {
    const result = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: job.controller.signal,
    });
    if (!result.ok) {
      let message = `本地代理返回 HTTP ${result.status}`;
      try { message = (await result.json()).error || message; } catch {}
      throw new Error(message);
    }
    if (!result.body) throw new Error('当前浏览器不支持流式读取。');
    const reader = result.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;
    function readEvent(frame) {
      if (job.controller.signal.aborted) return;
      let event = 'message';
      const lines = frame.split('\n');
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trimStart();
      }
      if (!data) return;
      let payload;
      try { payload = JSON.parse(data); } catch { return; }
      if (event === 'delta') {
        job.reply.content += String(payload.text || '');
        updateStreamingMessage(job);
      } else if (event === 'error') {
        throw new Error(payload.message || '本地 API 返回异常。');
      } else if (event === 'done') {
        completed = true;
      }
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let split;
      while ((split = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        readEvent(frame);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) readEvent(buffer);
    if (!completed && !job.reply.content) throw new Error('连接中断，本地 API 未返回内容。');
  }

  async function sendMessage() {
    if (generation) { abortGeneration(); return; }
    const message = $('messageInput').value.trim();
    if (!message) return;
    const endpointError = validateEndpoint(config.endpoint);
    if (endpointError) { toast('请先配置有效的本地 API 地址'); openSettings(); return; }
    let chat = currentChat();
    if (!chat) {
      newChat();
      chat = currentChat();
    }
    const userMessage = { id: uid(), role: 'user', content: message, createdAt: Date.now(), status: 'done' };
    chat.messages.push(userMessage);
    const outgoing = chat.messages.map(({ role, content }) => ({ role, content })).slice(-48);
    const reply = { id: uid(), model: config.model, provider: config.provider, role: 'assistant', content: '', createdAt: Date.now(), status: 'streaming' };
    chat.messages.push(reply);
    chat.updatedAt = Date.now();
    if (chat.title === '新对话') chat.title = message.replace(/\s+/g, ' ').slice(0, 19) || '新对话';
    conversations.sort((a,b) => b.updatedAt - a.updatedAt);
    $('messageInput').value = '';
    resizeInput();
    saveState();
    renderConversations();
    renderMessages();
    const job = { controller: new AbortController(), reply, chatId: chat.id };
    setGeneration(job);
    try {
      await streamReply(job, { provider: config.provider, endpoint: config.endpoint, model: config.model, systemPrompt: config.systemPrompt, messages: outgoing });
      if (job.controller.signal.aborted) return;
      reply.status = 'done';
      setStatus('已收到本地回复', 'success');
    } catch (error) {
      if (job.controller.signal.aborted) {
        reply.status = 'stopped';
        if (!reply.content) reply.content = '已停止生成。';
      } else {
        reply.status = 'error';
        reply.content = reply.content ? `${reply.content}\n\n[连接提示] ${error.message}` : `连接失败：${error.message}`;
        setStatus('API 连接异常', 'error');
      }
    } finally {
      if (generation === job) setGeneration(null);
      chat.updatedAt = Date.now();
      saveState();
      if (activeChatId === job.chatId) renderMessages();
    }
  }

  async function init() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const defaults = await res.json();
        config = { ...config, provider: defaults.provider, endpoint: defaults.endpoint, model: defaults.model, systemPrompt: defaults.systemPrompt };
      }
    } catch { /* UI still works and can display errors even if local proxy stops. */ }
    const storedConfig = readStorage(SETTINGS_KEY, null);
    if (storedConfig && typeof storedConfig === 'object' && ['openai','responses','ollama','simple'].includes(storedConfig.provider)) {
      config = { ...config, ...storedConfig };
    }
    const stored = readStorage(CHATS_KEY, []);
    if (Array.isArray(stored)) {
      conversations = stored.filter(chat => chat && typeof chat.id === 'string' && Array.isArray(chat.messages))
        .slice(0, 35)
        .map(chat => ({ ...chat, messages: chat.messages.filter(m => ['user','assistant'].includes(m.role) && typeof m.content === 'string').map(m => ({ ...m, status: m.status === 'streaming' ? 'stopped' : m.status })) }));
    }
    activeChatId = readStorage(ACTIVE_KEY, null);
    if (!conversations.some(chat => chat.id === activeChatId)) activeChatId = conversations[0]?.id || null;
    updateModelBadge();
    renderConversations();
    renderMessages();
    updateSendEnabled();

    $('newChatSide').addEventListener('click', newChat);
    $('topNewChat').addEventListener('click', newChat);
    $('menuButton').addEventListener('click', openSidebar);
    $('sidebarClose').addEventListener('click', closeSidebar);
    $('mobileOverlay').addEventListener('click', closeSidebar);
    $('settingsButton').addEventListener('click', openSettings);
    $('settingsClose').addEventListener('click', closeSettings);
    $('settingsBackdrop').addEventListener('click', event => { if (event.target === $('settingsBackdrop')) closeSettings(); });
    $('settingsForm').addEventListener('submit', onSaveSettings);
    $('testButton').addEventListener('click', testConnection);
    $('providerSelect').addEventListener('change', () => {
      const preset = PROVIDER_PRESETS[$('providerSelect').value];
      if (!preset) return;
      $('endpointInput').value = preset.endpoint;
      $('modelInput').value = preset.model;
      showFeedback('已切换接口示例地址，可继续修改端口和模型名。');
    });
    $('messageInput').addEventListener('input', () => { resizeInput(); updateSendEnabled(); });
    $('messageInput').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
        event.preventDefault();
        if (!generation) sendMessage();
      }
    });
    $('sendButton').addEventListener('click', sendMessage);
    document.querySelectorAll('[data-prompt]').forEach(el => el.addEventListener('click', () => {
      $('messageInput').value = el.dataset.prompt;
      resizeInput(); updateSendEnabled(); $('messageInput').focus();
    }));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { closeSettings(); closeSidebar(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); newChat(); }
    });
    resizeInput();
  }
  init();
})();
