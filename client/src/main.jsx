import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import TvBoard from './TvBoard.jsx'
import ResetPasswordPage from './ResetPasswordPage.jsx'

// /tv is its own fullscreen page — no sidebar, just the board —
// so the office can open that url straight on a TV. same idea for
// /reset-password: the link in a reset email opens this page on its
// own, no login needed to get there.
const root =
  window.location.pathname === '/tv' ? (
    <TvBoard />
  ) : window.location.pathname === '/reset-password' ? (
    <ResetPasswordPage />
  ) : (
    <App />
  )

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {root}
  </StrictMode>,
)
