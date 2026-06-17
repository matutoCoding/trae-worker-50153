import type { Request, Response } from 'express'
import { FamilyRepository } from '../repositories/FamilyRepository.js'

interface UserInfo {
  userId: string
  name: string
  role: 'owner' | 'member'
  familyId: string
}

const sessions = new Map<string, UserInfo>()

const VALID_USER_IDS = ['user-1', 'user-2', 'user-3']

export const AuthController = {
  async login(req: Request, res: Response): Promise<void> {
    const { userId } = req.body

    if (!userId || !VALID_USER_IDS.includes(userId)) {
      res.status(400).json({
        success: false,
        message: '无效的用户ID，可选值：user-1, user-2, user-3',
      })
      return
    }

    const member = FamilyRepository.findMemberById(userId)
    if (!member) {
      res.status(404).json({
        success: false,
        message: '用户不存在',
      })
      return
    }

    const userInfo: UserInfo = {
      userId: member.id,
      name: member.name,
      role: member.role,
      familyId: member.familyId,
    }

    sessions.set(userId, userInfo)

    res.status(200).json({
      success: true,
      data: userInfo,
      message: '登录成功',
    })
  },

  async logout(req: Request, res: Response): Promise<void> {
    const userId = (req as any).currentUser?.userId

    if (userId) {
      sessions.delete(userId)
    }

    res.status(200).json({
      success: true,
      message: '登出成功',
    })
  },

  async me(req: Request, res: Response): Promise<void> {
    const userId = (req as any).currentUser?.userId

    if (!userId) {
      res.status(401).json({
        success: false,
        message: '未登录',
      })
      return
    }

    const userInfo = sessions.get(userId)
    if (!userInfo) {
      res.status(401).json({
        success: false,
        message: '会话已过期',
      })
      return
    }

    res.status(200).json({
      success: true,
      data: userInfo,
    })
  },

  getSession(userId: string): UserInfo | undefined {
    return sessions.get(userId)
  },
}

export default AuthController
