import { Database } from 'bun:sqlite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.resolve(path.join(__dirname, '..'), process.env.DB_PATH || 'database/gateway.db')
const db = new Database(dbPath)

// 列出所有表
const tables = db.prepare('SELECT name, sql FROM sqlite_master WHERE type=\'table\'').all()
console.log('All tables:')
for (const t of tables) {
  console.log('\n--- ' + t.name + ' ---')
  console.log(t.sql)
  const cols = db.prepare('PRAGMA table_info(' + t.name + ')').all()
  console.log('Columns:', JSON.stringify(cols, null, 2))
}

db.close()