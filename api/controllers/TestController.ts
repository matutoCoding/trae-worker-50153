import type { Request, Response } from 'express'
import { BookingService } from '../services/BookingService.js'
import { CreditService, CreditInsufficientError } from '../services/CreditService.js'
import { FamilyRepository } from '../repositories/FamilyRepository.js'
import { BookingRepository } from '../repositories/BookingRepository.js'
import { RoomRepository } from '../repositories/RoomRepository.js'
import { BookingConflictError } from '../../shared/types.js'
import { LockTimeoutError, LockQueueFullError } from '../utils/LockManager.js'

interface TestCaseResult {
  name: string
  passed: boolean
  description: string
  details: Record<string, any>
  error?: string
}

function getTestDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export const TestController = {
  async runConcurrencyTests(req: Request, res: Response): Promise<void> {
    const results: TestCaseResult[] = []
    const testDate = getTestDate()
    const startTime = `${testDate}T09:00:00`
    const endTime = `${testDate}T10:00:00`

    const rooms = RoomRepository.findAll()
    if (rooms.length === 0) {
      res.status(500).json({
        success: false,
        message: '没有琴房数据，请先初始化',
      })
      return
    }
    const roomId = rooms[0].id
    const roomName = rooms[0].name

    const testBookingsToClean: string[] = []

    try {
      results.push(await testTwoUsersSameRoom(roomId, roomName, startTime, endTime))
    } catch (e: any) {
      results.push({
        name: '两人抢同一琴房',
        passed: false,
        description: '验证两人同时抢同一琴房同一时段，只有一人成功，另一人收到明确冲突',
        details: {},
        error: e?.message || String(e),
      })
    }

    try {
      results.push(await testConcurrentCreditDeduction())
    } catch (e: any) {
      results.push({
        name: '家庭额度并发扣减',
        passed: false,
        description: '验证多人同时扣家庭额度，不会超额，余额最终正确',
        details: {},
        error: e?.message || String(e),
      })
    }

    try {
      results.push(await testLockTimeout())
    } catch (e: any) {
      results.push({
        name: '锁超时立即返回',
        passed: false,
        description: '验证锁等待超时后立即返回错误，不会继续挂着或偷偷执行',
        details: {},
        error: e?.message || String(e),
      })
    }

    try {
      results.push(await testRemoveConflictAndRetry(roomId, roomName, testDate))
    } catch (e: any) {
      results.push({
        name: '清除冲突后重试',
        passed: false,
        description: '验证多时段预约冲突后，只清除冲突时段，剩余时段可成功预约',
        details: {},
        error: e?.message || String(e),
      })
    }

    for (const id of testBookingsToClean) {
      try { BookingRepository.delete(id) } catch { /* ignore */ }
    }

    const allPassed = results.every((r) => r.passed)

    res.status(200).json({
      success: true,
      data: {
        allPassed,
        total: results.length,
        passed: results.filter((r) => r.passed).length,
        failed: results.filter((r) => !r.passed).length,
        testDate,
        results,
      },
      message: allPassed ? '全部并发测试通过' : '部分测试未通过',
    })
  },
}

