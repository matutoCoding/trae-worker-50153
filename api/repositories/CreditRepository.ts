import { queryAll, queryOne, run } from '../db/dbUtils.js'
import type { CreditTransaction } from '../../shared/types.js'

function mapRowToTransaction(row: Record<string, any>): CreditTransaction {
  return {
    id: row.id as string,
    familyId: row.family_id as string,
    userId: row.user_id as string,
    type: row.type as CreditTransaction['type'],
    subType: (row.sub_type as CreditTransaction['subType']) || 'other',
    amount: row.amount as number,
    balanceAfter: row.balance_after as number,
    bookingId: row.booking_id ? (row.booking_id as string) : undefined,
    description: row.description as string,
    createdAt: row.created_at as string,
  }
}

export const CreditRepository = {
  createTransaction(transaction: Omit<CreditTransaction, 'id' | 'createdAt'>): CreditTransaction {
    const id = `txn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    run(
      `INSERT INTO credit_transactions (id, family_id, user_id, type, sub_type, amount, balance_after, booking_id, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        transaction.familyId,
        transaction.userId,
        transaction.type,
        transaction.subType || 'other',
        transaction.amount,
        transaction.balanceAfter,
        transaction.bookingId ?? null,
        transaction.description,
      ],
    )
    return this.findById(id)!
  },

  findById(id: string): CreditTransaction | null {
    const row = queryOne('SELECT * FROM credit_transactions WHERE id = ?', [id])
    return row ? mapRowToTransaction(row) : null
  },

  findByFamilyId(familyId: string, limit: number = 100): CreditTransaction[] {
    const rows = queryAll(
      'SELECT * FROM credit_transactions WHERE family_id = ? ORDER BY created_at DESC LIMIT ?',
      [familyId, limit],
    )
    return rows.map(mapRowToTransaction)
  },
}
