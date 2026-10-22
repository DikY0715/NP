import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import {
  PackageCheck,
  ClipboardList,
  Recycle,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import type { AdminMedicine, AdminStats, BorrowRequest } from '@/types';

export default function AdminHomeScreen() {
  const { state, dispatch } = useApp();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [lowStock, setLowStock] = useState<AdminMedicine[]>([]);
  const [pendingReview, setPendingReview] = useState<BorrowRequest[]>([]);

  const load = useCallback(async () => {
    try {
      const [s, cabinet, pending] = await Promise.all([
        api.adminStats(),
        api.adminMedicines('cabinet'),
        api.adminBorrows('pending'),
      ]);
      setStats(s);
      setLowStock(cabinet.filter((m) => m.lowStock));
      setPendingReview(pending);
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '加载失败',
      });
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const go = (
    screen: 'adminDispatch' | 'adminInventory' | 'publicMedicine',
    tab: 'pending' | 'verify' | 'approved' | 'completed' = 'verify'
  ) => {
    if (screen === 'adminDispatch') {
      dispatch({ type: 'SET_ADMIN_DISPATCH_TAB', tab });
    }
    dispatch({ type: 'NAVIGATE', screen });
  };

  const cards = [
    {
      key: 'awaiting',
      label: '待处理借药',
      value: stats?.awaitingDispatch ?? '-',
      icon: PackageCheck,
      cls: 'bg-indigo-50 text-indigo-500',
      onClick: () => go('adminDispatch'),
    },
    {
      key: 'review',
      label: '待医生审核',
      value: stats?.pendingReview ?? '-',
      icon: ClipboardList,
      cls: 'bg-amber-50 text-amber-500',
      onClick: () => go('adminDispatch', 'pending'),
    },
    {
      key: 'cabinet',
      label: '闲置药品',
      value: stats?.sharedCount ?? '-',
      icon: Recycle,
      cls: 'bg-emerald-50 text-emerald-500',
      onClick: () => go('publicMedicine'),
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-gradient-to-b from-indigo-500 to-blue-500 px-4 pt-8 pb-10">
        <h1 className="text-xl font-bold text-white">社区智慧驿站</h1>
        <p className="text-sm text-white/80 mt-1">
          {state.user?.community || ''} · 管理员工作台
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 -mt-4">
        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-3">
          {cards.map((c) => (
            <button
              key={c.key}
              onClick={c.onClick}
              disabled={!c.onClick}
              className="bg-white rounded-2xl p-3 shadow-sm flex flex-col items-center active:scale-[0.98] transition-transform disabled:active:scale-100"
            >
              <div className={`w-10 h-10 rounded-xl ${c.cls} flex items-center justify-center mb-2`}>
                <c.icon className="w-5 h-5" />
              </div>
              <p className="text-lg font-bold text-gray-800 leading-none">{c.value}</p>
              <p className="text-[11px] text-gray-400 mt-1 text-center">{c.label}</p>
            </button>
          ))}
        </div>

        {/* 待医生审核 */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-gray-800">待医生审核</h2>
            </div>
            <button
              onClick={() => go('adminDispatch', 'pending')}
              className="text-xs text-indigo-500 flex items-center"
            >
              查看全部
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingReview.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
              暂无等待医生安全审核的借药申请
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {pendingReview.map((r) => (
                <button
                  key={r.id}
                  onClick={() => go('adminDispatch', 'pending')}
                  className="w-full px-4 py-3 flex items-center justify-between active:bg-gray-50"
                >
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {r.medicineName}
                      <span className="ml-1.5 text-xs font-normal text-gray-400">
                        {r.quantity}
                        {r.unit}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {r.borrowerName} · {formatTime(r.createdAt)}
                    </p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 shrink-0 ml-3">
                    待医生审核
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 库存预警 */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-gray-800">库存预警</h2>
            </div>
            <button
              onClick={() => go('adminInventory')}
              className="text-xs text-indigo-500 flex items-center"
            >
              去补货
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {lowStock.length === 0 ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
              柜内库存充足，暂无需要补货的药品
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {lowStock.map((m) => (
                <button
                  key={m.id}
                  onClick={() => go('adminInventory')}
                  className="w-full px-4 py-3 flex items-center justify-between active:bg-gray-50"
                >
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {m.spec || '驿站自营'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-xs font-bold text-rose-500">
                      仅剩 {m.quantity} {m.unit}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-500">
                      需补货
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