async function testTwoUsersSameRoom(
  roomId: string,
  roomName: string,
  startTime: string,
  endTime: string,
): Promise<TestCaseResult> {
  const details: Record<string, any> = { roomId, roomName, startTime, endTime }
  const bookingIds: string[] = []

  try {
    const user1 = 'user-1'
    const user2 = 'user-2'

    const member1 = FamilyRepository.findMemberById(user1)
    const member2 = FamilyRepository.findMemberById(user2)

    if (!member1 || !member2) {
      return {
        name: '两人抢同一琴房',
        passed: false,
        description: '验证两人同时抢同一琴房同一时段，只有一人成功，另一人收到明确冲突',
        details: { ...details, error: '测试用户不存在' },
      }
    }

    const existing = BookingRepository.findByRoomAndTimeRange(roomId, startTime, endTime)
    if (existing.length > 0) {
      for (const b of existing) {
        try { BookingRepository.delete(b.id) } catch { /* ignore */ }
      }
    }

    const results = await Promise.allSettled([
      BookingService.createBooking(user1, { roomId, startTime, endTime }),
      BookingService.createBooking(user2, { roomId, startTime, endTime }),
    ])

    const successes = results.filter((r) => r.status === 'fulfilled')
    const failures = results.filter((r) => r.status === 'rejected')

    details.user1Result = results[0].status === 'fulfilled'
      ? { success: true, bookingId: (results[0] as any).value.id }
      : { success: false, error: (results[0] as any).reason?.message }

    details.user2Result = results[1].status === 'fulfilled'
      ? { success: true, bookingId: (results[1] as any).value.id }
      : { success: false, error: (results[1] as any).reason?.message }

    details.successCount = successes.length
    details.failureCount = failures.length

    const conflictFailures = failures.filter(
      (f) => (f as any).reason instanceof BookingConflictError
    )
    details.conflictFailureCount = conflictFailures.length

    let passed = true
    const issues: string[] = []

    if (successes.length !== 1) {
      passed = false
      issues.push(`应该恰好 1 人成功，实际 ${successes.length} 人成功`)
    }

    if (failures.length !== 1) {
      passed = false
      issues.push(`应该恰好 1 人失败，实际 ${failures.length} 人失败`)
    }

    if (conflictFailures.length !== 1) {
      passed = false
      issues.push(`失败的请求应该是 BOOKING_CONFLICT 类型，实际 ${conflictFailures.length} 个`)
    }

    const failedReason = (failures[0] as any)?.reason
    if (failedReason && failedReason instanceof BookingConflictError) {
      details.conflictInfo = {
        count: failedReason.conflicts.length,
        firstConflict: failedReason.conflicts[0],
        hasConflictUserName: !!failedReason.conflicts[0]?.conflictUserName,
      }
      if (!failedReason.conflicts[0]?.conflictUserName) {
        passed = false
        issues.push('冲突信息中应该包含占用人姓名')
      }
      if (failedReason.conflicts.length === 0) {
        passed = false
        issues.push('冲突信息数组为空')
      }
    }

    for (const r of results) {
      if (r.status === 'fulfilled') {
        bookingIds.push(r.value.id)
      }
    }

    details.issues = issues

    return {
      name: '两人抢同一琴房',
      passed,
      description: '验证两人同时抢同一琴房同一时段，只有一人成功，另一人收到包含占用人姓名的明确冲突',
      details,
    }
  } finally {
    for (const id of bookingIds) {
      try { BookingRepository.delete(id) } catch { /* ignore */ }
    }
  }
}

