import { useState } from 'react'

// the login screen. posts the username + password to /api/login and,
// when it works, saves the token and hands the user up to the app so
// it can show the dashboard. a wrong login just says so under the
// form — the server never says whether the username or the password
// was the wrong part.
function LoginPage({ onLoggedIn }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

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

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="logo">MiracleDesk</p>
        <p className="login-sub">Log in to see your desk.</p>

        <form className="deal-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="sam"
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

        <p className="login-hint">
          Demo logins — sam, jess, dan, priya, or broker. Password for all
          of them is demo1234.
        </p>
      </div>
    </div>
  )
}

export default LoginPage
