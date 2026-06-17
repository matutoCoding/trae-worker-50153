import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Check, Clock, AlertCircle, User, MapPin, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { api, type ApiError } from '@/lib/api';
import type { Room, ScheduleSlot, BookingConflictInfo } from '@/../shared/types';

const TIME_START = 8;
const TIME_END = 22;
const SLOT_MINUTES = 30;

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export default function ScheduleGrid() {
  const { rooms, selectedSlots, toggleSelectedSlot, clearSelectedSlots, user, removeSelectedSlots, setFamilyInfo } = useAppStore();
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [scheduleData, setScheduleData] = useState<Map<string, ScheduleSlot>>(new Map());
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [conflictInfos, setConflictInfos] = useState<BookingConflictInfo[]>([]);
  const [noRetrySlots, setNoRetrySlots] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const timeSlots = useMemo(() => {
    const slots: { hour: number; minute: number; label: string }[] = [];
    for (let h = TIME_START; h < TIME_END; h++) {
      for (let m = 0; m < 60; m += SLOT_MINUTES) {
        slots.push({ hour: h, minute: m, label: formatTime(h, m) });
      }
    }
    return slots;
  }, []);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (rooms.length === 0) return;
      setLoading(true);
      const allSlots = new Map<string, ScheduleSlot>();
      try {
        const startDate = formatDate(weekDates[0]);
        const endDate = formatDate(weekDates[weekDates.length - 1]);
        const slots = await api.getSchedule(startDate, endDate);
        slots.forEach((slot) => {
          allSlots.set(`${slot.roomId}-${slot.date}-${slot.startTime}`, slot);
        });
      } finally {
        setScheduleData(allSlots);
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [rooms, weekDates]);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const getSlotKey = (roomId: string, date: string, startTime: string) =>
    `${roomId}-${date}-${startTime}`;

  const handleSlotClick = (room: Room, date: Date, slot: { hour: number; minute: number }) => {
    const dateStr = formatDate(date);
    const startTime = formatTime(slot.hour, slot.minute);
    const endTime = formatTime(
      slot.minute + SLOT_MINUTES >= 60 ? slot.hour + 1 : slot.hour,
      (slot.minute + SLOT_MINUTES) % 60
    );
    const key = getSlotKey(room.id, dateStr, startTime);
    const existing = scheduleData.get(key);
    if (existing && !existing.available) return;

    toggleSelectedSlot({
      roomId: room.id,
      date: dateStr,
      startTime,
      endTime,
    });
    setShowDrawer(true);
  };

  const isSlotSelected = (roomId: string, date: string, startTime: string) =>
    selectedSlots.some(
      (s) => s.roomId === roomId && s.date === date && s.startTime === startTime
    );

  const isSlotBooked = (roomId: string, date: string, startTime: string) => {
    const key = getSlotKey(roomId, date, startTime);
    const slot = scheduleData.get(key);
    return slot ? !slot.available : false;
  };

  const isSlotMine = (roomId: string, date: string, startTime: string) => {
    const key = getSlotKey(roomId, date, startTime);
    const slot = scheduleData.get(key);
    return slot ? slot.userId === user?.userId : false;
  };

  const selectedByRoom = useMemo(() => {
    const grouped = new Map<string, typeof selectedSlots>();
    selectedSlots.forEach((s) => {
      const arr = grouped.get(s.roomId) || [];
      arr.push(s);
      grouped.set(s.roomId, arr);
    });
    return grouped;
  }, [selectedSlots]);

  const totalMinutes = selectedSlots.length * SLOT_MINUTES;
  const totalHours = (totalMinutes / 60).toFixed(1);

  const buildBatchBookings = (slots: typeof selectedSlots) => {
    const byRoom = new Map<string, typeof selectedSlots>();
    for (const slot of slots) {
      const arr = byRoom.get(slot.roomId) ?? [];
      arr.push(slot);
      byRoom.set(slot.roomId, arr);
    }
    const batchBookings: { roomId: string; startTime: string; endTime: string }[] = [];

    byRoom.forEach((roomSlots, roomId) => {
      const sorted = [...roomSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
      let currentStart = sorted[0];
      let prevEnd = sorted[0];

      const flush = () => {
        batchBookings.push({
          roomId,
          startTime: `${currentStart.date}T${currentStart.startTime}:00`,
          endTime: `${prevEnd.date}T${prevEnd.endTime}:00`,
        });
      };

      for (let i = 1; i < sorted.length; i++) {
        const slot = sorted[i];
        if (slot.date === prevEnd.date && slot.startTime === prevEnd.endTime) {
          prevEnd = slot;
        } else {
          flush();
          currentStart = slot;
          prevEnd = slot;
        }
      }
      flush();
    });

    return batchBookings;
  };

  const fetchWeekSchedule = async () => {
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    const weekEndStr = end.toISOString().split('T')[0];
    try {
      const slotMap = new Map<string, ScheduleSlot>();
      for (const room of rooms) {
        const list = await api.getWeekSchedule(room.id, weekStartStr, weekEndStr);
        for (const s of list) {
          slotMap.set(s.id, s);
        }
      }
      setScheduleData(slotMap);
    } catch (e) {
      console.error('刷新排期失败', e);
    }
  };

  const refreshFamilyInfo = async () => {
    try {
      const info = await api.getFamilyInfo();
      setFamilyInfo(info);
    } catch (e) {
      console.error('刷新家庭信息失败', e);
    }
  };

  const submitBookings = async (slots: typeof selectedSlots) => {
    if (slots.length === 0) {
      return { success: false, error: '没有可预约的时段' };
    }

    const batchBookings = buildBatchBookings(slots);
    if (batchBookings.length === 0) {
      return { success: false, error: '没有可预约的时段' };
    }

    setBookingLoading(true);
    try {
      await api.createBatchBookings({ bookings: batchBookings });
      clearSelectedSlots();
      setShowDrawer(false);
      setBookingError(null);
      setConflictInfos([]);
      setNoRetrySlots(false);
      fetchWeekSchedule();
      refreshFamilyInfo();
      return { success: true };
    } catch (e) {
      const apiErr = e as ApiError;
      let errorMessage = '预约失败，请稍后重试';
      let conflicts: BookingConflictInfo[] = [];

      if (apiErr.code === 'LOCK_TIMEOUT') {
        errorMessage = '预约等待超时，当前时段较热门，请稍后重试或选择其他时段';
      } else if (apiErr.code === 'LOCK_QUEUE_FULL') {
        errorMessage = '系统繁忙，当前排队人数较多，请稍后再试';
      } else if (apiErr.code === 'BOOKING_CONFLICT') {
        errorMessage = '部分时段已被他人抢先预约，请查看下方详情后调整选择';
        if (apiErr.conflicts && apiErr.conflicts.length > 0) {
          conflicts = apiErr.conflicts;
        }
      } else if (apiErr.code === 'CREDIT_INSUFFICIENT') {
        const cur = apiErr.currentBalance ?? 0;
        const req = apiErr.requiredAmount ?? 0;
        errorMessage = `家庭额度不足。当前剩余 ${cur} 点，本次需要 ${req} 点，请先充值`;
      } else if (apiErr instanceof Error) {
        errorMessage = apiErr.message;
      }

      return { success: false, error: errorMessage, conflicts };
    } finally {
      setBookingLoading(false);
    }
  };

  const handleConfirm = async () => {
    setBookingError(null);
    setConflictInfos([]);
    setNoRetrySlots(false);

    const result = await submitBookings(selectedSlots);
    if (!result.success) {
      setBookingError(result.error || '预约失败');
      if (result.conflicts && result.conflicts.length > 0) {
        setConflictInfos(result.conflicts);
      }
    }
  };

  const getSlotsOverlappingConflicts = () => {
    if (conflictInfos.length === 0) return [];
    return selectedSlots.filter((slot) => {
      const slotStart = new Date(`${slot.date}T${slot.startTime}:00`).getTime();
      const slotEnd = new Date(`${slot.date}T${slot.endTime}:00`).getTime();
      return conflictInfos.some((c) => {
        if (c.roomId !== slot.roomId) return false;
        const cStart = new Date(c.startTime).getTime();
        const cEnd = new Date(c.endTime).getTime();
        return slotStart < cEnd && slotEnd > cStart;
      });
    });
  };

  const getNonConflictingSlots = () => {
    if (conflictInfos.length === 0) return [...selectedSlots];
    return selectedSlots.filter((slot) => {
      const slotStart = new Date(`${slot.date}T${slot.startTime}:00`).getTime();
      const slotEnd = new Date(`${slot.date}T${slot.endTime}:00`).getTime();
      return !conflictInfos.some((c) => {
        if (c.roomId !== slot.roomId) return false;
        const cStart = new Date(c.startTime).getTime();
        const cEnd = new Date(c.endTime).getTime();
        return slotStart < cEnd && slotEnd > cStart;
      });
    });
  };

  const handleRemoveConflictsAndRetry = async () => {
    const remainingSlots = getNonConflictingSlots();

    if (remainingSlots.length === 0) {
      setNoRetrySlots(true);
      setBookingError('清除冲突后已无可预约时段，请关闭后重新选择其他时段');
      return;
    }

    removeSelectedSlots(getSlotsOverlappingConflicts());
    setConflictInfos([]);
    setNoRetrySlots(false);
    setBookingError(null);

    const result = await submitBookings(remainingSlots);
    if (!result.success) {
      setBookingError(result.error || '重试失败');
      if (result.conflicts && result.conflicts.length > 0) {
        setConflictInfos(result.conflicts);
      }
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={prevWeek}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 - {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
            </h2>
            <p className="text-sm text-gray-500">共 {rooms.length} 间琴房 · 30分钟/时段</p>
          </div>
          <button
            onClick={nextWeek}
            className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        {loading && <div className="text-sm text-gray-500">加载中...</div>}
      </div>

      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-white border border-gray-200" />
          <span className="text-gray-600">可预约</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-gray-200" />
          <span className="text-gray-600">已预约</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-200" />
          <span className="text-gray-600">我的预约</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-emerald-700" />
          <span className="text-gray-600">已选中</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-2xl bg-white">
        <div className="min-w-max">
          <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="w-20 flex-shrink-0 p-3 border-r border-gray-100" />
            {weekDates.map((date, i) => {
              const isToday = formatDate(date) === formatDate(new Date());
              return (
                <div
                  key={i}
                  className={`flex-1 min-w-[110px] p-3 text-center border-r border-gray-100 last:border-r-0 ${
                    isToday ? 'bg-emerald-50/50' : ''
                  }`}
                >
                  <p className={`text-xs mb-0.5 ${isToday ? 'text-emerald-700 font-medium' : 'text-gray-500'}`}>
                    {weekDayNames[i]}
                  </p>
                  <p className={`text-lg font-bold ${isToday ? 'text-emerald-900' : 'text-gray-900'}`}>
                    {date.getMonth() + 1}/{date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {rooms.map((room) => (
            <div key={room.id} className="border-b border-gray-100 last:border-b-0">
              <div className="flex">
                <div className="w-20 flex-shrink-0 p-3 border-r border-gray-100 bg-gray-50/50 sticky left-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{room.name}</p>
                  <p className="text-xs text-gray-500">{room.hourlyRate}点/h</p>
                </div>
                {weekDates.map((date) => (
                  <div
                    key={date.toISOString()}
                    className="flex-1 min-w-[110px] border-r border-gray-100 last:border-r-0 relative"
                  >
                    {timeSlots.map((slot) => {
                      const dateStr = formatDate(date);
                      const selected = isSlotSelected(room.id, dateStr, slot.label);
                      const booked = isSlotBooked(room.id, dateStr, slot.label);
                      const mine = isSlotMine(room.id, dateStr, slot.label);

                      return (
                        <button
                          key={slot.label}
                          onClick={() => handleSlotClick(room, date, slot)}
                          disabled={booked && !mine}
                          className={`w-full h-7 border-b border-gray-50 last:border-b-0 transition-colors ${
                            selected
                              ? 'bg-emerald-700 hover:bg-emerald-600'
                              : mine
                              ? 'bg-amber-200 hover:bg-amber-300'
                              : booked
                              ? 'bg-gray-200 cursor-not-allowed'
                              : 'hover:bg-emerald-50'
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex">
                <div className="w-20 flex-shrink-0 border-r border-gray-100 bg-gray-50/50" />
                {weekDates.map((date, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-[110px] border-r border-gray-100 last:border-r-0 relative h-0"
                  >
                    {timeSlots
                      .filter((_, idx) => idx % 2 === 0)
                      .map((slot, idx) => (
                        <div
                          key={slot.label}
                          className="absolute left-0 -bottom-1 text-[10px] text-gray-400"
                          style={{ top: idx * 56 + 4 }}
                        >
                          {slot.label}
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showDrawer && selectedSlots.length > 0 && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setShowDrawer(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 max-h-[70vh] overflow-hidden flex flex-col">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 mb-2" />
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">确认预约</h3>
                <button
                  onClick={() => {
                    clearSelectedSlots();
                    setShowDrawer(false);
                  }}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Clock className="w-4 h-4" />
                  共 {totalHours} 小时 ({selectedSlots.length} 个时段)
                </div>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {Array.from(selectedByRoom.entries()).map(([roomId, slots]) => {
                const room = rooms.find((r) => r.id === roomId);
                const minutes = slots.length * SLOT_MINUTES;
                const credits = Math.ceil((minutes / 60) * (room?.hourlyRate || 0));
                return (
                  <div key={roomId} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900">{room?.name}</p>
                      <span className="text-sm text-emerald-700 font-medium">
                        {credits} 点
                      </span>
                    </div>
                    {slots
                      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                      .map((s, i) => (
                        <p key={i} className="text-sm text-gray-600">
                          {s.date} {s.startTime} - {s.endTime}
                        </p>
                      ))}
                  </div>
                );
              })}
              {bookingError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">{bookingError}</div>
                </div>
              )}

              {conflictInfos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">冲突时段详情</p>
                    {!noRetrySlots && (
                      <button
                        onClick={handleRemoveConflictsAndRetry}
                        disabled={bookingLoading}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-medium hover:bg-amber-200 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        清除冲突时段并重试
                      </button>
                    )}
                    {noRetrySlots && (
                      <span className="text-xs text-gray-400 font-medium">
                        无可重试时段
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {conflictInfos.map((c, idx) => {
                      const room = rooms.find((r) => r.id === c.roomId);
                      const startDt = new Date(c.startTime);
                      const endDt = new Date(c.endTime);
                      const month = startDt.getMonth() + 1;
                      const day = startDt.getDate();
                      const fmt = (d: Date) =>
                        `${d.getHours().toString().padStart(2, '0')}:${d
                          .getMinutes()
                          .toString()
                          .padStart(2, '0')}`;
                      return (
                        <div
                          key={idx}
                          className="bg-red-50/60 border border-red-100 rounded-xl p-3"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-3.5 h-3.5 text-red-600" />
                            <span className="text-sm font-semibold text-gray-900">
                              {room?.name ?? '未知琴房'}
                            </span>
                            <span className="text-xs text-gray-500 ml-auto">
                              {month}月{day}日
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Clock className="w-3.5 h-3.5 text-gray-500" />
                            <span>
                              {fmt(startDt)} - {fmt(endDt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-red-700 bg-red-100/60 rounded-lg px-2.5 py-1.5 inline-flex">
                            <User className="w-3 h-3" />
                            <span>
                              被 {c.conflictUserName ?? '其他用户'} 占用
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  clearSelectedSlots();
                  setShowDrawer(false);
                }}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={bookingLoading}
                className="flex-[2] py-3 rounded-xl bg-emerald-900 text-white font-medium hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {bookingLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    预约中...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    确认预约
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
