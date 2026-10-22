import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError } from '@/lib/api';
import type { StaffAccount } from '@/types';
import {
  UserPlus,
  Stethoscope,
  ShieldCheck,
  Phone,
  KeyRound,
  User as UserIcon,
  ChevronDown,
} from 'lucide-react';

export default function AdminUsersScreen() {
  const { state, dispatch } = useApp();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [role, setRole] = useState<'doctor' | 'admin'>('doctor');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const load = useCallback(async () => {
    try {
      setAccounts(await api.adminStaff());
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '账号列表加载失败',
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const canSubmit =
    name.trim().length > 0 &&
    username.trim().length >= 3 &&
    password.length >= 6 &&
    !submitting;

  const resetForm = () => {
    setName('');
    setUsername('');
    setPhone('');
    setPassword('');
  };

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await api.adminCreateStaff({
        username: username.trim(),
        password,
        name: name.trim(),
        role,
        phone: phone.trim() || undefined,
      });
      setAccounts((prev) => [created, ...prev]);
      dispatch({
        type: 'SHOW_TOAST',
        message: `${created.name} 的${created.role === 'doctor' ? '医生' : '管理员'}账号已分配`,
      });
      resetForm();
      setShowForm(false);
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '账号分配失败',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      <div className="bg-gradient-to-b from-indigo-500 to-blue-500 px-4 pt-8 pb-10">
        <h1 className="text-xl font-bold text-white">账号管理</h1>
        <p className="text-sm text-white/80 mt-1">
          {state.user?.community || ''} · 医生与管理员账号由后台分配
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 -mt-4 space-y-4">
        {/* 分配入口 */}
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-800">分配新账号</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                为诊所医生或社区管理员开通登录权限
              </p>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-300 transition-transform ${showForm ? 'rotate-180' : ''}`}
          />
        </button>

        {/* 分配表单 */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">账号角色</label>
              <div className="flex gap-2">
                {(
                  [
                    { key: 'doctor', label: '诊所医生', icon: Stethoscope },
                    { key: 'admin', label: '社区管理员', icon: ShieldCheck },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setRole(r.key)}
                    className={`flex-1 h-10 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      role === r.key
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <r.icon className="w-4 h-4" />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <FormInput
              label="姓名"
              icon={<UserIcon className="w-4 h-4 text-gray-400" />}
              value={name}
              onChange={setName}
              placeholder="如：陈医生"
            />
            <FormInput
              label="登录用户名"
              icon={<UserIcon className="w-4 h-4 text-gray-400" />}
              value={username}
              onChange={setUsername}
              placeholder="至少 3 位，如 doctor2"
            />
            <FormInput
              label="手机号（选填）"
              icon={<Phone className="w-4 h-4 text-gray-400" />}
              value={phone}
              onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 11))}
              placeholder="用于联系与身份核对"
            />
            <FormInput
              label="初始密码"
              icon={<KeyRound className="w-4 h-4 text-gray-400" />}
              value={password}
              onChange={setPassword}
              placeholder="至少 6 位，交付后请提醒本人修改"
              type="password"
            />

            <button
              onClick={handleCreate}
              disabled={!canSubmit}
              className={`w-full h-11 rounded-xl text-sm font-semibold transition-colors ${
                canSubmit
                  ? 'bg-gradient-to-r from-indigo-500 to-blue-500 text-white'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {submitting ? '分配中…' : '确认分配账号'}
            </button>
          </div>
        )}

        {/* 已分配账号 */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-bold text-gray-800">已分配账号</h2>
            <span className="text-[11px] text-gray-400">{accounts.length} 个</span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl p-4 shadow-sm text-center text-xs text-gray-400">
              加载中…
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <p className="text-sm text-gray-500">还没有分配医生或管理员账号</p>
              <p className="text-[11px] text-gray-400 mt-1">点击上方「分配新账号」即可开通</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {accounts.map((acc) => (
                <div key={acc.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                      acc.role === 'doctor'
                        ? 'bg-emerald-50 text-emerald-500'
                        : 'bg-indigo-50 text-indigo-500'
                    }`}
                  >
                    {acc.role === 'doctor' ? (
                      <Stethoscope className="w-5 h-5" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 truncate">{acc.name}</p>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                          acc.role === 'doctor'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-indigo-50 text-indigo-600'
                        }`}
                      >
                        {acc.role === 'doctor' ? '医生' : '管理员'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {acc.username}
                      {acc.phone ? ` · ${acc.phone}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-300 shrink-0">{acc.createdAt}</span>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-3 px-1 leading-relaxed">
            居民请在登录页使用手机号 + 验证码自助注册，无需在此分配。
          </p>
        </div>
      </div>
    </div>
  );
}

function FormInput({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-gray-50 border border-gray-100 focus-within:ring-2 focus-within:ring-indigo-200">
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-11 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
        />
      </div>
    </div>
  );
}
