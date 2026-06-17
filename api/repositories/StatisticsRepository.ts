import { queryAll } from '../db/dbUtils.js'
import type { DurationStats, MemberRanking } from '../../shared/types.js'

export const StatisticsRepository = {
  getDurationStatsByFamily(familyId: string, startDate: string, endDate: string): DurationStats[] {
    const rows = queryAll(
      `SELECT
         date(b.start_time) as date,
         SUM(b.duration_minutes) as duration_minutes
       FROM bookings b
       WHERE b.family_id = ?
         AND b.status = 'active'
         AND date(b.start_time) >= date(?)
         AND date(b.start_time) <= date(?)
       GROUP BY date(b.start_time)
       ORDER BY date(b.start_time) ASC`,
      [familyId, startDate, endDate],
    )

    return rows.map((row: Record<string, any>) => ({
      date: row.date as string,
      durationMinutes: row.duration_minutes as number,
    }))
  },

  getMemberRanking(familyId: string, startDate: string, endDate: string): MemberRanking[] {
    const rows = queryAll(
      `SELECT
         b.user_id as user_id,
         fm.name as name,
         SUM(b.duration_minutes) as duration_minutes
       FROM bookings b
       INNER JOIN family_members fm ON b.user_id = fm.id
       WHERE b.family_id = ?
         AND b.status = 'active'
         AND date(b.start_time) >= date(?)
         AND date(b.start_time) <= date(?)
       GROUP BY b.user_id, fm.name
       ORDER BY duration_minutes DESC`,
      [familyId, startDate, endDate],
    )

    return rows.map((row: Record<string, any>) => ({
      userId: row.user_id as string,
      name: row.name as string,
      durationMinutes: row.duration_minutes as number,
    }))
  },
}
