import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ensureNotificationPermission } from '@/lib/notifications';
import { 
  ChevronRight, 
  HelpCircle, 
  Settings, 
  FileText,
  Info,
  LogOut,
  Edit3,
  Check,
  X,
  MapPin,
  Bell,
  HeartPulse,
  Coins,
  ShieldCheck,
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

export default function ProfileScreen() {
  const { state, dispatch, actions } = useApp();
  const [isEditingName, setIsEditingName] = useState(false);
  const nickname = state.user?.name || '药邻用户';
  const [editNickname, setEditNickname] = useState('');
  const [borrowNotif, setBorrowNotif] = useState(() => {
    return localStorage.getItem('yaolin_notif_borrow') !== 'false';
  });
  const [expiryNotif, setExpiryNotif] = useState(() => {
    return localStorage.getItem('yaolin_notif_expiry') !== 'false';
  });

  const totalMedicines = state.medicines.length;
  const sharedMedicines = state.medicines.filter(m => m.visibility === 'public').length;
  const helpCount = state.myHelpPosts.length;
  const responseCount = state.myHelpPosts.reduce((acc, p) => acc + p.responses, 0);

  const startEditName = () => {
    setEditNickname(nickname);
    setIsEditingName(true);
  };

  const saveName = async () => {
    const newName = editNickname.trim() || nickname;
    setIsEditingName(false);
    await actions.updateProfile({ name: newName });
  };

  const cancelEditName = () => {
    setIsEditingName(false);
  };

  const menuGroups = [
    {
      title: '药品管理',
      items: [
        {
          icon: HeartPulse,
          label: '健康档案',
          desc: '过敏史 / 基础疾病 / 用药记录',
          action: () => dispatch({ type: 'NAVIGATE', screen: 'healthProfile' })
        },
        { 
          icon: FileText, 
          label: '借药记录', 
          desc: `${state.transactions.length}条记录`,
          action: () => dispatch({ type: 'NAVIGATE', screen: 'transaction' })
        },
        {
          icon: Coins,
          label: '积分商城',
          desc: '共享赚积分，兑换小礼品',
          action: () => dispatch({ type: 'NAVIGATE', screen: 'points' })
        },
        {
          icon: ShieldCheck,
          label: '信用与黑名单',
          desc: '信用分与借药权限',
          action: () => dispatch({ type: 'NAVIGATE', screen: 'credit' })
        },
        {
          icon: AlertTriangle,
          label: '不良反应上报',
          desc: '用药后异常及时反馈医生',
          action: () => dispatch({ type: 'NAVIGATE', screen: 'report' })
        },
      ]
    },
    {
      title: '设置',
      items: [
        { 
          icon: Settings, 
          label: '隐私设置', 
          desc: '药品默认可见性',
          action: () => dispatch({ type: 'NAVIGATE', screen: 'privacy' })
        },
        { 
          icon: Bell, 
          label: '借药提醒', 
          desc: borrowNotif ? '已开启' : '已关闭',
          toggle: () => {
            const v = !borrowNotif;
            setBorrowNotif(v);
            localStorage.setItem('yaolin_notif_borrow', String(v));
            if (v) void ensureNotificationPermission();
          },
          isOn: borrowNotif,
        },
        { 
          icon: Bell, 
          label: '过期提醒', 
          desc: expiryNotif ? '已开启' : '已关闭',
          toggle: () => {
            const v = !expiryNotif;
            setExpiryNotif(v);
            localStorage.setItem('yaolin_notif_expiry', String(v));
            if (v) void ensureNotificationPermission();
          },
          isOn: expiryNotif,
        },
      ]
    },
    {
      title: '帮助',
      items: [
        { 
          icon: HelpCircle, 
          label: '帮助与反馈', 
          desc: '',
          action: () => dispatch({ type: 'SHOW_TOAST', message: '功能开发中' })
        },
        { 
          icon: Info, 
          label: '关于药邻', 
          desc: 'v1.0.0',
          action: () => dispatch({ type: 'SHOW_TOAST', message: '药邻 v1.0.0' })
        },
      ]
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-orange-50/50" style={{ height: '100%' }}>
      {/* Header Background */}
      <div className="bg-gradient-to-b from-orange-400 to-amber-500 px-4 pt-6 pb-8">
        {/* User Info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
            <span className="text-2xl font-bold text-white">{nickname[0]}</span>
          </div>
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder="输入昵称"
                  autoFocus
                  className="flex-1 h-10 px-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button onClick={saveName} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </button>
                <button onClick={cancelEditName} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">{nickname}</h2>
                {state.user?.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded-full bg-white/25 text-xs text-white">管理员</span>
                )}
                {state.user?.role === 'doctor' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/80 text-xs text-white">医生</span>
                )}
                <button onClick={startEditName} className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Edit3 className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-white/70" />
              <p className="text-sm text-white/80">
                {[state.user?.community, state.user?.building].filter(Boolean).join(' · ') || '未设置小区'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 divide-x divide-white/20">
          <div className="text-center">
            <p className="text-xl font-bold text-white">{totalMedicines}</p>
            <p className="text-xs text-white/80 mt-0.5">我的药品</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{sharedMedicines}</p>
            <p className="text-xs text-white/80 mt-0.5">共享次数</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{helpCount}</p>
            <p className="text-xs text-white/80 mt-0.5">求助次数</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-white">{responseCount}</p>
            <p className="text-xs text-white/80 mt-0.5">帮助人数</p>
          </div>
        </div>
      </div>

      {/* Menu Groups */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 -mt-2">
        <div className="space-y-5">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-medium text-gray-400 mb-2 px-1">{group.title}</h3>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {group.items.map((item: any, index: number) => (
                  <button
                    key={item.label}
                    onClick={item.toggle || item.action}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-orange-50 transition-colors ${
                      index < group.items.length - 1 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                      <item.icon className="w-4.5 h-4.5 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{item.label}</p>
                      {item.desc && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                      )}
                    </div>
                    {item.toggle ? (
                      item.isOn ? (
                        <ToggleRight className="w-10 h-6 text-orange-500" />
                      ) : (
                        <ToggleLeft className="w-10 h-6 text-gray-300" />
                      )
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Logout Button */}
        <button 
          onClick={() => actions.logout()}
          className="w-full mt-6 h-12 rounded-xl bg-white text-red-500 font-medium shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </div>
  );
}
