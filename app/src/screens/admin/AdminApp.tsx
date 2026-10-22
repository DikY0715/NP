import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { LayoutDashboard, PackageCheck, Boxes, UserCog, UserRound } from 'lucide-react';
import type { ScreenName } from '@/types';
import ScanScreen from '@/screens/ScanScreen';
import PublicMedicineScreen from '@/screens/PublicMedicineScreen';
import AdminHomeScreen from './AdminHomeScreen';
import AdminDispatchScreen from './AdminDispatchScreen';
import AdminInventoryScreen from './AdminInventoryScreen';
import AdminUsersScreen from './AdminUsersScreen';
import AdminRewardsScreen from './AdminRewardsScreen';
import ReportInboxScreen from '../doctor/ReportInboxScreen';
import RoleProfileScreen from '../roles/RoleProfileScreen';

type AdminTab = 'adminHome' | 'adminDispatch' | 'adminInventory' | 'adminUsers' | 'adminProfile';

const TABS: { key: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'adminHome', label: '工作台', icon: LayoutDashboard },
  { key: 'adminDispatch', label: '出货', icon: PackageCheck },
  { key: 'adminInventory', label: '库存', icon: Boxes },
  { key: 'adminUsers', label: '账号', icon: UserCog },
  { key: 'adminProfile', label: '我的', icon: UserRound },
];

function currentTab(screen: ScreenName): AdminTab {
  if (screen === 'adminDispatch') return 'adminDispatch';
  if (screen === 'adminInventory') return 'adminInventory';
  if (screen === 'adminUsers') return 'adminUsers';
  if (screen === 'adminProfile') return 'adminProfile';
  return 'adminHome';
}

/** 管理员端：独立信息架构，仅包含驿站管理功能。 */
export default function AdminApp() {
  const { state, dispatch } = useApp();

  // 公共药品页：与居民端同一页面（驿站自营 / 闲置药品）
  if (state.currentScreen === 'publicMedicine') {
    return <PublicMedicineScreen />;
  }

  // 不良反应上报处理
  if (state.currentScreen === 'reportInbox') {
    return (
      <div className="flex flex-col h-full">
        <ReportInboxScreen role="admin" />
      </div>
    );
  }

  // 信用与积分管理
  if (state.currentScreen === 'adminRewards') {
    return (
      <div className="flex flex-col h-full">
        <AdminRewardsScreen />
      </div>
    );
  }

  // AI 识药入库：复用居民端摄像头取景体验，确认后入库到实体柜
  if (state.currentScreen === 'adminScan') {
    return (
      <ScanScreen
        showManualInput={false}
        confirmLabel="确认入库"
        onConfirm={async (m) => {
          try {
            await api.adminAddCabinetMedicine({
              name: m.name,
              spec: m.spec,
              quantity: m.quantity,
              unit: m.unit,
              expiryDate: m.expiryDate,
            });
            dispatch({ type: 'SHOW_TOAST', message: `${m.name} 已入库到实体柜` });
            dispatch({ type: 'GO_BACK' });
          } catch (err) {
            dispatch({
              type: 'SHOW_TOAST',
              message: err instanceof Error ? err.message : '入库失败',
            });
          }
        }}
      />
    );
  }

  const tab = currentTab(state.currentScreen);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        {tab === 'adminHome' && <AdminHomeScreen />}
        {tab === 'adminDispatch' && <AdminDispatchScreen />}
        {tab === 'adminInventory' && <AdminInventoryScreen />}
        {tab === 'adminUsers' && <AdminUsersScreen />}
        {tab === 'adminProfile' && <RoleProfileScreen role="admin" />}
      </div>

      <nav className="h-16 bg-white/95 backdrop-blur border-t border-indigo-100 flex items-center justify-around pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                if (t.key === 'adminDispatch') {
                  dispatch({ type: 'SET_ADMIN_DISPATCH_TAB', tab: 'verify' });
                }
                dispatch({ type: 'NAVIGATE', screen: t.key });
              }}
              className="relative w-16 h-12 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-b bg-gradient-to-r from-indigo-500 to-blue-500" />
              )}
              <t.icon
                className={`w-6 h-6 ${active ? 'text-indigo-500' : 'text-gray-400'}`}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <span className={`text-[10px] ${active ? 'text-indigo-600 font-semibold' : 'text-gray-400'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
