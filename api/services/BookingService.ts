import { BookingRepository } from '../repositories/BookingRepository.js'
import { RoomRepository } from '../repositories/RoomRepository.js'
import { FamilyRepository } from '../repositories/FamilyRepository.js'
import { CreditService, CreditInsufficientError } from './CreditService.js'
import { lockManager } from '../utils/LockManager.js'
import { beginTransaction, commit, rollback } from '../db/dbUtils.js'
import type {
  Booking,
  CreateBookingRequest,
  CreateBatchBookingRequest,
  ScheduleSlot,
  BookingConflictInfo,
} from '../../shared/types.js'
import { BookingConflictError } from '../../shared/types.js'

function calculateDurationMinutes(startTime: string, endTime: string): number {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  return Math.round((end - start) / 60000)
}

function calculateCredits(durationMinutes: number, hourlyRate: number): number {
  const hours = durationMinutes / 60
  return Math.ceil(hours * 2) * 0.5 * hourlyRate
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function mergeAdjacentByRoom(
  bookings: CreateBookingRequest[]
): CreateBookingRequest[] {
  if (bookings.length === 0) return []

  const byRoom = new Map<string, CreateBookingRequest[]>()
  for (const b of bookings) {
    const arr = byRoom.get(b.roomId) ?? []
    arr.push(b)
    byRoom.set(b.roomId, arr)
  }

  const result: CreateBookingRequest[] = []
  for (const [roomId, reqs] of byRoom) {
    const sorted = [...reqs].sort((a, b) => a.startTime.localeCompare(b.startTime))
    let cs = sorted[0].startTime
    let ce = sorted[0].endTime

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime === ce) {
        ce = sorted[i].endTime
      } else {
        result.push({ roomId, startTime: cs, endTime: ce })
        cs = sorted[i].startTime
        ce = sorted[i].endTime
      }
    }
    result.push({ roomId, startTime: cs, endTime: ce })
  }
  return result
}

function getMemberName(userId: string): string {
  const m = FamilyRepository.findMemberById(userId)
  return m?.name ?? '其他用户'
}

function validateAndCheckConflicts(
  mergedRequests: CreateBookingRequest[],
  excludeUserId?: string,
): {
  totalCredits: number
  conflicts: BookingConflictInfo[]
} {
  let totalCredits = 0
  const conflicts: BookingConflictInfo[] = []

  for (const req of mergedRequests) {
    const room = RoomRepository.findById(req.roomId)
    if (!room) {
      throw new Error('琴房不存在')
    }

    const start = new Date(req.startTime)
    const end = new Date(req.endTime)
    if (start >= end) {
      throw new Error('结束时间必须晚于开始时间')
    }

    const durationMinutes = calculateDurationMinutes(req.startTime, req.endTime)
    if (durationMinutes % 30 !== 0) {
      throw new Error('预约时长必须是 30 分钟的整数倍')
    }

    const existingConflicts = BookingRepository.findByRoomAndTimeRange(
      req.roomId,
      req.startTime,
      req.endTime,
    ).filter((b) => !excludeUserId || b.userId !== excludeUserId)

    if (existingConflicts.length > 0) {
      for (const c of existingConflicts) {
        conflicts.push({
          roomId: req.roomId,
          startTime: c.startTime,
          endTime: c.endTime,
          conflictUserId: c.userId,
          conflictUserName: getMemberName(c.userId),
        })
      }
    }

    const credits = calculateCredits(durationMinutes, room.hourlyRate)
    totalCredits = Math.round((totalCredits + credits) * 100) / 100
  }

  return { totalCredits, conflicts }
}

