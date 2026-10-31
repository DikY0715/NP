import { useState } from 'react';
import { useApp, getExpiryLabel, getStatusColor } from '@/context/AppContext';
import { Search, ScanLine, Stethoscope, Clock, Users, Plus, ChevronRight, Pill, MapPin } from 'lucide-react';
import type { Medicine } from '@/types';

function MedicineCard({ medicine }: { medicine: Medicine }) {
  const { dispatch } = useApp();
  const statusLabel = getExpiryLabel(medicine.status, medicine.expiryDate);
  const statusClass = getStatusColor(medicine.status);

  return (
    <div 
      onClick={() => {
        dispatch({ type: 'SELECT_MEDICINE', id: medicine.id });
        dispatch({ type: 'NAVIGATE', screen: 'medicineDetail' });
      }}
      className="bg-white rounded-2xl p-4 shadow-sm border border-orange-50 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="flex items-center gap-3">
        {/* Medicine Image or Icon */}
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center shrink-0 overflow-hidden">
          {medicine.images && medicine.images.length > 0 ? (
            <img src={medicine.images[0]} alt={medicine.name} className="w-full h-full object-cover" />
          ) : (
            <Pill className="w-7 h-7 text-orange-500" />
          )}
        </div>
        
        {/* Medicine Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-gray-800 truncate">{medicine.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusClass}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-1.5">{medicine.spec}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {medicine.symptoms.slice(0, 3).map(s => (
              <span key={s} className="text-xs px-2 py-0.5 bg-orange-50 text-orange-600 rounded-md">
                {s}
              </span>
            ))}
          </div>
        </div>
        
        {/* Quantity only */}
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">剩余{medicine.quantity}{medicine.unit}</p>
        </div>
      </div>
    </div>
  );
}

export default function HomeScreen() {
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [demoLoc, setDemoLoc] = useState(false);

  const locate = () => {
    setDemoLoc(true);
  };

  const filteredMedicines = searchQuery
    ? state.medicines.filter(m => 
        m.name.includes(searchQuery) || 
        m.symptoms.some(s => s.includes(searchQuery))
      )
    : state.medicines;

  const totalCount = state.medicines.length;
  const expiringCount = state.medicines.filter(m => m.status === 'expiring').length;
  const expiredCount = state.medicines.filter(m => m.status === 'expired').length;

  const quickActions = [
    { icon: ScanLine, label: 'AI 识药', color: 'from-orange-400 to-orange-500', screen: 'scan' as const },
    { icon: Stethoscope, label: '症状查药', color: 'from-emerald-400 to-emerald-500', screen: 'symptom' as const },
    { icon: Clock, label: '过期提醒', color: 'from-red-400 to-red-500', screen: 'expiry' as const },
    { icon: Users, label: '公共药品', color: 'from-sky-400 to-sky-500', screen: 'publicMedicine' as const },
  ];

  return (
    <div className="flex flex-col h-full w-full" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-gradient-to-b from-orange-50 to-transparent px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-gray-500">{state.user?.community || '阳光花园'}</p>
                <button onClick={locate} className="w-4 h-4 flex items-center justify-center">
                  <MapPin className={`w-3 h-3 ${demoLoc ? 'text-emerald-500' : 'text-orange-500'}`} />
                </button>
              </div>
              <p className="text-sm font-medium text-gray-800">{state.user?.building || '3栋2单元'}</p>
              {demoLoc && <p className="text-[10px] text-emerald-600">目前此定位为演示定位</p>}
            </div>
          </div>

        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索药品名称或症状..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => dispatch({ type: 'NAVIGATE', screen: action.screen })}
              className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-md`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-gray-600 font-medium">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Stats Card */}
        <div className="bg-gradient-to-r from-orange-400 to-amber-500 rounded-2xl p-4 text-white shadow-lg shadow-orange-200">
          <div className="grid grid-cols-3 divide-x divide-white/20">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-xs text-white/80 mt-0.5">药品总数</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{expiringCount}</p>
              <p className="text-xs text-white/80 mt-0.5">即将过期</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{expiredCount}</p>
              <p className="text-xs text-white/80 mt-0.5">已过期</p>
            </div>
          </div>
        </div>

        {/* 在线问诊入口 */}
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'consult' })}
          className="mt-3 w-full bg-white rounded-2xl p-3.5 shadow-sm border border-orange-50 flex items-center gap-3 active:scale-[0.99] transition-transform"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-gray-800">在线问诊</p>
            <p className="text-xs text-gray-400">向社区医生咨询用药问题</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {/* Medicine List */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">我的药品</h2>
          <button className="flex items-center gap-0.5 text-xs text-orange-500">
            查看全部 <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        
        <div className="space-y-3">
          {filteredMedicines.map((medicine) => (
            <MedicineCard key={medicine.id} medicine={medicine} />
          ))}
        </div>

        {filteredMedicines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <img src="/images/empty-medicine.png" alt="暂无药品" className="w-24 h-24 mb-4 opacity-60" />
            <p className="text-sm text-gray-400">暂无药品，点击 AI 识药录入</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="absolute bottom-20 right-4 z-30">
        {showFabMenu && (
          <div className="absolute bottom-16 right-0 space-y-2">
            <button
              onClick={() => {
                setShowFabMenu(false);
                dispatch({ type: 'NAVIGATE', screen: 'scan' });
              }}
              className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-lg border border-orange-100 text-sm text-gray-700 whitespace-nowrap"
            >
              <ScanLine className="w-4 h-4 text-orange-500" />
              AI 识药录入
            </button>
            <button
              onClick={() => {
                setShowFabMenu(false);
                dispatch({ type: 'NAVIGATE', screen: 'addMedicine' });
              }}
              className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 shadow-lg border border-orange-100 text-sm text-gray-700 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-orange-500" />
              手动录入
            </button>
          </div>
        )}
        <button
          onClick={() => setShowFabMenu(!showFabMenu)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-lg shadow-orange-300 flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus className={`w-6 h-6 transition-transform ${showFabMenu ? 'rotate-45' : ''}`} />
        </button>
      </div>
    </div>
  );
}
