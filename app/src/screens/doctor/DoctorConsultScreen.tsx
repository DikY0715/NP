import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import ChatView, { toBubbles, chatTime, type ChatBubble } from '@/components/ChatView';
import HealthArchiveSheet from '@/components/HealthArchiveSheet';
import { FileText, MessageSquare, Users } from 'lucide-react';
import type { ConsultConversation, HealthArchive } from '@/types';

interface ActiveConv {
  id: string;
  residentId: string;
  name: string;
  building: string;
}

/** 医生端：在线问诊。无选中会话时为会话列表，选中后进入微信式聊天。 */
export default function DoctorConsultScreen() {
  const { dispatch } = useApp();
  const [convs, setConvs] = useState<ConsultConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<ActiveConv | null>(null);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [archive, setArchive] = useState<HealthArchive | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const loadList = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        setConvs(await api.consultConversations());
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
    if (active) return;
    loadList();
    const timer = setInterval(() => loadList(true), 8000);
    return () => clearInterval(timer);
  }, [active, loadList]);

  const openConv = async (conv: ConsultConversation) => {
    setActive({
      id: conv.id,
      residentId: conv.residentId,
      name: conv.residentName,
      building: conv.residentBuilding,
    });
    setThreadLoading(true);
    try {
      const thread = await api.consultThread(conv.id);
      setBubbles(toBubbles(thread.messages, 'doctor'));
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '加载失败',
      });
    } finally {
      setThreadLoading(false);
    }
  };

  const send = async (text: string) => {
    if (!active) return;
    try {
      const msg = await api.replyConsult(active.id, text);
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

  const openArchive = async () => {
    if (!active || archiveBusy) return;
    setArchiveBusy(true);
    try {
      setArchive(await api.patientArchive(active.residentId));
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '无权查看该档案',
      });
    } finally {
      setArchiveBusy(false);
    }
  };

  if (active) {
    return (
      <>
        <ChatView
          title={active.name}
          subtitle={active.building}
          accent="emerald"
          bubbles={bubbles}
          loading={threadLoading}
          emptyHint="暂无消息，回复居民的问诊吧"
          onSend={send}
          headerAction={
            <button
              onClick={openArchive}
              disabled={archiveBusy}
              className="ml-auto shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl text-emerald-600 active:bg-emerald-50 disabled:opacity-50"
            >
              <FileText className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">档案</span>
            </button>
          }
          onBack={() => {
            setActive(null);
            setArchive(null);
            loadList();
          }}
        />
        {archive && (
          <HealthArchiveSheet archive={archive} onClose={() => setArchive(null)} />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-emerald-50/40">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-semibold text-gray-800">线上问诊</h1>
        </div>
        <p className="text-xs text-gray-400">与居民一对一沟通，解答用药疑问</p>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-16">加载中…</p>
        ) : convs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <MessageSquare className="w-7 h-7 text-emerald-300" />
            </div>
            <p className="text-sm text-gray-500">还没有居民发起问诊</p>
          </div>
        ) : (
          <div className="space-y-2">
            {convs.map((c) => (
              <button
                key={c.id}
                onClick={() => openConv(c)}
                className="w-full bg-white rounded-2xl p-3.5 shadow-sm border border-emerald-50 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {c.residentName}
                      {c.residentBuilding && (
                        <span className="text-xs text-gray-400 font-normal"> · {c.residentBuilding}</span>
                      )}
                    </p>
                    <span className="text-xs text-gray-400 shrink-0">
                      {c.updatedAt ? formatTime(c.updatedAt) : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-gray-500 truncate">{c.lastMessage || '（暂无消息）'}</p>
                    {c.unread > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
