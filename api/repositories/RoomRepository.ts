import { queryAll, queryOne, run } from '../db/dbUtils.js'
import type { Room, CreateRoomRequest } from '../../shared/types.js'

function mapRowToRoom(row: Record<string, any>): Room {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as Room['type'],
    description: row.description as string,
    hourlyRate: row.hourly_rate as number,
    createdAt: row.created_at as string,
  }
}

export const RoomRepository = {
  findAll(): Room[] {
    const rows = queryAll('SELECT * FROM rooms ORDER BY created_at ASC')
    return rows.map(mapRowToRoom)
  },

  findById(id: string): Room | null {
    const row = queryOne('SELECT * FROM rooms WHERE id = ?', [id])
    return row ? mapRowToRoom(row) : null
  },

  create(request: CreateRoomRequest): Room {
    const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    run(
      `INSERT INTO rooms (id, name, type, description, hourly_rate, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [id, request.name, request.type, request.description, request.hourlyRate],
    )
    return this.findById(id)!
  },
}
