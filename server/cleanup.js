// startup cleanup — sessions and password-reset rows pile up in the
// tables and nothing ever deleted them. a session that's past its
// 30 days is dead anyway (nobody can log in with it), and a reset
// token that's expired or already used can never work again, so the
// server clears them out when it starts. the audit log grows the
// same way, so rows older than a year go too — the log is a record
// of recent changes, not forever. returns how many rows went,
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
  // audit rows store created_at as an ISO string, so a plain string
  // compare works — anything older than a year from now is gone.
  const oneYearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString()
  const audit = db
    .prepare('DELETE FROM audit_log WHERE created_at <= ?')
    .run(oneYearAgo)
  return { sessions: sessions.changes, resets: resets.changes, audit: audit.changes }
}

module.exports = { cleanupExpired }
