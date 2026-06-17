import { BookingRepository } from '../repositories/BookingRepository.js'
import { RoomRepository } from '../repositories/RoomRepository.js'
import { FamilyRepository } from '../repositories/FamilyRepository.js'
import { CreditService } from './CreditService.js'
import { lockManager } from '../utils/LockManager.js'
import type { Booking, CreateBookingRequest, ScheduleSlot } from '../../shared/types.js'

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

export const BookingService = {
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

    const start = new Date(request.startTime)
    const end = new Date(request.endTime)
    if (start >= end) {
      throw new Error('结束时间必须晚于开始时间')
    }

    const durationMinutes = calculateDurationMinutes(request.startTime, request.endTime)
    if (durationMinutes % 30 !== 0) {
      throw new Error('预约时长必须是 30 分钟的整数倍')
    }

    const lockKey = `room:booking:${request.roomId}`

    return lockManager.runWithLock(lockKey, async () => {
      const conflicts = BookingRepository.findByRoomAndTimeRange(
        request.roomId,
        request.startTime,
        request.endTime,
      )
      if (conflicts.length > 0) {
        throw new Error('该时段已被预约')
      }

      const creditsNeeded = calculateCredits(durationMinutes, room.hourlyRate)

      let booking = BookingRepository.create({
        userId,
        familyId: member.familyId,
        roomId: request.roomId,
        startTime: request.startTime,
        endTime: request.endTime,
        durationMinutes,
        creditsUsed: creditsNeeded,
        isMerged: false,
        mergedFromIds: [],
        status: 'active',
      })

      try {
        await CreditService.deductCredits(
          member.familyId,
          userId,
          creditsNeeded,
          booking.id,
          `预约 ${room.name} ${formatDate(new Date(request.startTime))}`,
        )
      } catch (error) {
        BookingRepository.delete(booking.id)
        throw error
      }

      const adjacentBookings = BookingRepository.findAdjacentBookings(
        request.roomId,
        userId,
        request.startTime,
        request.endTime,
      )

      if (adjacentBookings.length > 0) {
        const allBookings = [booking, ...adjacentBookings]
        const minStart = allBookings.reduce(
          (min, b) => (new Date(b.startTime) < new Date(min) ? b.startTime : min),
          booking.startTime,
        )
        const maxEnd = allBookings.reduce(
          (max, b) => (new Date(b.endTime) > new Date(max) ? b.endTime : max),
          booking.endTime,
        )
        const totalDuration = calculateDurationMinutes(minStart, maxEnd)
        const totalCredits = calculateCredits(totalDuration, room.hourlyRate)
        const mergedIds = allBookings.map((b) => b.id)

        adjacentBookings.forEach((b) => BookingRepository.delete(b.id))
        BookingRepository.delete(booking.id)

        booking = BookingRepository.create({
          userId,
          familyId: member.familyId,
          roomId: request.roomId,
          startTime: minStart,
          endTime: maxEnd,
          durationMinutes: totalDuration,
          creditsUsed: totalCredits,
          isMerged: true,
          mergedFromIds: mergedIds,
          status: 'active',
        })
      }

      return booking
    })
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

    const lockKey = `room:booking:${booking.roomId}`

    await lockManager.runWithLock(lockKey, async () => {
      const currentBooking = BookingRepository.findById(bookingId)
      if (!currentBooking || currentBooking.status !== 'active') {
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
    })
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

    const lockKey = `room:booking:${booking.roomId}`

    return lockManager.runWithLock(lockKey, async () => {
      const currentBooking = BookingRepository.findById(bookingId)
      if (!currentBooking || currentBooking.status !== 'active') {
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

      return resultBookings
    })
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
