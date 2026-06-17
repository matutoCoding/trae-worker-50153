import { queryAll, queryOne, run } from '../db/dbUtils.js'
import type { Booking } from '../../shared/types.js'

function mapRowToBooking(row: Record<string, any>): Booking {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    familyId: row.family_id as string,
    roomId: row.room_id as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    durationMinutes: row.duration_minutes as number,
    creditsUsed: row.credits_used as number,
    isMerged: row.is_merged === 1,
    mergedFromIds: JSON.parse((row.merged_from_ids as string) || '[]'),
    createdAt: row.created_at as string,
    status: row.status as Booking['status'],
  }
}

export const BookingRepository = {
  findById(id: string): Booking | null {
    const row = queryOne('SELECT * FROM bookings WHERE id = ?', [id])
    return row ? mapRowToBooking(row) : null
  },

  findByUserId(userId: string): Booking[] {
    const rows = queryAll(
      "SELECT * FROM bookings WHERE user_id = ? AND status = 'active' ORDER BY start_time DESC",
      [userId],
    )
    return rows.map(mapRowToBooking)
  },

  findByRoomAndTimeRange(roomId: string, startTime: string, endTime: string): Booking[] {
    const rows = queryAll(
      `SELECT * FROM bookings
       WHERE room_id = ? AND status = 'active'
         AND start_time < ? AND end_time > ?
       ORDER BY start_time ASC`,
      [roomId, endTime, startTime],
    )
    return rows.map(mapRowToBooking)
  },

  findAdjacentBookings(roomId: string, userId: string, startTime: string, endTime: string): Booking[] {
    const rows = queryAll(
      `SELECT * FROM bookings
       WHERE room_id = ? AND user_id = ? AND status = 'active'
         AND (end_time = ? OR start_time = ?)
       ORDER BY start_time ASC`,
      [roomId, userId, startTime, endTime],
    )
    return rows.map(mapRowToBooking)
  },

  findByDateRange(startDate: string, endDate: string): Booking[] {
    const rows = queryAll(
      `SELECT * FROM bookings
       WHERE status = 'active'
         AND date(start_time) >= date(?) AND date(start_time) <= date(?)
       ORDER BY start_time ASC`,
      [startDate, endDate],
    )
    return rows.map(mapRowToBooking)
  },

  create(booking: Omit<Booking, 'id' | 'createdAt'>): Booking {
    const id = `booking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    run(
      `INSERT INTO bookings (id, user_id, family_id, room_id, start_time, end_time, duration_minutes, credits_used, is_merged, merged_from_ids, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`,
      [
        id,
        booking.userId,
        booking.familyId,
        booking.roomId,
        booking.startTime,
        booking.endTime,
        booking.durationMinutes,
        booking.creditsUsed,
        booking.isMerged ? 1 : 0,
        JSON.stringify(booking.mergedFromIds),
      ],
    )
    return this.findById(id)!
  },

  update(id: string, updates: Partial<Omit<Booking, 'id' | 'createdAt'>>): Booking | null {
    const current = this.findById(id)
    if (!current) return null

    const merged = { ...current, ...updates }
    run(
      `UPDATE bookings
       SET user_id = ?, family_id = ?, room_id = ?, start_time = ?, end_time = ?,
           duration_minutes = ?, credits_used = ?, is_merged = ?, merged_from_ids = ?, status = ?
       WHERE id = ?`,
      [
        merged.userId,
        merged.familyId,
        merged.roomId,
        merged.startTime,
        merged.endTime,
        merged.durationMinutes,
        merged.creditsUsed,
        merged.isMerged ? 1 : 0,
        JSON.stringify(merged.mergedFromIds),
        merged.status,
        id,
      ],
    )
    return this.findById(id)
  },

  cancel(id: string): boolean {
    const changes = run("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [id])
    return changes > 0
  },

  delete(id: string): void {
    run('DELETE FROM bookings WHERE id = ?', [id])
  },
}
