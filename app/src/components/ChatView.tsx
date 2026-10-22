import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Send } from 'lucide-react';
import type { ConsultMessage } from '@/types';

export interface ChatBubble {
  id: string;
  content: string;
  isMe: boolean;
  time: string;
}

interface ChatViewProps {
  title: string;
  subtitle?: string;
  accent: 'orange' | 'emerald';
  bubbles: ChatBubble[];
  loading?: boolean;
  placeholder?: string;
  emptyHint?: string;
  onSend: (text: string) => Promise<void>;
  onBack?: () => void;
}

const ACCENT = {
  orange: { avatar: 'from-orange-300 to-amber-400', ring: 'focus:ring-orange-200' },
  emerald: { avatar: 'from-emerald-300 to-teal-400', ring: 'focus:ring-emerald-200' },
};

/** 聊天时间：当天显示 HH:MM，否则 M/D HH:MM */
export function chatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hm = d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

/** 把后端消息映射成聊天气泡（me 表示当前登录方的角色） */
export function toBubbles(messages: ConsultMessage[], me: 'resident' | 'doctor'): ChatBubble[] {
  return messages.map((m) => ({
    id: m.id,
    content: m.content,
    isMe: m.senderRole === me,
    time: chatTime(m.createdAt),
  }));
}

export default function ChatView({
  title,
  subtitle,
  accent,
  bubbles,
  loading,
  placeholder = '输入消息…',
  emptyHint,
  onSend,
  onBack,
}: ChatViewProps) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const theme = ACCENT[accent];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bubbles]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setInput('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5]">
      {/* Header */}
      <div className="bg-white px-3 pt-4 pb-3 shadow-sm flex items-center gap-2 shrink-0 z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-6 h-6 text-gray-800" />
          </button>
        )}
        <div
          className={`w-9 h-9 rounded-full bg-gradient-to-br ${theme.avatar} flex items-center justify-center shrink-0`}
        >
          <span className="text-white font-semibold text-sm">{title.slice(0, 1)}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-gray-800 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-16">加载中…</p>
        ) : bubbles.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-16">{emptyHint}</p>
        ) : (
          bubbles.map((b) => (
            <div key={b.id} className={`flex ${b.isMe ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[72%]">
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    b.isMe
                      ? 'bg-[#95EC69] text-gray-800 rounded-tr-md'
                      : 'bg-white text-gray-800 rounded-tl-md shadow-sm'
                  }`}
                >
                  {b.content}
                </div>
                <p className={`text-xs text-gray-400 mt-1 ${b.isMe ? 'text-right' : 'text-left'}`}>
                  {b.time}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-2 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={placeholder}
            className={`flex-1 h-10 px-4 rounded-full bg-[#F5F5F5] text-sm focus:outline-none focus:ring-2 ${theme.ring}`}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              input.trim() ? 'bg-[#07C160] text-white' : 'bg-gray-200 text-gray-400'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
