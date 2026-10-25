import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { ChevronLeft, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle } from 'lucide-react';
// Transaction type used inline

type TxFilter = 'all' | 'borrow_in' | 'borrow_out';

export default function TransactionScreen() {
  const { state, dispatch, actions } = useApp();
  const [filter, setFilter] = useState<TxFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = state.transactions.filter(t => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  const filters: { key: TxFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'borrow_in', label: '我借入' },
    { key: 'borrow_out', label: '我借出' },
  ];

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'pending_owner': return '管理员已核验，待药主放入中转格口';
      case 'pending': return '待医生审核';
      case 'pending_admin': return '待管理员核验';
      case 'pending_payment': return '待支付';
      case 'approved': return '待出货取药';
      case 'completed': return '已完成';
      case 'rejected': return '审核未通过';
      default: return '进行中';
    }
  };

  const handlePay = async (id: string) => {
    setBusyId(id);
    try {
      await api.payBorrow(id);
      await actions.refresh();
      dispatch({ type: 'SHOW_TOAST', message: '支付成功，等待驿站出货' });
    } finally {
      setBusyId(null);
    }
  };

  const handleOwnerDropoff = async (id: string) => {
    setBusyId(id);
    try {
      await api.ownerDropoff(id);
      await actions.refresh();
      dispatch({ type: 'SHOW_TOAST', message: '已确认放入中转格口' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-orange-50/50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">交易记录</h1>
        </div>
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

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <ArrowDownLeft className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">暂无交易记录</p>
            <p className="text-xs text-gray-400 mt-1">申请借用或共享药品后会显示在这里</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(tx => (
              <div key={tx.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    tx.type === 'borrow_in' ? 'bg-green-50' : 'bg-orange-50'
                  }`}>
                    {tx.type === 'borrow_in' ? (
                      <ArrowDownLeft className="w-5 h-5 text-green-500" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-orange-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">
                        {tx.type === 'borrow_in' ? '借入' : '借出'} {tx.medicineName}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        {statusIcon(tx.status)}
                        {statusLabel(tx.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      {tx.quantity}{tx.unit} · {tx.counterpartyName}
                    </p>
                    {tx.price ? (
                      <p className="text-xs text-orange-600 mb-1">
                        ¥{tx.price.toFixed(2)}
                        {tx.paymentStatus === 'paid' ? ' · 已支付' : ''}
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-400">{tx.timestamp}</p>
                    {tx.type === 'borrow_in' && tx.status === 'pending_payment' && (
                      <button
                        onClick={() => handlePay(tx.id)}
                        disabled={busyId === tx.id}
                        className="mt-2 h-8 px-4 rounded-lg bg-gradient-to-r from-orange-400 to-amber-500 text-white text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                      >
                        {busyId === tx.id ? '支付中…' : `去支付 ¥${(tx.price ?? 0).toFixed(2)}`}
                      </button>
                    )}
                    {tx.type === 'borrow_out' && tx.status === 'pending_owner' && (
                      <button
                        onClick={() => handleOwnerDropoff(tx.id)}
                        disabled={busyId === tx.id}
                        className="mt-2 h-8 px-4 rounded-lg bg-orange-50 text-orange-600 text-xs font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                      >
                        {busyId === tx.id ? '提交中…' : '已放入中转格口'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
