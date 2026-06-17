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

export type CreditTransactionType = 'recharge' | 'consume' | 'refund'
export type CreditTransactionSubType =
  | 'top-up'
  | 'booking'
  | 'cancel'
  | 'rollback'
  | 'other'

export interface CreditTransaction {
  id: string
  familyId: string
  userId: string
  type: CreditTransactionType
  subType: CreditTransactionSubType
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

export interface CreateBatchBookingRequest {
  bookings: CreateBookingRequest[]
}

export interface CreateBatchBookingResponse {
  success: boolean
  bookings?: Booking[]
  message?: string
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

export interface BookingConflictInfo {
  roomId: string
  startTime: string
  endTime: string
  conflictUserId?: string
  conflictUserName?: string
}

export class BookingConflictError extends Error {
  public readonly conflicts: BookingConflictInfo[]
  constructor(conflicts: BookingConflictInfo[], message?: string) {
    super(
      message ||
        `以下时段已被他人预约：${conflicts
          .map(
            (c) =>
              `${c.startTime.replace('T', ' ').slice(5, 16)}-${c.endTime.slice(11, 16)}`
          )
          .join('；')}，请刷新页面重新选择`
    )
    this.name = 'BookingConflictError'
    this.conflicts = conflicts
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      conflicts: this.conflicts,
    }
  }
}