function createBookingsWithMerge(
  userId: string,
  familyId: string,
  mergedRequests: CreateBookingRequest[],
): Booking[] {
  const createdIds: string[] = []
  const result: Booking[] = []

  for (const req of mergedRequests) {
    const room = RoomRepository.findById(req.roomId)!
    const durationMinutes = calculateDurationMinutes(req.startTime, req.endTime)
    const credits = calculateCredits(durationMinutes, room.hourlyRate)

    let booking = BookingRepository.create({
      userId,
      familyId,
      roomId: req.roomId,
      startTime: req.startTime,
      endTime: req.endTime,
      durationMinutes,
      creditsUsed: credits,
      isMerged: false,
      mergedFromIds: [],
      status: 'active',
    })
    createdIds.push(booking.id)

    const adjacents = BookingRepository.findAdjacentBookings(
      req.roomId,
      userId,
      req.startTime,
      req.endTime,
    ).filter((b) => !createdIds.includes(b.id) && b.status === 'active')

    if (adjacents.length > 0) {
      const allToMerge = [booking, ...adjacents]
      const minStart = allToMerge.reduce(
        (min, b) => (new Date(b.startTime) < new Date(min) ? b.startTime : min),
        booking.startTime,
      )
      const maxEnd = allToMerge.reduce(
        (max, b) => (new Date(b.endTime) > new Date(max) ? b.endTime : max),
        booking.endTime,
      )
      const totalDuration = calculateDurationMinutes(minStart, maxEnd)
      const totalCreditsForMerge = calculateCredits(totalDuration, room.hourlyRate)
      const mergedIds = allToMerge.map((b) => b.id)

      adjacents.forEach((b) => BookingRepository.delete(b.id))
      BookingRepository.delete(booking.id)

      booking = BookingRepository.create({
        userId,
        familyId,
        roomId: req.roomId,
        startTime: minStart,
        endTime: maxEnd,
        durationMinutes: totalDuration,
        creditsUsed: totalCreditsForMerge,
        isMerged: true,
        mergedFromIds,
        status: 'active',
      })
    }

    result.push(booking)
  }

  return result
}

function buildLockKeys(roomIds: string[], familyId: string): string[] {
  const roomKeys = [...new Set(roomIds)]
    .sort()
    .map((id) => `room:booking:${id}`)
  return [...roomKeys, `family:credits:${familyId}`]
}

