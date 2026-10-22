import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import type { AdverseReport, ReactionSeverity } from '@/types';
import { AlertTriangle, ArrowLeft, Send, History } from 'lucide-react';

const SEVERITY_OPTIONS: { value: ReactionSeverity; label: string; cls: string }[] = [
  { value: 'mild', label: '轻微', cls: 'bg-amber-100 text-amber-700' },
  { value: 'moderate', label: '中等', cls: 'bg-orange-100 text-orange-700' },
  { value: 'severe', label: '严重', cls: 'bg-red-100 text-red-700' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: '待医生处理',
  resolved: '已受理',
  rejected: '未通过',
};

export default function ReportScreen() {
  const { state, dispatch } = useApp();
  const [reports, setReports] = useState<AdverseReport[]>([]);
  const [medicineName, setMedicineName] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [severity, setSeverity] = useState<ReactionSeverity>('mild');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const borrows = state.transactions.filter((t) => t.type === 'borrow_in');

  const load = useCallback(async () => {
    try {
      setReports(await api.myReports());
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

  const submit = async () => {
    if (!symptoms.trim()) {
      dispatch({ type: 'SHOW_TOAST', message: '请填写不良反应表现' });
      return;
    }
    if (!medicineName.trim()) {
      dispatch({ type: 'SHOW_TOAST', message: '请填写或选择药品' });
      return;
    }
    setSubmitting(true);
    try {
      await api.createReport({
        medicineName,
        symptoms,
        severity,
        description,
      });
      setMedicineName('');
      setSymptoms('');
      setSeverity('mild');
      setDescription('');
      dispatch({ type: 'SHOW_TOAST', message: '上报成功，医生会尽快处理' });
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '提交失败',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-gradient-to-br from-red-500 to-orange-500 px-4 pt-6 pb-8">
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">不良反应上报</h1>
        </div>
        <p className="text-xs text-white/85 mt-2">
          用药后出现皮疹、头晕、恶心等异常，请及时上报，医生会跟进处理
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 -mt-4 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">
              药品名称
            </label>
            <input
              value={medicineName}
              onChange={(e) => setMedicineName(e.target.value)}
              placeholder="填写药品名称"
              className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            {borrows.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {Array.from(new Set(borrows.map((b) => b.medicineName)))
                  .slice(0, 6)
                  .map((name) => (
                    <button
                      key={name}
                      onClick={() => setMedicineName(name)}
                      className="px-2 py-1 rounded-lg bg-orange-50 text-orange-600 text-[11px]"
                    >
                      {name}
                    </button>
                  ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">
              不良反应表现 <span className="text-red-500">*</span>
            </label>
            <input
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="如：皮疹、瘙痒、恶心、头晕"
              className="w-full h-10 px-3 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">
              严重程度
            </label>
            <div className="flex gap-2">
              {SEVERITY_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSeverity(s.value)}
                  className={`flex-1 h-9 rounded-xl text-xs font-medium ${
                    severity === s.value ? s.cls : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">
              补充说明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="服药时间、剂量、是否就医等"
              className="w-full p-3 rounded-xl bg-gray-50 border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            {submitting ? '提交中…' : '提交上报'}
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3">
            <History className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-bold text-gray-800">我的上报</h2>
          </div>
          {reports.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">暂无上报记录</p>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  className="pb-3 border-b border-gray-50 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        r.severity === 'severe' ? 'text-red-500' : 'text-amber-500'
                      }`}
                    />
                    <p className="text-sm font-medium text-gray-800 truncate flex-1">
                      {r.medicineName || '未填写药品'}
                    </p>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{r.symptoms}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {formatTime(r.createdAt)}
                    {r.handleNote ? ` · 医生说明：${r.handleNote}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
