import { useEffect, useState } from 'react'
import { apiFetch } from './api'

// the accounts page — broker only. a list of every login in the
// office, a form to add a new agent, and per-account buttons to
// reset a password or turn an account off and on. the server checks
// the broker role on every one of these calls, so this page only
// ever shows for the broker — but even if someone got here another
// way, the calls would all come back 403.
function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [splitPlan, setSplitPlan] = useState('70')
  const [yearlyGoal, setYearlyGoal] = useState('150000')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  // which account is getting a new password right now, and what it is
  const [resettingId, setResettingId] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [note, setNote] = useState('')
  // which agent's yearly goal is being edited, and what it's set to
  const [editingGoalId, setEditingGoalId] = useState(null)
  const [goalValue, setGoalValue] = useState('')

  function loadAccounts() {
    apiFetch('/api/accounts')
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data)
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setNote('')

    apiFetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        username,
        email,
        password,
        splitPlan,
        yearlyGoal: Number(yearlyGoal),
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not save the account')
        }
        return res.json()
      })
      .then(() => {
        setSaved(true)
        setName('')
        setUsername('')
        setEmail('')
        setPassword('')
        setSplitPlan('70')
        setYearlyGoal('150000')
        loadAccounts()
      })
      .catch((err) => setError(err.message))
  }

  function handleResetPassword(account) {
    setError('')
    setNote('')

    apiFetch(`/api/accounts/${account.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: resetPassword }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not reset the password')
        }
        return res.json()
      })
      .then(() => {
        setResettingId(null)
        setResetPassword('')
        setNote(`Password reset for ${account.name} — their old password no longer works.`)
      })
      .catch((err) => setError(err.message))
  }

  function handleSaveGoal(account) {
    setError('')
    setNote('')

    apiFetch(`/api/agents/${account.agentId}/goal`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yearlyGoal: Number(goalValue) }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not save the goal')
        }
        return res.json()
      })
      .then((updated) => {
        setEditingGoalId(null)
        setGoalValue('')
        setNote(
          `${account.name}'s yearly goal is now $${updated.yearly_goal.toLocaleString()} — the office goal moved with it.`
        )
        loadAccounts()
      })
      .catch((err) => setError(err.message))
  }

  function handleToggleActive(account) {
    setError('')
    setNote('')

    apiFetch(`/api/accounts/${account.id}/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !account.active }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'could not change the account')
        }
        return res.json()
      })
      .then(() => {
        setNote(
          account.active
            ? `${account.name} is turned off — they are logged out and cannot log back in.`
            : `${account.name} is back on — they can log in again.`
        )
        loadAccounts()
      })
      .catch((err) => setError(err.message))
  }

  return (
    <>
      <form className="deal-form" onSubmit={handleSubmit}>
        <h2>Add an agent</h2>

        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex Morgan"
            required
          />
        </label>

        <label>
          Username
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. alex"
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@brokerage.ca"
            required
          />
        </label>

        <label>
          Starting password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="at least 8 characters"
            required
          />
        </label>

        <label>
          Split plan
          <input
            type="text"
            value={splitPlan}
            onChange={(e) => setSplitPlan(e.target.value)}
            placeholder="70"
          />
        </label>

        <label>
          Yearly goal ($)
          <input
            type="number"
            value={yearlyGoal}
            onChange={(e) => setYearlyGoal(e.target.value)}
            min="1"
          />
        </label>

        <button type="submit">Save account</button>

        {error && <p className="form-error">{error}</p>}
        {saved && (
          <p className="form-saved">
            Account saved — they can log in with the username or email
            above.
          </p>
        )}
      </form>

      <section className="deals-section">
        {loading && <p className="table-note">Loading accounts…</p>}

        {failed && (
          <p className="table-note">
            Couldn&apos;t reach the server — make sure it&apos;s running,
            then refresh this page.
          </p>
        )}

        {!loading && !failed && note && <p className="form-saved">{note}</p>}
        {!loading && !failed && error && (
          <p className="form-error">{error}</p>
        )}

        {!loading && !failed && accounts.length === 0 && (
          <p className="table-note">No accounts yet.</p>
        )}

        {!loading && !failed && accounts.length > 0 && (
          <table className="deals-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Yearly goal</th>
                <th>Status</th>
                <th>Password</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td>{account.name}</td>
                  <td>{account.username}</td>
                  <td>{account.email || '—'}</td>
                  <td>{account.role}</td>
                  <td>
                    {account.agentId === null ? (
                      '—'
                    ) : editingGoalId === account.id ? (
                      <span>
                        <input
                          type="number"
                          min="1"
                          value={goalValue}
                          onChange={(e) => setGoalValue(e.target.value)}
                          style={{ width: '110px' }}
                        />{' '}
                        <button
                          type="button"
                          onClick={() => handleSaveGoal(account)}
                        >
                          Save
                        </button>{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGoalId(null)
                            setGoalValue('')
                          }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span>
                        ${account.yearlyGoal.toLocaleString()}{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGoalId(account.id)
                            setGoalValue(String(account.yearlyGoal))
                          }}
                        >
                          Change
                        </button>
                      </span>
                    )}
                  </td>
                  <td>{account.active ? 'Active' : 'Deactivated'}</td>
                  <td>
                    {resettingId === account.id ? (
                      <span>
                        <input
                          type="password"
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="new password"
                          style={{ width: '130px' }}
                        />{' '}
                        <button
                          type="button"
                          onClick={() => handleResetPassword(account)}
                        >
                          Save
                        </button>{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setResettingId(null)
                            setResetPassword('')
                          }}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setResettingId(account.id)}
                      >
                        Reset password
                      </button>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(account)}
                    >
                      {account.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

export default AccountsPage
