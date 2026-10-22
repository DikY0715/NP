import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ChevronLeft, Eye, EyeOff, Heart, Ban, Building, Users, ToggleLeft, ToggleRight } from 'lucide-react';
import type { Visibility, ShareMode, ShareScope } from '@/types';

export default function PrivacyScreen() {
  const { dispatch } = useApp();
  
  const [defaultVisibility, setDefaultVisibility] = useState<Visibility>('public');
  const [defaultShareMode, setDefaultShareMode] = useState<ShareMode>('free');
  const [defaultScope, setDefaultScope] = useState<ShareScope>('building');
  const [profileVisible, setProfileVisible] = useState(true);

  const visibilityOptions: { key: Visibility; label: string; desc: string; icon: typeof Eye }[] = [
    { key: 'public', label: '公开', desc: '社区可见，可借', icon: Eye },
    { key: 'private', label: '仅家人', desc: '仅自己管理', icon: EyeOff },
    { key: 'emergency', label: '紧急时可见', desc: '平时隐藏，求助时匹配', icon: Heart },
  ];

  const shareModeOptions: { key: ShareMode; label: string; desc: string; icon: typeof Heart }[] = [
    { key: 'free', label: '免费赠送', desc: '邻里人情，免费共享', icon: Heart },
    { key: 'none', label: '暂不共享', desc: '仅自己使用', icon: Ban },
  ];

  const scopeOptions: { key: ShareScope; label: string; icon: typeof Building }[] = [
    { key: 'building', label: '本楼栋', icon: Building },
    { key: 'community', label: '本小区', icon: Users },
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
        <h1 className="text-lg font-semibold text-gray-800">隐私设置</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
        {/* Default Visibility */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">默认药品可见性</label>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {visibilityOptions.map((opt, index) => (
              <button
                key={opt.key}
                onClick={() => setDefaultVisibility(opt.key)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-orange-50 transition-colors ${
                  index < visibilityOptions.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  defaultVisibility === opt.key ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <opt.icon className={`w-4.5 h-4.5 ${defaultVisibility === opt.key ? 'text-orange-500' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${defaultVisibility === opt.key ? 'text-orange-700' : 'text-gray-800'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
                {defaultVisibility === opt.key && (
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

        {/* Default Share Mode */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">默认共享方式</label>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {shareModeOptions.map((opt, index) => (
              <button
                key={opt.key}
                onClick={() => setDefaultShareMode(opt.key)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-orange-50 transition-colors ${
                  index < shareModeOptions.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  defaultShareMode === opt.key ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <opt.icon className={`w-4.5 h-4.5 ${defaultShareMode === opt.key ? 'text-orange-500' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${defaultShareMode === opt.key ? 'text-orange-700' : 'text-gray-800'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500">{opt.desc}</p>
                </div>
                {defaultShareMode === opt.key && (
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

        {/* Default Scope */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-3 block">默认共享范围</label>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {scopeOptions.map((opt, index) => (
              <button
                key={opt.key}
                onClick={() => setDefaultScope(opt.key)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-orange-50 transition-colors ${
                  index < scopeOptions.length - 1 ? 'border-b border-gray-50' : ''
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  defaultScope === opt.key ? 'bg-orange-100' : 'bg-gray-100'
                }`}>
                  <opt.icon className={`w-4.5 h-4.5 ${defaultScope === opt.key ? 'text-orange-500' : 'text-gray-500'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${defaultScope === opt.key ? 'text-orange-700' : 'text-gray-800'}`}>
                    {opt.label}
                  </p>
                </div>
                {defaultScope === opt.key && (
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

        {/* Profile Visibility Toggle */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">个人资料可见</p>
              <p className="text-xs text-gray-500 mt-0.5">昵称、头像对他人可见</p>
            </div>
            <button
              onClick={() => setProfileVisible(!profileVisible)}
              className="relative"
            >
              {profileVisible ? (
                <ToggleRight className="w-12 h-7 text-orange-500" />
              ) : (
                <ToggleLeft className="w-12 h-7 text-gray-300" />
              )}
            </button>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-blue-600 leading-relaxed">
            药品隐藏功能可保护您的隐私。贵重药品或隐私药品可设置为"仅家人可见"。设置为"紧急时可见"的药品平时不会出现在共享列表中，仅在他人发布求助时自动匹配。
          </p>
        </div>
      </div>
    </div>
  );
}