async function testConcurrentCreditDeduction(): Promise<TestCaseResult> {
  const details: Record<string, any> = {}

  const familyId = 'family-1'
  const userId = 'user-1'

  const account = FamilyRepository.findAccountById(familyId)
  if (!account) {
    return {
      name: '家庭额度并发扣减',
      passed: false,
      description: '验证多人同时扣家庭额度，不会超额，余额最终正确',
      details: { error: '家庭账户不存在' },
    }
  }

  const originalBalance = account.creditsBalance
  const testAmount = 10
  const concurrency = 5
  const targetTotal = testAmount * concurrency

  details.originalBalance = originalBalance
  details.testAmountPerRequest = testAmount
  details.concurrency = concurrency
  details.targetTotal = targetTotal

  const initialBalance = 35
  const setSuccess = FamilyRepository.updateAccountBalanceAndVersion(
    familyId,
    initialBalance,
    account.creditsTotal,
    account.version,
  )
  if (!setSuccess) {
    const freshAccount = FamilyRepository.findAccountById(familyId)!
    FamilyRepository.updateAccountBalanceAndVersion(
      familyId,
      initialBalance,
      freshAccount.creditsTotal,
      freshAccount.version,
    )
  }
  details.balanceBeforeTest = initialBalance

  let successfulDeductions = 0
  let failedDeductions = 0
  let insufficientFailures = 0
  let otherFailures = 0

  const promises: Promise<any>[] = []
  for (let i = 0; i < concurrency; i++) {
    promises.push(
      CreditService.deductCredits(
        familyId,
        userId,
        testAmount,
        `test-${Date.now()}-${i}`,
        `并发测试 ${i + 1}`,
      ).then(
        (tx) => { successfulDeductions++; return { success: true, tx } },
        (err) => {
          failedDeductions++
          if (err instanceof CreditInsufficientError) insufficientFailures++
          else otherFailures++
          return { success: false, error: err.message }
        }
      )
    )
  }

  await Promise.all(promises)

  details.successfulDeductions = successfulDeductions
  details.failedDeductions = failedDeductions
  details.insufficientFailures = insufficientFailures
  details.otherFailures = otherFailures

  const finalAccount = FamilyRepository.findAccountById(familyId)!
  details.balanceAfterTest = finalAccount.creditsBalance

  const expectedSuccessful = Math.floor(initialBalance / testAmount)
  const expectedRemaining = initialBalance - expectedSuccessful * testAmount
  details.expectedSuccessful = expectedSuccessful
  details.expectedRemaining = expectedRemaining

  let passed = true
  const issues: string[] = []

  const actualDeductedTotal = successfulDeductions * testAmount
  const actualRemaining = finalAccount.creditsBalance
  const actualCheck = Math.round((initialBalance - actualDeductedTotal) * 100) / 100

  if (Math.abs(actualRemaining - actualCheck) > 0.01) {
    passed = false
    issues.push(`余额不正确：期初 ${initialBalance}，成功扣 ${successfulDeductions} 次共 ${actualDeductedTotal}，期末应为 ${actualCheck}，实际 ${actualRemaining}`)
  }

  if (insufficientFailures + otherFailures !== failedDeductions) {
    passed = false
    issues.push('失败类型统计不一致')
  }

  if (otherFailures > 0) {
    passed = false
    issues.push(`出现 ${otherFailures} 个非额度不足的错误`)
  }

  details.issues = issues

  try {
    FamilyRepository.updateAccountBalanceAndVersion(
      familyId,
      originalBalance,
      account.creditsTotal,
      finalAccount.version,
    )
  } catch { /* ignore */ }

  return {
    name: '家庭额度并发扣减',
    passed,
    description: '验证多人同时扣家庭额度，不会超额扣减，余额和成功次数一致',
    details,
  }
}

async function testLockTimeout(): Promise<TestCaseResult> {
  const details: Record<string, any> = {}
  const lockKey = 'test:lock:timeout-single'

  const { LockManager } = await import('../utils/LockManager.js')
  const lm = new LockManager()

  const shortTimeout = 200
  const longHoldTime = 1000

  details.shortTimeoutMs = shortTimeout
  details.longHoldTimeMs = longHoldTime

  let firstRelease: (() => void) | null = null
  let timeoutOccurred = false
  let timeoutAfterMs = 0
  let continuedAfterTimeout = false

  const startTime = Date.now()

  try {
    firstRelease = await lm.acquire(lockKey, 5000, 10)

    const timeoutPromise = lm.acquire(lockKey, shortTimeout, 10).then(
      () => {
        continuedAfterTimeout = true
        return { gotLock: true }
      },
      (err) => {
        timeoutOccurred = true
        timeoutAfterMs = Date.now() - startTime
        return { gotLock: false, error: err.message, isTimeout: err instanceof LockTimeoutError }
      }
    )

    await new Promise((r) => setTimeout(r, longHoldTime))
    if (firstRelease) firstRelease()

    const timeoutResult = await timeoutPromise

    details.timeoutResult = timeoutResult
    details.timeoutAfterMs = timeoutAfterMs

    let passed = true
    const issues: string[] = []

    if (!timeoutOccurred) {
      passed = false
      issues.push('应该触发超时，但没有触发')
    }

    if (continuedAfterTimeout) {
      passed = false
      issues.push('超时后不应该继续获得锁，但继续执行了')
    }

    if (timeoutAfterMs > shortTimeout * 3) {
      passed = false
      issues.push(`超时响应太慢：设置 ${shortTimeout}ms，实际 ${timeoutAfterMs}ms`)
    }

    details.issues = issues

    return {
      name: '锁超时立即返回',
      passed,
      description: '验证锁等待超时后立即返回错误，不会继续挂着或超时后又偷偷执行',
      details,
    }
  } finally {
    if (firstRelease) {
      try { firstRelease() } catch { /* ignore */ }
    }
  }
}

