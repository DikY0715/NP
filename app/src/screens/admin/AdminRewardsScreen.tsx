import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import type { AdminCredit, Redemption } from '@/types';
import {
  ArrowLeft,
  Gift,
  ShieldAlert,
  ShieldCheck,
  UserX,
  Package,
  X,
} from 'lucide-react';

export default function AdminRewardsScreen() {
  const { dispatch } = useApp();
  const [tab, setTab] = useState<'credit' | 'redemptions'>('credit');
  const [credits, setCredits] = useState<AdminCredit[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [blacklisting, setBlacklisting] = useState<AdminCredit | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        api.adminCredits(),
        api.adminRedemptions('all'),
      ]);
      setCredits(c);
      setRedemptions(r);
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '加载失败',
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const doBlacklist = async () => {
    if (!blacklisting) return;
    setBusy(true);
    try {
      await api.adminCreditAction(blacklisting.userId, 'blacklist', reason);
      setBlacklisting(null);
      setReason('');
      dispatch({ type: 'SHOW_TOAST', message: '已列入黑名单' });
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '操作失败',
      });
    } finally {
      setBusy(false);
    }
  };

  const unblacklist = async (userId: string) => {
    try {
      await api.adminCreditAction(userId, 'unblacklist', '');
      dispatch({ type: 'SHOW_TOAST', message: '已解除限制' });
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '操作失败',
      });
    }
  };

  const fulfill = async (id: string) => {
    try {
      await api.fulfillRedemption(id);
      dispatch({ type: 'SHOW_TOAST', message: '礼品已发放' });
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '操作失败',
      });
    }
  };

  const pendingRedemptions = redemptions.filter((r) => r.status === 'pending');

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-gradient-to-br from-violet-500 to-indigo-500 px-4 pt-6 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">信用与积分管理</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('credit')}
            className={`px-3 py-1.5 rounded-full text-xs ${
              tab === 'credit'
                ? 'bg-white text-indigo-600 font-medium'
                : 'bg-white/20 text-white'
            }`}
          >
            居民信用
          </button>
          <button
            onClick={() => setTab('redemptions')}
            className={`px-3 py-1.5 rounded-full text-xs ${
              tab === 'redemptions'
                ? 'bg-white text-indigo-600 font-medium'
                : 'bg-white/20 text-white'
            }`}
          >
            礼品发放 {pendingRedemptions.length > 0 ? `(${pendingRedemptions.length})` : ''}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 -mt-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-400">
            加载中…
          </div>
        ) : tab === 'credit' ? (
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
            {credits.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">
                本小区暂无居民
              </p>
            )}
            {credits.map((c) => (
              <div key={c.userId} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      c.status === 'blacklisted'
                        ? 'bg-red-50 text-red-500'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {c.status === 'blacklisted' ? (
                      <ShieldAlert className="w-4 h-4" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {c.name}
                      <span className="text-xs text-gray-400 font-normal ml-2">
                        {c.building || '未设置楼栋'}
                      </span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      信用 {c.score} 分
                      {c.reason ? ` · ${c.reason}` : ''}
                    </p>
                  </div>
                  {c.status === 'blacklisted' ? (
                    <button
                      onClick={() => unblacklist(c.userId)}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0"
                    >
                      解除限制
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setBlacklisting(c);
                        setReason('');
                      }}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 flex items-center gap-1 shrink-0"
                    >
                      <UserX className="w-3 h-3" />
                      拉黑
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
            {redemptions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">暂无兑换记录</p>
            )}
            {redemptions.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-500 flex items-center justify-center shrink-0">
                  <Gift className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {r.giftName}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {r.userName} · {r.userBuilding || '未设置楼栋'} · {r.points} 积分 ·{' '}
                    {formatTime(r.createdAt)}
                  </p>
                </div>
                {r.status === 'pending' ? (
                  <button
                    onClick={() => fulfill(r.id)}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg bg-indigo-500 text-white flex items-center gap-1 shrink-0"
                  >
                    <Package className="w-3 h-3" />
                    确认发放
                  </button>
                ) : (
                  <span className="text-[11px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                    已发放
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {blacklisting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full bg-white rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-gray-800">
                拉黑 {blacklisting.name}
              </h3>
              <button
                onClick={() => setBlacklisting(null)}
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              拉黑后该居民将无法借药与共享药品，信用分同时扣 20。
            </p>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="填写拉黑原因（如多次逾期未取药）"
              className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setBlacklisting(null)}
                className="flex-1 h-10 rounded-xl bg-gray-100 text-gray-600 text-sm"
              >
                取消
              </button>
              <button
                onClick={doBlacklist}
                disabled={busy}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-60"
              >
                {busy ? '处理中…' : '确认拉黑'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
