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
  const [downloadingBackup, setDownloadingBackup] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    apiFetch('/api/audit')
      .then((res) => res.json())
      .then((data) => {
        setEntries(data)
        setHasMore(data.length === 100)
      })
      .catch(() => setFailed(true))
  }, [])

  // older entries come back 100 at a time, newest first — this just
  // tacks the next page onto the list. the button goes away once a
  // page comes back short, because that means we've seen them all.
  function loadOlder() {
    if (!entries || loadingMore) return
    setLoadingMore(true)
    setMoreError(false)
    apiFetch('/api/audit?offset=' + entries.length)
      .then((res) => res.json())
      .then((data) => {
        setEntries([...entries, ...data])
        setHasMore(data.length === 100)
      })
      .catch(() => setMoreError(true))
      .finally(() => setLoadingMore(false))
  }

  // the backup goes through apiFetch (not a plain link) so the login
  // token rides along — a plain <a href> would just get a 401.
  // the button locks while the file is coming down, same as the csv
  // export — a double-click used to fire two downloads.
  function downloadBackup() {
    if (downloadingBackup) return
    setDownloadingBackup(true)
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
      .finally(() => setDownloadingBackup(false))
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
        <button
          type="button"
          onClick={downloadBackup}
          disabled={downloadingBackup}
        >
          {downloadingBackup ? 'Downloading…' : 'Download a backup'}
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
      {hasMore && entries.length > 0 && (
        <div className="export-row">
          <button type="button" onClick={loadOlder} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Show older entries'}
          </button>
        </div>
      )}
      {moreError && (
        <p className="table-note">
          Couldn&apos;t load the older entries — try again in a minute.
        </p>
      )}
    </>
  )
}

export default AuditTrail
