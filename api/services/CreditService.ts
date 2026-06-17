import { FamilyRepository } from '../repositories/FamilyRepository.js'
import { CreditRepository } from '../repositories/CreditRepository.js'
import { lockManager, isLockHeldByCurrentCaller } from '../utils/LockManager.js'
import type { CreditTransaction, CreditTransactionSubType } from '../../shared/types.js'

const MAX_RETRY = 3

export class CreditInsufficientError extends Error {
  public readonly currentBalance: number
  public readonly requiredAmount: number
  constructor(currentBalance: number, requiredAmount: number) {
    super(
      `家庭额度不足。当前剩余 ${currentBalance} 点，本次操作需要 ${requiredAmount} 点，请先充值`
    )
    this.name = 'CreditInsufficientError'
    this.currentBalance = currentBalance
    this.requiredAmount = requiredAmount
  }
}

function deductCreditsCore(
  familyId: string,
  userId: string,
  amount: number,
  bookingId: string,
  description: string,
  subType: CreditTransactionSubType = 'booking',
): CreditTransaction {
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const account = FamilyRepository.findAccountById(familyId)
    if (!account) {
      throw new Error('家庭账户不存在')
    }

    if (account.creditsBalance < amount) {
      throw new CreditInsufficientError(account.creditsBalance, amount)
    }

    const newBalance = Math.round((account.creditsBalance - amount) * 100) / 100
    const success = FamilyRepository.updateAccountBalance(
      familyId,
      newBalance,
      account.version,
    )

    if (success) {
      return CreditRepository.createTransaction({
        familyId,
        userId,
        type: 'consume',
        subType,
        amount,
        balanceAfter: newBalance,
        bookingId,
        description,
      })
    }
  }

  throw new Error('并发扣减额度失败，请重试')
}

function refundCreditsCore(
  familyId: string,
  userId: string,
  amount: number,
  bookingId: string,
  description: string,
  subType: CreditTransactionSubType = 'cancel',
): CreditTransaction {
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const account = FamilyRepository.findAccountById(familyId)
    if (!account) {
      throw new Error('家庭账户不存在')
    }

    const newBalance = Math.round((account.creditsBalance + amount) * 100) / 100
    const success = FamilyRepository.updateAccountBalance(
      familyId,
      newBalance,
      account.version,
    )

    if (success) {
      return CreditRepository.createTransaction({
        familyId,
        userId,
        type: 'refund',
        subType,
        amount,
        balanceAfter: newBalance,
        bookingId,
        description,
      })
    }
  }

  throw new Error('并发退回额度失败，请重试')
}

function rechargeCreditsCore(
  familyId: string,
  userId: string,
  amount: number,
  description: string,
  subType: CreditTransactionSubType = 'top-up',
): CreditTransaction {
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const account = FamilyRepository.findAccountById(familyId)
    if (!account) {
      throw new Error('家庭账户不存在')
    }

    const newBalance = Math.round((account.creditsBalance + amount) * 100) / 100
    const newTotal = Math.round((account.creditsTotal + amount) * 100) / 100
    const success = FamilyRepository.updateAccountBalanceAndVersion(
      familyId,
      newBalance,
      newTotal,
      account.version,
    )

    if (success) {
      return CreditRepository.createTransaction({
        familyId,
        userId,
        type: 'recharge',
        subType,
        amount,
        balanceAfter: newBalance,
        description,
      })
    }
  }

  throw new Error('充值失败，请重试')
}

export const CreditService = {
  CreditInsufficientError,

  async deductCredits(
    familyId: string,
    userId: string,
    amount: number,
    bookingId: string,
    description: string,
    subType?: CreditTransactionSubType,
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('扣减额度必须大于 0')
    }

    const lockKey = `family:credits:${familyId}`

    if (isLockHeldByCurrentCaller(lockKey)) {
      return deductCreditsCore(familyId, userId, amount, bookingId, description, subType)
    }

    return lockManager.runWithLock(
      lockKey,
      () => deductCreditsCore(familyId, userId, amount, bookingId, description, subType),
      12000,
    )
  },

  async refundCredits(
    familyId: string,
    userId: string,
    amount: number,
    bookingId: string,
    description: string,
    subType?: CreditTransactionSubType,
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('退回额度必须大于 0')
    }

    const lockKey = `family:credits:${familyId}`

    if (isLockHeldByCurrentCaller(lockKey)) {
      return refundCreditsCore(familyId, userId, amount, bookingId, description, subType)
    }

    return lockManager.runWithLock(
      lockKey,
      () => refundCreditsCore(familyId, userId, amount, bookingId, description, subType),
      12000,
    )
  },

  async rechargeCredits(
    familyId: string,
    userId: string,
    amount: number,
    description: string,
    subType?: CreditTransactionSubType,
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('充值额度必须大于 0')
    }

    const lockKey = `family:credits:${familyId}`

    if (isLockHeldByCurrentCaller(lockKey)) {
      return rechargeCreditsCore(familyId, userId, amount, description, subType)
    }

    return lockManager.runWithLock(
      lockKey,
      () => rechargeCreditsCore(familyId, userId, amount, description, subType),
      12000,
    )
  },

  getTransactions(familyId: string, limit: number = 100): CreditTransaction[] {
    return CreditRepository.findByFamilyId(familyId, limit)
  },
}

export { CreditInsufficientError as _CreditInsufficientError }
export default CreditService
