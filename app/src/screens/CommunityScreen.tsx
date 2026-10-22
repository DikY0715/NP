import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { MapPin, Pill, Heart, MessageCircle, Plus, Search, Info, Clock, CheckCircle2, X, Minus } from 'lucide-react';
import type { CommunityMedicine, ShareScope } from '@/types';

type CommunityTab = 'medicines' | 'help';
type BorrowState =
  | 'idle'
  | 'pending_owner'
  | 'pending'
  | 'pending_admin'
  | 'pending_payment'
  | 'accepted';

interface BorrowTarget {
  medicineId: string;
  medicineName: string;
  ownerName: string;
  maxQty: number;
  unit: string;
  unitPrice?: number;
}

function parseDistance(d: string): number {
  const num = parseInt(d.replace(/[^0-9]/g, ''));
  return isNaN(num) ? 9999 : num;
}

export default function CommunityScreen() {
  const { state, dispatch, actions } = useApp();
  const [activeTab, setActiveTab] = useState<CommunityTab>('medicines');
  const [scope, setScope] = useState<ShareScope>('building');
  const [searchQuery, setSearchQuery] = useState('');

  const scopes: { key: ShareScope; label: string }[] = [
    { key: 'community', label: '本小区' },
    { key: 'building', label: '本楼栋' },
  ];

  const sortedMedicines = useMemo(() => {
    // 社区页只展示邻里共享的闲置药品，驿站自营药品在「公共药品」页
    let list = state.communityMedicines.filter(m => !m.isCabinet);
    list.sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance));
    if (searchQuery.trim()) {
      const q = searchQuery.trim();
      list = list.filter(cm => cm.name.includes(q) || cm.symptoms.some(s => s.includes(q)));
    }
    return list;
  }, [state.communityMedicines, searchQuery]);

  // 借药申请弹窗
  const [borrowTarget, setBorrowTarget] = useState<BorrowTarget | null>(null);
  const [borrowQty, setBorrowQty] = useState(1);
  const [symptomNote, setSymptomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 从交易记录（由借药请求派生）推导当前药品的借用状态
  const getBorrowState = (medicineName: string): BorrowState => {
    const t = state.transactions.find(
      t => t.type === 'borrow_in' && t.medicineName === medicineName,
    );
    if (!t) return 'idle';
    switch (t.status) {
      case 'pending_owner':
      case 'pending':
      case 'pending_admin':
      case 'pending_payment':
        return t.status;
      case 'approved':
      case 'completed':
        return 'accepted';
      default:
        // rejected 后允许重新申请
        return 'idle';
    }
  };

  const borrowStateHint = (status: BorrowState): string => {
    switch (status) {
      case 'pending_owner': return '已提交，等待药主放入中转格口';
      case 'pending': return '药主已放入中转格口，等待医生安全审核';
      case 'pending_admin': return '医生审核通过，等待驿站实物核验';
      case 'pending_payment': return '核验通过，请前往交易记录完成支付';
      default: return '';
    }
  };

  const changeScope = (next: ShareScope) => {
    setScope(next);
    actions.loadCommunity(next);
  };

  // 进入页面时按当前范围拉取社区药品
  useEffect(() => {
    actions.loadCommunity(scope);
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
      dispatch({ type: 'SHOW_TOAST', message: '借药申请已提交，等待审核' });
      setBorrowTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const renderMedicineCard = (cm: CommunityMedicine) => {
    const status = getBorrowState(cm.name);
    return (
      <div key={cm.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-50">
        {/* Medicine Info */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <Pill className="w-6 h-6 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 text-sm">{cm.name}</h3>
            <p className="text-xs text-gray-500 mb-1">{cm.spec}</p>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                cm.isCabinet
                  ? 'bg-blue-50 text-blue-500'
                  : 'bg-green-50 text-green-600'
              }`}>
                {cm.sourceLabel}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                cm.unitPrice ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'
              }`}>
                {cm.unitPrice ? `¥${cm.unitPrice}/${cm.unit}` : '免费共享'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center text-orange-600 text-xs">
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

        {/* Status badge */}
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

        {/* Buttons */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
          {status === 'idle' && (
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
              className="flex-1 h-9 rounded-lg bg-gradient-to-r from-orange-400 to-amber-500 text-white text-sm font-medium active:scale-[0.98] transition-transform"
            >
              申请借用
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

  const helpPosts = state.helpPosts;

  return (
    <div className="flex flex-col h-full w-full bg-orange-50/50" style={{ height: '100%' }}>
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800 mb-3">社区互助</h1>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索药品..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-orange-50 border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {scopes.map(s => (
              <button
                key={s.key}
                onClick={() => changeScope(s.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  scope === s.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        <button
          onClick={() => setActiveTab('medicines')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
            activeTab === 'medicines' ? 'text-orange-500' : 'text-gray-500'
          }`}
        >
          邻里药箱
          {activeTab === 'medicines' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('help')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
            activeTab === 'help' ? 'text-orange-500' : 'text-gray-500'
          }`}
        >
          求助动态
          {activeTab === 'help' && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-orange-500 rounded-full" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {activeTab === 'medicines' && (
          <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-xl p-3 mb-4">
            <Info className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <p className="text-xs text-orange-700 leading-relaxed">
              本页为邻居共享的闲置药品，<strong>全部免费赠送</strong>，严禁任何形式的私下金钱交易。领取前请确认药品在有效期内。
            </p>
          </div>
        )}

        {activeTab === 'medicines' ? (
          <div className="space-y-3">
            {sortedMedicines.map(renderMedicineCard)}
          </div>
        ) : (
          <div className="space-y-3">
            {helpPosts.map(post => (
              <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm border border-orange-50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-300 to-amber-400 flex items-center justify-center text-white font-semibold text-sm">
                    {post.authorName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{post.authorName}</p>
                    <p className="text-xs text-gray-400">{post.timestamp}</p>
                  </div>
                  {post.urgency === 'urgent' && (
                    <span className="ml-auto px-2 py-0.5 bg-red-50 text-red-500 rounded-full text-xs font-medium">紧急</span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-3">{post.content}</p>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {post.symptoms.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-red-50 text-red-500 rounded-md text-xs">{s}</span>
                  ))}
                  {post.neededMedicines.map(m => (
                    <span key={m} className="px-2 py-0.5 bg-orange-50 text-orange-600 rounded-md text-xs">{m}</span>
                  ))}
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-500 rounded-md text-xs">
                    {post.scope === 'building' ? '本楼栋' : '本小区'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                  <span className="text-xs text-gray-400">{post.responses}人回应</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        await actions.respondHelp(post.id, '我可以提供帮助');
                        dispatch({ type: 'SHOW_TOAST', message: '已回应求助' });
                      }}
                      className="flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-orange-400 to-amber-500 text-white rounded-full text-xs font-medium active:scale-95 transition-transform"
                    >
                      <Heart className="w-3 h-3" />
                      我有
                    </button>
                    <button 
                      onClick={() => {
                        dispatch({ type: 'SELECT_MEDICINE', id: `chat_${post.authorName}` });
                        dispatch({ type: 'NAVIGATE', screen: 'chat' });
                      }}
                      className="flex items-center gap-1 px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium active:scale-95 transition-transform"
                    >
                      <MessageCircle className="w-3 h-3" />
                      私聊
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'medicines' && sortedMedicines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-gray-500">暂无匹配的共享药品</p>
          </div>
        )}
      </div>

      {/* FAB */}
      <div className="absolute bottom-20 right-4 z-30">
        <button
          onClick={() => dispatch({ type: 'NAVIGATE', screen: 'postHelp' })}
          className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-orange-400 to-amber-500 text-white font-medium shadow-lg shadow-orange-300 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" />
          发布求助
        </button>
      </div>

      {/* 借药申请弹窗：填写症状，提交审核 */}
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
              {borrowTarget.medicineName} · 药主 {borrowTarget.ownerName}。
              提交后依次由在线医生安全审核、驿站管理员实物核验
              {borrowTarget.unitPrice
                ? `，通过后需在线支付 ¥${(borrowTarget.unitPrice * borrowQty).toFixed(2)}`
                : '，全程免费'}
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              症状描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={symptomNote}
              onChange={(e) => setSymptomNote(e.target.value)}
              rows={3}
              placeholder="请简要描述当前症状、持续时间及过敏史/禁忌，供医生判断是否对症"
              className="w-full p-3 rounded-xl bg-orange-50/60 border border-orange-100 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 mb-4"
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
              className="w-full h-11 rounded-xl bg-gradient-to-r from-orange-400 to-amber-500 text-white font-semibold active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              {submitting ? '提交中…' : '提交审核'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
