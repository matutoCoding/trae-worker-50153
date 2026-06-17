import type { Request, Response } from 'express'
import { FamilyService } from '../services/FamilyService.js'
import { CreditService } from '../services/CreditService.js'
import { LockTimeoutError, LockQueueFullError } from '../utils/LockManager.js'
import type { AddMemberRequest } from '../../shared/types.js'

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
  res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : defaultMessage,
  })
}

export const FamilyController = {
  async getFamily(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const familyInfo = FamilyService.getFamilyInfoByUserId(userId)
      res.status(200).json({
        success: true,
        data: familyInfo,
      })
    } catch (error) {
      handleError(res, error, '获取家庭信息失败')
    }
  },

  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const request = req.body as AddMemberRequest
      const familyInfo = FamilyService.getFamilyInfoByUserId(userId)
      const member = FamilyService.addMember(familyInfo.account.id, request)
      res.status(201).json({
        success: true,
        data: member,
        message: '添加成员成功',
      })
    } catch (error) {
      handleError(res, error, '添加成员失败')
    }
  },

  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const memberId = req.params.id
      const familyInfo = FamilyService.getFamilyInfoByUserId(userId)
      FamilyService.removeMember(familyInfo.account.id, memberId)
      res.status(200).json({
        success: true,
        message: '移除成员成功',
      })
    } catch (error) {
      handleError(res, error, '移除成员失败')
    }
  },

  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const familyInfo = FamilyService.getFamilyInfoByUserId(userId)
      const transactions = CreditService.getTransactions(familyInfo.account.id)
      res.status(200).json({
        success: true,
        data: transactions,
      })
    } catch (error) {
      handleError(res, error, '获取交易记录失败')
    }
  },

  async rechargeCredits(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const { amount, description } = req.body
      const familyInfo = FamilyService.getFamilyInfoByUserId(userId)

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          message: '充值金额必须大于 0',
        })
        return
      }

      const transaction = await CreditService.rechargeCredits(
        familyInfo.account.id,
        userId,
        amount,
        description || `充值 ${amount} 小时`,
      )
      res.status(200).json({
        success: true,
        data: transaction,
        message: '充值成功',
      })
    } catch (error) {
      handleError(res, error, '充值失败')
    }
  },
}

export default FamilyController
