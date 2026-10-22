import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError } from '@/lib/api';
import { Pill, User, MapPin, Boxes, Package, Plus, Minus, ScanLine, Keyboard } from 'lucide-react';
import type { AdminMedicine, ExpiryStatus } from '@/types';

const STATUS_META: Record<ExpiryStatus, { text: string; cls: string }> = {
  normal: { text: '正常', cls: 'bg-emerald-50 text-emerald-600' },
  expiring: { text: '临近效期', cls: 'bg-amber-50 text-amber-600' },
  expired: { text: '已过期', cls: 'bg-red-50 text-red-500' },
};

export default function AdminInventoryScreen() {
  const { dispatch } = useApp();
  const [list, setList] = useState<AdminMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(10);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', spec: '', quantity: 10, unit: '盒', expiryDate: '', unitPrice: '' });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        setList(await api.adminMedicines('cabinet'));
      } catch (err) {
        if (!silent) {
          dispatch({
            type: 'SHOW_TOAST',
            message: err instanceof ApiError ? err.message : '加载失败',
          });
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [dispatch],
  );

  useEffect(() => {
    load();
  }, [load]);

  // 柜内库存实时刷新
  useEffect(() => {
    const timer = setInterval(() => load(true), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const restock = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await api.adminRestock(id, restockQty);
      dispatch({
        type: 'SHOW_TOAST',
        message: `已补货，${updated.name} 柜内库存 ${updated.quantity}${updated.unit}`,
      });
      setRestockId(null);
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '补货失败',
      });
    } finally {
      setBusyId(null);
    }
  };

  const addMedicine = async () => {
    if (!form.name.trim()) {
      dispatch({ type: 'SHOW_TOAST', message: '请填写药品名称' });
      return;
    }
    setAdding(true);
    try {
      await api.adminAddCabinetMedicine({
        name: form.name,
        spec: form.spec,
        quantity: form.quantity,
        unit: form.unit,
        expiryDate: form.expiryDate,
        unitPrice: form.unitPrice.trim() ? Number(form.unitPrice) : undefined,
      });
      dispatch({ type: 'SHOW_TOAST', message: `${form.name} 已入库到实体柜` });
      setForm({ name: '', spec: '', quantity: 10, unit: '盒', expiryDate: '', unitPrice: '' });
      setShowAdd(false);
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '入库失败',
      });
    } finally {
      setAdding(false);
    }
  };

  const needRestock = list.filter((m) => m.lowStock).length;

  return (
    <div className="flex flex-col h-full w-full bg-indigo-50/30">
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Boxes className="w-5 h-5 text-indigo-600" />
          <h1 className="text-lg font-semibold text-gray-800">柜内库存</h1>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="ml-auto px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex items-center gap-1"
          >
            <Keyboard className="w-3.5 h-3.5" />
            手动入库
          </button>
          <button
            onClick={() => dispatch({ type: 'NAVIGATE', screen: 'adminScan' })}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-indigo-500 to-blue-500 text-white flex items-center gap-1"
          >
            <ScanLine className="w-3.5 h-3.5" />
            AI 识药入库
          </button>
        </div>
        <p className="text-xs text-gray-400">
          实时查看实体柜内公共药品剩余数量，库存不足可及时补货
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-16">加载中…</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <Package className="w-7 h-7 text-indigo-300" />
            </div>
            <p className="text-sm text-gray-500">实体柜内暂无药品</p>
          </div>
        ) : (
          <>
            {showAdd && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 mb-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">手动新增驿站自营药品入库</h3>
                <div className="space-y-2">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="药品名称（必填）"
                    className="w-full h-9 px-3 rounded-lg bg-gray-50 text-sm focus:outline-none"
                  />
                  <input
                    value={form.spec}
                    onChange={(e) => setForm({ ...form, spec: e.target.value })}
                    placeholder="规格，如 0.3g*20粒"
                    className="w-full h-9 px-3 rounded-lg bg-gray-50 text-sm focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={form.quantity}
                      onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                      placeholder="数量"
                      className="w-1/2 h-9 px-3 rounded-lg bg-gray-50 text-sm focus:outline-none"
                    />
                    <input
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                      placeholder="单位，如 盒"
                      className="w-1/2 h-9 px-3 rounded-lg bg-gray-50 text-sm focus:outline-none"
                    />
                  </div>
                  <input
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    placeholder="有效期，如 2027-06-30"
                    className="w-full h-9 px-3 rounded-lg bg-gray-50 text-sm focus:outline-none"
                  />
                  <input
                    value={form.unitPrice}
                    onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                    inputMode="decimal"
                    placeholder={`单价（元/${form.unit || '单位'}），留空表示免费共享`}
                    className="w-full h-9 px-3 rounded-lg bg-gray-50 text-sm focus:outline-none"
                  />
                  <p className="text-xs text-gray-400">
                    填写单价后，居民借药需在医生审核与管理员核验通过后在线支付
                  </p>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={addMedicine}
                    disabled={adding}
                    className="flex-1 h-9 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {adding ? '入库中…' : '确认入库'}
                  </button>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="h-9 px-4 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl p-4 text-white shadow-lg shadow-indigo-100 mb-4">
              <div className="grid grid-cols-2 divide-x divide-white/20">
                <div className="text-center">
                  <p className="text-2xl font-bold">{list.length}</p>
                  <p className="text-xs text-white/80 mt-0.5">柜内药品</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{needRestock}</p>
                  <p className="text-xs text-white/80 mt-0.5">需补货</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {list.map((m) => {
                const meta = STATUS_META[m.status];
                const low = m.lowStock;
                const isCabinet = m.source === 'cabinet';
                return (
                  <div
                    key={m.id}
                    className={`bg-white rounded-2xl p-4 shadow-sm border ${
                      low ? 'border-red-100' : 'border-indigo-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          low ? 'bg-red-50' : 'bg-indigo-100'
                        }`}
                      >
                        <Pill className={`w-5 h-5 ${low ? 'text-red-500' : 'text-indigo-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-gray-800">{m.name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
                            {meta.text}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              isCabinet ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-500'
                            }`}
                          >
                            {isCabinet ? '驿站自营' : m.dropoffStatus === 'verified' ? '居民投放' : '居民共享'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              m.unitPrice ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-500'
                            }`}
                          >
                            {m.unitPrice ? `¥${m.unitPrice}/${m.unit}` : '免费'}
                          </span>
                          {low && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-500">
                              库存偏低
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{m.spec}</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-0.5">
                            <User className="w-3 h-3" />
                            {isCabinet ? '驿站' : m.ownerName}
                          </span>
                          {!isCabinet && m.building && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {m.building}
                            </span>
                          )}
                          <span>{m.expiryDate} 到期</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xl font-bold ${low ? 'text-red-500' : 'text-indigo-600'}`}>
                          {m.quantity}
                        </p>
                        <p className="text-xs text-gray-400">{m.unit} 剩余</p>
                      </div>
                    </div>

                    {restockId !== m.id && (
                      <button
                        onClick={() => {
                          setRestockId(m.id);
                          setRestockQty(10);
                        }}
                        className={`w-full mt-3 h-9 rounded-lg text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5 ${
                          low
                            ? 'bg-gradient-to-r from-red-400 to-rose-500 text-white'
                            : 'bg-indigo-50 text-indigo-600'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        补货
                      </button>
                    )}

                    {restockId === m.id && (
                      <div className="mt-3 border-t border-gray-100 pt-3 flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 h-9">
                          <button
                            onClick={() => setRestockQty((q) => Math.max(1, q - 1))}
                            className="w-6 h-6 flex items-center justify-center text-gray-500"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-medium text-gray-800 min-w-[28px] text-center">
                            {restockQty}
                          </span>
                          <button
                            onClick={() => setRestockQty((q) => q + 1)}
                            className="w-6 h-6 flex items-center justify-center text-gray-500"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => restock(m.id)}
                          disabled={busyId === m.id}
                          className="flex-1 h-9 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                        >
                          {busyId === m.id ? '补货中…' : `确认补货 ${restockQty}${m.unit}`}
                        </button>
                        <button
                          onClick={() => setRestockId(null)}
                          className="h-9 px-3 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium"
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
