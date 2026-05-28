"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ease } from "../motion";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  timestamp?: Date;
}

export interface SmartChatProps {
  // Required
  apiRoute: string;

  // Persona
  botName?: string;
  botAvatar?: ReactNode;
  welcomeMessage?: string;
  placeholder?: string;
  themeColor?: string; // CSS color for accents

  // Behaviour
  systemContext?: string;
  maxMessages?: number;
  showTimestamps?: boolean;
  allowImageGeneration?: boolean;
  imageApiRoute?: string;

  // Callbacks
  onMessage?: (msg: ChatMessage) => void;

  className?: string;
}

const defaultAvatar = (name: string, color: string) => (
  <div
    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
    style={{ background: color }}
  >
    {name[0].toUpperCase()}
  </div>
);

export function SmartChat({
  apiRoute,
  botName = "AI",
  botAvatar,
  welcomeMessage,
  placeholder = "Ask me anything...",
  themeColor = "#7c3aed",
  systemContext,
  maxMessages = 50,
  showTimestamps = false,
  allowImageGeneration = false,
  imageApiRoute = "/api/image",
  onMessage,
  className,
}: SmartChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!welcomeMessage) return [];
    return [{ id: "welcome", role: "assistant", content: welcomeMessage, timestamp: new Date() }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev.slice(-(maxMessages - 1)), userMsg]);
    setInput("");
    setLoading(true);
    setError(null);
    onMessage?.(userMsg);

    try {
      // Check if user wants image generation
      const wantsImage =
        allowImageGeneration &&
        /\b(show me|generate|create|make|draw|image of|picture of|photo of)\b/i.test(text);

      if (wantsImage && imageApiRoute) {
        const imgRes = await fetch(imageApiRoute, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text }),
        });
        const imgData = await imgRes.json();

        if (imgData.url) {
          const botMsg: ChatMessage = {
            id: `b-${Date.now()}`,
            role: "assistant",
            content: "Here's what I generated for you:",
            imageUrl: imgData.url,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, botMsg]);
          onMessage?.(botMsg);
          return;
        }
      }

      // Standard AI response
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

      const res = await fetch(apiRoute, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history,
          systemContext,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Support both streaming and JSON responses
      const contentType = res.headers.get("content-type") ?? "";
      let reply = "";

      if (contentType.includes("text/event-stream") || contentType.includes("text/plain")) {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          const streamMsg: ChatMessage = {
            id: `b-${Date.now()}`,
            role: "assistant",
            content: "",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, streamMsg]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            // Handle SSE format
            const lines = chunk.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") break;
                try { reply += JSON.parse(data); } catch { reply += data; }
              } else {
                reply += line;
              }
            }
            setMessages(prev =>
              prev.map(m => m.id === streamMsg.id ? { ...m, content: reply } : m)
            );
          }
          onMessage?.({ ...streamMsg, content: reply });
          return;
        }
      }

      const data = await res.json();
      reply = data.reply ?? data.message ?? data.content ?? String(data);

      const botMsg: ChatMessage = {
        id: `b-${Date.now()}`,
        role: "assistant",
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      onMessage?.(botMsg);

    } catch (e) {
      setError("Failed to get a response. Please try again.");
      console.error("[SmartChat]", e);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const avatar = botAvatar ?? defaultAvatar(botName, themeColor);

  return (
    <div className={`flex flex-col h-full ${className ?? ""}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: ease.out }}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.role === "assistant" && avatar}

              <div className={`max-w-[80%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-white rounded-tr-sm"
                      : "bg-white/5 border border-white/8 text-white/90 rounded-tl-sm"
                  }`}
                  style={msg.role === "user" ? { background: themeColor } : undefined}
                >
                  {msg.content}
                </div>
                {msg.imageUrl && (
                  <motion.img
                    src={msg.imageUrl}
                    alt="Generated"
                    className="rounded-xl max-w-full border border-white/10"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: ease.out }}
                  />
                )}
                {showTimestamps && msg.timestamp && (
                  <span className="text-xs text-white/30">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="flex gap-3 items-center"
            >
              {avatar}
              <div className="bg-white/5 border border-white/8 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-white/40"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="text-xs text-red-400/80 text-center py-1">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-white/5">
        <div className="flex gap-2 items-center bg-white/5 border border-white/10 rounded-2xl px-4 py-2 focus-within:border-white/20 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none min-w-0"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.93 }}
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 transition-opacity"
            style={{ background: themeColor }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M13 7L1 1l2.5 6L1 13l12-6z" fill="white" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Floating chat bubble (can overlay any page) ───────────────────────────
export interface FloatingChatProps extends SmartChatProps {
  triggerLabel?: string;
  width?: number;
  height?: number;
}

export function FloatingChat({ triggerLabel = "Chat", width = 380, height = 520, ...props }: FloatingChatProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.2, ease: ease.out }}
            className="rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col bg-[#0a0a14]"
            style={{ width, height }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 border-b border-white/8"
              style={{ background: props.themeColor ?? "#7c3aed" }}
            >
              <span className="text-white font-semibold text-sm">{props.botName ?? "AI"}</span>
              <button
                onClick={() => setOpen(false)}
                className="text-white/70 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <SmartChat {...props} className="flex-1 min-h-0" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center text-xl"
        style={{ background: props.themeColor ?? "#7c3aed", boxShadow: `0 8px 32px ${props.themeColor ?? "#7c3aed"}50` }}
      >
        {open ? "×" : "💬"}
      </motion.button>
    </div>
  );
}
