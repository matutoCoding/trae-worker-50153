import { useState } from 'react';
import { Calendar, Clock, Piano, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import type { Booking, Room } from '@/../shared/types';
import { api } from '@/lib/api';

interface BookingCardProps {
  booking: Booking;
  rooms: Room[];
  onCancelled?: () => void;
}

export default function BookingCard({ booking, rooms, onCancelled }: BookingCardProps) {
  const [cancelling, setCancelling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const room = rooms.find((r) => r.id === booking.roomId);
  const startDate = new Date(booking.startTime);
  const endDate = new Date(booking.endTime);
  const hours = (booking.durationMinutes / 60).toFixed(1);

  const isCancelled = booking.status === 'cancelled';
  const isPast = endDate < new Date();

  const formatDate = (d: Date) =>
    `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.cancelBooking(booking.id);
      setConfirmOpen(false);
      onCancelled?.();
    } catch (e) {
      console.error('退订失败', e);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl border p-5 transition-all ${
      isCancelled ? 'border-gray-100 opacity-60' : 'border-gray-100 hover:shadow-md hover:shadow-emerald-900/5'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
            isCancelled ? 'bg-gray-100' : 'bg-emerald-50'
          }`}>
            <Piano className={`w-5 h-5 ${isCancelled ? 'text-gray-400' : 'text-emerald-700'}`} />
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{room?.name || '琴房'}</h4>
            <div className="flex items-center gap-3 mt-0.5">
              {booking.isMerged && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                  合并预约
                </span>
              )}
              {isCancelled ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  已退订
                </span>
              ) : isPast ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  已完成
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  待使用
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-emerald-900">{booking.creditsUsed}</p>
          <p className="text-xs text-gray-500">额度消耗</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-700">{formatDate(startDate)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-gray-700">
            {String(startDate.getHours()).padStart(2, '0')}:{String(startDate.getMinutes()).padStart(2, '0')} - {String(endDate.getHours()).padStart(2, '0')}:{String(endDate.getMinutes()).padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <p className="text-sm text-gray-500">时长 {hours} 小时</p>
        {!isCancelled && !isPast && (
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            退订
          </button>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">确认退订</h3>
            <p className="text-sm text-gray-600 mb-6">
              退订后将退还 {booking.creditsUsed} 点额度，确定要取消这个预约吗？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                再想想
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {cancelling ? '处理中...' : '确认退订'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
