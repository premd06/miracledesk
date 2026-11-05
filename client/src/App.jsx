import { useEffect, useState } from 'react'
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
import SummaryCards from './SummaryCards'
import logoMark from './assets/logo-mark.webp'

const pages = ['Dashboard', 'Deals', 'Clients', 'Calendar', 'Broker view']

function App() {
  const [page, setPage] = useState('Dashboard')
  // bumped every time a deal is saved, so the table reloads
  const [dealsVersion, setDealsVersion] = useState(0)
  // dark mode, saved so it sticks between visits
  const [dark, setDark] = useState(
    () => localStorage.getItem('miracledesk-theme') === 'dark',
  )

  useEffect(() => {
    const theme = dark ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('miracledesk-theme', theme)
  }, [dark])

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

        {page !== 'Dashboard' && page !== 'Deals' && page !== 'Broker view' && page !== 'Clients' && page !== 'Calendar' && (
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
