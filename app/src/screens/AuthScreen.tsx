import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import {
  ChevronLeft,
  Eye,
  EyeOff,
  MapPin,
  Phone,
  User as UserIcon,
  Lock,
  ShieldCheck,
} from 'lucide-react';

type Mode = 'login' | 'register';

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

const DEMO_ACCOUNTS = [
  { username: 'demo', password: 'demo123', desc: '张阿姨 · 3号楼' },
  { username: 'lisi', password: 'lisi123', desc: '李叔 · 5号楼' },
  { username: 'wangwu', password: 'wangwu123', desc: '小王 · 3号楼' },
  { username: 'admin', password: 'admin123', desc: '管理员' },
  { username: 'doctor', password: 'doctor123', desc: '陈医生 · 在线医生' },
];

export default function AuthScreen() {
  const { dispatch, actions } = useApp();
  const [mode, setMode] = useState<Mode>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 登录字段（支持用户名或手机号）
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 注册字段
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [building, setBuilding] = useState('');
  const [community, setCommunity] = useState('阳光小区');

  // 验证码发送状态
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [debugCode, setDebugCode] = useState<string | undefined>();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const canSubmit =
    mode === 'login'
      ? username.trim().length > 0 && password.length > 0
      : PHONE_PATTERN.test(phone.trim()) &&
        code.trim().length === 6 &&
        password.length >= 6 &&
        name.trim().length > 0 &&
        building.trim().length > 0 &&
        community.trim().length > 0;

  const handleSendCode = async () => {
    const p = phone.trim();
    if (!PHONE_PATTERN.test(p)) {
      dispatch({ type: 'SHOW_TOAST', message: '请输入正确的 11 位手机号' });
      return;
    }
    setSending(true);
    try {
      const r = await api.sendSmsCode(p);
      setCountdown(60);
      setDebugCode(r.debugCode);
      dispatch({
        type: 'SHOW_TOAST',
        message: r.debugCode ? `验证码已发送（演示环境：${r.debugCode}）` : '验证码已发送',
      });
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '验证码发送失败',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await actions.login(username.trim(), password);
      } else {
        await actions.register({
          phone: phone.trim(),
          code: code.trim(),
          password,
          name: name.trim(),
          building: building.trim(),
          community: community.trim(),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (u: string, p: string) => {
    setMode('login');
    setUsername(u);
    setPassword(p);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setPassword('');
    setCode('');
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-orange-50 to-amber-50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-2">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'splash' })}
          className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Logo & Title */}
      <div className="flex flex-col items-center pt-4 pb-6">
        <img src="/images/logo.png" alt="药邻" className="w-20 h-20 object-contain drop-shadow" />
        <h1 className="text-2xl font-bold text-gray-800 mt-3">药邻</h1>
        <p className="text-xs text-gray-500 mt-1">让药品在邻里间流动</p>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {/* Mode Tabs */}
        <div className="flex bg-white rounded-full p-1 shadow-sm mb-5">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 h-9 rounded-full text-sm font-medium transition-colors ${
                mode === m ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow' : 'text-gray-500'
              }`}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === 'login' ? (
            <>
              <Field icon={<UserIcon className="w-4 h-4 text-gray-400" />}>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="用户名 / 手机号"
                  autoCapitalize="none"
                  className="flex-1 h-12 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                />
              </Field>

              <Field icon={<Lock className="w-4 h-4 text-gray-400" />}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码"
                  className="flex-1 h-12 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                />
                <button onClick={() => setShowPassword((v) => !v)} className="px-1">
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </Field>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Field icon={<Phone className="w-4 h-4 text-gray-400" />}>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      inputMode="numeric"
                      placeholder="手机号（将作为登录账号）"
                      className="flex-1 h-12 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                    />
                  </Field>
                </div>
                <button
                  onClick={handleSendCode}
                  disabled={sending || countdown > 0}
                  className={`w-24 h-12 rounded-xl text-xs font-medium transition-colors ${
                    sending || countdown > 0
                      ? 'bg-gray-200 text-gray-400'
                      : 'bg-gradient-to-r from-orange-400 to-amber-500 text-white'
                  }`}
                >
                  {sending ? '发送中…' : countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                </button>
              </div>

              <Field icon={<ShieldCheck className="w-4 h-4 text-gray-400" />}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 位短信验证码"
                  className="flex-1 h-12 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                />
                {debugCode && (
                  <span className="text-[11px] text-orange-500 shrink-0">演示码 {debugCode}</span>
                )}
              </Field>

              <Field icon={<Lock className="w-4 h-4 text-gray-400" />}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码（至少 6 位）"
                  className="flex-1 h-12 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                />
                <button onClick={() => setShowPassword((v) => !v)} className="px-1">
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </Field>

              <Field icon={<UserIcon className="w-4 h-4 text-gray-400" />}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="昵称（邻里间显示的名字）"
                  className="flex-1 h-12 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                />
              </Field>

              <div className="flex gap-3">
                <div className="flex-1">
                  <Field icon={<MapPin className="w-4 h-4 text-gray-400" />}>
                    <input
                      value={community}
                      onChange={(e) => setCommunity(e.target.value)}
                      placeholder="小区"
                      className="flex-1 h-12 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                    />
                  </Field>
                </div>
                <div className="w-28">
                  <Field icon={null}>
                    <input
                      value={building}
                      onChange={(e) => setBuilding(e.target.value)}
                      placeholder="楼栋"
                      className="flex-1 h-12 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                    />
                  </Field>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed px-1">
                医生与管理员账号由社区后台统一分配，居民请使用手机号验证码注册。
              </p>
            </>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`w-full h-12 mt-6 rounded-full font-semibold flex items-center justify-center gap-2 transition-all ${
            canSubmit && !submitting
              ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-lg shadow-orange-200 active:scale-[0.98]'
              : 'bg-gray-200 text-gray-400'
          }`}
        >
          {submitting && <Spinner className="size-4 text-white" />}
          {mode === 'login' ? '登录' : '注册并登录'}
        </button>

        {/* Demo accounts */}
        {mode === 'login' && (
          <div className="mt-6">
            <p className="text-xs text-gray-400 text-center mb-2">演示账号（点击一键填入）</p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  onClick={() => fillDemo(acc.username, acc.password)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white/80 rounded-xl text-left active:bg-orange-50 transition-colors"
                >
                  <span className="text-sm text-gray-700">
                    {acc.username}
                    <span className="text-gray-300"> / </span>
                    {acc.password}
                  </span>
                  <span className="text-xs text-gray-400">{acc.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 h-12 px-4 bg-white rounded-xl border border-orange-100 focus-within:ring-2 focus-within:ring-orange-200">
      {icon}
      {children}
    </div>
  );
}
