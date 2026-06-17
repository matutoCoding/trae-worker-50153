import { queryAll, queryOne, run } from '../db/dbUtils.js'
import type { FamilyAccount, FamilyMember, AddMemberRequest } from '../../shared/types.js'

function mapRowToFamilyAccount(row: Record<string, any>): FamilyAccount {
  return {
    id: row.id as string,
    name: row.name as string,
    ownerId: row.owner_id as string,
    creditsBalance: row.credits_balance as number,
    creditsTotal: row.credits_total as number,
    version: row.version as number,
    createdAt: row.created_at as string,
  }
}

function mapRowToFamilyMember(row: Record<string, any>): FamilyMember {
  return {
    id: row.id as string,
    familyId: row.family_id as string,
    name: row.name as string,
    role: row.role as FamilyMember['role'],
    avatar: row.avatar as string,
    createdAt: row.created_at as string,
  }
}

export const FamilyRepository = {
  findAccountById(id: string): FamilyAccount | null {
    const row = queryOne('SELECT * FROM family_accounts WHERE id = ?', [id])
    return row ? mapRowToFamilyAccount(row) : null
  },

  findAllAccounts(): FamilyAccount[] {
    const rows = queryAll('SELECT * FROM family_accounts ORDER BY created_at')
    return rows.map(mapRowToFamilyAccount)
  },

  updateAccountBalance(familyId: string, newBalance: number, expectedVersion: number): boolean {
    const changes = run(
      `UPDATE family_accounts
       SET credits_balance = ?, version = version + 1
       WHERE id = ? AND version = ?`,
      [newBalance, familyId, expectedVersion],
    )
    return changes > 0
  },

  updateAccountBalanceAndVersion(
    familyId: string,
    newBalance: number,
    newTotal: number,
    expectedVersion: number,
  ): boolean {
    const changes = run(
      `UPDATE family_accounts
       SET credits_balance = ?, credits_total = ?, version = version + 1
       WHERE id = ? AND version = ?`,
      [newBalance, newTotal, familyId, expectedVersion],
    )
    return changes > 0
  },

  createAccount(account: Omit<FamilyAccount, 'createdAt'>): FamilyAccount {
    run(
      `INSERT INTO family_accounts (id, name, owner_id, credits_balance, credits_total, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        account.id,
        account.name,
        account.ownerId,
        account.creditsBalance,
        account.creditsTotal,
        account.version,
      ],
    )
    return this.findAccountById(account.id)!
  },

  findMembersByFamilyId(familyId: string): FamilyMember[] {
    const rows = queryAll('SELECT * FROM family_members WHERE family_id = ? ORDER BY created_at', [familyId])
    return rows.map(mapRowToFamilyMember)
  },

  findMemberById(id: string): FamilyMember | null {
    const row = queryOne('SELECT * FROM family_members WHERE id = ?', [id])
    return row ? mapRowToFamilyMember(row) : null
  },

  addMember(familyId: string, request: AddMemberRequest): FamilyMember {
    const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    run(
      `INSERT INTO family_members (id, family_id, name, role, avatar, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [id, familyId, request.name, request.role, request.avatar],
    )
    return this.findMemberById(id)!
  },

  removeMember(memberId: string): boolean {
    const changes = run('DELETE FROM family_members WHERE id = ?', [memberId])
    return changes > 0
  },
}

export default FamilyRepository
