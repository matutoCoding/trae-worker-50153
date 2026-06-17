export interface Room {
  id: string
  name: string
  type: 'upright' | 'grand' | 'digital'
  description: string
  hourlyRate: number
  createdAt: string
}

export interface Booking {
  id: string
  userId: string
  familyId: string
  roomId: string
  startTime: string
  endTime: string
  durationMinutes: number
  creditsUsed: number
  isMerged: boolean
  mergedFromIds: string[]
  createdAt: string
  status: 'active' | 'cancelled'
}

export interface FamilyAccount {
  id: string
  name: string
  ownerId: string
  creditsBalance: number
  creditsTotal: number
  version: number
  createdAt: string
}

export interface FamilyMember {
  id: string
  familyId: string
  name: string
  role: 'owner' | 'member'
  avatar: string
  createdAt: string
}

export interface CreditTransaction {
  id: string
  familyId: string
  userId: string
  type: 'recharge' | 'consume' | 'refund'
  amount: number
  balanceAfter: number
  bookingId?: string
  description: string
  createdAt: string
}

export interface ScheduleSlot {
  roomId: string
  date: string
  startTime: string
  endTime: string
  bookingId: string | null
  userId: string | null
  available: boolean
}

export interface CreateBookingRequest {
  roomId: string
  startTime: string
  endTime: string
}

export interface CreateBookingResponse {
  success: boolean
  booking?: Booking
  message?: string
}

export interface DurationStats {
  date: string
  durationMinutes: number
}

export interface MemberRanking {
  userId: string
  name: string
  durationMinutes: number
}

export interface CreateRoomRequest {
  name: string
  type: 'upright' | 'grand' | 'digital'
  description: string
  hourlyRate: number
}

export interface FamilyInfo {
  account: FamilyAccount
  members: FamilyMember[]
}

export interface AddMemberRequest {
  name: string
  role: 'owner' | 'member'
  avatar: string
}
