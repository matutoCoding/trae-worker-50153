import { RoomRepository } from '../repositories/RoomRepository.js'
import type { Room, CreateRoomRequest } from '../../shared/types.js'

export const RoomService = {
  getRoomList(): Room[] {
    return RoomRepository.findAll()
  },

  getRoomById(id: string): Room | null {
    return RoomRepository.findById(id)
  },

  createRoom(request: CreateRoomRequest): Room {
    if (!request.name || !request.type || !request.description) {
      throw new Error('琴房名称、类型和描述不能为空')
    }
    if (request.hourlyRate <= 0) {
      throw new Error('琴房时薪必须大于 0')
    }
    if (!['upright', 'grand', 'digital'].includes(request.type)) {
      throw new Error('无效的琴房类型')
    }
    return RoomRepository.create(request)
  },
}
