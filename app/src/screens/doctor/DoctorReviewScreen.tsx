import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import { Stethoscope, Pill, User, MapPin, ClipboardCheck } from 'lucide-react';
import type { BorrowRequest, BorrowStatus } from '@/types';

type Tab = 'pending' | 'approved' | 'rejected';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' },
];

const STATUS_BADGE: Record<BorrowStatus, { text: string; cls: string }> = {
  pending_owner: { text: '待药主投放', cls: 'bg-gray-100 text-gray-500' },
  pending: { text: '待安全审核', cls: 'bg-amber-50 text-amber-600' },
  pending_admin: { text: '待驿站核验', cls: 'bg-indigo-50 text-indigo-600' },
  pending_payment: { text: '待居民支付', cls: 'bg-orange-50 text-orange-600' },
  approved: { text: '审核通过', cls: 'bg-emerald-50 text-emerald-600' },
  rejected: { text: '已驳回', cls: 'bg-gray-100 text-gray-500' },
  completed: { text: '已取药完成', cls: 'bg-blue-50 text-blue-600' },
};

export default function DoctorReviewScreen() {
  const { dispatch } = useApp();
  const [tab, setTab] = useState<Tab>('pending');
  const [list, setList] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<{ id: string; approved: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        if (tab === 'approved') {
          const all = await api.reviewBorrows('all');
          setList(
            all.filter((r) =>
              ['pending_owner', 'pending_admin', 'pending_payment', 'approved', 'completed'].includes(
                r.status,
              ),
            ),
          );
        } else {
          setList(await api.reviewBorrows(tab));
        }
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
    [tab, dispatch],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => load(true), 8000);
    return () => clearInterval(timer);
  }, [load]);

  const submit = async () => {
    if (!deciding) return;
    setSubmitting(true);
    try {
      await api.decideBorrow(deciding.id, deciding.approved, note.trim());
      dispatch({
        type: 'SHOW_TOAST',
        message: deciding.approved ? '已通过，等待驿站核验' : '已驳回该借药申请',
      });
      setDeciding(null);
      setNote('');
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '操作失败',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-emerald-50/40">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Stethoscope className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-semibold text-gray-800">药品安全审核</h1>
        </div>
        <p className="text-xs text-gray-400 mb-3">审核借药申请的症状与药品匹配性（是否对症、有无禁忌）</p>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-16">加载中…</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <ClipboardCheck className="w-7 h-7 text-emerald-300" />
            </div>
            <p className="text-sm text-gray-500">暂无{tab === 'pending' ? '待审核' : ''}借药申请</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((r) => {
              const badge = STATUS_BADGE[r.status];
              const isDeciding = deciding?.id === r.id;
              return (
                <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {r.borrowerName}
                        {r.borrowerBuilding && (
                          <span className="text-xs text-gray-400 font-normal"> · {r.borrowerBuilding}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{formatTime(r.createdAt)}申请</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>

                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <Pill className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {r.medicineName}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          借用 {r.quantity}
                          {r.unit}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        {r.isCabinet ? '来源：驿站自营（公共区）' : `药主：${r.ownerName}`}
                        {!r.isCabinet && r.ownerBuilding && (
                          <>
                            <MapPin className="w-3 h-3" />
                            {r.ownerBuilding}
                          </>
                        )}
                      </p>
                      {r.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {r.symptoms.map((s) => (
                            <span key={s} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {r.note && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2">
                      <p className="text-xs text-amber-700">
                        <span className="font-medium">症状描述：</span>
                        {r.note}
                      </p>
                    </div>
                  )}

                  {/* 审核结论（已处理） */}
                  {r.status !== 'pending' && r.doctorNote && (
                    <p className="mt-2 text-xs text-gray-500">
                      审核意见：{r.doctorNote}
                    </p>
                  )}

                  {/* 待审核操作区 */}
                  {r.status === 'pending' && !isDeciding && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setDeciding({ id: r.id, approved: true });
                          setNote('');
                        }}
                        className="flex-1 h-9 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium active:scale-[0.98] transition-transform"
                      >
                        审核通过
                      </button>
                      <button
                        onClick={() => {
                          setDeciding({ id: r.id, approved: false });
                          setNote('');
                        }}
                        className="flex-1 h-9 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium active:scale-[0.98] transition-transform"
                      >
                        驳回
                      </button>
                    </div>
                  )}

                  {/* 审核意见填写 */}
                  {isDeciding && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder={
                          deciding?.approved
                            ? '可填写用药嘱咐（选填）'
                            : '请填写驳回原因，如症状不符、存在禁忌等'
                        }
                        className="w-full p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={submit}
                          disabled={submitting || (!deciding?.approved && !note.trim())}
                          className={`flex-1 h-9 rounded-lg text-white text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-40 ${
                            deciding?.approved
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                              : 'bg-gray-700'
                          }`}
                        >
                          确认{deciding?.approved ? '通过' : '驳回'}
                        </button>
                        <button
                          onClick={() => setDeciding(null)}
                          className="flex-1 h-9 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
