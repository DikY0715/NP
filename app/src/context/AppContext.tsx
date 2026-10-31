import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import type {
  ScreenName,
  TabName,
  Medicine,
  HelpPost,
  Message,
  CommunityMedicine,
  Transaction,
  User,
  Visibility,
  ShareMode,
  ShareScope,
  ExpiryStatus
} from '@/types';
import { api, getToken, setToken, clearToken, ApiError } from '@/lib/api';
import { pushNotification, notifEnabled, ensureNotificationPermission } from '@/lib/notifications';

// Tab 到 Screen 的映射
const tabScreenMap: Record<TabName, ScreenName> = {
  home: 'home',
  community: 'community',
  message: 'message',
  profile: 'profile',
};

// 各角色登录后的落地屏
export function landingScreenForRole(role: User['role']): ScreenName {
  if (role === 'doctor') return 'doctorReview';
  if (role === 'admin') return 'adminHome';
  return 'home';
}

// State 接口
interface AppState {
  currentScreen: ScreenName;
  activeTab: TabName;
  previousScreen: ScreenName | null;
  /** 当前登录用户；null 表示未登录 */
  user: User | null;
  /** 是否已完成首次登录态检查（避免闪现错误页面） */
  authReady: boolean;
  medicines: Medicine[];
  helpPosts: HelpPost[];
  /** 我发布的求助（用于个人中心统计） */
  myHelpPosts: HelpPost[];
  communityMedicines: CommunityMedicine[];
  messages: Message[];
  transactions: Transaction[];
  selectedMedicineId: string | null;
  /** 管理员出货页进入时默认选中的 tab */
  adminDispatchTab: 'pending' | 'verify' | 'approved' | 'completed';
  toast: { message: string; visible: boolean } | null;
}

type DataPatch = Partial<
  Pick<
    AppState,
    'medicines' | 'helpPosts' | 'myHelpPosts' | 'communityMedicines' | 'messages' | 'transactions'
  >
>;

// Action 类型
type AppAction =
  | { type: 'NAVIGATE'; screen: ScreenName }
  | { type: 'GO_BACK' }
  | { type: 'SET_TAB'; tab: TabName }
  | { type: 'SET_USER'; user: User | null }
  | { type: 'SET_AUTH_READY'; ready: boolean }
  | { type: 'LOAD_DATA'; data: DataPatch }
  | { type: 'RESET' }
  | { type: 'ADD_MEDICINE'; medicine: Medicine }
  | { type: 'UPDATE_MEDICINE'; id: string; updates: Partial<Medicine> }
  | { type: 'DELETE_MEDICINE'; id: string }
  | { type: 'SELECT_MEDICINE'; id: string | null }
  | { type: 'SET_ADMIN_DISPATCH_TAB'; tab: AppState['adminDispatchTab'] }
  | { type: 'ADD_HELP_POST'; post: HelpPost }
  | { type: 'RESPONSE_HELP'; postId: string }
  | { type: 'MARK_MESSAGE_READ'; id: string }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'HIDE_TOAST' };

