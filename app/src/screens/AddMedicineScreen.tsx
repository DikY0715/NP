import { useState, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { ChevronLeft, Plus, Camera } from 'lucide-react';

const SYMPTOM_OPTIONS = ['发烧', '头痛', '牙痛', '感冒', '咳嗽', '腹泻', '肠胃不适', '消炎', '止痛', '外伤', '过敏', '中暑'];

export default function AddMedicineScreen() {
  const { dispatch, actions } = useApp();
  const [name, setName] = useState('');
  const [spec, setSpec] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('粒');
  const [dosage, setDosage] = useState('');
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isOtc, setIsOtc] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleAddCustomSymptom = () => {
    if (customSymptom.trim() && !selectedSymptoms.includes(customSymptom.trim())) {
      setSelectedSymptoms(prev => [...prev, customSymptom.trim()]);
      setCustomSymptom('');
    }
  };

  const handleImageSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setPreviewImages(prev => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (idx: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== idx));
  };

  const canSubmit = name.trim().length > 0 && spec.trim().length > 0 && expiryDate.length > 0 && quantity.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const allSymptoms = selectedSymptoms.length > 0 ? selectedSymptoms : ['其他'];

    await actions.addMedicine({
      name: name.trim(),
      spec: spec.trim(),
      symptoms: allSymptoms,
      expiryDate,
      price: 0,
      visibility: isOtc ? 'public' : 'private',
      shareMode: isOtc ? 'free' : 'none',
      shareScope: 'building',
      quantity: parseInt(quantity) || 0,
      unit,
      dosage: dosage.trim() || undefined,
      images: previewImages.length > 0 ? previewImages : undefined,
      isOtc,
    });
    dispatch({ type: 'SHOW_TOAST', message: '药品录入成功！' });
    dispatch({ type: 'SET_TAB', tab: 'home' });
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
          <h1 className="text-lg font-semibold text-gray-800">手动录入</h1>
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
          <Plus className="w-4 h-4" />
          保存
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
        {/* Medicine Images */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">药品图片</label>
          <div className="flex gap-2 flex-wrap">
            {previewImages.map((img, idx) => (
              <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden">
                <img src={img} alt="药品" className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full text-white text-xs flex items-center justify-center"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={handleImageSelect}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-orange-200 flex flex-col items-center justify-center gap-1 text-orange-400 active:bg-orange-50 transition-colors"
            >
              <Camera className="w-6 h-6" />
              <span className="text-xs">拍照</span>
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Medicine Name */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            药品名称 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：布洛芬缓释胶囊"
            className="w-full h-12 px-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        {/* Specification */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            规格 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="如：0.3g x 24粒"
            className="w-full h-12 px-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        {/* Symptoms - selectable tags + custom input */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">适用症状</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {SYMPTOM_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => toggleSymptom(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedSymptoms.includes(s)
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 border border-orange-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Custom symptom input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customSymptom}
              onChange={(e) => setCustomSymptom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSymptom()}
              placeholder="输入其他症状，按回车添加..."
              className="flex-1 h-10 px-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <button
              onClick={handleAddCustomSymptom}
              disabled={!customSymptom.trim()}
              className={`h-10 px-4 rounded-xl text-sm font-medium ${
                customSymptom.trim()
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              添加
            </button>
          </div>
          {selectedSymptoms.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedSymptoms.filter(s => !SYMPTOM_OPTIONS.includes(s)).map(s => (
                <span key={s} className="px-2 py-1 bg-orange-50 text-orange-600 rounded-md text-xs flex items-center gap-1">
                  {s}
                  <button onClick={() => toggleSymptom(s)} className="text-orange-400">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Dosage */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">药用量</label>
          <textarea
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="如：一次1粒，若持续疼痛每4-6小时一次..."
            className="w-full h-20 p-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
          />
        </div>

        {/* OTC */}
        <button
          type="button"
          onClick={() => setIsOtc((v) => !v)}
          className="w-full bg-white rounded-xl p-4 border border-orange-100 flex items-center justify-between text-left"
        >
          <div className="flex-1 pr-3">
            <p className="text-sm font-medium text-gray-700">非处方药（OTC）</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {isOtc ? '可共享给邻里使用' : '处方药不可共享，仅保存在家庭药箱'}
            </p>
          </div>
          <span
            className={`w-11 h-6 rounded-full shrink-0 relative transition-colors ${
              isOtc ? 'bg-orange-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                isOtc ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </span>
        </button>

        {/* Expiry Date */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            保质期 <span className="text-red-400">*</span>
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        {/* Quantity + Unit */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              数量 <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="如：24"
              className="w-full h-12 px-4 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>
          <div className="w-24">
            <label className="text-sm font-medium text-gray-700 mb-2 block">单位</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full h-12 px-3 rounded-xl bg-white border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="粒">粒</option>
              <option value="片">片</option>
              <option value="袋">袋</option>
              <option value="瓶">瓶</option>
              <option value="盒">盒</option>
              <option value="支">支</option>
              <option value="ml">ml</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
