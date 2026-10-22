import { useState } from 'react';
import { useApp, getExpiryLabel, getStatusColor } from '@/context/AppContext';
import { ChevronLeft, Pill, Trash2, CheckCircle2 } from 'lucide-react';
// ExpiryStatus type used implicitly via getStatusColor

type FilterType = 'all' | 'expiring' | 'expired';

export default function ExpiryScreen() {
  const { state, dispatch, actions } = useApp();
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredMedicines = state.medicines.filter(m => {
    if (filter === 'all') return m.status !== 'normal';
    return m.status === filter;
  });

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'expiring', label: '即将过期' },
    { key: 'expired', label: '已过期' },
  ];

  const handleDismiss = async (id: string) => {
    await actions.deleteMedicine(id);
    dispatch({ type: 'SHOW_TOAST', message: '已标记为处理' });
  };

  return (
    <div className="flex flex-col h-full bg-orange-50/50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <button 
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">过期提醒</h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        <div className="space-y-3">
          {filteredMedicines.map(medicine => (
            <ExpiryCard 
              key={medicine.id} 
              medicine={medicine} 
              onDismiss={() => handleDismiss(medicine.id)}
            />
          ))}
        </div>

        {filteredMedicines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-sm text-gray-500">太棒了！没有过期药品</p>
            <p className="text-xs text-gray-400 mt-1">定期检查，保持健康</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpiryCard({ 
  medicine, 
  onDismiss 
}: { 
  medicine: import('@/types').Medicine; 
  onDismiss: () => void;
}) {
  const label = getExpiryLabel(medicine.status, medicine.expiryDate);
  const borderColor = medicine.status === 'expired' ? 'border-l-red-400' : 'border-l-amber-400';
  const bgColor = medicine.status === 'expired' ? 'bg-red-50' : 'bg-amber-50';

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-4 ${borderColor} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center shrink-0`}>
          <Pill className={`w-6 h-6 ${medicine.status === 'expired' ? 'text-red-500' : 'text-amber-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-800 text-sm">{medicine.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(medicine.status)}`}>
              {label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2">{medicine.spec}</p>
          <p className="text-xs text-gray-400">
            保质期至 {medicine.expiryDate}
          </p>
          
          {medicine.status === 'expired' && (
            <div className="mt-2 flex items-center gap-2">
              <button 
                onClick={onDismiss}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium active:scale-95 transition-transform"
              >
                <Trash2 className="w-3 h-3" />
                标记为已处理
              </button>
            </div>
          )}
          
          {medicine.status === 'expiring' && (
            <div className="mt-2">
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                建议优先使用
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
