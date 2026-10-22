import { useApp } from '@/context/AppContext';
import { ClipboardCheck, ShieldCheck, MessageSquare, UserRound } from 'lucide-react';
import type { ScreenName } from '@/types';
import DoctorReviewScreen from './DoctorReviewScreen';
import DoctorMedicineScreen from './DoctorMedicineScreen';
import DoctorConsultScreen from './DoctorConsultScreen';
import RoleProfileScreen from '../roles/RoleProfileScreen';
import ReportInboxScreen from './ReportInboxScreen';

type DoctorTab = 'doctorReview' | 'doctorMedicines' | 'doctorConsult' | 'doctorProfile';

const TABS: { key: DoctorTab; label: string; icon: typeof ClipboardCheck }[] = [
  { key: 'doctorReview', label: '借药审核', icon: ClipboardCheck },
  { key: 'doctorMedicines', label: '共享审核', icon: ShieldCheck },
  { key: 'doctorConsult', label: '在线问诊', icon: MessageSquare },
  { key: 'doctorProfile', label: '我的', icon: UserRound },
];

function currentTab(screen: ScreenName): DoctorTab {
  if (screen === 'doctorMedicines') return 'doctorMedicines';
  if (screen === 'doctorConsult') return 'doctorConsult';
  if (screen === 'doctorProfile') return 'doctorProfile';
  return 'doctorReview';
}

/** 医生端：独立信息架构，仅包含医生职能（借药审核 / 共享药审核 / 在线问诊）。 */
export default function DoctorApp() {
  const { state, dispatch } = useApp();
  const tab = currentTab(state.currentScreen);

  if (state.currentScreen === 'reportInbox') {
    return (
      <div className="flex flex-col h-full">
        <ReportInboxScreen role="doctor" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        {tab === 'doctorReview' && <DoctorReviewScreen />}
        {tab === 'doctorMedicines' && <DoctorMedicineScreen />}
        {tab === 'doctorConsult' && <DoctorConsultScreen />}
        {tab === 'doctorProfile' && <RoleProfileScreen role="doctor" />}
      </div>

      <nav className="h-16 bg-white/95 backdrop-blur border-t border-emerald-100 flex items-center justify-around pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => dispatch({ type: 'NAVIGATE', screen: t.key })}
              className="relative w-16 h-12 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[3px] rounded-b bg-gradient-to-r from-emerald-500 to-teal-500" />
              )}
              <t.icon
                className={`w-6 h-6 ${active ? 'text-emerald-500' : 'text-gray-400'}`}
                strokeWidth={active ? 2.5 : 1.5}
              />
              <span className={`text-[10px] ${active ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                {t.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
