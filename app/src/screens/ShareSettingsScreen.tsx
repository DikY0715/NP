import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ChevronLeft, Pill, Eye, EyeOff, Heart, Ban } from 'lucide-react';
import type { Visibility, ShareMode, ShareScope } from '@/types';

export default function ShareSettingsScreen() {
  const { state, dispatch, actions } = useApp();
  
  const medicine = state.medicines.find(m => m.id === state.selectedMedicineId);
  
  const [visibility, setVisibility] = useState<Visibility>(medicine?.visibility ?? 'public');
  const [shareMode, setShareMode] = useState<ShareMode>(medicine?.shareMode ?? 'free');
  const [shareScope, setShareScope] = useState<ShareScope>(medicine?.shareScope ?? 'building');

  if (!medicine) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">请选择药品</p>
      </div>
    );
  }

  const handleSave = async () => {
    await actions.updateMedicine(medicine.id, {
      visibility,
      shareMode,
      shareScope,
    });
    dispatch({ type: 'SHOW_TOAST', message: '共享设置已保存' });
    dispatch({ type: 'GO_BACK' });
  };

  const visibilityOptions: { key: Visibility; label: string; desc: string; icon: typeof Eye }[] = [
    { key: 'public', label: '公开', desc: '社区可见，可借', icon: Eye },
    { key: 'private', label: '仅家人', desc: '仅自己管理', icon: EyeOff },
    { key: 'emergency', label: '紧急时可见', desc: '平时隐藏，求助时匹配', icon: Heart },
  ];

  const shareModeOptions: { key: ShareMode; label: string; desc: string; icon: typeof Heart }[] = [
    { key: 'free', label: '免费赠送', desc: '邻里人情，免费共享', icon: Heart },
    { key: 'none', label: '暂不共享', desc: '仅自己使用', icon: Ban },
  ];

  const scopeOptions: { key: ShareScope; label: string }[] = [
    { key: 'building', label: '本楼栋' },
    { key: 'community', label: '本小区' },
  ];

  return (
    <div className="flex flex-col h-full bg-orange-50/50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm flex items-center gap-3">
        <button 
          onClick={() => dispatch({ type: 'GO_BACK' })}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">共享设置</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
        {/* Medicine Info */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center">
            <Pill className="w-7 h-7 text-orange-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{medicine.name}</h3>
            <p className="text-sm text-gray-500">{medicine.spec}</p>
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">可见性设置</label>
          <div className="space-y-2">
            {visibilityOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setVisibility(opt.key)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors ${
                  visibility === opt.key
                    ? 'bg-orange-50 border-2 border-orange-300'
                    : 'bg-white border-2 border-transparent'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  visibility === opt.key ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <opt.icon className={`w-5 h-5 ${visibility === opt.key ? 'text-orange-500' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${visibility === opt.key ? 'text-orange-700' : 'text-gray-800'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
                {visibility === opt.key && (
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Share Mode - only show if visibility is public */}
        {visibility === 'public' && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">共享方式</label>
            <div className="space-y-2">
              {shareModeOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setShareMode(opt.key)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors ${
                    shareMode === opt.key
                      ? 'bg-orange-50 border-2 border-orange-300'
                      : 'bg-white border-2 border-transparent'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    shareMode === opt.key ? 'bg-orange-100' : 'bg-gray-100'
                  }`}>
                    <opt.icon className={`w-5 h-5 ${shareMode === opt.key ? 'text-orange-500' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${shareMode === opt.key ? 'text-orange-700' : 'text-gray-800'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                  {shareMode === opt.key && (
                    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scope - only show if visibility is public */}
        {visibility === 'public' && (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">共享范围</label>
            <div className="flex gap-2">
              {scopeOptions.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setShareScope(opt.key)}
                  className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                    shareScope === opt.key
                      ? 'bg-orange-500 text-white'
                      : 'bg-white text-gray-600 border border-orange-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Privacy Note */}
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600 leading-relaxed">
            隐私说明：设置为"仅家人可见"的药品不会出现在社区共享列表中。贵重药品或隐私药品建议设置为"仅家人可见"或"紧急时可见"。
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="px-4 pb-6 pt-2 bg-white border-t border-gray-100">
        <button
          onClick={handleSave}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-orange-400 to-amber-500 text-white font-semibold shadow-lg shadow-orange-200 active:scale-[0.98] transition-transform"
        >
          保存设置
        </button>
      </div>
    </div>
  );
}
