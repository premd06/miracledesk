// login stuff for miracledesk — passwords are hashed with scrypt
// (built into node, no extra package), and a login gives you a random
// token you send back as "Authorization: Bearer <token>".
// sessions live in the database now (the sessions table), not in
// memory — so restarting the server doesn't log anyone out, and
// closing the tab changes nothing: the token is still in
// localStorage and still good when you come back. a session lasts
// 30 days, and every request pushes that out another 30 days, so
// anyone who actually uses the app stays logged in. log out deletes
// the row, and deactivating an account kills its sessions too.
// the token itself is never stored — only its sha256 hash — so even
// if someone reads the table they can't use it.
// roles are just 'agent' or 'broker' for now. the server checks them
// on the data routes (roles.js) — an agent only ever sees their own
// deals and numbers, the broker sees the whole office.
const crypto = require('node:crypto')

// 30 days, in milliseconds. long on purpose — this is a desk app
// people open every day, and getting logged out all the time would
// just make everyone hate it. the sliding expiry below is what
// keeps it safe: a token nobody uses for 30 days dies on its own.
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

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

// the sessions table only ever sees a hash of the token, never the
// token itself — same idea as the password-reset tokens.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// a password has to be at least this long. 8 isn't Fort Knox, but it
// stops the one-word passwords people actually pick.
const MIN_PASSWORD_LENGTH = 8

// the user object the rest of the server works with — built from a
// users row plus the agent's name. kept in one place so login and
// session lookups build exactly the same shape.
function userFromRow(db, user) {
  return {
    id: user.id,
    name: user.agent_id
      ? db.prepare('SELECT name FROM agents WHERE id = ?').get(user.agent_id).name
      : 'Broker',
    role: user.role,
    agentId: user.agent_id,
  }
}

// returns { token, user } on a good login, null on a bad one. the
// first field takes a username or an email — whichever the person
// typed — and both lookups are case-insensitive so "Sam",
// "sam" and "sam@miracledesk.test" all find the same account.
// a deactivated account can't log in at all.
function loginUser(db, login, password) {
  if (!login || !password) {
    return null
  }
  const user = db
    .prepare(
      `SELECT * FROM users
       WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE`
    )
    .get(login.trim(), login.trim())
  if (!user) {
    return null
  }
  if (user.active === 0) {
    return null
  }
  if (!checkPassword(password, user.password_salt, user.password_hash)) {
    return null
  }
  const token = makeToken()
  const now = Date.now()
  db.prepare(
    `INSERT INTO sessions
     (user_id, token_hash, created_at, last_used_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(user.id, hashToken(token), now, now, now + SESSION_TTL_MS)
  return { token, user: userFromRow(db, user) }
}

// turn a token back into its user, or null when it's not a real
// session. a token is good when its row exists, it hasn't hit its
// 30 days, and the account is still active. every good check slides
// the expiry out another 30 days from right now, so using the app
// keeps you logged in.
function getUser(db, token) {
  if (!token) {
    return null
  }
  const row = db
    .prepare(
      `SELECT sessions.*, users.*
       FROM sessions JOIN users ON sessions.user_id = users.id
       WHERE sessions.token_hash = ?`
    )
    .get(hashToken(token))
  if (!row) {
    return null
  }
  if (row.expires_at <= Date.now() || row.active === 0) {
    // dead either way — clear the row so the table doesn't fill up
    // with tokens nobody will ever use again.
    db.prepare('DELETE FROM sessions WHERE id = ?').run(row.id)
    return null
  }
  db.prepare(
    'UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?'
  ).run(Date.now(), Date.now() + SESSION_TTL_MS, row.id)
  return userFromRow(db, row)
}

// log out: just that one token stops working. other devices the
// same person is logged in on keep working — each login is its own row.
function logout(db, token) {
  if (!token) {
    return
  }
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(
    hashToken(token)
  )
}

// log one user out everywhere — used when a broker resets someone's
// password or deactivates them, so an old session can't keep going.
function logoutAll(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
}

// log one user out everywhere except this login — used when someone
// changes their own password. if the password leaked, the other
// devices stop working, but the device you're on right now keeps
// working so you don't get kicked out mid-click.
function logoutOthers(db, userId, token) {
  if (!token) {
    logoutAll(db, userId)
    return
  }
  db.prepare(
    'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?'
  ).run(userId, hashToken(token))
}

module.exports = {
  SESSION_TTL_MS,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  checkPassword,
  makeToken,
  hashToken,
  loginUser,
  getUser,
  logout,
  logoutAll,
  logoutOthers,
}