export const BookingService = {
  async createBatchBookings(
    userId: string,
    request: CreateBatchBookingRequest,
  ): Promise<Booking[]> {
    if (!request.bookings || request.bookings.length === 0) {
      throw new Error('预约时段不能为空')
    }

    const member = FamilyRepository.findMemberById(userId)
    if (!member) {
      throw new Error('用户不存在')
    }

    const mergedRequests = mergeAdjacentByRoom(request.bookings)
    const roomIds = [...new Set(mergedRequests.map((r) => r.roomId))]
    const lockKeys = buildLockKeys(roomIds, member.familyId)

    return lockManager.runWithMultiLock(
      lockKeys,
      async () => {
        beginTransaction()
        try {
          const { totalCredits, conflicts } = validateAndCheckConflicts(mergedRequests)
          if (conflicts.length > 0) {
            rollback()
            throw new BookingConflictError(conflicts)
          }

          const account = FamilyRepository.findAccountById(member.familyId)
          if (!account) {
            rollback()
            throw new Error('家庭账户不存在')
          }
          if (account.creditsBalance < totalCredits) {
            rollback()
            throw new CreditInsufficientError(account.creditsBalance, totalCredits)
          }

          const bookings = createBookingsWithMerge(userId, member.familyId, mergedRequests)

          for (const booking of bookings) {
            await CreditService.deductCredits(
              member.familyId,
              userId,
              booking.creditsUsed,
              booking.id,
              `预约 琴房 ${formatDate(new Date(booking.startTime))}`,
            )
          }

          const { conflicts: finalConflicts } = validateAndCheckConflicts(mergedRequests, userId)
          if (finalConflicts.length > 0) {
            rollback()
            throw new BookingConflictError(finalConflicts)
          }

          commit()
          return bookings
        } catch (error) {
          try { rollback() } catch { /* ignore */ }
          throw error
        }
      },
      15000,
    )
  },

  async createBooking(
    userId: string,
    request: CreateBookingRequest,
  ): Promise<Booking> {
    const member = FamilyRepository.findMemberById(userId)
    if (!member) {
      throw new Error('用户不存在')
    }

    const room = RoomRepository.findById(request.roomId)
    if (!room) {
      throw new Error('琴房不存在')
    }

    const lockKeys = buildLockKeys([request.roomId], member.familyId)

    return lockManager.runWithMultiLock(
      lockKeys,
      async () => {
        beginTransaction()
        try {
          const { totalCredits, conflicts } = validateAndCheckConflicts([request])
          if (conflicts.length > 0) {
            rollback()
            throw new BookingConflictError(conflicts)
          }

          const account = FamilyRepository.findAccountById(member.familyId)
          if (!account) {
            rollback()
            throw new Error('家庭账户不存在')
          }
          if (account.creditsBalance < totalCredits) {
            rollback()
            throw new CreditInsufficientError(account.creditsBalance, totalCredits)
          }

          const bookings = createBookingsWithMerge(userId, member.familyId, [request])

          for (const booking of bookings) {
            await CreditService.deductCredits(
              member.familyId,
              userId,
              booking.creditsUsed,
              booking.id,
              `预约 ${room.name} ${formatDate(new Date(request.startTime))}`,
            )
          }

          const { conflicts: finalConflictsSingle } = validateAndCheckConflicts([request], userId)
          if (finalConflictsSingle.length > 0) {
            rollback()
            throw new BookingConflictError(finalConflictsSingle)
          }

          commit()
          return bookings[0]
        } catch (error) {
          try { rollback() } catch { /* ignore */ }
          throw error
        }
      },
      15000,
    )
  },

  async cancelBooking(userId: string, bookingId: string): Promise<void> {
    const booking = BookingRepository.findById(bookingId)
    if (!booking) {
      throw new Error('预约不存在')
    }
    if (booking.status !== 'active') {
      throw new Error('预约已取消')
    }
    if (booking.userId !== userId) {
      throw new Error('无权取消他人的预约')
    }

    const member = FamilyRepository.findMemberById(userId)
    if (!member) {
      throw new Error('用户不存在')
    }

    const lockKeys = buildLockKeys([booking.roomId], member.familyId)

    await lockManager.runWithMultiLock(
      lockKeys,
      async () => {
        beginTransaction()
        try {
          const currentBooking = BookingRepository.findById(bookingId)
          if (!currentBooking || currentBooking.status !== 'active') {
            commit()
            return
          }

          await CreditService.refundCredits(
            currentBooking.familyId,
            userId,
            currentBooking.creditsUsed,
            currentBooking.id,
            `退订预约 ${formatDate(new Date(currentBooking.startTime))}`,
          )

          BookingRepository.cancel(currentBooking.id)
          commit()
        } catch (error) {
          try { rollback() } catch { /* ignore */ }
          throw error
        }
      },
      15000,
    )
  },

  async cancelBookingWithSplit(
    userId: string,
    bookingId: string,
    splitStartTime: string,
    splitEndTime: string,
  ): Promise<Booking[]> {
    const booking = BookingRepository.findById(bookingId)
    if (!booking) {
      throw new Error('预约不存在')
    }
    if (booking.status !== 'active') {
      throw new Error('预约已取消')
    }
    if (booking.userId !== userId) {
      throw new Error('无权取消他人的预约')
    }

    const member = FamilyRepository.findMemberById(userId)
    if (!member) {
      throw new Error('用户不存在')
    }

    const room = RoomRepository.findById(booking.roomId)
    if (!room) {
      throw new Error('琴房不存在')
    }

    const splitStart = new Date(splitStartTime)
    const splitEnd = new Date(splitEndTime)
    const bookingStart = new Date(booking.startTime)
    const bookingEnd = new Date(booking.endTime)

    if (splitStart < bookingStart || splitEnd > bookingEnd || splitStart >= splitEnd) {
      throw new Error('拆分时段无效')
    }

    const lockKeys = buildLockKeys([booking.roomId], member.familyId)

    return lockManager.runWithMultiLock(
      lockKeys,
      async () => {
        beginTransaction()
        try {
          const currentBooking = BookingRepository.findById(bookingId)
          if (!currentBooking || currentBooking.status !== 'active') {
            commit()
            return []
          }

          const resultBookings: Booking[] = []
          const splitDuration = calculateDurationMinutes(splitStartTime, splitEndTime)
          const splitCredits = calculateCredits(splitDuration, room.hourlyRate)

          if (splitStartTime === currentBooking.startTime && splitEndTime === currentBooking.endTime) {
            await CreditService.refundCredits(
              currentBooking.familyId,
              userId,
              currentBooking.creditsUsed,
              currentBooking.id,
              `退订预约 ${formatDate(new Date(currentBooking.startTime))}`,
            )
            BookingRepository.cancel(currentBooking.id)
            commit()
            return resultBookings
          }

          if (splitStartTime === currentBooking.startTime) {
            const remainingDuration = calculateDurationMinutes(splitEndTime, currentBooking.endTime)
            const remainingCredits = calculateCredits(remainingDuration, room.hourlyRate)

            BookingRepository.update(currentBooking.id, {
              startTime: splitEndTime,
              durationMinutes: remainingDuration,
              creditsUsed: remainingCredits,
              isMerged: false,
              mergedFromIds: [],
            })

            await CreditService.refundCredits(
              currentBooking.familyId,
              userId,
              splitCredits,
              currentBooking.id,
              `部分退订 ${formatDate(new Date(splitStartTime))}`,
            )

            const updated = BookingRepository.findById(currentBooking.id)
            if (updated) resultBookings.push(updated)
            commit()
            return resultBookings
          }

          if (splitEndTime === currentBooking.endTime) {
            const remainingDuration = calculateDurationMinutes(currentBooking.startTime, splitStartTime)
            const remainingCredits = calculateCredits(remainingDuration, room.hourlyRate)

            BookingRepository.update(currentBooking.id, {
              endTime: splitStartTime,
              durationMinutes: remainingDuration,
              creditsUsed: remainingCredits,
              isMerged: false,
              mergedFromIds: [],
            })

            await CreditService.refundCredits(
              currentBooking.familyId,
              userId,
              splitCredits,
              currentBooking.id,
              `部分退订 ${formatDate(new Date(splitStartTime))}`,
            )

            const updated = BookingRepository.findById(currentBooking.id)
            if (updated) resultBookings.push(updated)
            commit()
            return resultBookings
          }

          const beforeDuration = calculateDurationMinutes(currentBooking.startTime, splitStartTime)
          const beforeCredits = calculateCredits(beforeDuration, room.hourlyRate)
          const afterDuration = calculateDurationMinutes(splitEndTime, currentBooking.endTime)
          const afterCredits = calculateCredits(afterDuration, room.hourlyRate)

          BookingRepository.update(currentBooking.id, {
            endTime: splitStartTime,
            durationMinutes: beforeDuration,
            creditsUsed: beforeCredits,
            isMerged: false,
            mergedFromIds: [],
          })

          const afterBooking = BookingRepository.create({
            userId: currentBooking.userId,
            familyId: currentBooking.familyId,
            roomId: currentBooking.roomId,
            startTime: splitEndTime,
            endTime: currentBooking.endTime,
            durationMinutes: afterDuration,
            creditsUsed: afterCredits,
            isMerged: false,
            mergedFromIds: [],
            status: 'active',
          })

          await CreditService.refundCredits(
            currentBooking.familyId,
            userId,
            splitCredits,
            currentBooking.id,
            `中间时段退订 ${formatDate(new Date(splitStartTime))}`,
          )

          const beforeUpdated = BookingRepository.findById(currentBooking.id)
          if (beforeUpdated) resultBookings.push(beforeUpdated)
          resultBookings.push(afterBooking)

          commit()
          return resultBookings
        } catch (error) {
          try { rollback() } catch { /* ignore */ }
          throw error
        }
      },
      15000,
    )
  },

  getBookingsByUser(userId: string): Booking[] {
    return BookingRepository.findByUserId(userId)
  },

  getSchedule(startDate: string, endDate: string): ScheduleSlot[] {
    const rooms = RoomRepository.findAll()
    const bookings = BookingRepository.findByDateRange(startDate, endDate)

    const slots: ScheduleSlot[] = []
    const currentDate = new Date(startDate)
    const end = new Date(endDate)

    while (currentDate <= end) {
      const dateStr = formatDate(currentDate)

      for (const room of rooms) {
        for (let hour = 8; hour < 22; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const slotStart = new Date(currentDate)
            slotStart.setHours(hour, minute, 0, 0)
            const slotEnd = new Date(slotStart)
            slotEnd.setMinutes(slotEnd.getMinutes() + 30)

            const booking = bookings.find(
              (b) =>
                b.roomId === room.id &&
                new Date(b.startTime) <= slotStart &&
                new Date(b.endTime) >= slotEnd,
            )

            slots.push({
              roomId: room.id,
              date: dateStr,
              startTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
              endTime: `${slotEnd.getHours().toString().padStart(2, '0')}:${slotEnd.getMinutes().toString().padStart(2, '0')}`,
              bookingId: booking?.id ?? null,
              userId: booking?.userId ?? null,
              available: !booking,
            })
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    return slots
  },
}

export default BookingService
