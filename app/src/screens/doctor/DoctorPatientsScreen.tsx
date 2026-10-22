import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import type { DoctorPatient, HealthArchive } from '@/types';
import {
  AlertTriangle,
  ChevronRight,
  Droplet,
  HeartPulse,
  MapPin,
  Pill,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';

export default function DoctorPatientsScreen() {
  const { dispatch } = useApp();
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [archive, setArchive] = useState<HealthArchive | null>(null);
  const [openBusy, setOpenBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPatients(await api.doctorPatients());
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

  const openArchive = async (residentId: string) => {
    setOpenBusy(true);
    try {
      setArchive(await api.patientArchive(residentId));
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '无权查看该档案',
      });
    } finally {
      setOpenBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-gradient-to-b from-emerald-500 to-teal-500 px-4 pt-8 pb-10">
        <h1 className="text-xl font-bold text-white">患者健康档案</h1>
        <p className="text-xs text-white/80 mt-1">
          仅展示已授权你查看的居民档案与用药记录
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 -mt-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-400">
            加载中…
          </div>
        ) : patients.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">暂无居民授权你查看档案</p>
            <p className="text-xs text-gray-400 mt-1">
              居民在「我的 - 健康档案」中授权后，会出现在这里
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
            {patients.map((p) => (
              <button
                key={p.grantId}
                onClick={() => openArchive(p.residentId)}
                disabled={openBusy}
                className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-gray-50"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-emerald-600">
                    {p.name[0] || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    {p.allergies.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 shrink-0">
                        过敏 {p.allergies.length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {p.building || '未设置楼栋'}
                    <span className="mx-1">·</span>
                    {p.hasProfile ? '已填档案' : '未填档案'}
                    <span className="mx-1">·</span>
                    授权于 {formatTime(p.grantedAt)}
                  </p>
                  {p.allergies.length > 0 && (
                    <p className="text-[11px] text-red-400 mt-1 truncate">
                      过敏史：{p.allergies.join('、')}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 档案详情弹窗 */}
      {archive && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
          <div className="w-full max-w-[430px] max-h-[85%] bg-gray-50 rounded-t-3xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-t-3xl border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-800">{archive.name}</h2>
                <p className="text-xs text-gray-400">{archive.building || '未设置楼栋'}</p>
              </div>
              <button
                onClick={() => setArchive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-3">
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-bold text-gray-800">健康档案</h3>
                </div>

                {archive.profile ? (
                  <>
                    <div className="mb-3">
                      <div className="flex items-center gap-1 mb-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-xs font-medium text-gray-600">过敏史</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {archive.profile.allergies.length === 0 ? (
                          <span className="text-xs text-gray-400">无</span>
                        ) : (
                          archive.profile.allergies.map((a) => (
                            <span
                              key={a}
                              className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs"
                            >
                              {a}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex items-center gap-1 mb-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-medium text-gray-600">基础疾病</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {archive.profile.chronicDiseases.length === 0 ? (
                          <span className="text-xs text-gray-400">无</span>
                        ) : (
                          archive.profile.chronicDiseases.map((c) => (
                            <span
                              key={c}
                              className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-xs"
                            >
                              {c}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span className="flex items-center gap-1">
                        <Droplet className="w-3.5 h-3.5 text-rose-400" />
                        血型 {archive.profile.bloodType || '未填'}
                      </span>
                      <span>
                        出生年份 {archive.profile.birthYear || '未填'}
                      </span>
                    </div>

                    {archive.profile.note && (
                      <p className="text-xs text-gray-500 mt-3 bg-gray-50 rounded-lg p-2.5">
                        {archive.profile.note}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-3">
                    该居民尚未填写健康档案
                  </p>
                )}
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-1.5 mb-3">
                  <Pill className="w-4 h-4 text-indigo-500" />
                  <h3 className="text-sm font-bold text-gray-800">用药记录</h3>
                  <span className="ml-auto text-[11px] text-gray-400">
                    共 {archive.medications.length} 条
                  </span>
                </div>

                {archive.medications.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">暂无记录</p>
                ) : (
                  <div className="space-y-3">
                    {archive.medications.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            m.kind === 'borrow'
                              ? 'bg-indigo-50 text-indigo-500'
                              : 'bg-emerald-50 text-emerald-500'
                          }`}
                        >
                          {m.kind === 'borrow' ? (
                            <Pill className="w-4 h-4" />
                          ) : (
                            <Stethoscope className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {m.title}
                            </p>
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                              {m.status}
                            </span>
                          </div>
                          {m.detail && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {m.detail}
                            </p>
                          )}
                          <p className="text-[11px] text-gray-400 mt-1">
                            {formatTime(m.createdAt)}
                            {m.doctorName ? ` · 医生 ${m.doctorName}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
