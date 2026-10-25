import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { api, ApiError, formatTime } from '@/lib/api';
import {
  QrCode,
  Pill,
  User,
  MapPin,
  CheckCircle2,
  PackageCheck,
  Ticket,
  ShieldCheck,
  X,
  ArrowDownToLine,
} from 'lucide-react';
import type { BorrowRequest, LockerDropoff } from '@/types';

type Tab = 'pending' | 'verify' | 'approved' | 'completed';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: '待医生审核' },
  { key: 'verify', label: '待核验' },
  { key: 'approved', label: '待出货' },
  { key: 'completed', label: '已完成' },
];

interface VerifyTarget {
  kind: 'borrow' | 'dropoff';
  id: string;
  title: string;
  subtitle: string;
}

export default function AdminDispatchScreen() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<Tab>(state.adminDispatchTab);
  const [list, setList] = useState<BorrowRequest[]>([]);
  const [dropoffs, setDropoffs] = useState<LockerDropoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<VerifyTarget | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        if (tab === 'verify') {
          const [borrows, drops] = await Promise.all([
            api.adminBorrows('pending_admin'),
            api.adminDropoffs('pending_verify'),
          ]);
          setList(borrows);
          setDropoffs(drops);
        } else {
          setList(await api.adminBorrows(tab));
          setDropoffs([]);
        }
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
    [tab, dispatch],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => load(true), 8000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (id: string, kind: 'dispatch' | 'complete') => {
    setBusyId(id);
    try {
      if (kind === 'dispatch') {
        const r = await api.adminDispatch(id);
        dispatch({ type: 'SHOW_TOAST', message: `取药码 ${r.pickupCode} 已发放` });
      } else {
        const target = list.find((x) => x.id === id);
        await api.adminComplete(id);
        dispatch({
          type: 'SHOW_TOAST',
          message:
            target?.dispenseMode === 'vending'
              ? '已从透明售货口出货掉落，库存已扣减'
              : '取药完成，库存已扣减',
        });
      }
      await load();
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '操作失败',
      });
    } finally {
      setBusyId(null);
    }
  };

  const openVerify = (target: VerifyTarget) => {
    setVerifyNote('');
    setVerifyTarget(target);
  };

  const submitVerify = async (compliant: boolean) => {
    if (!verifyTarget) return;
    setVerifyBusy(true);
    try {
      if (verifyTarget.kind === 'borrow') {
        await api.adminVerifyBorrow(verifyTarget.id, compliant, verifyNote.trim());
      } else {
        await api.adminVerifyDropoff(verifyTarget.id, compliant, verifyNote.trim());
      }
      setVerifyTarget(null);
      await load();
      dispatch({
        type: 'SHOW_TOAST',
        message: compliant ? '核验通过' : '已退回',
      });
    } catch (err) {
      dispatch({
        type: 'SHOW_TOAST',
        message: err instanceof ApiError ? err.message : '核验失败',
      });
    } finally {
      setVerifyBusy(false);
    }
  };

  const emptyText =
    tab === 'pending'
      ? '暂无待医生审核的借药申请'
      : tab === 'verify'
        ? '暂无待核验事项'
        : tab === 'approved'
          ? '暂无待出货借药单'
          : '暂无已完成记录';

  return (
    <div className="flex flex-col h-full w-full bg-indigo-50/30">
      <div className="bg-white px-4 pt-4 pb-3 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <PackageCheck className="w-5 h-5 text-indigo-600" />
          <h1 className="text-lg font-semibold text-gray-800">借药出货</h1>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          借药需医生安全审核、管理员核验通过后，通知药主放入中转格口；有价药品待居民付款后才出货
        </p>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6">
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-16">加载中…</p>
        ) : list.length === 0 && dropoffs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <QrCode className="w-7 h-7 text-indigo-300" />
            </div>
            <p className="text-sm text-gray-500">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tab === 'verify' &&
              dropoffs.map((d) => (
                <div key={`dropoff-${d.id}`} className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                      <ArrowDownToLine className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {d.ownerName}
                        {d.ownerBuilding && (
                          <span className="text-xs text-gray-400 font-normal"> · {d.ownerBuilding}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(d.createdAt)}登记 · 居民自助投放
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium">
                      待核验实物
                    </span>
                  </div>

                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <Pill className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {d.medicineName}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          投放 {d.quantity}
                          {d.unit}
                        </span>
                      </p>
                      {d.note && <p className="text-xs text-gray-500 mt-1">备注：{d.note}</p>}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      openVerify({
                        kind: 'dropoff',
                        id: d.id,
                        title: `核验投放：${d.medicineName}`,
                        subtitle: `${d.ownerName} 投放 ${d.quantity}${d.unit}，通过后即可供邻居借用`,
                      })
                    }
                    className="w-full mt-3 h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    核验实物
                  </button>
                </div>
              ))}

            {tab === 'verify' &&
              list.map((r) => (
                <div key={`borrow-${r.id}`} className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {r.borrowerName}
                        {r.borrowerBuilding && (
                          <span className="text-xs text-gray-400 font-normal"> · {r.borrowerBuilding}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(r.createdAt)}申请 · {r.doctorName} 已审核
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
                      待核验
                    </span>
                  </div>

                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Pill className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {r.medicineName}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          借用 {r.quantity}
                          {r.unit}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        {r.isCabinet ? '来源：驿站自营（公共区）' : `药主：${r.ownerName}`}
                        {!r.isCabinet && r.ownerBuilding && (
                          <>
                            <MapPin className="w-3 h-3" />
                            {r.ownerBuilding}
                          </>
                        )}
                      </p>
                      {r.doctorNote && (
                        <p className="text-xs text-emerald-600 mt-1">医生嘱咐：{r.doctorNote}</p>
                      )}
                      {r.amount > 0 && (
                        <p className="text-xs text-orange-600 mt-1">
                          有价药品：核验通过后需居民支付 ¥{r.amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      openVerify({
                        kind: 'borrow',
                        id: r.id,
                        title: `核验借药：${r.medicineName}`,
                        subtitle: `${r.borrowerName} 借用 ${r.quantity}${r.unit}，请核对借药申请与药主药品信息`,
                      })
                    }
                    className="w-full mt-3 h-10 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    核验实物
                  </button>
                </div>
              ))}

            {tab !== 'verify' &&
              list.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-50">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">
                        {r.borrowerName}
                        {r.borrowerBuilding && (
                          <span className="text-xs text-gray-400 font-normal"> · {r.borrowerBuilding}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(r.createdAt)}申请
                        {tab === 'pending'
                          ? ' · 等待医生安全审核'
                          : ` · ${r.doctorName} 审核`}
                      </p>
                    </div>
                    {tab === 'pending' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
                        待医生审核
                      </span>
                    ) : r.dispenseMode === 'vending' ? (
                      <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 text-xs font-medium">
                        透明售货
                      </span>
                    ) : r.pickupCode ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-xs font-medium">
                        待取药
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium">
                        中转格口
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Pill className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">
                        {r.medicineName}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          {tab === 'pending' ? '申请借用' : '出货'} {r.quantity}
                          {r.unit}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        {r.isCabinet ? '来源：驿站自营（公共区）' : `药主：${r.ownerName}`}
                        {!r.isCabinet && r.ownerBuilding && (
                          <>
                            <MapPin className="w-3 h-3" />
                            {r.ownerBuilding}
                          </>
                        )}
                      </p>
                      {r.doctorNote && (
                        <p className="text-xs text-emerald-600 mt-1">医生嘱咐：{r.doctorNote}</p>
                      )}
                    </div>
                  </div>

                  {r.pickupCode && (
                    <div className="mt-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-amber-500" />
                        <div>
                          <p className="text-xs text-amber-600">取药码</p>
                          <p className="text-2xl font-bold tracking-[0.3em] text-amber-700 leading-tight">
                            {r.pickupCode}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {tab === 'approved' && r.dispenseMode === 'vending' && (
                    <button
                      onClick={() => act(r.id, 'complete')}
                      disabled={busyId === r.id}
                      className="w-full mt-3 h-10 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <PackageCheck className="w-4 h-4" />
                      {busyId === r.id ? '处理中…' : '确认出货掉落'}
                    </button>
                  )}
                  {tab === 'approved' && r.dispenseMode === 'locker' && !r.pickupCode && (
                    <button
                      onClick={() => act(r.id, 'dispatch')}
                      disabled={busyId === r.id}
                      className="w-full mt-3 h-10 rounded-lg bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                      {busyId === r.id ? '处理中…' : '放药入格口并发放取药码'}
                    </button>
                  )}
                  {tab === 'approved' && r.dispenseMode === 'locker' && r.pickupCode && (
                    <button
                      onClick={() => act(r.id, 'complete')}
                      disabled={busyId === r.id}
                      className="w-full mt-3 h-10 rounded-lg bg-emerald-500 text-white text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {busyId === r.id ? '处理中…' : '居民已取药，确认完成'}
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 实物核验弹窗 */}
      {verifyTarget && (
        <div className="absolute inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !verifyBusy && setVerifyTarget(null)}
          />
          <div className="relative w-full bg-white rounded-t-3xl p-5 pb-7">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-bold text-gray-800">核验确认</h2>
              <button
                onClick={() => !verifyBusy && setVerifyTarget(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {verifyTarget.title}
              <br />
              {verifyTarget.subtitle}
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">核验意见（选填）</label>
            <textarea
              value={verifyNote}
              onChange={(e) => setVerifyNote(e.target.value)}
              rows={3}
              placeholder="请记录核验情况与处理意见"
              className="w-full p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => submitVerify(false)}
                disabled={verifyBusy}
                className="flex-1 h-11 rounded-xl bg-red-50 text-red-500 font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                退回
              </button>
              <button
                onClick={() => submitVerify(true)}
                disabled={verifyBusy}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {verifyBusy ? '提交中…' : '核验通过'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
