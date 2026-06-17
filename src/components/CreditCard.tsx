import { Wallet } from 'lucide-react';

interface CreditCardProps {
  balance: number;
  total: number;
  familyName?: string;
}

export default function CreditCard({ balance, total, familyName }: CreditCardProps) {
  const used = Math.max(0, total - balance);
  const percentage = total > 0 ? Math.round((balance / total) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800 p-6 text-white shadow-xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-700/20 rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400/10 rounded-full translate-y-1/2 -translate-x-1/3" />

      <div className="relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <p className="text-sm text-emerald-200/80">家庭额度账户</p>
              {familyName && <p className="text-lg font-serif font-semibold">{familyName}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-emerald-200/60">可用比例</p>
            <p className="text-xl font-bold text-amber-300">{percentage}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-emerald-200/70 mb-1">剩余额度</p>
            <p className="text-4xl font-bold tracking-tight">
              {balance.toLocaleString()}
              <span className="text-lg font-normal text-emerald-200/60 ml-1">点</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-emerald-200/70 mb-1">已用额度</p>
            <p className="text-4xl font-bold tracking-tight text-emerald-200">
              {used.toLocaleString()}
              <span className="text-lg font-normal text-emerald-200/60 ml-1">点</span>
            </p>
          </div>
        </div>

        <div className="relative w-full h-2 bg-emerald-950/50 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-emerald-200/60">0</span>
          <span className="text-xs text-emerald-200/60">总额度 {total.toLocaleString()} 点</span>
        </div>
      </div>
    </div>
  );
}
