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

  // HST I charged on this year's closed deals — it gets remitted, so I
  // want to see it separately from what I actually keep. the set-aside
  // is just a rough rule of thumb (25% of net) so I don't spend money
  // I'll owe at tax time — it's not tax advice, my accountant has the
  // real number.
  const hstCollected = closedThisYear.reduce(
    (sum, deal) => sum + deal.hst,
    0
  )
  const taxSetAside = netThisYear * 0.25

  res.json({
    netThisYear: round(netThisYear),
    dealCount: deals.length,
    closedThisYearCount: closedThisYear.length,
    closingSoonCount: closingSoon.length,
    closingSoonNet: round(closingSoonNet),
    goal,
    goalProgress: goal ? round((netThisYear / goal) * 100) : 0,
    hstCollected: round(hstCollected),
    taxSetAside: round(taxSetAside),
  })
})

// net earned per month, for the chart on the dashboard. only closed
// deals count, and only this year's — so the chart shows how the year
// actually went, month by month. months with no closings still show up
// as zero, otherwise the chart would have gaps in it.
app.get('/api/monthly', (req, res) => {
  const agentId = req.query.agentId ? Number(req.query.agentId) : null
  const deals = dealsWithMath(agentId)

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const totals = months.map((month) => ({ month, net: 0 }))

  deals
    .filter((deal) => deal.status === 'closed' && thisYear(deal))
    .forEach((deal) => {
      const monthIndex = Number(deal.closing_date.slice(5, 7)) - 1
      if (monthIndex >= 0 && monthIndex < 12) {
        totals[monthIndex].net += deal.net
      }
    })

  res.json(totals.map((row) => ({ ...row, net: round(row.net) })))
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

// the agents, for the add-a-deal form's dropdown.
app.get('/api/agents', (req, res) => {
  res.json(db.prepare('SELECT id, name FROM agents ORDER BY name').all())
})

// every client, or one agent's with ?agentId=. newest contact first,
// so the ones you haven't talked to in a while sink to the bottom.
app.get('/api/clients', (req, res) => {
  const agentId = req.query.agentId ? Number(req.query.agentId) : null
  const rows = agentId
    ? db
        .prepare(
          `SELECT clients.*, agents.name AS agent_name
           FROM clients JOIN agents ON clients.agent_id = agents.id
           WHERE agent_id = ? ORDER BY last_contacted`
        )
        .all(agentId)
    : db
        .prepare(
          `SELECT clients.*, agents.name AS agent_name
           FROM clients JOIN agents ON clients.agent_id = agents.id
           ORDER BY last_contacted`
        )
        .all()
  res.json(rows)
})

// add a client. the agent has to exist, and I need a name and a type
// (buyer or seller) — status defaults to active, last contacted can
// be left blank until you've actually talked to them.
app.post('/api/clients', (req, res) => {
  const body = req.body || {}
  const agentId = Number(body.agent_id)

  if (!body.name || (body.type !== 'buyer' && body.type !== 'seller')) {
    return res
      .status(400)
      .json({ error: 'a name and a type (buyer or seller) are required' })
  }
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(agentId)
  if (!agent) {
    return res.status(400).json({ error: 'no agent with that id' })
  }

  const result = db
    .prepare(
      `INSERT INTO clients
       (agent_id, name, type, status, last_contacted)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      agentId,
      body.name,
      body.type,
      body.status || 'active',
      body.last_contacted || null
    )

  res
    .status(201)
    .json(
      db
        .prepare(
          `SELECT clients.*, agents.name AS agent_name
           FROM clients JOIN agents ON clients.agent_id = agents.id
           WHERE clients.id = ?`
        )
        .get(result.lastInsertRowid)
    )
})

// follow-up nudges, two kinds. stale clients are the ones I haven't
// talked to in 14 days or more (or never) — those are the deals that
// go quiet. anniversaries are closed deals whose closing anniversary
// falls in the next 30 days — worth a text, past clients send referrals.
// ?agentId= narrows both lists to one agent.
app.get('/api/nudges', (req, res) => {
  const agentId = req.query.agentId ? Number(req.query.agentId) : null
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const daysAgo = (dateText) =>
    Math.floor((today - new Date(dateText + 'T00:00:00')) / 86400000)

  const clientRows = agentId
    ? db
        .prepare(
          `SELECT clients.*, agents.name AS agent_name
           FROM clients JOIN agents ON clients.agent_id = agents.id
           WHERE agent_id = ?`
        )
        .all(agentId)
    : db
        .prepare(
          `SELECT clients.*, agents.name AS agent_name
           FROM clients JOIN agents ON clients.agent_id = agents.id`
        )
        .all()

  const stale = clientRows
    .filter(
      (client) =>
        !client.last_contacted || daysAgo(client.last_contacted) >= 14
    )
    .map((client) => ({
      ...client,
      daysSinceContact: client.last_contacted
        ? daysAgo(client.last_contacted)
        : null,
    }))
    .sort((a, b) => (b.daysSinceContact || 999) - (a.daysSinceContact || 999))

  const dealRows = agentId
    ? db
        .prepare(
          `SELECT deals.*, agents.name AS agent_name
           FROM deals JOIN agents ON deals.agent_id = agents.id
           WHERE agent_id = ? AND status = 'closed'`
        )
        .all(agentId)
    : db
        .prepare(
          `SELECT deals.*, agents.name AS agent_name
           FROM deals JOIN agents ON deals.agent_id = agents.id
           WHERE status = 'closed'`
        )
        .all()

  const anniversaries = dealRows
    .map((deal) => {
      const monthDay = deal.closing_date.slice(5)
      let year = today.getFullYear()
      let anniversary = new Date(`${year}-${monthDay}T00:00:00`)
      if (anniversary < today) {
        year += 1
        anniversary = new Date(`${year}-${monthDay}T00:00:00`)
      }
      const daysUntil = Math.round((anniversary - today) / 86400000)
      return {
        ...deal,
        anniversaryDate: anniversary.toISOString().slice(0, 10),
        years: year - Number(deal.closing_date.slice(0, 4)),
        daysUntil,
      }
    })
    .filter((deal) => deal.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil)

  res.json({ stale, anniversaries })
})

// a pay-period export: every deal that closed in the date range, as
// a csv the office can open in a spreadsheet. leave from/to off and
// you get everything. ?agentId= narrows it to one agent.
app.get('/api/export/payperiod', (req, res) => {
  const agentId = req.query.agentId ? Number(req.query.agentId) : null
  const from = req.query.from || ''
  const to = req.query.to || ''

  let deals = dealsWithMath(agentId)
  if (from) {
    deals = deals.filter((deal) => deal.closing_date >= from)
  }
  if (to) {
    deals = deals.filter((deal) => deal.closing_date <= to)
  }

  const columns = [
    'agent',
    'address',
    'price',
    'side',
    'status',
    'closing_date',
    'gross',
    'referral',
    'agent_share',
    'hst',
    'net',
  ]
  const rows = deals.map((deal) => [
    deal.agent_name,
    deal.address,
    deal.price,
    deal.side,
    deal.status,
    deal.closing_date,
    deal.gross,
    deal.referral,
    deal.agentShare,
    deal.hst,
    deal.net,
  ])
  const csv = [columns, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(','))
    .join('\n')

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="payperiod.csv"'
  )
  res.send(csv)
})

// one csv cell: wrap it in quotes if it has a comma, quote or newline
// in it, and double up any quotes inside.
function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"'
  }
  return text
}

// the closing checklist for one deal. the four steps are the same for
// every deal, so the first time anyone opens a deal's checklist I
// create them all unticked — after that it's just reading the rows.
// ticking a box is a PATCH with { done: true/false } on that item.
const CHECKLIST_STEPS = [
  'Deposit received',
  'Conditions waived',
  'Lawyer docs sent',
  'Keys ready',
]

function checklistFor(dealId) {
  const existing = db
    .prepare('SELECT * FROM checklist_items WHERE deal_id = ? ORDER BY id')
    .all(dealId)
  if (existing.length === 0) {
    const insert = db.prepare(
      'INSERT INTO checklist_items (deal_id, label) VALUES (?, ?)'
    )
    CHECKLIST_STEPS.forEach((label) => insert.run(dealId, label))
    return db
      .prepare('SELECT * FROM checklist_items WHERE deal_id = ? ORDER BY id')
      .all(dealId)
  }
  return existing
}

app.get('/api/deals/:id/checklist', (req, res) => {
  const deal = db
    .prepare('SELECT id FROM deals WHERE id = ?')
    .get(Number(req.params.id))
  if (!deal) {
    return res.status(404).json({ error: 'no deal with that id' })
  }
  res.json(
    checklistFor(deal.id).map((item) => ({ ...item, done: item.done === 1 }))
  )
})

app.patch('/api/deals/:id/checklist/:itemId', (req, res) => {
  const item = db
    .prepare('SELECT * FROM checklist_items WHERE id = ? AND deal_id = ?')
    .get(Number(req.params.itemId), Number(req.params.id))
  if (!item) {
    return res.status(404).json({ error: 'no checklist item with that id' })
  }
  const done = req.body && req.body.done ? 1 : 0
  db.prepare('UPDATE checklist_items SET done = ? WHERE id = ?').run(
    done,
    item.id
  )
  res.json({ ...item, done: done === 1 })
})

app.get('/api/deals', (req, res) => {
  const agentId = req.query.agentId ? Number(req.query.agentId) : null
  res.json(dealsWithMath(agentId))
})

// add a deal. the agent has to exist, and the basics (address, price,
// commission %, side, status) have to be there — everything else can be
// filled in later. returns the new deal with its math worked out, so the
// form can show the net right away.
app.post('/api/deals', (req, res) => {
  const body = req.body || {}
  const agentId = Number(body.agent_id)
  const price = Number(body.price)
  const commissionPct = Number(body.commission_pct)

  if (!body.address || !body.side || !body.status) {
    return res
      .status(400)
      .json({ error: 'address, side and status are required' })
  }
  if (!agentId || !price || price <= 0 || !commissionPct || commissionPct <= 0) {
    return res
      .status(400)
      .json({ error: 'a valid agent, price and commission % are required' })
  }
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(agentId)
  if (!agent) {
    return res.status(400).json({ error: 'no agent with that id' })
  }

  const result = db
    .prepare(
      `INSERT INTO deals
       (agent_id, address, price, commission_pct, side, sold_date,
        closing_date, status, source, referral_pct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      agentId,
      body.address,
      price,
      commissionPct,
      body.side,
      body.sold_date || null,
      body.closing_date || null,
      body.status,
      body.source || null,
      Number(body.referral_pct) || 0
    )

  // run the whole list through the math so a tiered split counts the
  // deals before this one, then pick the new deal out of it.
  const created = dealsWithMath().find((deal) => deal.id === result.lastInsertRowid)
  res.status(201).json(created)
})

function round(n) {
  return Math.round(n * 100) / 100
}

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`)
})