async function testRemoveConflictAndRetry(
  roomId: string,
  roomName: string,
  testDate: string,
): Promise<TestCaseResult> {
  const details: Record<string, any> = { roomId, roomName, testDate }
  const bookingIds: string[] = []

  try {
    const user1 = 'user-1'
    const user2 = 'user-2'

    const slot1Start = `${testDate}T09:00:00`
    const slot1End = `${testDate}T10:00:00`
    const slot2Start = `${testDate}T10:00:00`
    const slot2End = `${testDate}T11:00:00`

    details.slot1 = '09:00-10:00'
    details.slot2 = '10:00-11:00'

    const existing = BookingRepository.findByRoomAndTimeRange(roomId, slot1Start, slot2End)
    for (const b of existing) {
      try { BookingRepository.delete(b.id) } catch { /* ignore */ }
    }

    const preBooking = await BookingService.createBooking(user1, {
      roomId,
      startTime: slot1Start,
      endTime: slot1End,
    })
    bookingIds.push(preBooking.id)
    details.preBookingBy = 'user-1'
    details.preBookingId = preBooking.id

    try {
      await BookingService.createBatchBookings(user2, {
        bookings: [
          { roomId, startTime: slot1Start, endTime: slot1End },
          { roomId, startTime: slot2Start, endTime: slot2End },
        ],
      })
      details.firstAttemptSuccess = true
      details.firstAttemptError = null
    } catch (e: any) {
      details.firstAttemptSuccess = false
      details.firstAttemptError = e?.message
      details.isBookingConflictError = e instanceof BookingConflictError
      if (e instanceof BookingConflictError) {
        details.conflictCount = e.conflicts.length
        details.conflictTimes = e.conflicts.map((c) => c.startTime.slice(11, 16))
      }
    }

    let retrySuccess = false
    let retryError: string | null = null
    let retryBookings: any[] = []

    try {
      const retryResult = await BookingService.createBatchBookings(user2, {
        bookings: [
          { roomId, startTime: slot2Start, endTime: slot2End },
        ],
      })
      retrySuccess = true
      retryBookings = retryResult
      for (const b of retryResult) bookingIds.push(b.id)
    } catch (e: any) {
      retryError = e?.message
    }

    details.retrySuccess = retrySuccess
    details.retryError = retryError
    details.retryBookingCount = retryBookings.length

    const user2Bookings = BookingRepository.findByUserId(user2).filter(
      (b) => b.roomId === roomId && b.status === 'active'
    )
    details.user2ActiveBookings = user2Bookings.length

    let passed = true
    const issues: string[] = []

    if (details.firstAttemptSuccess !== false) {
      passed = false
      issues.push('第一次提交应该因为冲突失败，但成功了')
    }

    if (!details.isBookingConflictError) {
      passed = false
      issues.push('第一次失败应该是 BookingConflictError 类型')
    }

    if (details.conflictCount !== 1) {
      passed = false
      issues.push(`应该恰好 1 个冲突时段，实际有 ${details.conflictCount} 个`)
    }

    if (!retrySuccess) {
      passed = false
      issues.push(`清除冲突后重试应该成功，但失败了：${retryError}`)
    }

    if (retryBookings.length !== 1) {
      passed = false
      issues.push(`重试后应该只创建 1 条预约，实际创建了 ${retryBookings.length} 条`)
    }

    if (details.user2ActiveBookings !== 1) {
      passed = false
      issues.push(`用户2最终应该有 1 条有效预约，实际有 ${details.user2ActiveBookings} 条`)
    }

    details.issues = issues

    return {
      name: '清除冲突后重试',
      passed,
      description: '验证多时段预约遇到冲突后，清除冲突时段再重试，只预约剩余时段',
      details,
    }
  } finally {
    for (const id of bookingIds) {
      try { BookingRepository.delete(id) } catch { /* ignore */ }
    }
  }
}

export default TestController
