import type { Request, Response } from 'express'
import { BookingService } from '../services/BookingService.js'
import { LockTimeoutError, LockQueueFullError } from '../utils/LockManager.js'
import { CreditInsufficientError } from '../services/CreditService.js'
import { BookingConflictError, type CreateBookingRequest, type CreateBatchBookingRequest } from '../../shared/types.js'

function handleError(res: Response, error: unknown, defaultMessage: string): void {
  if (error instanceof LockTimeoutError) {
    res.status(408).json({
      success: false,
      message: error.message,
      code: 'LOCK_TIMEOUT',
    })
    return
  }
  if (error instanceof LockQueueFullError) {
    res.status(503).json({
      success: false,
      message: error.message,
      code: 'LOCK_QUEUE_FULL',
    })
    return
  }
  if (error instanceof BookingConflictError) {
    res.status(409).json({
      success: false,
      message: error.message,
      code: 'BOOKING_CONFLICT',
      conflicts: error.conflicts,
    })
    return
  }
  if (error instanceof CreditInsufficientError) {
    res.status(402).json({
      success: false,
      message: error.message,
      code: 'CREDIT_INSUFFICIENT',
      currentBalance: error.currentBalance,
      requiredAmount: error.requiredAmount,
    })
    return
  }
  res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : defaultMessage,
  })
}

export const BookingController = {
  async getMyBookings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const bookings = BookingService.getBookingsByUser(userId)
      res.status(200).json({
        success: true,
        data: bookings,
      })
    } catch (error) {
      handleError(res, error, '获取预约列表失败')
    }
  },

  async createBatchBookings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const request = req.body as CreateBatchBookingRequest
      const bookings = await BookingService.createBatchBookings(userId, request)
      res.status(201).json({
        success: true,
        data: bookings,
        message: `预约成功，共 ${bookings.length} 条预约`,
      })
    } catch (error) {
      handleError(res, error, '预约失败')
    }
  },

  async createBooking(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const request = req.body as CreateBookingRequest
      const booking = await BookingService.createBooking(userId, request)
      res.status(201).json({
        success: true,
        data: booking,
        message: '预约成功',
      })
    } catch (error) {
      handleError(res, error, '预约失败')
    }
  },

  async cancelBooking(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const bookingId = req.params.id
      await BookingService.cancelBooking(userId, bookingId)
      res.status(200).json({
        success: true,
        message: '取消预约成功',
      })
    } catch (error) {
      handleError(res, error, '取消预约失败')
    }
  },

  async getSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query

      let start = startDate as string
      let end = endDate as string

      if (!start || !end) {
        const today = new Date()
        const weekLater = new Date(today)
        weekLater.setDate(weekLater.getDate() + 7)
        start = today.toISOString().split('T')[0]
        end = weekLater.toISOString().split('T')[0]
      }

      const schedule = BookingService.getSchedule(start, end)
      res.status(200).json({
        success: true,
        data: schedule,
      })
    } catch (error) {
      handleError(res, error, '获取课表失败')
    }
  },
}

export default BookingController
