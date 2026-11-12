// forgot-password for miracledesk — a one-time link that lives for
// an hour. the token itself only ever travels in the email (or the
// server log when there's no email set up) — the database only
// stores its sha256 hash, so even if someone reads the table they
// can't use the token. same scrypt hashing as the logins for the
// new password, and the old password keeps working until the reset
// actually goes through, so a stray email can't lock anyone out.
const crypto = require('node:crypto')
const { hashPassword } = require('./auth')

// an hour, in milliseconds. short on purpose — a reset link sitting
// in an inbox for days is a spare key someone forgot about.
const RESET_TTL_MS = 60 * 60 * 1000

// a password has to be at least this long. 8 isn't Fort Knox, but it
// stops the one-word passwords people actually pick.
const MIN_PASSWORD_LENGTH = 8

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// look a user up by email — case-insensitive, trimmed, same as login.
function findUserByEmail(db, email) {
  if (!email) {
    return null
  }
  return (
    db
      .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
      .get(email.trim()) || null
  )
}

// start a reset for an email. returns { token, email } when the
// email belongs to a user, null when it doesn't — the route answers
// the same either way, so nobody can probe which emails are
// registered. only one live token per user: making a new one kills
// any older ones still sitting unused.
function requestPasswordReset(db, email) {
  const user = findUserByEmail(db, email)
  if (!user) {
    return null
  }
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare(
    'DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL'
  ).run(user.id)
  db.prepare(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES (?, ?, ?)`
  ).run(user.id, hashToken(token), Date.now() + RESET_TTL_MS)
  return { token, email: user.email }
}

// find a reset row by the raw token — only if it's unused and still
// in its hour. a bad token, a used one, or an expired one all come
// back as nothing, and the route treats them all the same.
function findReset(db, token) {
  if (!token) {
    return null
  }
  return (
    db
      .prepare(
        `SELECT * FROM password_resets
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`
      )
      .get(hashToken(token), Date.now()) || null
  )
}

// use a reset token to set a new password. returns { ok: true } on
// success, or { error } when the token is bad/used/expired or the
// password is too short. the token is marked used first so it can't
// be replayed even if something goes wrong after.
function resetPassword(db, token, newPassword) {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    return { error: 'password must be at least 8 characters' }
  }
  const reset = findReset(db, token)
  if (!reset) {
    return { error: 'that reset link is not valid or has expired' }
  }
  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(
    Date.now(),
    reset.id
  )
  const { salt, hash } = hashPassword(newPassword)
  db.prepare(
    'UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?'
  ).run(salt, hash, reset.user_id)
  return { ok: true }
}

module.exports = {
  RESET_TTL_MS,
  MIN_PASSWORD_LENGTH,
  hashToken,
  findUserByEmail,
  requestPasswordReset,
  findReset,
  resetPassword,
}
