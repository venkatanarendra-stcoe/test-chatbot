import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { api, ApiError, tokenStore, type ChatMessage } from "@/services/api";

type View = "chat" | "history";

interface AssistantCtx {
  open: boolean; expanded: boolean; view: View; conversationId: string | undefined; messages: ChatMessage[];
  sending: boolean; online: boolean | null; loadingConversation: boolean;
  setOpen: (o: boolean) => void; toggle: () => void; setExpanded: (e: boolean) => void; setView: (v: View) => void;
  send: (text: string) => Promise<void>; newChat: () => void; openConversation: (id: string) => Promise<void>; removeConversation: (id: string) => Promise<void>;
}

const Ctx = createContext<AssistantCtx | null>(null);

/** Lives at the shell level, so the panel's open state and the current conversation survive page navigation. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loadingConversation, setLoading] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const socket = useRef<Socket | null>(null);
  const epoch = useRef(0);                 // bumped when the user switches chat, so a late reply is not appended to the wrong thread
  const current = useRef<string | undefined>(undefined);
  current.current = conversationId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Realtime transport (Socket.IO). REST /api/chat stays as the fallback when the socket is not connected.
  useEffect(() => {
    const s = io({ path: "/ws/socket.io", auth: (cb) => cb({ token: tokenStore.get() }), reconnectionDelayMax: 5000 });
    socket.current = s;
    s.on("connect", () => setOnline(true));
    s.on("chat:reply", (r: { conversation_id: string }) => {   // a reply to a message sent from another tab of this user
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      if (r.conversation_id === current.current) void api.messages(r.conversation_id).then(setMessages).catch(() => {});
    });
    return () => { s.disconnect(); socket.current = null; };
  }, [qc]);

  type Delivery = { ok: true; request_id: string; conversation_id: string; reply: string; blocked: boolean } | { ok: false; status: number; detail: string };
  const deliver = useCallback(async (text: string, id: string | undefined): Promise<Delivery> => {
    const payload = { message: text, conversation_id: id };
    const s = socket.current;
    if (s?.connected) {
      try { return await s.timeout(180_000).emitWithAck("chat:send", payload) as Delivery; }
      catch { return { ok: false, status: 0, detail: "The assistant took too long to respond." }; }
    }
    try { return { ok: true, ...(await api.chat(text, id)) }; }
    catch (e) { return { ok: false, status: e instanceof ApiError ? e.status : 0, detail: e instanceof Error ? e.message : "Message failed" }; }
  }, []);

  const send = useCallback(async (text: string) => {
    const at = epoch.current;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text, request_id: null, created_at: new Date().toISOString() }]);
    setSending(true);
    const r = await deliver(text, conversationId);
    setSending(false);
    if (r.ok) {
      setOnline(true);
      void qc.invalidateQueries({ queryKey: ["conversations"] });
      if (epoch.current !== at) return;                       // the user moved to another chat meanwhile
      setMessages((m) => [...m, { id: `a-${r.request_id}`, role: "assistant", content: r.reply, request_id: r.request_id, created_at: new Date().toISOString(), blocked: r.blocked }]);
      if (!conversationId) setConversationId(r.conversation_id);
      setView("chat");
      setOpen(true);                                          // the answer is ready: bring the assistant back if it was closed
      return;
    }
    if (r.status === 401) return;                             // the auth layer redirects to login
    if (r.status === 404 && conversationId) { setConversationId(undefined); toast.error("That conversation is no longer available. Starting a new chat."); }
    else if (r.status === 429) toast.warning(r.detail);
    else { setOnline(false); toast.error(r.detail); }
    setOpen(true);
  }, [conversationId, deliver, qc]);

  const newChat = useCallback(() => { epoch.current++; setConversationId(undefined); setMessages([]); setView("chat"); }, []);

  const openConversation = useCallback(async (id: string) => {
    epoch.current++; setLoading(true); setView("chat");
    try { setMessages(await api.messages(id)); setConversationId(id); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load conversation"); }
    finally { setLoading(false); }
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    try {
      await api.deleteConversation(id);
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (id === conversationId) newChat();
      toast.success("Conversation deleted");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
  }, [conversationId, newChat, qc]);

  const value = useMemo(() => ({ open, expanded, view, conversationId, messages, sending, online, loadingConversation, setOpen, toggle, setExpanded, setView, send, newChat, openConversation, removeConversation }),
    [open, expanded, view, conversationId, messages, sending, online, loadingConversation, toggle, send, newChat, openConversation, removeConversation]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAssistant must be used inside AssistantProvider");
  return c;
}
