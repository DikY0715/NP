import { useApp } from '@/context/AppContext';
import {
  LogOut,
  MapPin,
  Phone,
  ShieldCheck,
  Stethoscope,
  Info,
  ChevronRight,
  AlertTriangle,
  Coins,
} from 'lucide-react';
import type { User } from '@/types';

type Role = 'doctor' | 'admin';

const THEME: Record<
  Role,
  {
    gradient: string;
    softBg: string;
    iconBg: string;
    accentText: string;
    roleLabel: string;
    roleIcon: typeof Stethoscope;
    duties: string[];
  }
> = {
  doctor: {
    gradient: 'from-emerald-500 to-teal-500',
    softBg: 'bg-emerald-50',
    iconBg: 'bg-emerald-50 text-emerald-500',
    accentText: 'text-emerald-600',
    roleLabel: '在线医生',
    roleIcon: Stethoscope,
    duties: ['借药药品安全审核', '共享药品信息合规审核', '对症与禁忌专业把关'],
  },
  admin: {
    gradient: 'from-indigo-500 to-blue-500',
    softBg: 'bg-indigo-50',
    iconBg: 'bg-indigo-50 text-indigo-500',
    accentText: 'text-indigo-600',
    roleLabel: '社区管理员',
    roleIcon: ShieldCheck,
    duties: ['驿站药品入库盘点', '审核通过借药出货', '取药码发放与过期药回收'],
  },
};

export default function RoleProfileScreen({ role }: { role: Role }) {
  const { state, dispatch, actions } = useApp();
  const user: User = state.user!;
  const theme = THEME[role];
  const RoleIcon = theme.roleIcon;

  return (
    <div className="flex flex-col h-full w-full bg-gray-50">
      {/* 头部身份卡 */}
      <div className={`bg-gradient-to-b ${theme.gradient} px-4 pt-8 pb-10`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/30">
            <span className="text-2xl font-bold text-white">{user.name[0]}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{user.name}</h2>
              <span className="px-2 py-0.5 rounded-full bg-white/25 text-xs text-white">
                {theme.roleLabel}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-white/70" />
              <p className="text-sm text-white/80">{user.community || '未设置小区'}</p>
            </div>
            {user.phone && (
              <div className="flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3 text-white/70" />
                <p className="text-sm text-white/80">{user.phone}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 职责说明 */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 -mt-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="text-xs font-medium text-gray-400 mb-3 px-1">我的职责</h3>
          <div className="space-y-3">
            {theme.duties.map((d) => (
              <div key={d} className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl ${theme.iconBg} flex items-center justify-center`}
                >
                  <RoleIcon className="w-4 h-4" />
                </div>
                <p className="text-sm text-gray-700">{d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl mt-4 overflow-hidden shadow-sm">
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', screen: 'reportInbox' })}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 border-b border-gray-50"
          >
            <div className={`w-9 h-9 rounded-xl ${theme.softBg} flex items-center justify-center`}>
              <AlertTriangle className={`w-4 h-4 ${theme.accentText}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">不良反应上报处理</p>
              <p className="text-[11px] text-gray-400 mt-0.5">居民上报的异常用药与不良反应</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
          {role === 'admin' && (
            <button
              onClick={() => dispatch({ type: 'NAVIGATE', screen: 'adminRewards' })}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50"
            >
              <div className={`w-9 h-9 rounded-xl ${theme.softBg} flex items-center justify-center`}>
                <Coins className={`w-4 h-4 ${theme.accentText}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">信用与积分管理</p>
                <p className="text-[11px] text-gray-400 mt-0.5">居民信用分、黑名单与礼品发放</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl mt-4 overflow-hidden shadow-sm">
          <button
            onClick={() => dispatch({ type: 'SHOW_TOAST', message: '药邻社区服务平台 v1.0.0' })}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50"
          >
            <div className={`w-9 h-9 rounded-xl ${theme.softBg} flex items-center justify-center`}>
              <Info className={`w-4 h-4 ${theme.accentText}`} />
            </div>
            <span className="flex-1 text-sm font-medium text-gray-800">关于平台</span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>

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
