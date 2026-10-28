import { useState } from 'react'
import './App.css'
import DealsTable from './DealsTable'

// sample numbers only, for the shell. the real numbers come
// once the api is built — these just hold the layout in place.
const cards = [
  { label: 'Net earned this year', value: '$142,300', note: 'from 18 closed deals' },
  { label: 'Closing soon', value: '$38,900', note: '3 deals in the next 45 days' },
  { label: 'Deals this year', value: '24', note: '18 closed, 6 still open' },
  { label: 'Goal progress', value: '71%', note: '$142,300 of a $200,000 goal' },
]

const pages = ['Dashboard', 'Deals', 'Clients', 'Broker view']

function App() {
  const [page, setPage] = useState('Dashboard')

  return (
    <div className="shell">
      <header className="top">
        <p className="logo">MiracleDesk</p>
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
        <p className="intro">
          Sample numbers for now — the real totals land here once the api is wired up.
        </p>

        {page === 'Dashboard' && (
          <>
            <section className="cards">
              {cards.map((card) => (
                <div className="card" key={card.label}>
                  <p className="card-label">{card.label}</p>
                  <p className="card-value">{card.value}</p>
                  <p className="card-note">{card.note}</p>
                  {card.label === 'Goal progress' && (
                    <div className="goal-bar">
                      <div className="goal-fill" />
                    </div>
                  )}
                </div>
              ))}
            </section>

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
