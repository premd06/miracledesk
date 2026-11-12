// tests for email login + forgot-password — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const crypto = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')
const { hashPassword, loginUser } = require('./auth')
const {
  hashToken,
  requestPasswordReset,
  findReset,
  resetPassword,
} = require('./passwordReset')

// a throwaway in-memory database with one user in it, just for these
// tests — same shape as the real users table, email included.
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
      role TEXT NOT NULL
    );
    CREATE TABLE password_resets (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
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

test('login works with the email, not just the username', () => {
  const db = testDb()
  const result = loginUser(db, 'sam@miracledesk.test', 'demo1234')
  assert.ok(result)
  assert.equal(result.user.name, 'Sam Patel')
})

test('email login is case-insensitive and ignores spaces', () => {
  const db = testDb()
  assert.ok(loginUser(db, 'SAM@MIRACLEDESK.TEST', 'demo1234'))
  assert.ok(loginUser(db, '  sam@miracledesk.test  ', 'demo1234'))
})

test('login with the username still works exactly like before', () => {
  const db = testDb()
  assert.ok(loginUser(db, 'sam', 'demo1234'))
  assert.ok(loginUser(db, 'Sam', 'demo1234'))
})

test('an email nobody has fails to log in', () => {
  const db = testDb()
  assert.equal(loginUser(db, 'nobody@miracledesk.test', 'demo1234'), null)
  assert.equal(loginUser(db, 'sam@miracledesk.test', 'wrong-password'), null)
})

test('a reset request for a real email makes a token', () => {
  const db = testDb()
  const reset = requestPasswordReset(db, 'sam@miracledesk.test')
  assert.ok(reset)
  assert.equal(reset.email, 'sam@miracledesk.test')
  assert.equal(reset.token.length, 64)
  assert.ok(findReset(db, reset.token))
})

test('a reset request for an unknown email makes nothing', () => {
  const db = testDb()
  assert.equal(requestPasswordReset(db, 'nobody@miracledesk.test'), null)
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM password_resets').get().n,
    0
  )
})

test('the token is stored as a hash, never the raw token', () => {
  const db = testDb()
  const reset = requestPasswordReset(db, 'sam@miracledesk.test')
  const row = db
    .prepare('SELECT * FROM password_resets')
    .get()
  assert.notEqual(row.token_hash, reset.token)
  assert.equal(row.token_hash, hashToken(reset.token))
})

test('a good token resets the password — new one works, old one does not', () => {
  const db = testDb()
  const reset = requestPasswordReset(db, 'sam@miracledesk.test')
  const result = resetPassword(db, reset.token, 'brand-new-pass')
  assert.deepEqual(result, { ok: true })
  assert.ok(loginUser(db, 'sam', 'brand-new-pass'))
  assert.equal(loginUser(db, 'sam', 'demo1234'), null)
})

test('a used token cannot be used a second time', () => {
  const db = testDb()
  const reset = requestPasswordReset(db, 'sam@miracledesk.test')
  assert.deepEqual(resetPassword(db, reset.token, 'brand-new-pass'), {
    ok: true,
  })
  const again = resetPassword(db, reset.token, 'another-new-pass')
  assert.equal(again.error, 'that reset link is not valid or has expired')
  // the second try didn't change anything — the first password stands
  assert.ok(loginUser(db, 'sam', 'brand-new-pass'))
})

test('an expired token does not work', () => {
  const db = testDb()
  const reset = requestPasswordReset(db, 'sam@miracledesk.test')
  db.prepare(
    'UPDATE password_resets SET expires_at = ? WHERE token_hash = ?'
  ).run(Date.now() - 1000, hashToken(reset.token))
  const result = resetPassword(db, reset.token, 'brand-new-pass')
  assert.equal(result.error, 'that reset link is not valid or has expired')
  assert.ok(loginUser(db, 'sam', 'demo1234'))
})

test('a made-up token does not work', () => {
  const db = testDb()
  const result = resetPassword(db, crypto.randomBytes(32).toString('hex'), 'brand-new-pass')
  assert.equal(result.error, 'that reset link is not valid or has expired')
})

test('a password shorter than 8 characters is rejected', () => {
  const db = testDb()
  const reset = requestPasswordReset(db, 'sam@miracledesk.test')
  const result = resetPassword(db, reset.token, 'short')
  assert.equal(result.error, 'password must be at least 8 characters')
  // and the token is still good — a short try doesn't burn it
  assert.deepEqual(resetPassword(db, reset.token, 'long-enough-pass'), {
    ok: true,
  })
})

test('asking for a second reset kills the first token', () => {
  const db = testDb()
  const first = requestPasswordReset(db, 'sam@miracledesk.test')
  const second = requestPasswordReset(db, 'sam@miracledesk.test')
  assert.notEqual(first.token, second.token)
  assert.equal(
    resetPassword(db, first.token, 'brand-new-pass').error,
    'that reset link is not valid or has expired'
  )
  assert.deepEqual(resetPassword(db, second.token, 'brand-new-pass'), {
    ok: true,
  })
})
