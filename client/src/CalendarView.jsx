import { useEffect, useState } from 'react'

// a month calendar with closings and condition deadlines on it, so
// an agent can see what's coming up without digging through the
// deals table. the month's events are listed under the grid too.
function money(n) {
  return '$' + Math.round(n).toLocaleString()
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarView() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const monthKey =
    year + '-' + String(month + 1).padStart(2, '0')

  useEffect(() => {
    setLoading(true)
    fetch('/api/calendar?month=' + monthKey)
      .then((res) => res.json())
      .then((data) => {
        setEvents(data)
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }, [monthKey])

  function shiftMonth(step) {
    const next = new Date(year, month + step, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth())
  }

  function goToToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  const todayKey = today.toISOString().slice(0, 10)

  const eventsByDay = {}
  events.forEach((event) => {
    const day = Number(event.date.slice(8, 10))
    if (!eventsByDay[day]) {
      eventsByDay[day] = []
    }
    eventsByDay[day].push(event)
  })

  const cells = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(<div className="calendar-day calendar-day-empty" key={'blank-' + i} />)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = monthKey + '-' + String(day).padStart(2, '0')
    const dayEvents = eventsByDay[day] || []
    cells.push(
      <div
        className={
          'calendar-day' + (dateKey === todayKey ? ' calendar-day-today' : '')
        }
        key={day}
      >
        <span className="calendar-day-number">{day}</span>
        {dayEvents.map((event) => (
          <span
            className={
              'calendar-event ' +
              (event.kind === 'closing'
                ? 'status-closed'
                : 'status-conditional')
            }
            key={event.kind + '-' + event.dealId}
          >
            {event.kind === 'closing' ? 'Closing' : 'Conditions due'}
          </span>
        ))}
      </div>
    )
  }

  if (loading) {
    return <p className="table-note">Loading calendar…</p>
  }

  if (failed) {
    return (
      <p className="table-note">
        Couldn&apos;t reach the server — make sure it&apos;s running, then
        refresh this page.
      </p>
    )
  }

  return (
    <>
      <div className="calendar-nav">
        <button type="button" onClick={() => shiftMonth(-1)}>
          ‹ Prev
        </button>
        <h2>
          {monthNames[month]} {year}
        </h2>
        <button type="button" onClick={() => shiftMonth(1)}>
          Next ›
        </button>
        <button type="button" onClick={goToToday}>
          Today
        </button>
      </div>

      <div className="calendar-grid">
        {dayNames.map((name) => (
          <div className="calendar-weekday" key={name}>
            {name}
          </div>
        ))}
        {cells}
      </div>

      <section className="deals-section">
        <p className="section-label">
          {events.length === 0
            ? 'Nothing on the calendar this month'
            : 'This month'}
        </p>
        {events.map((event) => (
          <div className="recent-row" key={event.kind + '-' + event.dealId}>
            <span className="recent-address">
              {event.date} — {event.address} ({event.agentName})
            </span>
            <span
              className={
                'status ' +
                (event.kind === 'closing'
                  ? 'status-closed'
                  : 'status-conditional')
              }
            >
              {event.kind === 'closing' ? 'Closing' : 'Conditions due'}
            </span>
            <span className="recent-price">{money(event.net)}</span>
          </div>
        ))}
      </section>
    </>
  )
}

export default CalendarView
