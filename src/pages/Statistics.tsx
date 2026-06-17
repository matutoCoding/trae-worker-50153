import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Trophy, Clock, TrendingUp, Medal } from 'lucide-react';
import type { DurationStats, MemberRanking } from '@/../shared/types';
import { api } from '@/lib/api';

export default function Statistics() {
  const [durationStats, setDurationStats] = useState<DurationStats[]>([]);
  const [ranking, setRanking] = useState<MemberRanking[]>([]);
  const [days, setDays] = useState<7 | 14 | 30>(7);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        const startDate = start.toISOString().split('T')[0];
        const endDate = end.toISOString().split('T')[0];

        const [stats, rank] = await Promise.all([
          api.getDurationStats(startDate, endDate),
          api.getMemberRanking(startDate, endDate),
        ]);
        setDurationStats(
          stats.map((s) => ({
            ...s,
            date: s.date.slice(5),
            hours: +(s.durationMinutes / 60).toFixed(1),
          }))
        );
        setRanking(rank);
      } catch (e) {
        console.error('加载统计失败', e);
      }
    };
    fetchData();
  }, [days]);

  const totalMinutes = durationStats.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const avgHours = durationStats.length > 0 ? (totalMinutes / 60 / durationStats.length).toFixed(1) : '0';
  const maxDay = durationStats.reduce(
    (max, s) => (s.durationMinutes > max.durationMinutes ? s : max),
    { date: '-', durationMinutes: 0 } as DurationStats & { date: string }
  );

  const medalColors = ['from-amber-400 to-amber-600', 'from-gray-300 to-gray-500', 'from-orange-400 to-orange-600'];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif">练习统计</h1>
          <p className="text-gray-500 mt-1">查看你的练习数据和家庭排行</p>
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-emerald-900 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              近{d}天
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-300" />
            </div>
            <span className="text-sm text-emerald-200/80">累计练习</span>
          </div>
          <p className="text-3xl font-bold">
            {totalHours}
            <span className="text-base font-normal text-emerald-200/70 ml-1">小时</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">日均练习</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {avgHours}
            <span className="text-base font-normal text-gray-400 ml-1">小时</span>
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-rose-600" />
            </div>
            <span className="text-sm text-gray-500">单日最长</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {((maxDay.durationMinutes || 0) / 60).toFixed(1)}
            <span className="text-base font-normal text-gray-400 ml-1">小时</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{maxDay.date}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <BarChart className="w-5 h-5 text-emerald-700" />
          练习时长趋势
        </h2>
        <div className="h-64">
          {durationStats.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={durationStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#999' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#999' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}h`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                  }}
                  formatter={(value: number) => [`${value} 小时`, '练习时长']}
                  labelFormatter={(label) => `日期: ${label}`}
                />
                <Bar
                  dataKey="hours"
                  fill="#1B4332"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              暂无练习数据
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Medal className="w-5 h-5 text-amber-600" />
          家庭成员排行
        </h2>
        {ranking.length > 0 ? (
          <div className="space-y-3">
            {ranking.map((member, idx) => (
              <div key={member.userId} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${
                  idx < 3 ? medalColors[idx] : 'from-gray-200 to-gray-300'
                } flex items-center justify-center text-white font-bold text-sm`}>
                  {idx < 3 ? idx + 1 : idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{member.name}</p>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-900 to-emerald-600 rounded-full transition-all"
                      style={{
                        width: `${ranking[0] ? (member.durationMinutes / ranking[0].durationMinutes) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-900">
                    {(member.durationMinutes / 60).toFixed(1)}
                    <span className="text-sm font-normal text-gray-500 ml-1">小时</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            暂无排行数据
          </div>
        )}
      </div>
    </div>
  );
}
