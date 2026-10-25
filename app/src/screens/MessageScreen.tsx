import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Bell, CheckCircle2, XCircle, User, Clock, PackageCheck } from 'lucide-react';

type MessageFilter = 'all' | 'borrow' | 'system';

function StatusPill({ status }: { status?: string }) {
  switch (status) {
    case 'pending_owner':
      return (
        <div className="mt-2 flex items-center gap-1.5 text-amber-600 text-xs">
          <Clock className="w-4 h-4" />
          管理员已核验，等待药主放入中转格口
        </div>
      );
    case 'pending':
      return (
        <div className="mt-2 flex items-center gap-1.5 text-amber-600 text-xs">
          <Clock className="w-4 h-4" />
          已提交，等待医生安全审核
        </div>
      );
    case 'pending_admin':
      return (
        <div className="mt-2 flex items-center gap-1.5 text-indigo-600 text-xs">
          <PackageCheck className="w-4 h-4" />
          医生已通过，等待驿站实物核验
        </div>
      );
    case 'pending_payment':
      return (
        <div className="mt-2 flex items-center gap-1.5 text-orange-600 text-xs">
          <Clock className="w-4 h-4" />
          核验通过，请在交易记录中完成支付
        </div>
      );
    case 'approved':
      return (
        <div className="mt-2 flex items-center gap-1.5 text-indigo-600 text-xs">
          <PackageCheck className="w-4 h-4" />
          医生审核通过，等待驿站出货
        </div>
      );
    case 'completed':
      return (
        <div className="mt-2 flex items-center gap-1.5 text-green-600 text-xs">
          <CheckCircle2 className="w-4 h-4" />
          已完成取药
        </div>
      );
    case 'rejected':
      return (
        <div className="mt-2 flex items-center gap-1.5 text-gray-400 text-xs">
          <XCircle className="w-4 h-4" />
          医生审核未通过
        </div>
      );
    default:
      return null;
  }
}

export default function MessageScreen() {
  const { state, dispatch, actions } = useApp();
  const [filter, setFilter] = useState<MessageFilter>('all');

  const filteredMessages = state.messages.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'borrow') return m.type === 'borrow_request';
    if (filter === 'system') return m.type === 'system';
    return true;
  });

  const filters: { key: MessageFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'borrow', label: '借药进度' },
    { key: 'system', label: '系统通知' },
  ];

  const handleRead = (id: string) => {
    actions.markMessageRead(id);
  };

  return (
    <div className="flex flex-col h-full w-full bg-orange-50/50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800 mb-3">消息</h1>
        <div className="flex gap-2">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        <div className="space-y-3">
          {filteredMessages.map(msg => (
            <div
              key={msg.id}
              onClick={() => handleRead(msg.id)}
              className={`bg-white rounded-2xl p-4 shadow-sm border ${
                msg.read ? 'border-transparent' : 'border-orange-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  onClick={(e) => {
                    if (msg.type === 'borrow_request' && msg.senderName) {
                      e.stopPropagation();
                      dispatch({ type: 'SELECT_MEDICINE', id: 'chat_' + msg.senderName });
                      dispatch({ type: 'NAVIGATE', screen: 'chat' });
                    }
                  }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                    msg.type === 'system'
                      ? 'bg-orange-100'
                      : 'bg-gradient-to-br from-orange-300 to-amber-400 cursor-pointer active:scale-95'
                  }`}
                >
                  {msg.type === 'system' ? (
                    <Bell className="w-5 h-5 text-orange-600" />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-800">
                      {msg.type === 'borrow_request' ? msg.senderName : msg.title}
                    </h3>
                    {!msg.read && (
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{msg.content}</p>
                  <p className="text-xs text-gray-400">{msg.timestamp}</p>
                  <StatusPill status={msg.status} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">暂无消息</p>
          </div>
        )}
      </div>
    </div>
  );
}
