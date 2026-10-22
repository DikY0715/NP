import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { ChevronLeft } from 'lucide-react';

interface ChatMessage {
  id: string;
  content: string;
  isMe: boolean;
  timestamp: string;
}

export default function ChatScreen() {
  const { state, dispatch } = useApp();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: '您好，我看到您在社区共享了药品，请问还在吗？',
      isMe: true,
      timestamp: '10:30',
    },
    {
      id: '2',
      content: '在的，您需要借几粒？',
      isMe: false,
      timestamp: '10:32',
    },
    {
      id: '3',
      content: '我想借2粒布洛芬，您看方便吗？',
      isMe: true,
      timestamp: '10:33',
    },
    {
      id: '4',
      content: '方便的，您什么时候过来取？我在1栋1单元。',
      isMe: false,
      timestamp: '10:35',
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedId = state.selectedMedicineId;
  const chatPartner = selectedId && !selectedId.startsWith('chat_')
    ? state.communityMedicines.find(cm => cm.medicineId === selectedId)
    : undefined;
  const partnerName = selectedId?.startsWith('chat_')
    ? selectedId.slice(5)
    : chatPartner?.ownerName || '邻居';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      content: inputText.trim(),
      isMe: true,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages(prev => [...prev, newMsg]);
    setInputText('');

    setTimeout(() => {
      const reply: ChatMessage = {
        id: `reply_${Date.now()}`,
        content: '好的，没问题，您随时来取就行。',
        isMe: false,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, reply]);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5]" style={{ height: '100%' }}>
      {/* Header - simplified */}
      <div className="bg-white px-3 pt-4 pb-3 shadow-sm flex items-center gap-2 shrink-0 z-10">
        <button 
          onClick={() => dispatch({ type: 'GO_BACK' })}
          className="w-9 h-9 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center">
          <span className="text-white font-semibold text-sm">{partnerName[0]}</span>
        </div>
        <h1 className="text-base font-semibold text-gray-800">{partnerName}</h1>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[70%] ${msg.isMe ? 'order-1' : ''}`}>
              <div 
                className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.isMe 
                    ? 'bg-[#95EC69] text-gray-800 rounded-tr-md' 
                    : 'bg-white text-gray-800 rounded-tl-md shadow-sm'
                }`}
              >
                {msg.content}
              </div>
              <p className={`text-xs text-gray-400 mt-1 ${msg.isMe ? 'text-right' : 'text-left'}`}>
                {msg.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-4 py-2 pb-4 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="输入消息..."
            className="flex-1 h-10 px-4 rounded-full bg-[#F5F5F5] text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`h-10 px-5 rounded-full text-sm font-medium transition-colors ${
              inputText.trim()
                ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
