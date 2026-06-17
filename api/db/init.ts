import initSqlJs, { Database, SqlJsStatic } from 'sql.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_DIR = path.resolve(__dirname, '..', '..', 'data')
const DB_PATH = path.join(DB_DIR, 'piano.db')

let db: Database | null = null
let SQL: SqlJsStatic | null = null
let initPromise: Promise<void> | null = null

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function saveDatabase(): void {
  if (!db) return
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
}

export async function initDatabase(): Promise<void> {
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    if (!SQL) {
      SQL = await initSqlJs()
    }

    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true })
    }

    if (!db) {
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH)
        db = new SQL.Database(new Uint8Array(data))
      } else {
        db = new SQL.Database()
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS family_accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        credits_balance REAL NOT NULL DEFAULT 0,
        credits_total REAL NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS family_members (
        id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL REFERENCES family_accounts(id),
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'member')),
        avatar TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('upright', 'grand', 'digital')),
        description TEXT NOT NULL,
        hourly_rate REAL NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES family_members(id),
        family_id TEXT NOT NULL REFERENCES family_accounts(id),
        room_id TEXT NOT NULL REFERENCES rooms(id),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        credits_used REAL NOT NULL,
        is_merged INTEGER NOT NULL DEFAULT 0,
        merged_from_ids TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credit_transactions (
        id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL REFERENCES family_accounts(id),
        user_id TEXT NOT NULL REFERENCES family_members(id),
        type TEXT NOT NULL CHECK(type IN ('recharge', 'consume', 'refund')),
        amount REAL NOT NULL,
        balance_after REAL NOT NULL,
        booking_id TEXT REFERENCES bookings(id),
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_bookings_room_time ON bookings(room_id, start_time, end_time, status);
      CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_bookings_family ON bookings(family_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_family ON credit_transactions(family_id, created_at);
    `)

    const roomCountStmt = db.prepare('SELECT COUNT(*) as count FROM rooms')
    let roomCount = 0
    if (roomCountStmt.step()) {
      const row = roomCountStmt.getAsObject()
      roomCount = row.count as number
    }
    roomCountStmt.free()

    if (roomCount === 0) {
      db.run(`
        INSERT INTO rooms (id, name, type, description, hourly_rate, created_at) VALUES
        ('room-1', 'A101 立式琴房', 'upright', '雅马哈 U1 立式钢琴，环境安静', 1.0, datetime('now')),
        ('room-2', 'A102 立式琴房', 'upright', '卡瓦依 K300 立式钢琴', 1.0, datetime('now')),
        ('room-3', 'B201 三角琴房', 'grand', '雅马哈 C3 三角钢琴，专业演奏级', 2.0, datetime('now')),
        ('room-4', 'C301 数码琴房', 'digital', '罗兰 HP704 数码钢琴，戴耳机练习', 0.5, datetime('now'))
      `)
    }

    const familyCountStmt = db.prepare('SELECT COUNT(*) as count FROM family_accounts')
    let familyCount = 0
    if (familyCountStmt.step()) {
      const row = familyCountStmt.getAsObject()
      familyCount = row.count as number
    }
    familyCountStmt.free()

    if (familyCount === 0) {
      db.run(`
        INSERT INTO family_accounts (id, name, owner_id, credits_balance, credits_total, version, created_at) VALUES
        ('family-1', '李氏家庭', 'user-1', 10.0, 10.0, 0, datetime('now'))
      `)

      db.run(`
        INSERT INTO family_members (id, family_id, name, role, avatar, created_at) VALUES
        ('user-1', 'family-1', '李爸爸', 'owner', '👨', datetime('now')),
        ('user-2', 'family-1', '李小明', 'member', '👦', datetime('now')),
        ('user-3', 'family-1', '李小红', 'member', '👧', datetime('now'))
      `)

      db.run(`
        INSERT INTO credit_transactions (id, family_id, user_id, type, amount, balance_after, description, created_at) VALUES
        ('txn-1', 'family-1', 'user-1', 'recharge', 10.0, 10.0, '初始充值 10 小时', datetime('now'))
      `)
    }

    saveDatabase()
  })()

  return initPromise
}

export default db
