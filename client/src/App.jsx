import { useState } from 'react'
import './App.css'
import DealsTable from './DealsTable'
import SummaryCards from './SummaryCards'
import logoMark from './assets/logo-mark.webp'

const pages = ['Dashboard', 'Deals', 'Clients', 'Broker view']

function App() {
  const [page, setPage] = useState('Dashboard')

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <img className="logo-mark" src={logoMark} alt="" />
          <p className="logo">MiracleDesk</p>
        </div>
        <p className="top-note">Sample data</p>
      </header>

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

      <main>
        <h1>{page}</h1>

        {page === 'Dashboard' && (
          <>
            <SummaryCards />

            <section className="deals-section">
              <h2>Deals</h2>
              <DealsTable />
            </section>
          </>
        )}

        {page === 'Deals' && (
          <section className="deals-section">
            <DealsTable />
          </section>
        )}

        {page !== 'Dashboard' && page !== 'Deals' && (
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
