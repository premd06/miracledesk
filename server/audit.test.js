// tests for the audit trail — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { DatabaseSync } = require('node:sqlite')
const { logAudit, listAudit } = require('./audit')

// a throwaway in-memory database with just the two tables the audit
// code touches — the users table is only there so the username shows
// up next to each entry.
function testDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT);
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );
  `)
  db.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(
    1,
    'sam'
  )
  return db
}

test('logging a change saves who, what and when', () => {
  const db = testDb()
  logAudit(db, 1, 'deal added', '12 Fake St, Brampton')
  const rows = listAudit(db)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].username, 'sam')
  assert.equal(rows[0].action, 'deal added')
  assert.equal(rows[0].detail, '12 Fake St, Brampton')
  assert.ok(rows[0].created_at)
})

test('newest first, and the limit is respected', () => {
  const db = testDb()
  logAudit(db, 1, 'deal added', 'first')
  logAudit(db, 1, 'deal edited', 'second')
  logAudit(db, 1, 'deal deleted', 'third')
  const rows = listAudit(db, 2)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].detail, 'third')
  assert.equal(rows[1].detail, 'second')
})

test('an offset skips the newest entries, so the page can load more', () => {
  const db = testDb()
  logAudit(db, 1, 'deal added', 'first')
  logAudit(db, 1, 'deal edited', 'second')
  logAudit(db, 1, 'deal deleted', 'third')
  const rows = listAudit(db, 2, 1)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].detail, 'second')
  assert.equal(rows[1].detail, 'first')
})

test('an entry for a missing user still lists, with no username', () => {
  const db = testDb()
  logAudit(db, 99, 'deal added', '12 Fake St, Brampton')
  const rows = listAudit(db)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].username, null)
})
