import { formatTime } from '@/lib/api';
import type { HealthArchive } from '@/types';
import {
  AlertTriangle,
  Droplet,
  HeartPulse,
  Pill,
  Stethoscope,
  X,
} from 'lucide-react';

interface HealthArchiveSheetProps {
  archive: HealthArchive;
  onClose: () => void;
}

/** 医生端：居民健康档案 + 用药记录底部弹窗。 */
export default function HealthArchiveSheet({ archive, onClose }: HealthArchiveSheetProps) {
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-[430px] max-h-[85%] bg-gray-50 rounded-t-3xl flex flex-col overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-white rounded-t-3xl border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">{archive.name}</h2>
            <p className="text-xs text-gray-400">{archive.building || '未设置楼栋'}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
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
                  <span>出生年份 {archive.profile.birthYear || '未填'}</span>
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
                        <p className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">
                          {m.title}
                        </p>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                          {m.status}
                        </span>
                      </div>
                      {m.detail && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{m.detail}</p>
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
  );
}
