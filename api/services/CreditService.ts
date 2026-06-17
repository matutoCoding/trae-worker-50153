import { FamilyRepository } from '../repositories/FamilyRepository.js'
import { CreditRepository } from '../repositories/CreditRepository.js'
import { lockManager } from '../utils/LockManager.js'
import type { CreditTransaction } from '../../shared/types.js'

const MAX_RETRY = 3

export const CreditService = {
  async deductCredits(
    familyId: string,
    userId: string,
    amount: number,
    bookingId: string,
    description: string,
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('扣减额度必须大于 0')
    }

    const lockKey = `family:credits:${familyId}`

    return lockManager.runWithLock(lockKey, async () => {
      for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
        const account = FamilyRepository.findAccountById(familyId)
        if (!account) {
          throw new Error('家庭账户不存在')
        }

        if (account.creditsBalance < amount) {
          throw new Error('额度不足')
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
            amount,
            balanceAfter: newBalance,
            bookingId,
            description,
          })
        }
      }

      throw new Error('并发扣减额度失败，请重试')
    })
  },

  async refundCredits(
    familyId: string,
    userId: string,
    amount: number,
    bookingId: string,
    description: string,
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('退回额度必须大于 0')
    }

    const lockKey = `family:credits:${familyId}`

    return lockManager.runWithLock(lockKey, async () => {
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
            amount,
            balanceAfter: newBalance,
            bookingId,
            description,
          })
        }
      }

      throw new Error('并发退回额度失败，请重试')
    })
  },

  async rechargeCredits(
    familyId: string,
    userId: string,
    amount: number,
    description: string,
  ): Promise<CreditTransaction> {
    if (amount <= 0) {
      throw new Error('充值额度必须大于 0')
    }

    const lockKey = `family:credits:${familyId}`

    return lockManager.runWithLock(lockKey, async () => {
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
            amount,
            balanceAfter: newBalance,
            description,
          })
        }
      }

      throw new Error('充值失败，请重试')
    })
  },

  getTransactions(familyId: string, limit: number = 100): CreditTransaction[] {
    return CreditRepository.findByFamilyId(familyId, limit)
  },
}
