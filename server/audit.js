// the audit trail — a plain list of who changed what, so the broker
// can answer "who deleted that deal?" instead of guessing. every
// deal, client and account change writes one row here: who did it,
// what they did, and a short detail (an address, a username). the
// broker reads it from the Broker view page — agents never see it,
// and nothing here ever gets edited or deleted, it's just a record.
function logAudit(db, userId, action, detail) {
  db.prepare(
    `INSERT INTO audit_log (user_id, action, detail, created_at)
     VALUES (?, ?, ?, ?)`
  ).run(userId, action, detail || null, new Date().toISOString())
}

// the newest entries first, 100 at a time, with an offset so the
// broker can page back past the first 100 — a busy office writes
// more than 100 entries in a year. each row carries the username of
// whoever did it, or nothing when that account is gone.
function listAudit(db, limit, offset) {
  return db
    .prepare(
      `SELECT audit_log.*, users.username
       FROM audit_log LEFT JOIN users ON audit_log.user_id = users.id
       ORDER BY audit_log.id DESC LIMIT ? OFFSET ?`
    )
    .all(limit || 100, offset || 0)
}

module.exports = { logAudit, listAudit }
