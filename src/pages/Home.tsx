import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Users, BarChart3, ArrowRight, Sparkles } from 'lucide-react';
import CreditCard from '@/components/CreditCard';
import RoomCard from '@/components/RoomCard';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/lib/api';

const quickActions = [
  { path: '/schedule', label: '立即预约', icon: Calendar, color: 'from-emerald-900 to-emerald-700' },
  { path: '/bookings', label: '我的预约', icon: Clock, color: 'from-amber-600 to-amber-500' },
  { path: '/family', label: '家庭账户', icon: Users, color: 'from-sky-700 to-sky-500' },
  { path: '/statistics', label: '练习统计', icon: BarChart3, color: 'from-rose-600 to-rose-500' },
];

export default function Home() {
  const { familyInfo, rooms, setFamilyInfo, setRooms } = useAppStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [family, roomList] = await Promise.all([
          api.getFamilyInfo(),
          api.getRooms(),
        ]);
        setFamilyInfo(family);
        setRooms(roomList);
      } catch (e) {
        console.error('加载数据失败', e);
      }
    };
    fetchData();
  }, [setFamilyInfo, setRooms]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif">欢迎回来</h1>
          <p className="text-gray-500 mt-1">开始今天的练习吧</p>
        </div>
      </div>

      {familyInfo && (
        <CreditCard
          balance={familyInfo.account.creditsBalance}
          total={familyInfo.account.creditsTotal}
          familyName={familyInfo.account.name}
        />
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            快捷入口
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.path}
                to={action.path}
                className={`relative overflow-hidden rounded-2xl p-4 text-white bg-gradient-to-br ${action.color} hover:shadow-lg hover:shadow-emerald-900/20 transition-all group`}
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{action.label}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">琴房快览</h2>
          <Link
            to="/schedule"
            className="text-sm text-emerald-700 font-medium hover:text-emerald-800 flex items-center gap-1"
          >
            查看全部 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
          {rooms.length > 0 ? (
            rooms.map((room) => (
              <div key={room.id} className="w-72 flex-shrink-0 snap-start">
                <RoomCard room={room} />
              </div>
            ))
          ) : (
            <div className="w-full py-12 text-center text-gray-400">
              暂无琴房数据
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
