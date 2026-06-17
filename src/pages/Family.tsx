import { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  UserPlus,
  Trash2,
  Crown,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCcw,
  CreditCard,
  CalendarClock,
  XCircle,
  Undo2,
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/lib/api';
import type { CreditTransaction, CreditTransactionSubType } from '@/../shared/types';

export default function Family() {
  const { familyInfo, setFamilyInfo } = useAppStore();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [family, txns] = await Promise.all([
        api.getFamilyInfo(),
        api.getTransactions(),
      ]);
      setFamilyInfo(family);
      setTransactions(txns);
    } catch (e) {
      console.error('加载失败', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [setFamilyInfo]);

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    setLoading(true);
    try {
      await api.addMember({
        name: newMemberName.trim(),
        role: 'member',
        avatar: newMemberName.trim().slice(0, 2).toUpperCase(),
      });
      setNewMemberName('');
      setShowAddMember(false);
      fetchData();
    } catch (e) {
      console.error('添加成员失败', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('确定要移除该成员吗？')) return;
    try {
      await api.removeMember(memberId);
      fetchData();
    } catch (e) {
      console.error('移除成员失败', e);
    }
  };

  const handleRecharge = async () => {
    setLoading(true);
    try {
      await api.rechargeCredits(rechargeAmount);
      setShowRecharge(false);
      fetchData();
    } catch (e) {
      console.error('充值失败', e);
    } finally {
      setLoading(false);
    }
  };

  const getTxnIcon = (type: CreditTransaction['type'], subType?: CreditTransactionSubType) => {
    if (type === 'recharge') return ArrowUpRight;
    if (type === 'refund') {
      if (subType === 'cancel') return Undo2;
      if (subType === 'rollback') return XCircle;
      return RefreshCcw;
    }
    if (subType === 'booking') return CalendarClock;
    return ArrowDownLeft;
  };

  const getTxnColor = (type: CreditTransaction['type'], subType?: CreditTransactionSubType) => {
    if (type === 'recharge') return 'text-emerald-600 bg-emerald-50';
    if (type === 'refund') {
      if (subType === 'rollback') return 'text-rose-600 bg-rose-50';
      return 'text-sky-600 bg-sky-50';
    }
    if (subType === 'booking') return 'text-amber-600 bg-amber-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getTxnLabel = (type: CreditTransaction['type'], subType?: CreditTransactionSubType) => {
    if (type === 'recharge') return '充值';
    if (type === 'refund') {
      if (subType === 'cancel') return '退订返还';
      if (subType === 'rollback') return '失败回滚';
      return '退款';
    }
    if (subType === 'booking') return '预约扣减';
    return '消费';
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif">家庭账户</h1>
          <p className="text-gray-500 mt-1">管理家庭成员和额度流水</p>
        </div>
        <button
          onClick={() => setShowRecharge(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-900 text-white rounded-xl text-sm font-medium hover:bg-emerald-800 transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          充值额度
        </button>
      </div>

      {familyInfo && (
        <div className="bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 rounded-2xl p-6 text-white">
          <p className="text-emerald-200/80 text-sm">{familyInfo.account.name}</p>
          <p className="text-4xl font-bold mt-2">
            {familyInfo.account.creditsBalance.toLocaleString()}
            <span className="text-lg font-normal text-emerald-200/70 ml-2">剩余额度</span>
          </p>
          <p className="text-emerald-200/60 text-sm mt-1">
            总额度 {familyInfo.account.creditsTotal.toLocaleString()} 点
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            家庭成员
          </h2>
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加成员
          </button>
        </div>

        {familyInfo?.members.length ? (
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {familyInfo.members.map((member) => (
              <div key={member.id} className="flex items-center gap-4 p-4">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm">
                  {member.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{member.name}</p>
                    {member.role === 'owner' && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                        <Crown className="w-3 h-3" />
                        管理员
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    加入于 {new Date(member.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                </div>
                {member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            暂无家庭成员
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">额度流水</h2>
        {transactions.length > 0 ? (
          <div className="relative bg-white rounded-2xl border border-gray-100 p-1 pl-8">
            <div className="absolute left-6 top-6 bottom-6 w-px bg-gray-100"></div>
            {transactions
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((txn, idx) => {
                const Icon = getTxnIcon(txn.type, txn.subType);
                const isLast = idx === transactions.length - 1;
                return (
                  <div key={txn.id} className={`relative py-4 ${isLast ? '' : 'border-b border-gray-50'}`}>
                    <div className={`absolute -left-[30px] top-5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${getTxnColor(txn.type, txn.subType).replace('bg-', 'bg-').replace('text-', '')}`} style={{ backgroundColor: txn.type === 'recharge' ? '#10b981' : txn.subType === 'rollback' ? '#f43f5e' : txn.subType === 'cancel' || txn.type === 'refund' ? '#0284c7' : '#d97706' }}></div>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getTxnColor(txn.type, txn.subType)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 truncate">{txn.description}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 font-medium whitespace-nowrap">
                            {getTxnLabel(txn.type, txn.subType)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {new Date(txn.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${txn.type === 'consume' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {txn.type === 'consume' ? '-' : '+'}
                          {txn.amount}
                        </p>
                        <p className="text-xs text-gray-500">
                          余额 {txn.balanceAfter}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
            暂无流水记录
          </div>
        )}
      </div>

      {showAddMember && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddMember(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">添加家庭成员</h3>
            </div>
            <input
              type="text"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              placeholder="成员姓名"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddMember(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddMember}
                disabled={!newMemberName.trim() || loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-900 text-white font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {loading ? '添加中...' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecharge && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRecharge(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-emerald-700" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">充值额度</h3>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[50, 100, 200, 500].map((v) => (
                <button
                  key={v}
                  onClick={() => setRechargeAmount(v)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    rechargeAmount === v
                      ? 'bg-emerald-900 text-white'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={rechargeAmount}
              onChange={(e) => setRechargeAmount(Number(e.target.value))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all text-center text-2xl font-bold"
            />
            <p className="text-sm text-gray-500 text-center mt-2">点额度</p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowRecharge(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRecharge}
                disabled={rechargeAmount <= 0 || loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-900 text-white font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                {loading ? '充值中...' : `确认充值 ${rechargeAmount} 点`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
