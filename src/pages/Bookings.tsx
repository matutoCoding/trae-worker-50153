import { useEffect, useState } from 'react';
import { Clock, CalendarCheck } from 'lucide-react';
import BookingCard from '@/components/BookingCard';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/lib/api';

export default function Bookings() {
  const { myBookings, rooms, setMyBookings, setRooms } = useAppStore();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');

  const fetchData = async () => {
    try {
      const [bookings, roomList] = await Promise.all([
        api.getMyBookings(),
        api.getRooms(),
      ]);
      setMyBookings(bookings);
      setRooms(roomList);
    } catch (e) {
      console.error('加载预约失败', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, [setMyBookings, setRooms]);

  const filteredBookings = myBookings.filter((b) => {
    if (b.status === 'cancelled') return false;
    const isPast = new Date(b.endTime) < new Date();
    if (filter === 'upcoming') return !isPast;
    if (filter === 'completed') return isPast;
    return true;
  });

  const sorted = [...filteredBookings].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  const upcomingCount = myBookings.filter(
    (b) => b.status !== 'cancelled' && new Date(b.endTime) >= new Date()
  ).length;

  const completedCount = myBookings.filter(
    (b) => b.status !== 'cancelled' && new Date(b.endTime) < new Date()
  ).length;

  const tabs: { key: typeof filter; label: string; icon: typeof Clock; count: number }[] = [
    { key: 'all', label: '全部', icon: CalendarCheck, count: myBookings.filter((b) => b.status !== 'cancelled').length },
    { key: 'upcoming', label: '待使用', icon: Clock, count: upcomingCount },
    { key: 'completed', label: '已完成', icon: CalendarCheck, count: completedCount },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-serif">我的预约</h1>
        <p className="text-gray-500 mt-1">查看和管理你的琴房预约</p>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-emerald-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-4">
          {sorted.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              rooms={rooms}
              onCancelled={fetchData}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <CalendarCheck className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-500">暂无预约记录</p>
        </div>
      )}
    </div>
  );
}
