import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import type { AdverseReport } from '@/types';
import { AlertTriangle, ArrowLeft, CheckCircle2, XCircle, X } from 'lucide-react';

const SEVERITY_LABEL: Record<string, string> = {
  mild: '轻微',
  moderate: '中等',
  severe: '严重',
};

export default function ReportInboxScreen({ role }: { role: 'doctor' | 'admin' }) {
  const { dispatch } = useApp();
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [reports, setReports] = useState<AdverseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<AdverseReport | null>(null);
  const [accepted, setAccepted] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await api.reportInbox(role, tab));
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '加载失败',
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch, role, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await api.handleReport(active.id, accepted, note);
      setActive(null);
      setNote('');
      setAccepted(true);
      dispatch({ type: 'SHOW_TOAST', message: '已处理该上报' });
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '处理失败',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-gradient-to-br from-rose-500 to-red-500 px-4 pt-6 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">不良反应处理</h1>
        </div>
        <div className="flex gap-2">
          {(['pending', 'all'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs ${
                tab === t ? 'bg-white text-red-500 font-medium' : 'bg-white/20 text-white'
              }`}
            >
              {t === 'pending' ? '待处理' : '全部'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 -mt-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-400">
            加载中…
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {tab === 'pending' ? '暂无待处理的上报' : '暂无上报记录'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 ${
                      r.severity === 'severe' ? 'text-red-500' : 'text-amber-500'
                    }`}
                  />
                  <p className="text-sm font-semibold text-gray-800 flex-1 truncate">
                    {r.medicineName}
                  </p>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 ${
                      r.severity === 'severe'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {SEVERITY_LABEL[r.severity]}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-1">{r.symptoms}</p>
                {r.description && (
                  <p className="text-xs text-gray-400 mb-1">{r.description}</p>
                )}
                <p className="text-[11px] text-gray-400">
                  {r.userName} · {r.userBuilding || '未设置楼栋'} ·{' '}
                  {formatTime(r.createdAt)}
                </p>
                {r.status === 'pending' ? (
                  <button
                    onClick={() => {
                      setActive(r);
                      setAccepted(true);
                      setNote('');
                    }}
                    className="w-full mt-3 h-9 rounded-xl bg-red-500 text-white text-xs font-medium"
                  >
                    处理该上报
                  </button>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-2">
                    {r.status === 'resolved' ? '已受理' : '已驳回'}
                    {r.handleNote ? ` · ${r.handleNote}` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-800">处理上报</h3>
              <button
                onClick={() => setActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {active.userName} 上报「{active.medicineName}」：{active.symptoms}
            </p>

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setAccepted(true)}
                className={`flex-1 h-10 rounded-xl text-sm flex items-center justify-center gap-1.5 ${
                  accepted
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-50 text-gray-500'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                采纳并奖励 5 积分
              </button>
              <button
                onClick={() => setAccepted(false)}
                className={`flex-1 h-10 rounded-xl text-sm flex items-center justify-center gap-1.5 ${
                  !accepted ? 'bg-gray-700 text-white' : 'bg-gray-50 text-gray-500'
                }`}
              >
                <XCircle className="w-4 h-4" />
                驳回
              </button>
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="处理说明（选填），会发送给居民"
              className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-200 mb-4"
            />

            <button
              onClick={submit}
              disabled={busy}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-red-500 text-white text-sm font-medium disabled:opacity-60"
            >
              {busy ? '提交中…' : '确认处理'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
