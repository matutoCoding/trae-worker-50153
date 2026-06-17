import { useEffect } from 'react';
import ScheduleGrid from '@/components/ScheduleGrid';
import { useAppStore } from '@/stores/useAppStore';
import { api } from '@/lib/api';

export default function Schedule() {
  const { rooms, setRooms } = useAppStore();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const list = await api.getRooms();
        setRooms(list);
      } catch (e) {
        console.error('加载琴房失败', e);
      }
    };
    if (rooms.length === 0) fetchRooms();
  }, [rooms.length, setRooms]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-serif">排期预约</h1>
        <p className="text-gray-500 mt-1">选择时段预约琴房，支持多选合并</p>
      </div>
      <ScheduleGrid />
    </div>
  );
}
