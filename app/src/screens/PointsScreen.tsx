import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import type { Gift, PointAccount, PointLog, Redemption } from '@/types';
import {
  ArrowLeft,
  Gift as GiftIcon,
  Sparkles,
  Coins,
  CheckCircle2,
  Package,
} from 'lucide-react';

export default function PointsScreen() {
  const { dispatch } = useApp();
  const [account, setAccount] = useState<PointAccount | null>(null);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmGift, setConfirmGift] = useState<Gift | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, g, l, r] = await Promise.all([
        api.myPoints(),
        api.gifts(),
        api.pointLogs(),
        api.myRedemptions(),
      ]);
      setAccount(a);
      setGifts(g);
      setLogs(l);
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

  const doRedeem = async () => {
    if (!confirmGift) return;
    setBusy(true);
    try {
      await api.redeem(confirmGift.id);
      setConfirmGift(null);
      dispatch({ type: 'SHOW_TOAST', message: '兑换成功，请到驿站领取' });
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '兑换失败',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-gradient-to-br from-amber-400 to-orange-500 px-4 pt-6 pb-10">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">积分商城</h1>
        </div>
        <div className="flex items-end gap-2">
          <Coins className="w-7 h-7 text-white/90 mb-1" />
          <span className="text-4xl font-bold text-white leading-none">
            {account?.balance ?? 0}
          </span>
          <span className="text-sm text-white/85 mb-0.5">积分</span>
        </div>
        <p className="text-xs text-white/80 mt-2">
          累计获得 {account?.totalEarned ?? 0} 积分 · 共享与借药都能赚积分
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 -mt-5 space-y-4">
        {/* 积分规则 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-bold text-gray-800">如何获得积分</h2>
          </div>
          <div className="space-y-2">
            {(account?.rules ?? []).map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between text-xs text-gray-600"
              >
                <span>{r.label}</span>
                <span className="text-amber-600 font-medium">+{r.points}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 礼品 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <GiftIcon className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold text-gray-800">积分兑换</h2>
          </div>
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-4">加载中…</p>
          ) : (
            <div className="space-y-2">
              {gifts.map((g) => {
                const enough = (account?.balance ?? 0) >= g.points;
                const soldOut = g.stock <= 0;
                return (
                  <div
                    key={g.id}
                    className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {g.name}
                      </p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {g.description} · 剩余 {g.stock} 份
                      </p>
                    </div>
                    <button
                      onClick={() => setConfirmGift(g)}
                      disabled={!enough || soldOut}
                      className={`text-xs px-3 py-1.5 rounded-lg shrink-0 ${
                        soldOut
                          ? 'bg-gray-100 text-gray-400'
                          : enough
                            ? 'bg-orange-500 text-white'
                            : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {soldOut ? '已兑完' : `${g.points} 积分`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 我的兑换 */}
        {redemptions.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-gray-800">我的兑换</h2>
            </div>
            <div className="space-y-2">
              {redemptions.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-gray-700 truncate">{r.giftName}</span>
                  <span className="text-gray-400">-{r.points}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded ${
                      r.status === 'fulfilled'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {r.status === 'fulfilled' ? '已发放' : '待领取'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 积分明细 */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-3">积分明细</h2>
          {logs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">暂无积分记录</p>
          ) : (
            <div className="space-y-2.5">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-gray-700 truncate">{l.reason}</span>
                  <span
                    className={
                      l.amount >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }
                  >
                    {l.amount >= 0 ? '+' : ''}
                    {l.amount}
                  </span>
                  <span className="text-gray-300 w-20 text-right">
                    {formatTime(l.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 确认兑换 */}
      {confirmGift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full bg-white rounded-2xl p-5">
            <h3 className="text-base font-bold text-gray-800 mb-1">确认兑换</h3>
            <p className="text-sm text-gray-500 mb-4">
              使用 {confirmGift.points} 积分兑换「{confirmGift.name}」？兑换后请到驿站领取。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmGift(null)}
                className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-600 text-sm"
              >
                取消
              </button>
              <button
                onClick={doRedeem}
                disabled={busy}
                className="flex-1 h-11 rounded-xl bg-orange-500 text-white text-sm font-medium disabled:opacity-60"
              >
                {busy ? '兑换中…' : '确认兑换'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
