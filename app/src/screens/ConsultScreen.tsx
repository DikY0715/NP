import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError } from '@/lib/api';
import ChatView, { toBubbles, chatTime, type ChatBubble } from '@/components/ChatView';

/** 居民端：与社区医生的问诊聊天。 */
export default function ConsultScreen() {
  const { dispatch } = useApp();
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [doctorName, setDoctorName] = useState('社区医生');
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const thread = await api.myConsultThread();
        setDoctorName(thread.conversation.doctorName || '社区医生');
        setBubbles(toBubbles(thread.messages, 'resident'));
      } catch (err) {
        if (!silent) {
          dispatch({
            type: 'SHOW_TOAST',
            message: err instanceof ApiError ? err.message : '加载失败',
          });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [dispatch],
  );

  useEffect(() => {
    load();
    const timer = setInterval(() => load(true), 8000);
    return () => clearInterval(timer);
  }, [load]);

  const send = async (text: string) => {
    try {
      const msg = await api.sendConsultMessage(text);
      setBubbles((prev) => [
        ...prev,
        { id: msg.id, content: msg.content, isMe: true, time: chatTime(msg.createdAt) },
      ]);
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '发送失败',
      });
      throw err;
    }
  };

  return (
    <ChatView
      title={doctorName}
      subtitle="社区在线医生"
      accent="orange"
      bubbles={bubbles}
      loading={loading}
      emptyHint="向医生描述症状或用药疑问，医生会尽快回复"
      placeholder="描述症状或提问…"
      onSend={send}
      onBack={() => dispatch({ type: 'NAVIGATE', screen: 'home' })}
    />
  );
}
