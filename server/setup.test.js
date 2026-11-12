// tests for the first-run setup script — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { DatabaseSync } = require('node:sqlite')
const { setupBroker } = require('./setup')

// a throwaway in-memory database with just the users table —
// that's all setup touches.
function testDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
  `)
  return db
}

test('setup makes the first broker account on an empty database', () => {
  const db = testDb()
  const result = setupBroker(db, {
    username: 'boss',
    email: 'boss@brokerage.ca',
    password: 'a-real-password',
  })
  assert.equal(result.error, undefined)
  assert.equal(result.account.username, 'boss')
  assert.equal(result.account.role, 'broker')
  const row = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get('boss')
  assert.equal(row.role, 'broker')
  assert.equal(row.agent_id, null)
  assert.equal(row.active, 1)
})

test('setup refuses when the database already has accounts', () => {
  const db = testDb()
  setupBroker(db, {
    username: 'boss',
    email: 'boss@brokerage.ca',
    password: 'a-real-password',
  })
  const again = setupBroker(db, {
    username: 'sneaky',
    email: 'sneaky@brokerage.ca',
    password: 'another-password',
  })
  assert.ok(again.error)
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    1
  )
})

test('setup rejects a short password or a bad email', () => {
  const db = testDb()
  assert.ok(
    setupBroker(db, {
      username: 'boss',
      email: 'boss@brokerage.ca',
      password: 'short',
    }).error
  )
  assert.ok(
    setupBroker(db, {
      username: 'boss',
      email: 'not-an-email',
      password: 'a-real-password',
    }).error
  )
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    0
  )
})
