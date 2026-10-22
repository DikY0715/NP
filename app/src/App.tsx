import { useEffect, useCallback } from 'react';
import { useApp, unreadCount, AppProvider } from '@/context/AppContext';
import { Home, Users, MessageCircle, User } from 'lucide-react';
import type { ScreenName, TabName } from '@/types';

import SplashScreen from '@/screens/SplashScreen';
import AuthScreen from '@/screens/AuthScreen';
import HomeScreen from '@/screens/HomeScreen';
import ScanScreen from '@/screens/ScanScreen';
import SymptomScreen from '@/screens/SymptomScreen';
import ExpiryScreen from '@/screens/ExpiryScreen';
import PublicMedicineScreen from '@/screens/PublicMedicineScreen';
import CommunityScreen from '@/screens/CommunityScreen';
import PostHelpScreen from '@/screens/PostHelpScreen';
import ShareSettingsScreen from '@/screens/ShareSettingsScreen';
import MessageScreen from '@/screens/MessageScreen';
import ProfileScreen from '@/screens/ProfileScreen';
import PrivacyScreen from '@/screens/PrivacyScreen';
import MedicineDetailScreen from '@/screens/MedicineDetailScreen';
import AddMedicineScreen from '@/screens/AddMedicineScreen';
import ChatScreen from '@/screens/ChatScreen';
import TransactionScreen from '@/screens/TransactionScreen';
import ConsultScreen from '@/screens/ConsultScreen';
import HealthProfileScreen from '@/screens/HealthProfileScreen';
import PointsScreen from '@/screens/PointsScreen';
import CreditScreen from '@/screens/CreditScreen';
import ReportScreen from '@/screens/ReportScreen';
import DoctorApp from '@/screens/doctor/DoctorApp';
import AdminApp from '@/screens/admin/AdminApp';

import './App.css';

// Tab 配置
const tabs: { key: TabName; label: string; icon: typeof Home }[] = [
  { key: 'home', label: '药箱', icon: Home },
  { key: 'community', label: '社区', icon: Users },
  { key: 'message', label: '消息', icon: MessageCircle },
  { key: 'profile', label: '我的', icon: User },
];

// Screen 到 Tab 的映射
const screenToTabMap: Record<string, TabName> = {
  home: 'home',
  community: 'community',
  message: 'message',
  profile: 'profile',
};

// 主屏幕（有底部导航）
const tabRootScreens: ScreenName[] = ['home', 'community', 'message', 'profile'];

// 居民端：药箱 / 社区 / 消息 / 我的
function ResidentApp() {
  const { state, dispatch } = useApp();

  const handleTabChange = useCallback((tab: TabName) => {
    dispatch({ type: 'SET_TAB', tab });
  }, [dispatch]);

  const showNav = tabRootScreens.includes(state.currentScreen);
  const activeTab = screenToTabMap[state.currentScreen] ?? state.activeTab;
  const unread = unreadCount(state.messages);

  const renderScreen = () => {
    switch (state.currentScreen) {
      case 'home':
        return <HomeScreen />;
      case 'scan':
        return <ScanScreen />;
      case 'symptom':
        return <SymptomScreen />;
      case 'expiry':
        return <ExpiryScreen />;
      case 'publicMedicine':
        return <PublicMedicineScreen />;
      case 'community':
        return <CommunityScreen />;
      case 'postHelp':
        return <PostHelpScreen />;
      case 'shareSettings':
        return <ShareSettingsScreen />;
      case 'message':
        return <MessageScreen />;
      case 'profile':
        return <ProfileScreen />;
      case 'privacy':
        return <PrivacyScreen />;
      case 'medicineDetail':
        return <MedicineDetailScreen />;
      case 'addMedicine':
        return <AddMedicineScreen />;
      case 'chat':
        return <ChatScreen />;
      case 'transaction':
        return <TransactionScreen />;
      case 'consult':
        return <ConsultScreen />;
      case 'healthProfile':
        return <HealthProfileScreen />;
      case 'points':
        return <PointsScreen />;
      case 'credit':
        return <CreditScreen />;
      case 'report':
        return <ReportScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <>
      {renderScreen()}
      {showNav && (
        <nav className="bottom-nav">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
              >
                <div className="nav-icon-wrapper">
                  <tab.icon
                    className={`nav-icon ${isActive ? 'nav-icon-active' : ''}`}
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  {tab.key === 'message' && unread > 0 && (
                    <span className="nav-badge">{unread}</span>
                  )}
                </div>
                <span className={`nav-label ${isActive ? 'nav-label-active' : ''}`}>
                  {tab.label}
                </span>
                {isActive && <span className="nav-indicator" />}
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

function AppContent() {
  const { state, dispatch } = useApp();

  // 自动隐藏 Toast
  useEffect(() => {
    if (state.toast?.visible) {
      const timer = setTimeout(() => {
        dispatch({ type: 'HIDE_TOAST' });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.toast, dispatch]);

  const role = state.user?.role ?? 'user';

  // 按角色渲染三套完全独立的界面（信息架构、导航、功能均不同）
  let body;
  if (state.currentScreen === 'splash') {
    body = <SplashScreen />;
  } else if (!state.user || state.currentScreen === 'login') {
    body = <AuthScreen />;
  } else if (role === 'doctor') {
    body = <DoctorApp />;
  } else if (role === 'admin') {
    body = <AdminApp />;
  } else {
    body = <ResidentApp />;
  }

  return (
    <div className="app-container">
      <div className="app-content">{body}</div>

      {state.toast?.visible && (
        <div className="toast-container">
          <div className="toast-message">{state.toast.message}</div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
