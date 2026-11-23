// tests for the startup cleanup — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { DatabaseSync } = require('node:sqlite')
const { cleanupExpired } = require('./cleanup')

// a throwaway in-memory database with just the three tables the
// cleanup touches, and one row of each kind in each.
function testDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sessions (id INTEGER PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE password_resets (
      id INTEGER PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );
    CREATE TABLE audit_log (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL);
  `)
  const now = Date.now()
  const addSession = db.prepare(
    'INSERT INTO sessions (expires_at) VALUES (?)'
  )
  addSession.run(now - 1000) // expired
  addSession.run(now + 1000) // still good
  const addReset = db.prepare(
    'INSERT INTO password_resets (expires_at, used_at) VALUES (?, ?)'
  )
  addReset.run(now - 1000, null) // expired
  addReset.run(now + 1000, now) // used already
  addReset.run(now + 1000, null) // still good
  // audit rows store created_at as an ISO string, same as the real
  // table — one from 13 months ago, one from yesterday.
  const addAudit = db.prepare('INSERT INTO audit_log (created_at) VALUES (?)')
  addAudit.run(
    new Date(now - 400 * 24 * 60 * 60 * 1000).toISOString()
  )
  addAudit.run(new Date(now - 24 * 60 * 60 * 1000).toISOString())
  return db
}

test('expired sessions and dead reset rows go, live ones stay', () => {
  const db = testDb()
  const cleaned = cleanupExpired(db)
  assert.deepEqual(cleaned, { sessions: 1, resets: 2, audit: 1 })
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,
    1
  )
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM password_resets').get().n,
    1
  )
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n,
    1
  )
})

test('nothing to clean means zero rows removed', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sessions (id INTEGER PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE password_resets (
      id INTEGER PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );
    CREATE TABLE audit_log (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL);
  `)
  assert.deepEqual(cleanupExpired(db), { sessions: 0, resets: 0, audit: 0 })
})
