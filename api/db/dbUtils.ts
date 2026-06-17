import { getDb, saveDatabase } from './init.js'

export function queryAll(sql: string, params: any[] = []): Record<string, any>[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: Record<string, any>[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

export function queryOne(sql: string, params: any[] = []): Record<string, any> | null {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params)
  let row: Record<string, any> | null = null
  if (stmt.step()) {
    row = stmt.getAsObject()
  }
  stmt.free()
  return row
}

export function run(sql: string, params: any[] = []): number {
  const db = getDb()
  db.run(sql, params)
  const changes = db.getRowsModified()
  saveDatabase()
  return changes
}
