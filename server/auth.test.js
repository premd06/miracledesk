// tests for the login helpers — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { DatabaseSync } = require('node:sqlite')
const {
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
// login tests — nothing to do with the real miracledesk.db.
function testDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE agents (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER,
      username TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL
    );
  `)
  db.prepare("INSERT INTO agents (id, name) VALUES (1, 'Sam Patel')").run()
  const { salt, hash } = hashPassword('demo1234')
  db.prepare(
    `INSERT INTO users (agent_id, username, password_salt, password_hash, role)
     VALUES (1, 'sam', ?, ?, 'agent')`
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
  assert.deepEqual(getUser(result.token), result.user)
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
  logout(result.token)
  assert.equal(getUser(result.token), null)
})

test('an unknown token is nobody', () => {
  assert.equal(getUser('not-a-real-token'), null)
})
