import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import type {
  DoctorGrant,
  DoctorOption,
  HealthProfile,
  MedicationRecord,
} from '@/types';
import {
  ArrowLeft,
  AlertTriangle,
  HeartPulse,
  Pill,
  Save,
  ShieldCheck,
  ShieldOff,
  Stethoscope,
  Plus,
  X,
  Droplet,
} from 'lucide-react';

const BLOOD_TYPES = ['A', 'B', 'AB', 'O', '未知'];

/** 标签输入：过敏史 / 基础疾病 */
function TagInput({
  values,
  onChange,
  placeholder,
  tone,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  tone: 'red' | 'amber';
}) {
  const [draft, setDraft] = useState('');
  const chipCls =
    tone === 'red'
      ? 'bg-red-50 text-red-600 border-red-100'
      : 'bg-amber-50 text-amber-600 border-amber-100';

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.length === 0 && (
          <span className="text-xs text-gray-400">暂未填写</span>
        )}
        {values.map((v) => (
          <span
            key={v}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-xs ${chipCls}`}
          >
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 h-9 px-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
        <button
          onClick={add}
          className="w-9 h-9 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function HealthProfileScreen() {
  const { state, dispatch } = useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [grants, setGrants] = useState<DoctorGrant[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  // 编辑态
  const [allergies, setAllergies] = useState<string[]>([]);
  const [chronic, setChronic] = useState<string[]>([]);
  const [bloodType, setBloodType] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [note, setNote] = useState('');

  const applyProfile = (p: HealthProfile) => {
    setProfile(p);
    setAllergies(p.allergies);
    setChronic(p.chronicDiseases);
    setBloodType(p.bloodType);
    setBirthYear(p.birthYear ? String(p.birthYear) : '');
    setNote(p.note);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, meds, gs, docs] = await Promise.all([
        api.healthProfile(),
        api.healthMedications(),
        api.healthGrants(),
        api.healthDoctors(),
      ]);
      applyProfile(p);
      setMedications(meds);
      setGrants(gs);
      setDoctors(docs);
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

  const save = async () => {
    setSaving(true);
    try {
      const p = await api.updateHealthProfile({
        allergies,
        chronicDiseases: chronic,
        bloodType,
        birthYear: birthYear ? Number(birthYear) : undefined,
        note,
      });
      setProfile(p);
      dispatch({ type: 'SHOW_TOAST', message: '健康档案已保存' });
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '保存失败',
      });
    } finally {
      setSaving(false);
    }
  };

  const grant = async (doctorId: string) => {
    try {
      await api.grantDoctor(doctorId);
      setGrants(await api.healthGrants());
      dispatch({ type: 'SHOW_TOAST', message: '已授权该医生查看档案' });
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '授权失败',
      });
    }
  };

  const revoke = async (grantId: string) => {
    try {
      await api.revokeDoctor(grantId);
      setGrants(await api.healthGrants());
      dispatch({ type: 'SHOW_TOAST', message: '已撤销授权' });
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '撤销失败',
      });
    }
  };

  const activeGrants = grants.filter((g) => g.status === 'active');
  const authorizedIds = new Set(activeGrants.map((g) => g.doctorId));

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      {/* 头部 */}
      <div className="bg-gradient-to-b from-rose-500 to-orange-500 px-4 pt-6 pb-8">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-lg font-bold text-white">健康档案</h1>
        </div>
        <p className="text-xs text-white/85">
          {state.user?.name} · {state.user?.building || '未设置楼栋'}
        </p>
        <p className="text-xs text-white/70 mt-1">
          填写过敏史与基础疾病，借药时医生可据此判断用药禁忌
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 -mt-4 space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-400">
            加载中…
          </div>
        ) : (
          <>
            {/* 档案信息 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <HeartPulse className="w-4 h-4 text-rose-500" />
                <h2 className="text-sm font-bold text-gray-800">基本信息</h2>
                {profile && (
                  <span className="ml-auto text-[11px] text-gray-400">
                    {profile.updatedAt ? `更新于 ${formatTime(profile.updatedAt)}` : ''}
                  </span>
                )}
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-1 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-medium text-gray-600">过敏史</span>
                </div>
                <TagInput
                  values={allergies}
                  onChange={setAllergies}
                  placeholder="如：青霉素、磺胺类"
                  tone="red"
                />
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-1 mb-2">
                  <Stethoscope className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-gray-600">基础疾病</span>
                </div>
                <TagInput
                  values={chronic}
                  onChange={setChronic}
                  placeholder="如：高血压、糖尿病"
                  tone="amber"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <Droplet className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-xs font-medium text-gray-600">血型</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {BLOOD_TYPES.map((b) => (
                      <button
                        key={b}
                        onClick={() => setBloodType(bloodType === b ? '' : b)}
                        className={`px-2.5 py-1 rounded-lg text-xs border ${
                          bloodType === b
                            ? 'bg-rose-500 text-white border-rose-500'
                            : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-600 block mb-2">
                    出生年份
                  </span>
                  <input
                    value={birthYear}
                    onChange={(e) =>
                      setBirthYear(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="如 1985"
                    inputMode="numeric"
                    className="w-full h-9 px-3 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>

              <div className="mb-4">
                <span className="text-xs font-medium text-gray-600 block mb-2">
                  其他说明
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="如长期服药、既往手术史等"
                  className="w-full p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? '保存中…' : '保存档案'}
              </button>
            </div>

            {/* 用药记录 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <Pill className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-bold text-gray-800">用药记录</h2>
                <span className="ml-auto text-[11px] text-gray-400">
                  共 {medications.length} 条
                </span>
              </div>

              {medications.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  暂无借药或问诊记录
                </p>
              ) : (
                <div className="space-y-3">
                  {medications.map((m) => (
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
                          {m.createdAt ? formatTime(m.createdAt) : ''}
                          {m.doctorName ? ` · 医生 ${m.doctorName}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 授权医生 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-gray-800">授权医生查看</h2>
              </div>
              <p className="text-[11px] text-gray-400 mb-3">
                仅已授权的医生可查看你的档案与用药记录，可随时撤销
              </p>

              {activeGrants.length > 0 && (
                <div className="space-y-2 mb-3">
                  {activeGrants.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2"
                    >
                      <Stethoscope className="w-4 h-4 text-emerald-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800">
                          {g.doctorName}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {g.scopeNote} · {formatTime(g.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => revoke(g.id)}
                        className="flex items-center gap-1 text-[11px] text-red-500 px-2 py-1 rounded-lg bg-white"
                      >
                        <ShieldOff className="w-3 h-3" />
                        撤销
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-gray-400 mb-2">可授权的社区医生</p>
              <div className="space-y-2">
                {doctors.map((d) => {
                  const granted = authorizedIds.has(d.id);
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2"
                    >
                      <Stethoscope className="w-4 h-4 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800">{d.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {d.community || '社区医生'}
                        </p>
                      </div>
                      <button
                        onClick={() => grant(d.id)}
                        disabled={granted}
                        className={`text-[11px] px-2.5 py-1 rounded-lg ${
                          granted
                            ? 'bg-emerald-50 text-emerald-500'
                            : 'bg-orange-500 text-white'
                        }`}
                      >
                        {granted ? '已授权' : '授权查看'}
                      </button>
                    </div>
                  );
                })}
                {doctors.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">
                    暂无可用医生
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
