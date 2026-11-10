import { useEffect, useState } from 'react'
import { apiFetch } from './api'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

// pulls the per-month totals from /api/monthly and draws them as a
// smooth area chart. same deal as the other components: if the
// server isn't running, it says so instead of showing an empty chart.
function money(n) {
  return '$' + Math.round(n).toLocaleString()
}

function MonthlyChart() {
  const [months, setMonths] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    apiFetch('/api/monthly')
      .then((res) => res.json())
      .then((data) => {
        setMonths(data)
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p className="table-note">Loading chart…</p>
  }

  if (failed) {
    return (
      <p className="table-note">
        Couldn&apos;t reach the server — make sure it&apos;s running, then
        refresh this page.
      </p>
    )
  }

  if (months.length === 0) {
    return <p className="table-note">No closed deals yet this year.</p>
  }

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={months}>
          <CartesianGrid stroke="#e2e6e2" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#6b7a72', fontSize: 14 }} />
          <YAxis
            tickFormatter={(value) => '$' + Math.round(value / 1000) + 'k'}
            tick={{ fill: '#6b7a72', fontSize: 14 }}
            width={60}
          />
          <Tooltip formatter={(value) => money(value)} />
          <Area
            type="monotone"
            dataKey="net"
            stroke="#5f7f6e"
            fill="#5f7f6e"
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default MonthlyChart
