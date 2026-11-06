import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import TvBoard from './TvBoard.jsx'

// /tv is its own fullscreen page — no sidebar, just the board —
// so the office can open that url straight on a TV.
const root =
  window.location.pathname === '/tv' ? <TvBoard /> : <App />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {root}
  </StrictMode>,
)
