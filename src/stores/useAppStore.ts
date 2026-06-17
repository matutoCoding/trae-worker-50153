import { create } from 'zustand';
import type { Room, Booking, FamilyInfo, ScheduleSlot } from '@/../shared/types';

interface User {
  userId: string;
  name: string;
  familyId: string;
  role: 'owner' | 'member';
  avatar: string;
}

interface SelectedSlot {
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface AppState {
  user: User | null;
  familyInfo: FamilyInfo | null;
  rooms: Room[];
  myBookings: Booking[];
  scheduleSlots: ScheduleSlot[];
  selectedSlots: SelectedSlot[];
  setUser: (user: User | null) => void;
  setFamilyInfo: (info: FamilyInfo | null) => void;
  setRooms: (rooms: Room[]) => void;
  setMyBookings: (bookings: Booking[]) => void;
  setScheduleSlots: (slots: ScheduleSlot[]) => void;
  toggleSelectedSlot: (slot: SelectedSlot) => void;
  clearSelectedSlots: () => void;
  removeSelectedSlots: (slots: SelectedSlot[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  familyInfo: null,
  rooms: [],
  myBookings: [],
  scheduleSlots: [],
  selectedSlots: [],
  setUser: (user) => set({ user }),
  setFamilyInfo: (familyInfo) => set({ familyInfo }),
  setRooms: (rooms) => set({ rooms }),
  setMyBookings: (myBookings) => set({ myBookings }),
  setScheduleSlots: (scheduleSlots) => set({ scheduleSlots }),
  toggleSelectedSlot: (slot) =>
    set((state) => {
      const exists = state.selectedSlots.some(
        (s) =>
          s.roomId === slot.roomId &&
          s.date === slot.date &&
          s.startTime === slot.startTime
      );
      if (exists) {
        return {
          selectedSlots: state.selectedSlots.filter(
            (s) =>
              !(
                s.roomId === slot.roomId &&
                s.date === slot.date &&
                s.startTime === slot.startTime
              )
          ),
        };
      }
      return { selectedSlots: [...state.selectedSlots, slot] };
    }),
  clearSelectedSlots: () => set({ selectedSlots: [] }),
  removeSelectedSlots: (toRemove) =>
    set((state) => {
      const toRemoveSet = new Set(
        toRemove.map((s) => `${s.roomId}|${s.date}|${s.startTime}`)
      );
      return {
        selectedSlots: state.selectedSlots.filter(
          (s) => !toRemoveSet.has(`${s.roomId}|${s.date}|${s.startTime}`)
        ),
      };
    }),
}));
