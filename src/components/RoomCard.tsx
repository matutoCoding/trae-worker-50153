import { useNavigate } from 'react-router-dom';
import { Piano, Calendar, ArrowRight } from 'lucide-react';
import type { Room } from '@/../shared/types';

interface RoomCardProps {
  room: Room;
}

const typeLabels: Record<Room['type'], { label: string; color: string }> = {
  upright: { label: '立式钢琴', color: 'bg-emerald-100 text-emerald-800' },
  grand: { label: '三角钢琴', color: 'bg-amber-100 text-amber-800' },
  digital: { label: '数码钢琴', color: 'bg-sky-100 text-sky-800' },
};

export default function RoomCard({ room }: RoomCardProps) {
  const navigate = useNavigate();
  const typeInfo = typeLabels[room.type];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:shadow-emerald-900/5 transition-all duration-300 group">
      <div className="h-40 bg-gradient-to-br from-emerald-900 via-emerald-800 to-emerald-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(212,163,115,0.3),transparent_50%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Piano className="w-16 h-16 text-amber-300/80" strokeWidth={1.5} />
        </div>
        <div className="absolute top-3 left-3">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-1.5">{room.name}</h3>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2 h-10">{room.description}</p>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold text-emerald-900">{room.hourlyRate}</span>
            <span className="text-sm text-gray-500 ml-1">点/小时</span>
          </div>
          <button
            onClick={() => navigate(`/schedule?roomId=${room.id}`)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-900 text-white text-sm font-medium rounded-xl hover:bg-emerald-800 transition-colors group-hover:gap-2"
          >
            <Calendar className="w-4 h-4" />
            预约
            <ArrowRight className="w-4 h-4 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
}
