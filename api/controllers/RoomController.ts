import type { Request, Response } from 'express'
import { RoomService } from '../services/RoomService.js'
import type { CreateRoomRequest } from '../../shared/types.js'

export const RoomController = {
  async getRooms(req: Request, res: Response): Promise<void> {
    try {
      const rooms = RoomService.getRoomList()
      res.status(200).json({
        success: true,
        data: rooms,
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '获取琴房列表失败',
      })
    }
  },

  async createRoom(req: Request, res: Response): Promise<void> {
    try {
      const request = req.body as CreateRoomRequest
      const room = RoomService.createRoom(request)
      res.status(201).json({
        success: true,
        data: room,
        message: '琴房创建成功',
      })
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : '创建琴房失败',
      })
    }
  },
}

export default RoomController