// 初始状态
const initialState: AppState = {
  currentScreen: 'splash',
  activeTab: 'home',
  previousScreen: null,
  user: null,
  authReady: false,
  medicines: [],
  helpPosts: [],
  myHelpPosts: [],
  communityMedicines: [],
  messages: [],
  transactions: [],
  selectedMedicineId: null,
  adminDispatchTab: 'verify',
  toast: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return {
        ...state,
        previousScreen: state.currentScreen,
        currentScreen: action.screen,
      };
    case 'GO_BACK':
      return {
        ...state,
        currentScreen: state.previousScreen ?? tabScreenMap[state.activeTab],
        previousScreen: null,
      };
    case 'SET_TAB':
      return {
        ...state,
        activeTab: action.tab,
        currentScreen: tabScreenMap[action.tab],
        previousScreen: null,
      };
    case 'SET_USER':
      return { ...state, user: action.user };
    case 'SET_AUTH_READY':
      return { ...state, authReady: action.ready };
    case 'LOAD_DATA':
      return { ...state, ...action.data };
    case 'RESET':
      return { ...initialState, authReady: true };
    case 'ADD_MEDICINE':
      return { ...state, medicines: [action.medicine, ...state.medicines] };
    case 'UPDATE_MEDICINE':
      return {
        ...state,
        medicines: state.medicines.map(m =>
          m.id === action.id ? { ...m, ...action.updates } : m
        ),
      };
    case 'DELETE_MEDICINE':
      return { ...state, medicines: state.medicines.filter(m => m.id !== action.id) };
    case 'SELECT_MEDICINE':
      return { ...state, selectedMedicineId: action.id };
    case 'SET_ADMIN_DISPATCH_TAB':
      return { ...state, adminDispatchTab: action.tab };
    case 'ADD_HELP_POST':
      return {
        ...state,
        myHelpPosts: [action.post, ...state.myHelpPosts],
      };
    case 'RESPONSE_HELP':
      return {
        ...state,
        helpPosts: state.helpPosts.map(p =>
          p.id === action.postId ? { ...p, responses: p.responses + 1 } : p
        ),
      };
    case 'MARK_MESSAGE_READ':
      return {
        ...state,
        messages: state.messages.map(m =>
          m.id === action.id ? { ...m, read: true } : m
        ),
      };
    case 'SHOW_TOAST':
      return { ...state, toast: { message: action.message, visible: true } };
    case 'HIDE_TOAST':
      return { ...state, toast: null };
    default:
      return state;
  }
}

// 业务动作
export type MedicineInput = Partial<Omit<Medicine, 'id'>>;
export interface HelpPostInput {
  content: string;
  symptoms: string[];
  neededMedicines: string[];
  scope: ShareScope;
  urgency: 'normal' | 'urgent';
}
export interface RegisterInput {
  phone: string;
  code: string;
  password: string;
  name: string;
  building: string;
  community: string;
}

export interface AppActions {
  login: (username: string, password: string) => Promise<void>;
  register: (payload: RegisterInput) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  loadCommunity: (scope: ShareScope) => Promise<void>;
  addMedicine: (input: MedicineInput) => Promise<void>;
  updateMedicine: (id: string, updates: Partial<Medicine>) => Promise<void>;
  deleteMedicine: (id: string) => Promise<void>;
  addHelpPost: (input: HelpPostInput) => Promise<void>;
  respondHelp: (postId: string, message?: string) => Promise<void>;
  borrowMedicine: (medicineId: string, quantity: number, note?: string) => Promise<void>;
  markMessageRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  updateProfile: (updates: {
    name?: string;
    avatar?: string;
    phone?: string;
    building?: string;
    community?: string;
  }) => Promise<void>;
  showToast: (message: string) => void;
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: AppActions;
}

const AppContext = createContext<AppContextType | null>(null);

