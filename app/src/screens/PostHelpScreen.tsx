import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { ChevronLeft, Send } from 'lucide-react';
import type { ShareScope } from '@/types';

const COMMON_MEDICINES = ['布洛芬', '感冒清热颗粒', '阿莫西林', '蒙脱石散', '创可贴', '退烧药', '止咳糖浆'];

export default function PostHelpScreen() {
  const { dispatch, actions } = useApp();
  const [symptom, setSymptom] = useState('');
  const [neededMedicine, setNeededMedicine] = useState('');
  const [urgency, setUrgency] = useState<'normal' | 'urgent'>('normal');
  const [scope, setScope] = useState<ShareScope>('building');

  const canSubmit = symptom.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    await actions.addHelpPost({
      content: symptom,
      symptoms: [symptom.slice(0, 10)],
      neededMedicines: neededMedicine ? [neededMedicine] : [],
      scope,
      urgency,
    });
    dispatch({ type: 'SHOW_TOAST', message: '求助发布成功！' });
    dispatch({ type: 'GO_BACK' });
  };

  return (
    <div className="flex flex-col h-full bg-orange-50/50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">发布求助</h1>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            canSubmit
              ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          <Send className="w-4 h-4" />
          发布
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
        {/* Symptom Description */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">症状描述</label>
          <textarea
            value={symptom}
            onChange={(e) => setSymptom(e.target.value)}
            placeholder="描述一下症状，如：孩子半夜发烧了，体温38.5度..."
            className="w-full h-28 p-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
          />
        </div>

        {/* Needed Medicine */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">所需药品</label>
          <input
            type="text"
            value={neededMedicine}
            onChange={(e) => setNeededMedicine(e.target.value)}
            placeholder="输入药品名称..."
            className="w-full h-12 px-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {COMMON_MEDICINES.map(med => (
              <button
                key={med}
                onClick={() => setNeededMedicine(med)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  neededMedicine === med
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 border border-orange-100'
                }`}
              >
                {med}
              </button>
            ))}
          </div>
        </div>

        {/* Urgency */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">紧急程度</label>
          <div className="flex gap-3">
            <button
              onClick={() => setUrgency('normal')}
              className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                urgency === 'normal'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-600 border border-orange-100'
              }`}
            >
              普通
            </button>
            <button
              onClick={() => setUrgency('urgent')}
              className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                urgency === 'urgent'
                  ? 'bg-red-500 text-white'
                  : 'bg-white text-gray-600 border border-orange-100'
              }`}
            >
              紧急
            </button>
          </div>
        </div>

        {/* Scope */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">求助范围</label>
          <div className="flex gap-3">
            {(['building', 'community'] as ShareScope[]).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`flex-1 h-12 rounded-xl text-sm font-medium transition-colors ${
                  scope === s
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 border border-orange-100'
                }`}
              >
                {s === 'building' ? '本楼栋' : '本小区'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
