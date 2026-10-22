import { useState, useMemo } from 'react';
import { useApp, getStatusColor } from '@/context/AppContext';
import { ChevronLeft, Search, Pill, MapPin } from 'lucide-react';

const HOT_SYMPTOMS = ['发烧', '头痛', '肚子疼', '感冒', '咳嗽', '皮肤过敏', '牙痛', '腹泻', '中暑'];

export default function SymptomScreen() {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim();
    return state.medicines.filter(m => 
      m.symptoms.some(s => s.includes(q)) || 
      m.name.includes(q)
    );
  }, [query, state.medicines]);

  const hasResults = results.length > 0;
  const noMedicines = state.medicines.length === 0;

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
          <h1 className="text-lg font-semibold text-gray-800">症状查药</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="输入症状，如：肚子疼、发烧..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-12 pl-10 pr-4 rounded-xl bg-orange-50 border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            autoFocus
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {/* Hot Symptoms */}
        {!query && (
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">常见症状</h2>
            <div className="flex flex-wrap gap-2">
              {HOT_SYMPTOMS.map(symptom => (
                <button
                  key={symptom}
                  onClick={() => setQuery(symptom)}
                  className="px-4 py-2 bg-white rounded-xl text-sm text-gray-700 border border-orange-100 active:scale-95 transition-transform shadow-sm"
                >
                  {symptom}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results */}
        {query && (
          <div>
            {hasResults ? (
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  家里有 <span className="text-orange-500 font-semibold">{results.length}</span> 种药品可能适用
                </p>
                <div className="space-y-3">
                  {results.map(medicine => (
                    <div 
                      key={medicine.id}
                      className="bg-white rounded-2xl p-4 shadow-sm border border-orange-50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                          <Pill className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-800">{medicine.name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(medicine.status)}`}>
                              {medicine.status === 'expired' ? '已过期' : medicine.status === 'expiring' ? '即将过期' : '正常'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">{medicine.spec}</p>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            {medicine.symptoms.filter(s => s.includes(query) || query.includes(s)).map(s => (
                              <span key={s} className="px-2 py-0.5 bg-green-50 text-green-600 rounded-md text-xs">
                                {s}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-400">
                              剩余 {medicine.quantity} {medicine.unit}
                            </span>
                            <span className="text-sm font-semibold text-gray-700">
                              ¥{medicine.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <img src="/images/empty-medicine.png" alt="暂无药品" className="w-24 h-24 mb-4 opacity-50" />
                <p className="text-sm text-gray-500 mb-1">家里没有匹配的药品</p>
                <p className="text-xs text-gray-400 mb-4">可以试试去社区找找</p>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_TAB', tab: 'community' });
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-full text-sm font-medium shadow-md active:scale-95 transition-transform"
                >
                  <MapPin className="w-4 h-4" />
                  去社区看看
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State - No Medicines at all */}
        {noMedicines && !query && (
          <div className="flex flex-col items-center justify-center py-12">
            <img src="/images/empty-medicine.png" alt="暂无药品" className="w-24 h-24 mb-4 opacity-50" />
            <p className="text-sm text-gray-500">药箱是空的，先录入一些药品吧</p>
          </div>
        )}
      </div>
    </div>
  );
}
