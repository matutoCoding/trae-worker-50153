import type {
  Room,
  Booking,
  ScheduleSlot,
  FamilyInfo,
  CreditTransaction,
  DurationStats,
  MemberRanking,
  CreateBookingRequest,
  CreateBookingResponse,
  CreateBatchBookingRequest,
  AddMemberRequest,
  FamilyMember,
} from '@/../shared/types';

const BASE_URL = '/api';

function getUserId(): string {
  return localStorage.getItem('userId') || 'user-1';
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('x-user-id', getUserId());
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({ success: false, message: response.statusText }));

  if (!response.ok || !json.success) {
    throw new Error(json.message || `HTTP ${response.status}`);
  }

  return json.data as T;
}

export const api = {
  login: async (userId: string): Promise<{ success: boolean }> => {
    localStorage.setItem('userId', userId);
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
      headers: { 'x-user-id': userId, 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  getRooms: (): Promise<Room[]> => request('/rooms'),

  getSchedule: (startDate: string, endDate: string): Promise<ScheduleSlot[]> =>
    request(`/schedule?startDate=${startDate}&endDate=${endDate}`),

  createBooking: (data: CreateBookingRequest): Promise<Booking> =>
    request('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createBatchBookings: (data: CreateBatchBookingRequest): Promise<Booking[]> =>
    request('/bookings/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelBooking: (bookingId: string): Promise<{ success: boolean }> =>
    request(`/bookings/${bookingId}`, {
      method: 'DELETE',
    }),

  getMyBookings: (): Promise<Booking[]> => request('/bookings/mine'),

  getFamilyInfo: (): Promise<FamilyInfo> => request('/family'),

  addMember: (data: AddMemberRequest): Promise<FamilyMember> =>
    request('/family/members', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeMember: (memberId: string): Promise<{ success: boolean }> =>
    request(`/family/members/${memberId}`, {
      method: 'DELETE',
    }),

  getTransactions: (): Promise<CreditTransaction[]> =>
    request('/family/credits/transactions'),

  rechargeCredits: (amount: number): Promise<CreditTransaction> =>
    request('/family/credits/recharge', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    }),

  getDurationStats: (startDate: string, endDate: string): Promise<DurationStats[]> =>
    request(`/statistics/duration?startDate=${startDate}&endDate=${endDate}`),

  getMemberRanking: (startDate: string, endDate: string): Promise<MemberRanking[]> =>
    request(`/statistics/ranking?startDate=${startDate}&endDate=${endDate}`),
};
