import {useEffect, useRef, useState} from 'react';
import type {Config, Chat} from '../domain/chat';
import {BRIDGE_PROVIDERS} from '../domain/chat';
import {streamChat} from '../api/chat-stream.mjs';
import {readStored, restoreChats, persistChats, storageKeys} from './chat-storage.mjs';
export function useChat(config: Config, setConfig: (update: (config: Config) => Config) => void, setNotice: (message:string) => void) {
  const [chats,setChats] = useState<Chat[]>(() => restoreChats(localStorage));
  const [active,setActive] = useState<string|null>(() => {
    const value = readStored<unknown>(localStorage,storageKeys.active,null);
    return typeof value === 'string' ? value : null;
  });
  const [busy,setBusy] = useState(false);
  const abort = useRef<AbortController|null>(null);
  const runningChat = useRef<string|null>(null);
  const latest = useRef({chats,active}); latest.current = {chats,active};
  const chat = chats.find(c => c.id === active);
  useEffect(() => {
    const save = () => {try {persistChats(localStorage,latest.current.chats,latest.current.active);} catch {setNotice('浏览器存储空间不足。');}};
    const timer = setTimeout(save,250);
    window.addEventListener('pagehide',save);
    return () => {clearTimeout(timer); window.removeEventListener('pagehide',save);};
  },[chats,active,setNotice]);
  useEffect(() => () => {abort.current?.abort(); try {persistChats(localStorage,latest.current.chats,latest.current.active);} catch {}},[]);
  function patch(id: string, reply: string, content: string, status: string) {
    setChats((all) =>
      all.map((c) =>
        c.id === id
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === reply ? { ...m, content, status } : m,
              ),
            }
          : c,
      ),
    );
  }
  async function send(text: string, attachments: string[] = [], effort = "medium", model = "") {
    if (abort.current || !text.trim()) return;
    const chosenModel = (model || "").trim() || config.model;
    const bridgeProvider = BRIDGE_PROVIDERS.includes(chosenModel)
      ? chosenModel
      : config.bridgeProvider;
    if (config.provider !== 'ccswitch' && chosenModel !== config.model) setConfig((c) => ({ ...c, model: chosenModel }));
    const prompt = text.trim(),
      id = chat?.id || crypto.randomUUID(),
      reply = crypto.randomUUID(),
      controller = new AbortController();
    const messages = [
      ...(chat?.messages || []),
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: prompt,
        files: attachments.length ? attachments : undefined,
        status: undefined,
      },
    ];
    abort.current = controller;
    runningChat.current = id;
    setBusy(true);
    setActive(id);
    setNotice("");
    const next: Chat = {
      id,
      title: chat?.title || prompt.slice(0, 28),
      updatedAt: Date.now(),
      messages: [
        ...messages,
        {
          id: reply,
          role: "assistant",
          content: "",
          model: chosenModel,
          status: "streaming",
        },
      ],
    };
    setChats((all) => [next, ...all.filter((c) => c.id !== id)]);
    let content = "";
    try {
      content = await streamChat({
          ...config,
          // The composer's model picker is authoritative for this message; bridge
          // model ids are provider ids, so it also drives `provider`.
          model: config.provider === 'ccswitch' ? config.model:chosenModel,
          bridgeProvider: config.provider === 'ccswitch' ? undefined:bridgeProvider,
          // Pin this workbench conversation to one bridge session. Without it the
          // bridge treats every request as "start a new conversation", opens a new
          // tab and the web AI loses the earlier turns.
          conversationId: id,
          // The composer's 推理强度 drives the bridge's enableReasoning switch per
          // message: low turns deep thinking off, high turns it on, medium leaves
          // the bridge default in place.
          enableReasoning:
            effort === "low" ? false : effort === "high" ? true : undefined,
          messages: messages
            .filter(m => m.role === "user" || !["error", "stopped", "streaming"].includes(m.status || ""))
            .slice(-48)
            .map(({ role, content }) => ({ role, content })),
      }, {signal:controller.signal, onDelta:(value) => {content = value; patch(id, reply, content, 'streaming');}});
      patch(id, reply, content, "done");
    } catch (error) {
      const stopped = controller.signal.aborted,
        rawMessage = error instanceof Error ? error.message : "请求失败",
        message = config.provider === 'ccswitch' && /cc_switch_auth_error|认证失败|OpenAI Official/.test(rawMessage)
          ? 'CC Switch 上游认证失败。请在 CC Switch 的 Codex 页选择已配置密钥的 API 供应商，或修复当前供应商登录后重试。\n\n'+rawMessage
          : rawMessage;
      patch(
        id,
        reply,
        content || (stopped ? "已停止生成" : message),
        stopped ? "stopped" : "error",
      );
      if (!stopped) setNotice(message);
    } finally {
      abort.current = null;
      runningChat.current = null;
      setBusy(false);
    }
  }

  return {chats,active,chat,busy,send,stop:() => abort.current?.abort(),
    selectChat:setActive,
    newChat:() => setActive(null),
    deleteChat:(id:string) => {
      if (runningChat.current === id) return;
      setChats(all => all.filter(c => c.id !== id));
      if (active === id) setActive(null);
    },
  };
}
