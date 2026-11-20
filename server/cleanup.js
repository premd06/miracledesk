// startup cleanup — sessions and password-reset rows pile up in the
// tables and nothing ever deleted them. a session that's past its
// 30 days is dead anyway (nobody can log in with it), and a reset
// token that's expired or already used can never work again, so the
// server clears them out when it starts. returns how many rows went,
// so the startup log can say so.
function cleanupExpired(db) {
  const now = Date.now()
  const sessions = db
    .prepare('DELETE FROM sessions WHERE expires_at <= ?')
    .run(now)
  const resets = db
    .prepare(
      'DELETE FROM password_resets WHERE expires_at <= ? OR used_at IS NOT NULL'
    )
    .run(now)
  return { sessions: sessions.changes, resets: resets.changes }
}

module.exports = { cleanupExpired }
