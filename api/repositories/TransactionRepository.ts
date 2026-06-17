import { queryAll, queryOne, run } from '../db/dbUtils.js';
import type { CreditTransaction } from '../../shared/types.js';

function mapRowToTransaction(row: Record<string, any>): CreditTransaction {
  return {
    id: row.id as string,
    familyId: row.family_id as string,
    userId: row.user_id as string,
    type: row.type as CreditTransaction['type'],
    amount: row.amount as number,
    balanceAfter: row.balance_after as number,
    bookingId: row.booking_id ? (row.booking_id as string) : undefined,
    description: row.description as string,
    createdAt: row.created_at as string,
  };
}

export class TransactionRepository {
  findAll(): CreditTransaction[] {
    const rows = queryAll('SELECT * FROM credit_transactions ORDER BY created_at DESC');
    return rows.map(mapRowToTransaction);
  }

  findById(id: string): CreditTransaction | null {
    const row = queryOne('SELECT * FROM credit_transactions WHERE id = ?', [id]);
    return row ? mapRowToTransaction(row) : null;
  }

  findByFamilyId(familyId: string, limit?: number): CreditTransaction[] {
    let sql = 'SELECT * FROM credit_transactions WHERE family_id = ? ORDER BY created_at DESC';
    const params: any[] = [familyId];
    if (limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(limit);
    }
    const rows = queryAll(sql, params);
    return rows.map(mapRowToTransaction);
  }

  findByBookingId(bookingId: string): CreditTransaction[] {
    const rows = queryAll(
      'SELECT * FROM credit_transactions WHERE booking_id = ? ORDER BY created_at',
      [bookingId],
    );
    return rows.map(mapRowToTransaction);
  }

  create(transaction: Omit<CreditTransaction, 'createdAt'>): CreditTransaction {
    run(
      `INSERT INTO credit_transactions (
        id, family_id, user_id, type, amount, balance_after, booking_id, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        transaction.id,
        transaction.familyId,
        transaction.userId,
        transaction.type,
        transaction.amount,
        transaction.balanceAfter,
        transaction.bookingId ?? null,
        transaction.description,
      ],
    );
    const created = this.findById(transaction.id);
    if (!created) throw new Error('Failed to create credit transaction');
    return created;
  }

  delete(id: string): boolean {
    const changes = run('DELETE FROM credit_transactions WHERE id = ?', [id]);
    return changes > 0;
  }
}

export default new TransactionRepository();
