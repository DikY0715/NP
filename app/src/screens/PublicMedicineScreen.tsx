import { useState, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useApp } from '@/context/AppContext';
import { MapPin, Pill, MessageCircle, Search, Clock, CheckCircle2, X, Minus, Plus, Store, Wallet, ArrowRight, ChevronLeft } from 'lucide-react';
import type { CommunityMedicine } from '@/types';

interface FlowCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  steps: string[];
  note?: string;
  tone?: 'blue' | 'orange';
}

function FlowCard({ icon, title, subtitle, steps, note, tone = 'blue' }: FlowCardProps) {
  const box = tone === 'blue'
    ? 'bg-blue-50/70 border-blue-100'
    : 'bg-orange-50/70 border-orange-100';
  const badge = tone === 'blue'
    ? 'bg-blue-100 text-blue-600'
    : 'bg-orange-100 text-orange-600';
  const titleColor = tone === 'blue' ? 'text-blue-700' : 'text-orange-700';
  const chip = tone === 'blue' ? 'text-blue-600' : 'text-orange-600';
  const arrow = tone === 'blue' ? 'text-blue-300' : 'text-orange-300';
  const noteColor = tone === 'blue' ? 'text-blue-500' : 'text-orange-500';
  return (
    <div className={`rounded-2xl p-3.5 mb-3 border ${box}`}>
      <div className="flex items-start gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${badge}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${titleColor}`}>{title}</p>
          <p className="text-[11px] text-gray-500 leading-relaxed">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 mt-2.5">
        {steps.map((step, i) => (
          <span key={step} className="flex items-center gap-1">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium bg-white ${chip}`}>
              {i + 1}. {step}
            </span>
            {i < steps.length - 1 && (
              <ArrowRight className={`w-3 h-3 ${arrow}`} />
            )}
          </span>
        ))}
      </div>
      {note && (
        <p className={`text-[11px] mt-2 leading-relaxed ${noteColor}`}>{note}</p>
      )}
    </div>
  );
}

type BorrowState = 'idle' | 'pending' | 'pending_admin' | 'pending_payment' | 'accepted';

interface BorrowTarget {
  medicineId: string;
  medicineName: string;
  ownerName: string;
  maxQty: number;
  unit: string;
  unitPrice?: number;
}

type MedicineCategory = 'cabinet' | 'idle';

export default function PublicMedicineScreen() {
  const { state, dispatch, actions } = useApp();
  const isAdmin = state.user?.role === 'admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<MedicineCategory>(isAdmin ? 'idle' : 'cabinet');

  // 公共药品分两类：驿站自营（isCabinet=true，付费）与 闲置药品（isCabinet=false，免费）
  const cabinetMedicines = useMemo(
    () => state.communityMedicines.filter(m => m.isCabinet),
    [state.communityMedicines],
  );
  const idleMedicines = useMemo(
    () => state.communityMedicines.filter(m => !m.isCabinet),
    [state.communityMedicines],
  );

  const filteredMedicines = useMemo(() => {
    let list = category === 'cabinet' ? cabinetMedicines : idleMedicines;
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      list = list.filter(cm => cm.name.includes(q) || cm.symptoms.some(s => s.includes(q)));
    }
    return list;
  }, [category, cabinetMedicines, idleMedicines, searchQuery]);

  const [borrowTarget, setBorrowTarget] = useState<BorrowTarget | null>(null);
  const [borrowQty, setBorrowQty] = useState(1);
  const [symptomNote, setSymptomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const getBorrowState = (medicineName: string): BorrowState => {
    const t = state.transactions.find(
      t => t.type === 'borrow_in' && t.medicineName === medicineName,
    );
    if (!t) return 'idle';
    switch (t.status) {
      case 'pending':
      case 'pending_admin':
      case 'pending_payment':
        return t.status;
      case 'approved':
      case 'completed':
        return 'accepted';
      default:
        return 'idle';
    }
  };

  const borrowStateHint = (status: BorrowState): string => {
    switch (status) {
      case 'pending': return '已提交，等待医生安全审核';
      case 'pending_admin': return '医生审核通过，等待驿站实物核验';
      case 'pending_payment': return '核验通过，请前往交易记录完成支付';
      default: return '';
    }
  };

  useEffect(() => {
    actions.loadCommunity('community');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openBorrow = (
    cmId: string,
    medicineName: string,
    ownerName: string,
    maxQty: number,
    unit: string,
    unitPrice?: number,
  ) => {
    setBorrowTarget({ medicineId: cmId, medicineName, ownerName, maxQty: Math.max(1, maxQty), unit, unitPrice });
    setBorrowQty(1);
    setSymptomNote('');
  };

  const submitBorrow = async () => {
    if (!borrowTarget) return;
    setSubmitting(true);
    try {
      await actions.borrowMedicine(borrowTarget.medicineId, borrowQty, symptomNote.trim());
      dispatch({ type: 'SHOW_TOAST', message: '借药申请已提交，等待医生审核' });
      setBorrowTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const renderMedicineCard = (cm: CommunityMedicine) => {
    const status = getBorrowState(cm.name);
    return (
      <div key={cm.id} className="bg-white rounded-2xl p-4 shadow-sm border border-blue-50">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Pill className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 text-sm">{cm.name}</h3>
            <p className="text-xs text-gray-500 mb-1">{cm.spec}</p>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-500">
                {cm.sourceLabel}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                cm.isCabinet ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'
              }`}>
                {cm.isCabinet
                  ? (cm.unitPrice ? `¥${cm.unitPrice}/${cm.unit}` : '收费 · 待标价')
                  : '免费共享'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center text-blue-600 text-xs">
                  {cm.ownerName[0]}
                </span>
                {cm.ownerName} · {cm.building}
              </span>
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {cm.distance}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-400">剩余{cm.quantity}{cm.unit}</span>
              <span className="text-xs text-gray-300">|</span>
              <span className="text-xs text-gray-400">{cm.expiryDate}到期</span>
            </div>
          </div>
        </div>

        {status !== 'idle' && status !== 'accepted' && (
          <div className="mt-2 flex items-center gap-1.5 text-amber-600 text-xs">
            <Clock className="w-3.5 h-3.5" />
            {borrowStateHint(status)}
          </div>
        )}
        {status === 'accepted' && (
          <div className="mt-2 flex items-center gap-1.5 text-green-600 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            审核通过，等待驿站出货取药
          </div>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
          {status === 'idle' && !isAdmin && (
            <button
              onClick={() =>
                openBorrow(
                  cm.medicineId,
                  cm.name,
                  cm.ownerName,
                  cm.quantity > 5 ? 5 : cm.quantity,
                  cm.unit,
                  cm.unitPrice,
                )
              }
              className="flex-1 h-9 rounded-lg bg-gradient-to-r from-blue-400 to-indigo-500 text-white text-sm font-medium active:scale-[0.98] transition-transform"
            >
              申请借用
            </button>
          )}
          {status === 'idle' && isAdmin && (
            <button
              onClick={() => dispatch({ type: 'NAVIGATE', screen: 'adminInventory' })}
              className="flex-1 h-9 rounded-lg bg-gradient-to-r from-blue-400 to-indigo-500 text-white text-sm font-medium active:scale-[0.98] transition-transform"
            >
              库存管理
            </button>
          )}
          {status !== 'idle' && status !== 'accepted' && (
            <div className="flex-1 h-9 rounded-lg bg-amber-50 text-amber-600 text-sm font-medium flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {status === 'pending_payment' ? '待支付' : '进行中'}
            </div>
          )}
          {status === 'accepted' && (
            <div className="flex-1 h-9 rounded-lg bg-green-50 text-green-600 text-sm font-medium flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              审核通过
            </div>
          )}
          <button
            onClick={() => {
              dispatch({ type: 'SELECT_MEDICINE', id: cm.medicineId });
              dispatch({ type: 'NAVIGATE', screen: 'chat' });
            }}
            className="h-9 px-4 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium flex items-center gap-1 active:scale-[0.98] transition-transform"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            私聊
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-blue-50/50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => dispatch({ type: 'GO_BACK' })}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">公共药品</h1>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索药品..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-blue-50 border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {/* 分类切换：驿站自营 / 闲置药品（管理员端只保留闲置药品） */}
        {!isAdmin && (
          <div className="flex gap-2 mb-3">
          <button
            onClick={() => setCategory('cabinet')}
            className={`flex-1 h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
              category === 'cabinet'
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-200'
                : 'bg-white text-gray-600 border border-gray-100'
            }`}
          >
            <Store className="w-4 h-4" />
            驿站自营
            <span className={`text-[11px] ${category === 'cabinet' ? 'text-blue-100' : 'text-gray-400'}`}>
              {cabinetMedicines.length}
            </span>
          </button>
          <button
            onClick={() => setCategory('idle')}
            className={`flex-1 h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
              category === 'idle'
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                : 'bg-white text-gray-600 border border-gray-100'
            }`}
          >
            <Pill className="w-4 h-4" />
            闲置药品
            <span className={`text-[11px] ${category === 'idle' ? 'text-orange-100' : 'text-gray-400'}`}>
              {idleMedicines.length}
            </span>
          </button>
          </div>
        )}

        {!isAdmin && category === 'cabinet' ? (
          <FlowCard
            icon={<Wallet className="w-4 h-4" />}
            title="驿站自营药品（付费）"
            subtitle="居民提交症状描述，医生审核安全，管理员审核合规；双重审核通过后系统生成支付订单。"
            steps={['提交症状描述', '医生审核安全', '管理员审核合规', '生成支付订单', '支付后公共区出货']}
            note="未完成支付不可出货；支付完成后管理员从公共区取药交付。"
          />
        ) : (
          <FlowCard
            tone="orange"
            icon={<Pill className="w-4 h-4" />}
            title="闲置药品（免费共享）"
            subtitle="居民将闲置药品放入柜子中转格口或线上登记，医生先进行用药安全评估，管理员再做实物核验，通过后即可供邻里借用。"
            steps={['中转格口/线上登记', '医生安全评估', '管理员实物核验', '审核通过后免费取药']}
            note="药品全程存放在中转格口，邻里闲置药品免费赠送，严禁任何形式的金钱交易。"
          />
        )}

        <div className="flex items-center gap-2 mb-2">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
            category === 'cabinet' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
          }`}>
            {category === 'cabinet' ? <Store className="w-3.5 h-3.5" /> : <Pill className="w-3.5 h-3.5" />}
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-800">
              {category === 'cabinet' ? '驿站自营药品' : '闲置共享药品'}
            </h2>
            <p className="text-[11px] text-gray-400">
              {category === 'cabinet' ? '双重审核通过后在线支付' : '双重审核通过后免费取药'}
            </p>
          </div>
          <span className="text-xs text-gray-400">{filteredMedicines.length} 件</span>
        </div>

        <div className="space-y-3">
          {filteredMedicines.map(renderMedicineCard)}
        </div>

        {filteredMedicines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500">
              {category === 'cabinet' ? '驿站暂无可借的自营药品' : '暂无邻居共享的闲置药品'}
            </p>
          </div>
        )}
      </div>

      {/* 借药申请弹窗 */}
      {borrowTarget && (
        <div className="absolute inset-0 z-40 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && setBorrowTarget(null)} />
          <div className="relative w-full bg-white rounded-t-3xl p-5 pb-7 max-h-[85%] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-800">申请借用药品</h2>
              <button
                onClick={() => !submitting && setBorrowTarget(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {borrowTarget.medicineName} · {borrowTarget.ownerName}。
              提交后依次由在线医生安全审核、驿站管理员实物核验
              {borrowTarget.unitPrice
                ? `，通过后需在线支付 ¥${(borrowTarget.unitPrice * borrowQty).toFixed(2)}`
                : ''}
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              症状描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={symptomNote}
              onChange={(e) => setSymptomNote(e.target.value)}
              rows={3}
              placeholder="请简要描述当前症状、持续时间及过敏史/禁忌，供医生判断是否对症"
              className="w-full p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 mb-4"
            />

            <label className="block text-sm font-medium text-gray-700 mb-1.5">借用数量</label>
            <div className="flex items-center gap-3 mb-5">
              <button
                onClick={() => setBorrowQty(q => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95"
              >
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-base font-semibold text-gray-800 w-16 text-center">
                {borrowQty}
                {borrowTarget.unit}
              </span>
              <button
                onClick={() => setBorrowQty(q => Math.min(borrowTarget.maxQty, q + 1))}
                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95"
              >
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="text-xs text-gray-400">最多可借 {borrowTarget.maxQty}{borrowTarget.unit}</span>
            </div>

            <button
              onClick={submitBorrow}
              disabled={submitting || !symptomNote.trim()}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-400 to-indigo-500 text-white font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              {submitting ? '提交中…' : '提交审核'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
