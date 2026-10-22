import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import type { CreditLog, CreditProfile } from '@/types';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Scale,
} from 'lucide-react';

const RULES = [
  '按时取药、正常归还：信用保持稳定',
  '被管理员列入黑名单：-20 并限制借药',
  '信用分低于 60：自动限制借药与共享',
];

export default function CreditScreen() {
  const { dispatch } = useApp();
  const [credit, setCredit] = useState<CreditProfile | null>(null);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, l] = await Promise.all([api.myCredit(), api.creditLogs()]);
      setCredit(c);
      setLogs(l);
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

  const blacklisted = credit?.status === 'blacklisted';

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-gradient-to-br from-sky-500 to-indigo-500 px-4 pt-6 pb-10">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">信用与黑名单</h1>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-white leading-none">
            {credit?.score ?? 100}
          </span>
          <span className="text-sm text-white/85 mb-0.5">分</span>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-white/25 text-xs text-white mb-0.5">
            {credit?.level || '优秀'}
          </span>
        </div>
        <p className="text-xs text-white/80 mt-2">
          信用良好可正常借药与共享，违规会扣分并限制权限
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 -mt-5 space-y-4">
        {blacklisted && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-600">当前已被限制借药</p>
              <p className="text-xs text-red-400 mt-1">
                原因：{credit?.reason || '信用分不足'}。请联系社区管理员解除限制。
              </p>
            </div>
          </div>
        )}

        {!blacklisted && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-600">信用状态正常</p>
              <p className="text-xs text-emerald-500/80 mt-1">
                可正常借药、共享闲置药品并参与积分兑换
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <Scale className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-800">信用规则</h2>
          </div>
          <div className="space-y-2">
            {RULES.map((r) => (
              <div key={r} className="flex gap-2 text-xs text-gray-600">
                <span className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                {r}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-3">信用变动记录</h2>
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-3">加载中…</p>
          ) : logs.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">
              暂无变动记录，保持良好信用哦
            </p>
          ) : (
            <div className="space-y-3">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      l.delta >= 0
                        ? 'bg-emerald-50 text-emerald-500'
                        : 'bg-red-50 text-red-500'
                    }`}
                  >
                    {l.delta >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 truncate">{l.reason}</p>
                    <p className="text-[11px] text-gray-400">
                      {formatTime(l.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      l.delta >= 0 ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {l.delta > 0 ? '+' : ''}
                    {l.delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
