// the server for miracledesk — express + sqlite, nothing fancy.
// the routes here are the ones the frontend will call. the money math
// lives in commission.js so every route gets the same numbers.
const express = require('express')
const db = require('./db')
const { commission } = require('./commission')

const app = express()
const PORT = 3001

app.use(express.json())

// just to check the server is up
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// every deal with its commission math worked out. ?agentId= narrows it
// to one agent, otherwise you get the whole office.
// tiered split plans need to know what the agent already earned this
// year, so I go through each agent's deals oldest-first and keep a
// running total as I go.
function dealsWithMath(agentId) {
  const rows = agentId
    ? db
        .prepare(
          `SELECT deals.*, agents.name AS agent_name, agents.split_plan
           FROM deals JOIN agents ON deals.agent_id = agents.id
           WHERE agent_id = ? ORDER BY sold_date`
        )
        .all(agentId)
    : db
        .prepare(
          `SELECT deals.*, agents.name AS agent_name, agents.split_plan
           FROM deals JOIN agents ON deals.agent_id = agents.id
           ORDER BY agent_id, sold_date`
        )
        .all()

  const earnedSoFar = {}
  return rows.map((deal) => {
    const earned = earnedSoFar[deal.agent_id] || 0
    const math = commission(deal, earned)
    earnedSoFar[deal.agent_id] = earned + math.agentShare
    return { ...deal, ...math }
  })
}

function thisYear(deal) {
  const year = String(new Date().getFullYear())
  return deal.closing_date && deal.closing_date.startsWith(year)
}

// the numbers for the dashboard cards. ?agentId= for one agent's numbers,
// otherwise the whole office. "made this year" only counts closed deals.
app.get('/api/summary', (req, res) => {
  const agentId = req.query.agentId ? Number(req.query.agentId) : null
  const deals = dealsWithMath(agentId)

  const closedThisYear = deals.filter(
    (deal) => deal.status === 'closed' && thisYear(deal)
  )
  const netThisYear = closedThisYear.reduce((sum, deal) => sum + deal.net, 0)

  // closing soon = still open (pending or conditional) and closing in
  // the next 45 days, so the agent sees what's about to land.
  const today = new Date().toISOString().slice(0, 10)
  const in45Days = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const closingSoon = deals.filter(
    (deal) =>
      (deal.status === 'pending' || deal.status === 'conditional') &&
      deal.closing_date >= today &&
      deal.closing_date <= in45Days
  )
  const closingSoonNet = closingSoon.reduce((sum, deal) => sum + deal.net, 0)

  const agents = agentId
    ? db.prepare('SELECT * FROM agents WHERE id = ?').all(agentId)
    : db.prepare('SELECT * FROM agents').all()
  const goal = agents.reduce((sum, agent) => sum + agent.yearly_goal, 0)

  res.json({
    netThisYear: round(netThisYear),
    dealCount: deals.length,
    closedThisYearCount: closedThisYear.length,
    closingSoonCount: closingSoon.length,
    closingSoonNet: round(closingSoonNet),
    goal,
    goalProgress: goal ? round((netThisYear / goal) * 100) : 0,
  })
})

// every agent ranked by net earned this year, most on top — this is what
// the broker view will show.
app.get('/api/leaderboard', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents').all()
  const deals = dealsWithMath()

  const rows = agents
    .map((agent) => {
      const mine = deals.filter((deal) => deal.agent_id === agent.id)
      const closedThisYear = mine.filter(
        (deal) => deal.status === 'closed' && thisYear(deal)
      )
      const netThisYear = closedThisYear.reduce(
        (sum, deal) => sum + deal.net,
        0
      )
      return {
        id: agent.id,
        name: agent.name,
        netThisYear: round(netThisYear),
        dealCount: mine.length,
        closedThisYearCount: closedThisYear.length,
        goal: agent.yearly_goal,
        goalProgress: agent.yearly_goal
          ? round((netThisYear / agent.yearly_goal) * 100)
          : 0,
      }
    })
    .sort((a, b) => b.netThisYear - a.netThisYear)

  res.json(rows)
})

app.get('/api/deals', (req, res) => {
  const agentId = req.query.agentId ? Number(req.query.agentId) : null
  res.json(dealsWithMath(agentId))
})

function round(n) {
  return Math.round(n * 100) / 100
}

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`)
})
