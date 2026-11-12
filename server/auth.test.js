// tests for the login helpers — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const {
  SESSION_TTL_MS,
  hashPassword,
  checkPassword,
  makeToken,
  loginUser,
  getUser,
  logout,
} = require('./auth')

test('a password hashes and checks, a wrong one does not', () => {
  const { salt, hash } = hashPassword('demo1234')
  assert.equal(checkPassword('demo1234', salt, hash), true)
  assert.equal(checkPassword('wrong-password', salt, hash), false)
  assert.equal(checkPassword('', salt, hash), false)
})

test('same password, different salt, different hash', () => {
  const first = hashPassword('demo1234')
  const second = hashPassword('demo1234')
  assert.notEqual(first.salt, second.salt)
  assert.notEqual(first.hash, second.hash)
})

test('tokens are random — two logins never share one', () => {
  assert.notEqual(makeToken(), makeToken())
})

// a throwaway in-memory database with one user in it, just for the
// login tests — nothing to do with the real miracledesk.db. same
// shape as the real users table, email and active flag included,
// plus the sessions table the login now writes to.
function testDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE agents (id INTEGER PRIMARY KEY, name TEXT);
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
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `)
  db.prepare("INSERT INTO agents (id, name) VALUES (1, 'Sam Patel')").run()
  const { salt, hash } = hashPassword('demo1234')
  db.prepare(
    `INSERT INTO users (agent_id, username, email, password_salt, password_hash, role)
     VALUES (1, 'sam', 'sam@miracledesk.test', ?, ?, 'agent')`
  ).run(salt, hash)
  return db
}

test('login works with the right password and returns a usable token', () => {
  const db = testDb()
  const result = loginUser(db, 'sam', 'demo1234')
  assert.ok(result.token)
  assert.equal(result.user.name, 'Sam Patel')
  assert.equal(result.user.role, 'agent')
  assert.equal(result.user.agentId, 1)
  assert.deepEqual(getUser(db, result.token), result.user)
})

test('login is case-insensitive on the username', () => {
  const db = testDb()
  assert.ok(loginUser(db, 'Sam', 'demo1234'))
})

test('wrong password, unknown user, or missing fields all fail', () => {
  const db = testDb()
  assert.equal(loginUser(db, 'sam', 'nope'), null)
  assert.equal(loginUser(db, 'nobody', 'demo1234'), null)
  assert.equal(loginUser(db, '', 'demo1234'), null)
  assert.equal(loginUser(db, 'sam', ''), null)
})

test('logout kills the token', () => {
  const db = testDb()
  const result = loginUser(db, 'sam', 'demo1234')
  logout(db, result.token)
  assert.equal(getUser(db, result.token), null)
})

test('an unknown token is nobody', () => {
  const db = testDb()
  assert.equal(getUser(db, 'not-a-real-token'), null)
})

test('a login writes a session row — and only a hash of the token, never the token itself', () => {
  const db = testDb()
  const result = loginUser(db, 'sam', 'demo1234')
  const row = db.prepare('SELECT * FROM sessions').get()
  assert.equal(row.user_id, 1)
  assert.notEqual(row.token_hash, result.token)
  assert.equal(row.token_hash.length, 64)
  assert.ok(row.expires_at > Date.now())
  assert.ok(row.expires_at - Date.now() <= SESSION_TTL_MS)
})

test('the token survives a server restart — a new connection to the same database file still accepts it', () => {
  // a restart is just a new process opening the same file, so I
  // copy that here: log in on one connection, close it, open the
  // same file again, and the token still works.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miracledesk-test-'))
  const file = path.join(dir, 'test.db')
  const first = new DatabaseSync(file)
  first.exec(`
    CREATE TABLE agents (id INTEGER PRIMARY KEY, name TEXT);
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
    CREATE TABLE sessions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `)
  first.prepare("INSERT INTO agents (id, name) VALUES (1, 'Sam Patel')").run()
  const { salt, hash } = hashPassword('demo1234')
  first
    .prepare(
      `INSERT INTO users (agent_id, username, email, password_salt, password_hash, role)
       VALUES (1, 'sam', 'sam@miracledesk.test', ?, ?, 'agent')`
    )
    .run(salt, hash)
  const result = loginUser(first, 'sam', 'demo1234')
  first.close()

  const second = new DatabaseSync(file)
  assert.deepEqual(getUser(second, result.token), result.user)
  second.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

test('using the app pushes the expiry out — a token about to die gets another 30 days', () => {
  const db = testDb()
  const result = loginUser(db, 'sam', 'demo1234')
  // pretend the token is almost dead, then use it once
  db.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() + 1000)
  assert.ok(getUser(db, result.token))
  const row = db.prepare('SELECT * FROM sessions').get()
  assert.ok(row.expires_at - Date.now() > SESSION_TTL_MS - 60000)
})

test('an expired token is dead, and its row gets cleared', () => {
  const db = testDb()
  const result = loginUser(db, 'sam', 'demo1234')
  db.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1000)
  assert.equal(getUser(db, result.token), null)
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,
    0
  )
})

test('logging out on one device leaves the other login alone', () => {
  const db = testDb()
  const first = loginUser(db, 'sam', 'demo1234')
  const second = loginUser(db, 'sam', 'demo1234')
  logout(db, first.token)
  assert.equal(getUser(db, first.token), null)
  assert.ok(getUser(db, second.token))
})

test('a deactivated account cannot log in, and its old token stops working', () => {
  const db = testDb()
  const result = loginUser(db, 'sam', 'demo1234')
  db.prepare('UPDATE users SET active = 0 WHERE username = ?').run('sam')
  assert.equal(loginUser(db, 'sam', 'demo1234'), null)
  assert.equal(getUser(db, result.token), null)
})
