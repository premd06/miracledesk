import { useState } from 'react'

// the reset page — this is what the link in the reset email opens
// (/reset-password?token=...). it takes the token straight out of
// the url, asks for a new password twice, and posts both to
// /api/reset-password. a bad or expired link just says so — the
// server never says why, and a link only works once.
function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('the two passwords do not match')
      return
    }

    fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not reset the password')
        }
        return res.json()
      })
      .then(() => setDone(true))
      .catch((err) => setError(err.message))
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="logo">MiracleDesk</p>
        <p className="login-sub">Set a new password.</p>

        {!done && (
          <form className="deal-form" onSubmit={handleSubmit}>
            <label>
              New password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="at least 8 characters"
              />
            </label>
            <label>
              New password again
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                placeholder="type it again"
              />
            </label>
            <button type="submit">Reset password</button>
            {error && <p className="form-error">{error}</p>}
          </form>
        )}

        {done && (
          <>
            <p>Your password has been changed. You can log in with it now.</p>
            <p className="login-hint">
              <a href="/">Back to log in</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordPage
