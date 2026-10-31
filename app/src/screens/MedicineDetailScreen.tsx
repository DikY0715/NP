import { useState } from 'react';
import { useApp, getExpiryLabel, getStatusColor, getVisibilityLabel, getScopeLabel } from '@/context/AppContext';
import { api } from '@/lib/api';
import { ChevronLeft, Pill, Calendar, Eye, MapPin, Trash2, Edit3, Check, X, Camera, Send } from 'lucide-react';

export default function MedicineDetailScreen() {
  const { state, dispatch, actions } = useApp();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDropoff, setShowDropoff] = useState(false);
  const [dropoffQty, setDropoffQty] = useState(1);
  const [dropoffNote, setDropoffNote] = useState('');
  const [dropoffBusy, setDropoffBusy] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const medicine = state.medicines.find(m => m.id === state.selectedMedicineId);

  // Edit states
  const [editName, setEditName] = useState('');
  const [editSpec, setEditSpec] = useState('');
  const [editExpiry, setEditExpiry] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('粒');
  const [editDosage, setEditDosage] = useState('');
  const [editSymptoms, setEditSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);

  const startEditing = () => {
    if (!medicine) return;
    setEditName(medicine.name);
    setEditSpec(medicine.spec);
    setEditExpiry(medicine.expiryDate);
    setEditQuantity(medicine.quantity.toString());
    setEditUnit(medicine.unit);
    setEditDosage(medicine.dosage || '');
    setEditSymptoms([...medicine.symptoms]);
    setEditImages(medicine.images || []);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!medicine) return;
    await actions.updateMedicine(medicine.id, {
      name: editName.trim() || medicine.name,
      spec: editSpec.trim() || medicine.spec,
      expiryDate: editExpiry || medicine.expiryDate,

      quantity: parseInt(editQuantity) || medicine.quantity,
      unit: editUnit,
      dosage: editDosage.trim() || undefined,
      symptoms: editSymptoms.length > 0 ? editSymptoms : medicine.symptoms,
      images: editImages.length > 0 ? editImages : undefined,
    });
    setIsEditing(false);
    dispatch({ type: 'SHOW_TOAST', message: '药品信息已更新' });
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const toggleSymptom = (s: string) => {
    setEditSymptoms(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleAddCustomSymptom = () => {
    if (customSymptom.trim() && !editSymptoms.includes(customSymptom.trim())) {
      setEditSymptoms(prev => [...prev, customSymptom.trim()]);
      setCustomSymptom('');
    }
  };

  const handleImageSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (ev.target?.result) {
              setEditImages(prev => [...prev, ev.target!.result as string]);
            }
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
  };

  const removeImage = (idx: number) => {
    setEditImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDelete = async () => {
    if (!medicine) return;
    await actions.deleteMedicine(medicine.id);
    dispatch({ type: 'SHOW_TOAST', message: '药品已删除' });
    dispatch({ type: 'GO_BACK' });
  };

  const submitDropoff = async () => {
    if (!medicine) return;
    setDropoffBusy(true);
    try {
      await api.createDropoff(medicine.id, dropoffQty, dropoffNote.trim());
      await actions.refresh();
      setShowDropoff(false);
      dispatch({ type: 'SHOW_TOAST', message: '已登记投放，等待管理员实物核验' });
    } finally {
      setDropoffBusy(false);
    }
  };

  if (!medicine) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-orange-50/50">
        <p className="text-gray-500 mb-4">药品不存在</p>
        <button onClick={() => dispatch({ type: 'GO_BACK' })} className="px-6 py-2 bg-orange-500 text-white rounded-full text-sm">返回</button>
      </div>
    );
  }

  const statusLabel = getExpiryLabel(medicine.status, medicine.expiryDate);
  const statusClass = getStatusColor(medicine.status);

  const SYMPTOM_OPTIONS = ['发烧', '头痛', '牙痛', '感冒', '咳嗽', '腹泻', '肠胃不适', '消炎', '止痛', '外伤', '过敏', '中暑'];

  return (
    <div className="flex flex-col h-full bg-orange-50/50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm flex items-center justify-between">
        <button onClick={() => isEditing ? cancelEdit() : dispatch({ type: 'GO_BACK' })} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform">
          {isEditing ? <X className="w-5 h-5 text-gray-600" /> : <ChevronLeft className="w-5 h-5 text-gray-600" />}
        </button>
        <h1 className="text-lg font-semibold text-gray-800">{isEditing ? '编辑药品' : '药品详情'}</h1>
        <button 
          onClick={isEditing ? saveEdit : startEditing}
          className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center active:scale-95 transition-transform"
        >
          {isEditing ? <Check className="w-5 h-5 text-orange-600" /> : <Edit3 className="w-4 h-4 text-orange-600" />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Medicine Header Card */}
        <div className="bg-gradient-to-br from-orange-400 to-amber-500 px-6 pt-6 pb-8">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center border-2 border-white/30 overflow-hidden" onClick={() => medicine.images && medicine.images.length > 0 && !isEditing && setPreviewImage(medicine.images[0])}>
              {medicine.images && medicine.images.length > 0 && !isEditing ? (
                <img src={medicine.images[0]} alt={medicine.name} className="w-full h-full object-cover" />
              ) : (
                <Pill className="w-10 h-10 text-white" />
              )}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-lg font-bold text-white bg-white/20 rounded-lg px-2 py-1 mb-1 placeholder-white/60"
                  placeholder="药品名称"
                />
              ) : (
                <h2 className="text-xl font-bold text-white mb-1">{medicine.name}</h2>
              )}
              {isEditing ? (
                <input
                  value={editSpec}
                  onChange={(e) => setEditSpec(e.target.value)}
                  className="w-full text-sm text-white bg-white/20 rounded-lg px-2 py-0.5 placeholder-white/60"
                  placeholder="规格"
                />
              ) : (
                <p className="text-sm text-white/80">{medicine.spec}</p>
              )}
              {!isEditing && (
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 -mt-4 pb-6">
          {/* Images in edit mode */}
          {isEditing && (
            <div className="bg-white rounded-2xl p-4 shadow-md mb-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">药品图片</label>
              <div className="flex gap-2 flex-wrap">
                {editImages.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removeImage(idx)} className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/50 rounded-full text-white text-xs flex items-center justify-center">×</button>
                  </div>
                ))}
                <button onClick={handleImageSelect} className="w-20 h-20 rounded-xl border-2 border-dashed border-orange-200 flex flex-col items-center justify-center gap-1 text-orange-400">
                  <Camera className="w-6 h-6" />
                  <span className="text-xs">添加</span>
                </button>
              </div>
            </div>
          )}

          {/* Images display in view mode */}
          {!isEditing && medicine.images && medicine.images.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-md mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">药品图片</h3>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {medicine.images.map((img, idx) => (
                  <div key={idx} className="w-24 h-24 rounded-xl overflow-hidden shrink-0" onClick={() => setPreviewImage(img)}>
                    <img src={img} alt={`药品图片${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl p-4 shadow-md mb-4">
            {isEditing ? (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">数量</label>
                <div className="flex gap-1">
                  <input value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} className="w-full h-10 px-2 rounded-lg bg-orange-50 border border-orange-100 text-sm" />
                  <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="h-10 px-1 rounded-lg bg-orange-50 border border-orange-100 text-sm">
                    <option value="粒">粒</option>
                    <option value="片">片</option>
                    <option value="袋">袋</option>
                    <option value="瓶">瓶</option>
                    <option value="盒">盒</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">{medicine.quantity}</p>
                  <p className="text-xs text-gray-500">剩余{medicine.unit}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-800">{medicine.symptoms.length}</p>
                  <p className="text-xs text-gray-500">适用症状</p>
                </div>
              </div>
            )}
          </div>

          {/* Dosage */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">用法用量</h3>
            {isEditing ? (
              <textarea
                value={editDosage}
                onChange={(e) => setEditDosage(e.target.value)}
                placeholder="输入用法用量..."
                className="w-full h-20 p-3 rounded-xl bg-orange-50 border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none"
              />
            ) : (
              <p className="text-sm text-gray-600">{medicine.dosage || '暂无用量信息'}</p>
            )}
          </div>

          {/* Detail Items */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm mb-4">
            {/* Expiry */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
              <Calendar className="w-5 h-5 text-orange-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-400">保质期至</p>
                {isEditing ? (
                  <input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} className="text-sm font-medium text-gray-800 bg-orange-50 rounded-lg px-2 py-1 border border-orange-100" />
                ) : (
                  <p className="text-sm font-medium text-gray-800">{medicine.expiryDate}</p>
                )}
              </div>
              {!isEditing && <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass}`}>{medicine.status === 'expired' ? '已过期' : medicine.status === 'expiring' ? '即将过期' : '正常'}</span>}
            </div>
            {/* Visibility */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
              <Eye className="w-5 h-5 text-orange-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-400">可见性</p>
                <p className="text-sm font-medium text-gray-800">{getVisibilityLabel(medicine.visibility)}</p>
              </div>
              <button onClick={() => dispatch({ type: 'NAVIGATE', screen: 'shareSettings' })} className="text-xs text-orange-500">修改</button>
            </div>
            {/* Scope */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <MapPin className="w-5 h-5 text-orange-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-400">共享范围</p>
                <p className="text-sm font-medium text-gray-800">{getScopeLabel(medicine.shareScope)}</p>
              </div>
            </div>
          </div>

          {/* Symptoms - editable in edit mode */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">适用症状</h3>
            {isEditing ? (
              <>
                <div className="flex flex-wrap gap-2 mb-3">
                  {SYMPTOM_OPTIONS.map(s => (
                    <button key={s} onClick={() => toggleSymptom(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${editSymptoms.includes(s) ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={customSymptom} onChange={(e) => setCustomSymptom(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCustomSymptom()} placeholder="自定义症状..." className="flex-1 h-9 px-3 rounded-lg bg-orange-50 border border-orange-100 text-sm" />
                  <button onClick={handleAddCustomSymptom} className="h-9 px-3 rounded-lg bg-orange-500 text-white text-xs">添加</button>
                </div>
                {editSymptoms.filter(s => !SYMPTOM_OPTIONS.includes(s)).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editSymptoms.filter(s => !SYMPTOM_OPTIONS.includes(s)).map(s => (
                      <span key={s} className="px-2 py-1 bg-orange-50 text-orange-600 rounded-md text-xs flex items-center gap-1">{s}<button onClick={() => toggleSymptom(s)}>×</button></span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-wrap gap-2">
                {medicine.symptoms.map(s => (
                  <span key={s} className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium">{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* 投放到驿站中转格口 */}
          {!isEditing && medicine.isOtc && medicine.status !== 'expired' && medicine.quantity > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-semibold text-gray-700">投放到驿站中转格口</h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">
                把闲置药品放入驿站柜子的中转格口，医生完成用药安全评估、管理员完成实物核验后，
                邻居即可在线上发起借用，药品全程存放在中转格口。
              </p>
              {medicine.dropoffStatus === 'pending_verify' && (
                <p className="text-xs text-amber-600 mb-2">已登记投放，等待医生用药安全评估与管理员实物核验</p>
              )}
              {medicine.dropoffStatus === 'verified' && (
                <p className="text-xs text-green-600 mb-2">已通过核验，存放在中转格口供邻居借用</p>
              )}
              {medicine.dropoffStatus === 'rejected' && (
                <p className="text-xs text-red-500 mb-2">上次投放未通过核验，可整理后重新投放</p>
              )}
              <button
                onClick={() => {
                  setDropoffQty(Math.min(medicine.quantity, 1));
                  setDropoffNote('');
                  setShowDropoff(true);
                }}
                disabled={medicine.dropoffStatus === 'pending_verify'}
                className="w-full h-10 rounded-xl bg-orange-50 text-orange-600 text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-40"
              >
                {medicine.dropoffStatus === 'pending_verify' ? '等待管理员核验' : '登记投放'}
              </button>
            </div>
          )}

          {/* Delete Button - only in view mode */}
          {!isEditing && (
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full h-12 rounded-xl bg-red-50 text-red-500 font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <Trash2 className="w-4 h-4" />
              删除药品
            </button>
          )}
        </div>
      </div>

      {/* 投放登记弹窗 */}
      {showDropoff && (
        <div className="absolute inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => !dropoffBusy && setShowDropoff(false)} />
          <div className="relative w-full bg-white rounded-t-3xl p-5 pb-7">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-800">登记投放</h2>
              <button
                onClick={() => !dropoffBusy && setShowDropoff(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {medicine.name} · 放入中转格口后先由医生评估用药安全，再由管理员核验实物
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">投放数量</label>
            <div className="flex items-center gap-3 mb-4">
              <input
                type="number"
                min={1}
                max={medicine.quantity}
                value={dropoffQty}
                onChange={(e) => setDropoffQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 h-10 px-3 rounded-xl bg-orange-50 border border-orange-100 text-sm"
              />
              <span className="text-xs text-gray-400">
                {medicine.unit} · 最多 {medicine.quantity}{medicine.unit}
              </span>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">备注（选填）</label>
            <textarea
              value={dropoffNote}
              onChange={(e) => setDropoffNote(e.target.value)}
              rows={2}
              placeholder="例如：整盒未拆封，有效期至明年"
              className="w-full p-3 rounded-xl bg-orange-50/60 border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 mb-4"
            />

            <button
              onClick={submitDropoff}
              disabled={dropoffBusy}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-400 to-amber-500 text-white font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {dropoffBusy ? '提交中…' : '确认已放入中转格口'}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full bg-white rounded-t-3xl p-6 animate-slideUp">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-3">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">确认删除</h3>
              <p className="text-sm text-gray-500">删除后无法恢复，是否继续？</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 h-12 rounded-xl border border-gray-200 text-gray-600 font-medium active:scale-[0.98] transition-transform">取消</button>
              <button onClick={handleDelete} className="flex-1 h-12 rounded-xl bg-red-500 text-white font-medium active:scale-[0.98] transition-transform">删除</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPreviewImage(null)}>
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <img src={previewImage} alt="药品大图" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </div>
  );
}
