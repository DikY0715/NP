import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError } from '@/lib/api';
import { Pill, User, MapPin, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import type { ReviewMedicine, ComplianceStatus } from '@/types';

type Tab = 'pending' | 'ok' | 'rejected';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '待审核' },
  { key: 'ok', label: '合规' },
  { key: 'rejected', label: '不合规' },
];

const COMPLIANCE_BADGE: Record<ComplianceStatus, { text: string; cls: string }> = {
  pending: { text: '待审核', cls: 'bg-amber-50 text-amber-600' },
  ok: { text: '合规', cls: 'bg-emerald-50 text-emerald-600' },
  rejected: { text: '不合规', cls: 'bg-red-50 text-red-500' },
};

export default function DoctorMedicineScreen() {
  const { dispatch } = useApp();
  const [tab, setTab] = useState<Tab>('pending');
  const [list, setList] = useState<ReviewMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<{ id: string; compliant: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await api.reviewMedicines(tab));
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '加载失败',
      });
    } finally {
      setLoading(false);
    }
  }, [tab, dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    if (!deciding) return;
    setSubmitting(true);
    try {
      await api.decideCompliance(deciding.id, deciding.compliant, note.trim());
      dispatch({
        type: 'SHOW_TOAST',
        message: deciding.compliant ? '已标记为合规' : '已标记为不合规',
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
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-semibold text-gray-800">共享药合规审核</h1>
        </div>
        <p className="text-xs text-gray-400 mb-3">审核居民共享药品的信息合规性（OTC 范围、效期、包装信息）</p>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
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
              <ShieldQuestion className="w-7 h-7 text-emerald-300" />
            </div>
            <p className="text-sm text-gray-500">暂无待审核的共享药品</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((m) => {
              const badge = COMPLIANCE_BADGE[m.complianceStatus];
              const isDeciding = deciding?.id === m.id;
              return (
                <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <Pill className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-800">{m.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.text}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{m.spec}</p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-0.5">
                          <User className="w-3 h-3" />
                          {m.ownerName}
                        </span>
                        {m.building && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" />
                            {m.building}
                          </span>
                        )}
                        <span>库存 {m.quantity}{m.unit}</span>
                        <span>{m.expiryDate} 到期</span>
                        <span>{m.shareScope === 'building' ? '本楼栋共享' : '本小区共享'}</span>
                      </p>
                      {m.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {m.symptoms.map((s) => (
                            <span key={s} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-xs">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {m.complianceNote && (
                    <p className="mt-2 text-xs text-gray-500">审核备注：{m.complianceNote}</p>
                  )}

                  {m.complianceStatus === 'pending' && !isDeciding && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          setDeciding({ id: m.id, compliant: true });
                          setNote('');
                        }}
                        className="flex-1 h-9 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium active:scale-[0.98] transition-transform"
                      >
                        标记合规
                      </button>
                      <button
                        onClick={() => {
                          setDeciding({ id: m.id, compliant: false });
                          setNote('');
                        }}
                        className="flex-1 h-9 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        不合规
                      </button>
                    </div>
                  )}

                  {isDeciding && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder={
                          deciding?.compliant
                            ? '可填写审核备注（选填）'
                            : '请说明不合规原因，如处方药、过期、信息不全等'
                        }
                        className="w-full p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={submit}
                          disabled={submitting || (!deciding?.compliant && !note.trim())}
                          className={`flex-1 h-9 rounded-lg text-white text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-40 ${
                            deciding?.compliant
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                              : 'bg-gray-700'
                          }`}
                        >
                          确认
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
