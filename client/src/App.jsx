import { useEffect, useState } from 'react'
import { apiFetch } from './api'
import './App.css'
import AddDealForm from './AddDealForm'
import ClientsPage from './ClientsPage'
import DealsTable from './DealsTable'
import NudgesPanel from './NudgesPanel'
import BadgesRow from './BadgesRow'
import MonthlyChart from './MonthlyChart'
import RecentDeals from './RecentDeals'
import BrokerView from './BrokerView'
import CalendarView from './CalendarView'
import DealMap from './DealMap'
import IncomeReport from './IncomeReport'
import LoginPage from './LoginPage'
import SummaryCards from './SummaryCards'
import logoMark from './assets/logo-mark.webp'

const pages = ['Dashboard', 'Deals', 'Clients', 'Calendar', 'Map', 'Broker view']

function App() {
  const [page, setPage] = useState('Dashboard')
  // bumped every time a deal is saved, so the table reloads
  const [dealsVersion, setDealsVersion] = useState(0)
  // who is logged in. starts empty on every load — the saved token
  // gets checked against /api/me below, so a token that died (the
  // server restarted, or you logged out somewhere else) drops you
  // back to the login screen instead of showing the dashboard with
  // a stale name in the corner.
  const [user, setUser] = useState(null)
  const [checkedLogin, setCheckedLogin] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('miracledesk-token')
    if (!token) {
      setCheckedLogin(true)
      return
    }
    apiFetch('/api/me')
      .then((res) => {
        if (!res.ok) {
          throw new Error('not logged in')
        }
        return res.json()
      })
      .then((me) => {
        localStorage.setItem('miracledesk-user', JSON.stringify(me))
        setUser(me)
      })
      .catch(() => {
        localStorage.removeItem('miracledesk-token')
        localStorage.removeItem('miracledesk-user')
      })
      .finally(() => setCheckedLogin(true))
  }, [])
  // dark mode, saved so it sticks between visits
  const [dark, setDark] = useState(
    () => localStorage.getItem('miracledesk-theme') === 'dark',
  )

  useEffect(() => {
    const theme = dark ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('miracledesk-theme', theme)
  }, [dark])

  function handleLogout() {
    const token = localStorage.getItem('miracledesk-token')
    apiFetch('/api/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    localStorage.removeItem('miracledesk-token')
    localStorage.removeItem('miracledesk-user')
    setUser(null)
  }

  if (!checkedLogin) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <p className="logo">MiracleDesk</p>
          <p className="login-sub">Checking your login…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onLoggedIn={setUser} />
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <img className="logo-mark" src={logoMark} alt="" />
          <p className="logo">MiracleDesk</p>
        </div>
        <p className="top-note">Sample data</p>

        <nav className="nav">
          {pages.map((name) => (
            <button
              key={name}
              type="button"
              className={page === name ? 'active' : ''}
              onClick={() => setPage(name)}
            >
              {name}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setDark((d) => !d)}
        >
          {dark ? 'Light mode' : 'Dark mode'}
        </button>

        <a className="tv-link" href="/tv" target="_blank" rel="noreferrer">
          Open TV board
        </a>

        <p className="whoami">
          Logged in as {user.name} ({user.role})
        </p>
        <button type="button" className="theme-toggle" onClick={handleLogout}>
          Log out
        </button>
      </aside>

      <main>
        <h1>{page}</h1>

        {page === 'Dashboard' && (
          <>
            <SummaryCards />

            <section className="deals-section">
              <p className="section-label">Net earned by month</p>
              <MonthlyChart />
            </section>

            <section className="deals-section">
              <p className="section-label">Badges</p>
              <BadgesRow />
            </section>

            <section className="deals-section">
              <p className="section-label">Follow up</p>
              <NudgesPanel />
            </section>

            <section className="deals-section">
              <p className="section-label">Income report</p>
              <IncomeReport />
            </section>

            <section className="deals-section">
              <p className="section-label">Recent deals</p>
              <RecentDeals />
            </section>
          </>
        )}

        {page === 'Deals' && (
          <>
            <AddDealForm onAdded={() => setDealsVersion((v) => v + 1)} />
            <section className="deals-section">
              <DealsTable refreshKey={dealsVersion} />
            </section>
          </>
        )}

        {page === 'Broker view' && <BrokerView />}

        {page === 'Clients' && <ClientsPage />}

        {page === 'Calendar' && <CalendarView />}

        {page === 'Map' && (
          <section className="deals-section">
            <DealMap />
          </section>
        )}

        {page !== 'Dashboard' && page !== 'Deals' && page !== 'Broker view' && page !== 'Clients' && page !== 'Calendar' && page !== 'Map' && (
          <section className="placeholder">
            <h2>{page}</h2>
            <p>Coming in a later step.</p>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
