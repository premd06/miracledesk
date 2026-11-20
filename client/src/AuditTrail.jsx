import { useEffect, useState } from 'react'
import { apiFetch } from './api'

// the audit trail on the broker view: who changed what, newest first.
// every deal, client and account change lands here. the backup button
// is here too — it downloads a copy of the whole database, so the
// office has something to fall back on if the server ever dies.
function AuditTrail() {
  const [entries, setEntries] = useState(null)
  const [failed, setFailed] = useState(false)
  const [backupError, setBackupError] = useState(false)

  useEffect(() => {
    apiFetch('/api/audit')
      .then((res) => res.json())
      .then((data) => setEntries(data))
      .catch(() => setFailed(true))
  }, [])

  // the backup goes through apiFetch (not a plain link) so the login
  // token rides along — a plain <a href> would just get a 401.
  function downloadBackup() {
    setBackupError(false)
    apiFetch('/api/backup')
      .then((res) => {
        if (!res.ok) {
          throw new Error('backup failed')
        }
        const name =
          res.headers
            .get('Content-Disposition')
            ?.match(/filename="([^"]+)"/)?.[1] || 'miracledesk-backup.db'
        return res.blob().then((blob) => ({ blob, name }))
      })
      .then(({ blob, name }) => {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = name
        link.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => setBackupError(true))
  }

  if (failed) {
    return (
      <p className="table-note">
        Couldn&apos;t reach the server — make sure it&apos;s running, then
        refresh this page.
      </p>
    )
  }

  if (!entries) {
    return <p className="table-note">Loading the audit trail…</p>
  }

  return (
    <>
      <p className="table-note">
        Grab a copy of the database every week or so and keep it
        somewhere safe — if the server ever dies, this file is the
        office.
      </p>
      <div className="export-row">
        <button type="button" onClick={downloadBackup}>
          Download a backup
        </button>
      </div>
      {backupError && (
        <p className="table-note">
          The backup didn&apos;t download — try again in a minute.
        </p>
      )}
      {entries.length === 0 ? (
        <p className="table-note">Nothing recorded yet.</p>
      ) : (
        <div className="recent-deals">
          {entries.map((entry) => (
            <div className="recent-row" key={entry.id}>
              <span className="recent-status">
                {new Date(entry.created_at).toLocaleString()}
              </span>
              <span className="recent-address">
                {entry.username || 'unknown'} — {entry.action}
                {entry.detail ? ` — ${entry.detail}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default AuditTrail
