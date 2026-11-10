// login stuff for miracledesk — passwords are hashed with scrypt
// (built into node, no extra package), and a login gives you a random
// token you send back as "Authorization: Bearer <token>".
// tokens live in memory here, so restarting the server logs everyone
// out — fine for a demo, the real thing would store sessions properly.
// roles are just 'agent' or 'broker' for now. the server checks them
// on the data routes (roles.js) — an agent only ever sees their own
// deals and numbers, the broker sees the whole office.
const crypto = require('node:crypto')

// one random salt per password, so two people with the same password
// still end up with different hashes in the database.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString('hex')
  return { salt, hash }
}

// same scrypt, same salt — if the result matches what's stored, the
// password was right. timingSafeEqual so the comparison doesn't leak
// how close a wrong guess was.
function checkPassword(password, salt, hash) {
  const guess = crypto.scryptSync(password, salt, 64)
  const stored = Buffer.from(hash, 'hex')
  return (
    guess.length === stored.length && crypto.timingSafeEqual(guess, stored)
  )
}

function makeToken() {
  return crypto.randomBytes(32).toString('hex')
}

// token -> { id, name, role, agentId }. nothing secret in here — the
// token itself is the secret, and it's random enough nobody can guess it.
const sessions = new Map()

// returns { token, user } on a good login, null on a bad one. the
// username lookup is case-insensitive so "Sam" and "sam" both work.
function loginUser(db, username, password) {
  if (!username || !password) {
    return null
  }
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
    .get(username.trim())
  if (!user) {
    return null
  }
  if (!checkPassword(password, user.password_salt, user.password_hash)) {
    return null
  }
  const token = makeToken()
  const session = {
    id: user.id,
    name: user.agent_id
      ? db.prepare('SELECT name FROM agents WHERE id = ?').get(user.agent_id).name
      : 'Broker',
    role: user.role,
    agentId: user.agent_id,
  }
  sessions.set(token, session)
  return { token, user: session }
}

function getUser(token) {
  return sessions.get(token) || null
}

function logout(token) {
  sessions.delete(token)
}

module.exports = { hashPassword, checkPassword, makeToken, loginUser, getUser, logout }