// Provider 组件
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 拉取全部业务数据
  const loadAll = useCallback(async (scope: ShareScope = 'community') => {
    const [medicines, helpPosts, myHelpPosts, communityMedicines, messages, transactions] =
      await Promise.all([
        api.listMedicines(),
        api.helps(),
        api.myHelps(),
        api.communityMedicines(scope),
        api.listMessages(),
        api.listTransactions(),
      ]);
    dispatch({
      type: 'LOAD_DATA',
      data: { medicines, helpPosts, myHelpPosts, communityMedicines, messages, transactions },
    });
  }, []);

  // 首次加载：有令牌则恢复登录态并拉取数据
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        dispatch({ type: 'SET_AUTH_READY', ready: true });
        return;
      }
      try {
        const user = await api.me();
        if (cancelled) return;
        dispatch({ type: 'SET_USER', user });
        // 仅居民端需要加载药箱/社区/消息等居民数据
        if ((user.role ?? 'user') === 'user') {
          await loadAll();
        }
      } catch {
        clearToken();
      } finally {
        if (!cancelled) dispatch({ type: 'SET_AUTH_READY', ready: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  // 首次登录后（居民端）申请系统通知权限（静默，不弹权限框的浏览器会忽略）
  useEffect(() => {
    if ((state.user?.role ?? 'user') === 'user') {
      void ensureNotificationPermission();
    }
  }, [state.user?.role]);

  // 系统通知轮询：居民端定时拉取消息/药品，检测新借药消息与临近过期药品
  const seenMsgIds = useRef<Set<string>>(new Set());
  const seenExpiringIds = useRef<Set<string>>(new Set());
  const notifInitialized = useRef(false);

  useEffect(() => {
    const role = state.user?.role ?? 'user';
    if (!state.user || role !== 'user') return;
    let cancelled = false;

    const tick = async () => {
      try {
        const [messages, medicines] = await Promise.all([
          api.listMessages(),
          api.listMedicines(),
        ]);
        if (cancelled) return;

        // 借药提醒：出现新的「借药申请/审核」未读消息
        if (notifEnabled('borrow')) {
          for (const m of messages) {
            if (m.type === 'borrow_request' && !m.read && !seenMsgIds.current.has(m.id)) {
              if (notifInitialized.current) {
                pushNotification('borrow', '借药提醒', m.title || '您有新的借药消息');
              }
            }
            seenMsgIds.current.add(m.id);
          }
        }

        // 过期提醒：出现新进入「即将过期/已过期」状态的药品
        if (notifEnabled('expiry')) {
          for (const med of medicines) {
            if (med.status === 'expiring' || med.status === 'expired') {
              if (!seenExpiringIds.current.has(med.id) && notifInitialized.current) {
                pushNotification(
                  'expiry',
                  '过期提醒',
                  `「${med.name}」${med.status === 'expired' ? '已过期' : '即将过期'}`,
                );
              }
              seenExpiringIds.current.add(med.id);
            }
          }
        }

        notifInitialized.current = true;
      } catch {
        // 轮询失败静默处理，避免打扰用户
      }
    };

    const timer = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.user?.role]);

  const showToast = useCallback((message: string) => {
    dispatch({ type: 'SHOW_TOAST', message });
  }, []);

  // 统一错误提示
  const fail = useCallback(
    (err: unknown, fallback: string) => {
      const message =
        err instanceof ApiError || err instanceof Error ? err.message : fallback;
      dispatch({ type: 'SHOW_TOAST', message });
    },
    [],
  );

  const actions = useMemo<AppActions>(() => {
    const login = async (username: string, password: string) => {
      const { token, user } = await api.login(username, password);
      setToken(token);
      dispatch({ type: 'SET_USER', user });
      if ((user.role ?? 'user') === 'user') {
        await loadAll();
        dispatch({ type: 'SET_TAB', tab: 'home' });
      }
      // 按角色进入各自独立的工作台
      dispatch({ type: 'NAVIGATE', screen: landingScreenForRole(user.role) });
    };

    const register = async (payload: RegisterInput) => {
      const { token, user } = await api.register(payload);
      setToken(token);
      dispatch({ type: 'SET_USER', user });
      await loadAll();
      dispatch({ type: 'SET_TAB', tab: 'home' });
      dispatch({ type: 'NAVIGATE', screen: 'home' });
    };

    const logout = () => {
      clearToken();
      dispatch({ type: 'RESET' });
      dispatch({ type: 'NAVIGATE', screen: 'login' });
    };

    return {
      login,
      register,
      logout,
      refresh: () => loadAll(),
      loadCommunity: async (scope: ShareScope) => {
        const communityMedicines = await api.communityMedicines(scope);
        dispatch({ type: 'LOAD_DATA', data: { communityMedicines } });
      },
      addMedicine: async (input: MedicineInput) => {
        const created = await api.createMedicine(input);
        dispatch({ type: 'ADD_MEDICINE', medicine: created });
      },
      updateMedicine: async (id: string, updates: Partial<Medicine>) => {
        const updated = await api.updateMedicine(id, updates);
        dispatch({ type: 'UPDATE_MEDICINE', id, updates: updated });
      },
      deleteMedicine: async (id: string) => {
        await api.deleteMedicine(id);
        dispatch({ type: 'DELETE_MEDICINE', id });
      },
      addHelpPost: async (input: HelpPostInput) => {
        const post = await api.createHelp(input);
        dispatch({ type: 'ADD_HELP_POST', post });
      },
      respondHelp: async (postId: string, message = '') => {
        await api.respondHelp(postId, message);
        dispatch({ type: 'RESPONSE_HELP', postId });
      },
      borrowMedicine: async (medicineId: string, quantity: number, note = '') => {
        await api.createBorrow(medicineId, quantity, note);
        await loadAll();
      },
      markMessageRead: async (id: string) => {
        dispatch({ type: 'MARK_MESSAGE_READ', id });
        try {
          await api.markMessageRead(id);
        } catch {
          // 已读失败不影响本地展示
        }
      },
      markAllRead: async () => {
        await api.markAllRead();
        await loadAll();
      },
      updateProfile: async (updates) => {
        const user = await api.updateMe(updates);
        dispatch({ type: 'SET_USER', user });
      },
      showToast,
    };
  }, [loadAll, showToast]);

  // 包装器：捕获异步动作异常并提示
  const wrappedActions = useMemo<AppActions>(() => {
    const wrap = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, fallback: string) =>
      async (...args: A): Promise<void> => {
        try {
          await fn(...args);
        } catch (err) {
          fail(err, fallback);
        }
      };
    return {
      ...actions,
      login: wrap(actions.login, '登录失败'),
      register: wrap(actions.register, '注册失败'),
      loadCommunity: wrap(actions.loadCommunity, '加载社区药品失败'),
      addMedicine: wrap(actions.addMedicine, '药品录入失败'),
      updateMedicine: wrap(actions.updateMedicine, '更新失败'),
      deleteMedicine: wrap(actions.deleteMedicine, '删除失败'),
      addHelpPost: wrap(actions.addHelpPost, '发布求助失败'),
      respondHelp: wrap(actions.respondHelp, '回应失败'),
      borrowMedicine: wrap(actions.borrowMedicine, '借药申请失败'),
      markAllRead: wrap(actions.markAllRead, '操作失败'),
      updateProfile: wrap(actions.updateProfile, '保存失败'),
    };
  }, [actions, fail]);

  const value = useMemo(
    () => ({ state, dispatch, actions: wrappedActions }),
    [state, wrappedActions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// 工具函数
export function getExpiryStatus(expiryDate: string): ExpiryStatus {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring';
  return 'normal';
}

export function getExpiryLabel(status: ExpiryStatus, expiryDate: string): string {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  switch (status) {
    case 'expired':
      return '已过期';
    case 'expiring':
      return diffDays <= 0 ? '今天过期' : `还有${diffDays}天`;
    default:
      return expiryDate.slice(0, 7).replace('-', '.');
  }
}

export function getStatusColor(status: ExpiryStatus): string {
  switch (status) {
    case 'expired':
      return 'text-red-500 bg-red-50';
    case 'expiring':
      return 'text-amber-600 bg-amber-50';
    default:
      return 'text-emerald-600 bg-emerald-50';
  }
}

export function getVisibilityLabel(v: Visibility): string {
  switch (v) {
    case 'public': return '公开';
    case 'private': return '仅自己';
    case 'emergency': return '紧急时可见';
  }
}

export function getShareModeLabel(m: ShareMode): string {
  switch (m) {
    case 'free': return '免费赠送';
    case 'priced': return '按粒计价';
    case 'none': return '暂不共享';
  }
}

export function getScopeLabel(s: ShareScope): string {
  switch (s) {
    case 'building': return '本楼栋';
    case 'community': return '本小区';
  }
}

export const unreadCount = (messages: Message[]): number => 
  messages.filter(m => !m.read).length;
