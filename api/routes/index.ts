import { Router, type Request, type Response, type NextFunction } from 'express'
import { AuthController } from '../controllers/AuthController.js'
import { RoomController } from '../controllers/RoomController.js'
import { BookingController } from '../controllers/BookingController.js'
import { FamilyController } from '../controllers/FamilyController.js'
import { StatisticsController } from '../controllers/StatisticsController.js'
import { TestController } from '../controllers/TestController.js'

const VALID_USER_IDS = ['user-1', 'user-2', 'user-3']

declare global {
  namespace Express {
    interface Request {
      currentUser?: {
        userId: string
      }
    }
  }
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const userId = req.headers['x-user-id'] as string

  if (!userId || !VALID_USER_IDS.includes(userId)) {
    res.status(401).json({
      success: false,
      message: '未授权，请设置 x-user-id 请求头（可选值：user-1, user-2, user-3）',
    })
    return
  }

  req.currentUser = { userId }
  next()
}

const router = Router()

router.post('/auth/login', AuthController.login)
router.post('/auth/logout', authMiddleware, AuthController.logout)
router.get('/auth/me', authMiddleware, AuthController.me)

router.get('/rooms', authMiddleware, RoomController.getRooms)
router.post('/rooms', authMiddleware, RoomController.createRoom)

router.get('/bookings/mine', authMiddleware, BookingController.getMyBookings)
router.post('/bookings', authMiddleware, BookingController.createBooking)
router.post('/bookings/batch', authMiddleware, BookingController.createBatchBookings)
router.delete('/bookings/:id', authMiddleware, BookingController.cancelBooking)

router.get('/schedule', authMiddleware, BookingController.getSchedule)

router.get('/family', authMiddleware, FamilyController.getFamily)
router.post('/family/members', authMiddleware, FamilyController.addMember)
router.delete('/family/members/:id', authMiddleware, FamilyController.removeMember)
router.get('/family/credits/transactions', authMiddleware, FamilyController.getTransactions)
router.post('/family/credits/recharge', authMiddleware, FamilyController.rechargeCredits)

router.get('/statistics/duration', authMiddleware, StatisticsController.getDuration)
router.get('/statistics/ranking', authMiddleware, StatisticsController.getRanking)

router.get('/test/concurrency', authMiddleware, TestController.runConcurrencyTests)

export default router
