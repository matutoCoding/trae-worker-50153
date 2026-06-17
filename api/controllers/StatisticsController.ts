import type { Request, Response } from 'express'
import { StatisticsService } from '../services/StatisticsService.js'

export const StatisticsController = {
  async getDurationStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const { startDate, endDate } = req.query

      let start = startDate as string
      let end = endDate as string

      if (!start || !end) {
        const today = new Date()
        const monthAgo = new Date(today)
        monthAgo.setDate(monthAgo.getDate() - 30)
        start = monthAgo.toISOString().split('T')[0]
        end = today.toISOString().split('T')[0]
      }

      const stats = StatisticsService.getDurationStats(userId, start, end)
      res.status(200).json({
        success: true,
        data: stats,
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '获取时长统计失败',
      })
    }
  },

  async getRanking(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).currentUser.userId
      const { startDate, endDate } = req.query

      let start = startDate as string
      let end = endDate as string

      if (!start || !end) {
        const today = new Date()
        const monthAgo = new Date(today)
        monthAgo.setDate(monthAgo.getDate() - 30)
        start = monthAgo.toISOString().split('T')[0]
        end = today.toISOString().split('T')[0]
      }

      const ranking = StatisticsService.getMemberRanking(userId, start, end)
      res.status(200).json({
        success: true,
        data: ranking,
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '获取排行榜失败',
      })
    }
  },
}

export default StatisticsController
