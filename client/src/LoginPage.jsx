import { useState } from 'react'

// the login screen. posts the username or email + password to
// /api/login and, when it works, saves the token and hands the user
// up to the app so it can show the dashboard. a wrong login just
// says so under the form — the server never says whether the login
// or the password was the wrong part.
// the "forgot password?" link flips this same card into a reset
// request form instead of a whole new page — it just asks for an
// email and always says the same thing back, whether or not that
// email is registered, so nobody can probe for real accounts.
function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [forgot, setForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  function handleSubmit(event) {
    event.preventDefault()
    setError('')

    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not log in')
        }
        return res.json()
      })
      .then((data) => {
        localStorage.setItem('miracledesk-token', data.token)
        localStorage.setItem('miracledesk-user', JSON.stringify(data.user))
        onLoggedIn(data.user)
      })
      .catch((err) => setError(err.message))
  }

  function handleForgot(event) {
    event.preventDefault()
    setError('')

    fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail }),
    })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('could not send the reset email')
        }
        return res.json()
      })
      .then(() => setResetSent(true))
      .catch((err) => setError(err.message))
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="logo">MiracleDesk</p>
        <p className="login-sub">Log in to see your desk.</p>

        {!forgot && (
          <form className="deal-form" onSubmit={handleSubmit}>
            <label>
              Username or email
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                placeholder="sam or sam@miracledesk.test"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="your password"
              />
            </label>
            <button type="submit">Log in</button>
            {error && <p className="form-error">{error}</p>}
          </form>
        )}

        {!forgot && (
          <p className="login-hint">
            <button
              type="button"
              className="link-button"
              onClick={() => setForgot(true)}
            >
              Forgot password?
            </button>
          </p>
        )}

        {forgot && !resetSent && (
          <form className="deal-form" onSubmit={handleForgot}>
            <label>
              Email
              <input
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@brokerage.ca"
              />
            </label>
            <button type="submit">Send reset link</button>
            {error && <p className="form-error">{error}</p>}
            <p className="login-hint">
              <button
                type="button"
                className="link-button"
                onClick={() => setForgot(false)}
              >
                Back to log in
              </button>
            </p>
          </form>
        )}

        {forgot && resetSent && (
          <>
            <p>
              If an account with that email exists, a reset link has been
              sent. It works for one hour, and only once.
            </p>
            <p className="login-hint">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setForgot(false)
                  setResetSent(false)
                }}
              >
                Back to log in
              </button>
            </p>
          </>
        )}

        <p className="login-hint">
          Demo logins — sam, jess, dan, priya, or broker. Password for all
          of them is demo1234.
        </p>
      </div>
    </div>
  )
}

export default LoginPage
