// the server for miracledesk — express + sqlite, nothing fancy.
// the routes here are the ones the frontend will call. the money math
// lives in commission.js so every route gets the same numbers.
const express = require('express')
const db = require('./db')
const { commission } = require('./commission')
const { computeBadges, buildFeed } = require('./badges')
const { buildIncomeReport } = require('./report')
const { loginUser, getUser, logout } = require('./auth')
const {
  requestPasswordReset,
  resetPassword,
} = require('./passwordReset')
const { sendResetEmail } = require('./mailer')
const {
  listAccounts,
  createAccount,
  resetAccountPassword,
  setAccountActive,
  setAgentGoal,
  changePassword,
} = require('./accounts')
const { createLimiter } = require('./rateLimit')

// two small in-memory limits (see rateLimit.js): 10 failed logins
// per username in 15 minutes, and 5 reset requests per email in an
// hour. they're per-username and per-email on purpose — one person
// guessing at passwords shouldn't lock the whole office out.
const loginLimiter = createLimiter(15 * 60 * 1000, 10)
const forgotLimiter = createLimiter(60 * 60 * 1000, 5)
const { cleanDealUpdate } = require('./dealEdit')
const { importDeals } = require('./csvImport')
const {
  visibleAgentId,
  canCreateFor,
  canSeeDeal,
} = require('./roles')

const app = express()
const PORT = 3001

app.use(express.json())

// login part 2: every data route needs a token now. /api/login,
// /api/logout, /api/me and /api/health stay open — everything else
// goes through requireLogin, so no route can forget to check.
// the token comes in as "Authorization: Bearer <token>".
const OPEN_ROUTES = [
  '/login',
  '/logout',
  '/me',
  '/health',
  '/forgot-password',
  '/reset-password',
]
app.use('/api', (req, res, next) => {
  if (OPEN_ROUTES.includes(req.path)) {
    return next()
  }
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  const user = token ? getUser(db, token) : null
  if (!user) {
    return res.status(401).json({ error: 'not logged in' })
  }
  req.user = user
  next()
})

// pulls the agent id out of ?agentId= and checks the caller is
// allowed to ask for it. sends a 403 and returns undefined when an
// agent asks for someone else's data — the route just returns when
// it gets undefined back. a broker asking for nothing gets null,
// which means the whole office.
function scopedAgentId(req, res) {
  const asked = req.query.agentId ? Number(req.query.agentId) : null
  const scoped = visibleAgentId(req.user, asked)
  if (scoped === false) {
    res.status(403).json({ error: 'you can only see your own data' })
    return undefined
  }
  return scoped
}

// just to check the server is up
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

// log in: send { username, password } and get back a token plus who
// you are (name, role, agent id). the username field takes a username
// or an email — both work. the token goes in the Authorization
// header on later calls. wrong password or unknown login is a 401
// with no hint about which one was wrong.
// 10 wrong tries in 15 minutes for one login gets a 429 — that
// stops someone hammering at one account. a good login clears the
// count, so an honest typo doesn't count against anyone.
app.post('/api/login', (req, res) => {
  const body = req.body || {}
  const loginKey = String(body.username || '').trim().toLowerCase()
  if (loginLimiter.isBlocked(loginKey)) {
    return res.status(429).json({
      error: 'too many failed logins — try again in a few minutes',
    })
  }
  const result = loginUser(db, body.username, body.password)
  if (!result) {
    loginLimiter.hit(loginKey)
    return res.status(401).json({ error: 'wrong username or password' })
  }
  loginLimiter.clear(loginKey)
  res.json(result)
})

// forgot password: send { email } and, if that email belongs to an
// account, a reset link goes out. the answer is always the same
// sentence either way — saying "no account with that email" would
// let anyone check which emails are registered here. the link points
// at the frontend's reset page, with the token in the url.
app.post('/api/forgot-password', async (req, res) => {
  const body = req.body || {}
  const emailKey = String(body.email || '').trim().toLowerCase()
  // 5 reset requests per email in an hour — otherwise anyone could
  // flood one person's inbox with reset emails. the limit counts
  // every request, real email or not, and the answer stays the same
  // generic sentence either way.
  if (forgotLimiter.isBlocked(emailKey)) {
    return res.status(429).json({
      error: 'too many reset requests for this email — try again later',
    })
  }
  forgotLimiter.hit(emailKey)
  const reset = requestPasswordReset(db, body.email)
  if (reset) {
    const base = (process.env.RESET_BASE_URL || 'http://localhost:5173').replace(
      /\/$/,
      ''
    )
    const resetUrl = `${base}/reset-password?token=${reset.token}`
    try {
      await sendResetEmail(reset.email, resetUrl)
    } catch (err) {
      // the mail server being down shouldn't tell the browser
      // anything different — the link is still in the server log
      // when there's no smtp, and the token stays usable for its hour.
      console.log(`could not send reset email: ${err.message}`)
    }
  }
  res.json({
    ok: true,
    message:
      'If an account with that email exists, a reset link has been sent.',
  })
})

// reset the password: send { token, password } from the reset page.
// a bad, used, or expired token is a 400, and so is a password
// shorter than 8 characters. on success the new password works
// straight away and the old one stops working.
app.post('/api/reset-password', (req, res) => {
  const body = req.body || {}
  const result = resetPassword(db, body.token, body.password)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  res.json({ ok: true })
})

// who am I, from the token. the frontend calls this when it loads so
// a saved token still counts as logged in.
app.get('/api/me', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  const user = token ? getUser(db, token) : null
  if (!user) {
    return res.status(401).json({ error: 'not logged in' })
  }
  res.json(user)
})

// log out: the token stops working. the frontend also clears its copy.
app.post('/api/logout', (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (token) {
    logout(db, token)
  }
  res.json({ ok: true })
})

// accounts are the broker's job — an agent asking for them gets a
// 403, same as asking for someone else's deals.
function requireBroker(req, res) {
  if (req.user.role !== 'broker') {
    res.status(403).json({ error: 'only the broker can manage accounts' })
    return false
  }
  return true
}

// every account in the office, with who they are and whether they
// can log in. broker only.
app.get('/api/accounts', (req, res) => {
  if (!requireBroker(req, res)) {
    return
  }
  res.json(listAccounts(db))
})

// add a new agent: name, username, email, starting password, and
// optionally the split plan and yearly goal. broker only — and the
// broker can't make another broker here, agents only.
app.post('/api/accounts', (req, res) => {
  if (!requireBroker(req, res)) {
    return
  }
  const result = createAccount(db, req.body || {})
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  res.status(201).json(result.account)
})

// set a new password for one account. broker only, and not for
// their own account — the broker changes their own password with
// /api/change-password like everyone else. the account's logins
// everywhere stop working when this happens.
app.post('/api/accounts/:id/reset-password', (req, res) => {
  if (!requireBroker(req, res)) {
    return
  }
  const userId = Number(req.params.id)
  if (userId === req.user.id) {
    return res.status(400).json({
      error: 'use change password for your own account',
    })
  }
  const result = resetAccountPassword(db, userId, (req.body || {}).password)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  res.json({ ok: true })
})

// turn one account off or back on. broker only, and the broker
// can't turn off their own account — that would lock the office
// out of its own accounts page. turning an account off logs them
// out everywhere on the spot.
app.post('/api/accounts/:id/active', (req, res) => {
  if (!requireBroker(req, res)) {
    return
  }
  const userId = Number(req.params.id)
  if (userId === req.user.id) {
    return res
      .status(400)
      .json({ error: 'you cannot turn off your own account' })
  }
  const result = setAccountActive(db, userId, Boolean((req.body || {}).active))
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  res.json({ ok: true })
})

// set one agent's yearly goal. broker only — an agent can't raise
// their own target to make the leaderboard look better. the office
// goal is the sum of everyone's goals, so this moves that too.
app.patch('/api/agents/:id/goal', (req, res) => {
  if (!requireBroker(req, res)) {
    return
  }
  const result = setAgentGoal(
    db,
    Number(req.params.id),
    (req.body || {}).yearlyGoal
  )
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  res.json(result.agent)
})

// change your own password: the current one has to be right, and
// the new one has to be at least 8 characters. anyone logged in can
// use this — agent or broker.
app.post('/api/change-password', (req, res) => {
  const body = req.body || {}
  const result = changePassword(
    db,
    req.user.id,
    body.currentPassword,
    body.password
  )
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
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
// otherwise the whole office — but only a broker gets the whole
// office; an agent always gets their own numbers. "made this year"
// only counts closed deals.
app.get('/api/summary', (req, res) => {
  const agentId = scopedAgentId(req, res)
  if (agentId === undefined) {
    return
  }
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

  // pace forecast: if I keep earning at the same rate I have so far
  // this year, where do I finish on Dec 31? just net so far divided
  // by the days gone, times the days in the year — a rough guess, not
  // a promise, but it shows whether the goal is actually in reach.
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now - yearStart) / 86400000) + 1
  const year = now.getFullYear()
  const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInYear = isLeap ? 366 : 365
  const paceForecast = round((netThisYear / dayOfYear) * daysInYear)

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
    paceForecast,
  })
})

// badges: one row per agent, each badge marked earned or not, with a
// line saying what it took (or what it still takes). an agent only
// gets their own row — the whole office is for the broker. the math
// lives in badges.js so I can test it without the server running.
app.get('/api/badges', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents').all()
  const rows = computeBadges(agents, dealsWithMath())
  if (req.user.role === 'broker') {
    return res.json(rows)
  }
  res.json(rows.filter((row) => row.id === req.user.agentId))
})

// the office pulse: recent closings and deals closing soon, newest
// first — a quick glance at what the office has actually been doing.
// an agent only sees their own deals in it.
app.get('/api/feed', (req, res) => {
  const agentId = req.user.role === 'broker' ? null : req.user.agentId
  res.json(buildFeed(dealsWithMath(agentId)))
})

// the calendar: every closing date and condition deadline in one
// month, so an agent can see what's coming up at a glance.
// ?month=2026-11, defaults to this month. an agent only sees
// their own deals' events.
app.get('/api/calendar', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7)
  const agentId = scopedAgentId(req, res)
  if (agentId === undefined) {
    return
  }
  const deals = dealsWithMath(agentId)

  const events = []
  deals.forEach((deal) => {
    if (deal.closing_date && deal.closing_date.startsWith(month)) {
      events.push({
        date: deal.closing_date,
        kind: 'closing',
        dealId: deal.id,
        address: deal.address,
        agentName: deal.agent_name,
        status: deal.status,
        net: round(deal.net),
      })
    }
    if (deal.condition_deadline && deal.condition_deadline.startsWith(month)) {
      events.push({
        date: deal.condition_deadline,
        kind: 'condition deadline',
        dealId: deal.id,
        address: deal.address,
        agentName: deal.agent_name,
        status: deal.status,
        net: round(deal.net),
      })
    }
  })
  events.sort((a, b) => a.date.localeCompare(b.date))
  res.json(events)
})

// net earned per month, for the chart on the dashboard. only closed
// deals count, and only this year's — so the chart shows how the year
// actually went, month by month. months with no closings still show up
// as zero, otherwise the chart would have gaps in it. an agent only
// sees their own months.
app.get('/api/monthly', (req, res) => {
  const agentId = scopedAgentId(req, res)
  if (agentId === undefined) {
    return
  }
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
// the broker view will show. an agent only gets their own row.
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

  if (req.user.role === 'broker') {
    return res.json(rows)
  }
  res.json(rows.filter((row) => row.id === req.user.agentId))
})

// the income report: a clean printable page per agent, for mortgages
// and loans — open it in the browser and print to pdf. needs an agent,
// and the agent has to exist. an agent can only pull their own
// report; a broker can pull anyone's.
app.get('/api/report/income', (req, res) => {
  const agentId = scopedAgentId(req, res)
  if (agentId === undefined) {
    return
  }
  if (!agentId) {
    return res.status(400).json({ error: 'agentId is required' })
  }
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId)
  if (!agent) {
    return res.status(404).json({ error: 'no agent with that id' })
  }
  res.setHeader('Content-Type', 'text/html')
  res.send(buildIncomeReport(agent, dealsWithMath(agentId)))
})

// the agents, for the add-a-deal form's dropdown. an agent only
// sees themselves in it — the broker sees everyone.
app.get('/api/agents', (req, res) => {
  if (req.user.role === 'broker') {
    return res.json(
      db.prepare('SELECT id, name FROM agents ORDER BY name').all()
    )
  }
  res.json(
    db
      .prepare('SELECT id, name FROM agents WHERE id = ?')
      .all(req.user.agentId)
  )
})

// every client, or one agent's with ?agentId=. newest contact first,
// so the ones you haven't talked to in a while sink to the bottom.
// an agent only sees their own clients.
app.get('/api/clients', (req, res) => {
  const agentId = scopedAgentId(req, res)
  if (agentId === undefined) {
    return
  }
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
// be left blank until you've actually talked to them. an agent can
// only add clients for themselves.
app.post('/api/clients', (req, res) => {
  const body = req.body || {}
  const agentId = Number(body.agent_id)

  if (!canCreateFor(req.user, agentId)) {
    return res
      .status(403)
      .json({ error: 'you can only add clients for yourself' })
  }

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
// ?agentId= narrows both lists to one agent. an agent only sees
// their own nudges.
app.get('/api/nudges', (req, res) => {
  const agentId = scopedAgentId(req, res)
  if (agentId === undefined) {
    return
  }
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
// you get everything. ?agentId= narrows it to one agent. an agent
// only exports their own deals.
app.get('/api/export/payperiod', (req, res) => {
  const agentId = scopedAgentId(req, res)
  if (agentId === undefined) {
    return
  }
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
    .prepare('SELECT * FROM deals WHERE id = ?')
    .get(Number(req.params.id))
  if (!deal) {
    return res.status(404).json({ error: 'no deal with that id' })
  }
  if (!canSeeDeal(req.user, deal)) {
    return res.status(403).json({ error: "that's not your deal" })
  }
  res.json(
    checklistFor(deal.id).map((item) => ({ ...item, done: item.done === 1 }))
  )
})

app.patch('/api/deals/:id/checklist/:itemId', (req, res) => {
  const deal = db
    .prepare('SELECT * FROM deals WHERE id = ?')
    .get(Number(req.params.id))
  if (!deal) {
    return res.status(404).json({ error: 'no deal with that id' })
  }
  if (!canSeeDeal(req.user, deal)) {
    return res.status(403).json({ error: "that's not your deal" })
  }
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
  const agentId = scopedAgentId(req, res)
  if (agentId === undefined) {
    return
  }
  res.json(dealsWithMath(agentId))
})

// add a deal. the agent has to exist, and the basics (address, price,
// commission %, side, status) have to be there — everything else can be
// filled in later. returns the new deal with its math worked out, so the
// form can show the net right away. an agent can only add deals
// for themselves.
app.post('/api/deals', (req, res) => {
  const body = req.body || {}
  const agentId = Number(body.agent_id)
  const price = Number(body.price)
  const commissionPct = Number(body.commission_pct)

  if (!canCreateFor(req.user, agentId)) {
    return res
      .status(403)
      .json({ error: 'you can only add deals for yourself' })
  }

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
        closing_date, condition_deadline, status, source, referral_pct, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      agentId,
      body.address,
      price,
      commissionPct,
      body.side,
      body.sold_date || null,
      body.closing_date || null,
      body.condition_deadline || null,
      body.status,
      body.source || null,
      Number(body.referral_pct) || 0,
      Number(body.lat) || null,
      Number(body.lng) || null
    )

  // run the whole list through the math so a tiered split counts the
  // deals before this one, then pick the new deal out of it.
  const created = dealsWithMath().find((deal) => deal.id === result.lastInsertRowid)
  res.status(201).json(created)
})

// import deals from a csv: send { csv, agent_id } where csv is the
// file text. the good rows get added, the bad ones are skipped and
// reported back with a reason, so the broker can fix the file and
// try again. same role rule as adding one deal — an agent can only
// import their own deals, the broker can import for anyone.
app.post('/api/deals/import', (req, res) => {
  const body = req.body || {}
  const agentId = Number(body.agent_id)

  if (!canCreateFor(req.user, agentId)) {
    return res
      .status(403)
      .json({ error: 'you can only add deals for yourself' })
  }
  if (!agentId) {
    return res.status(400).json({ error: 'an agent is required' })
  }
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId)
  if (!agent) {
    return res.status(400).json({ error: 'no agent with that id' })
  }

  const result = importDeals(db, body.csv, agentId)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }

  // run the whole list through the math so the new deals come back
  // with their numbers worked out, same as adding one deal.
  const imported = dealsWithMath().filter((deal) =>
    result.importedIds.includes(deal.id)
  )
  res.status(201).json({ imported, skipped: result.skipped })
})

// edit a deal — fix a typo'd price, change the status, move the
// closing date. only the fields sent get changed, and only an
// agent's own deals (or any deal, if you're the broker). returns
// the updated deal with its math re-worked, so the table shows the
// new net straight away.
app.patch('/api/deals/:id', (req, res) => {
  const deal = db
    .prepare('SELECT * FROM deals WHERE id = ?')
    .get(Number(req.params.id))
  if (!deal) {
    return res.status(404).json({ error: 'no deal with that id' })
  }
  if (!canSeeDeal(req.user, deal)) {
    return res.status(403).json({ error: "that's not your deal" })
  }

  const { updates, error } = cleanDealUpdate(req.body || {})
  if (error) {
    return res.status(400).json({ error })
  }

  const columns = Object.keys(updates)
  const setClause = columns.map((column) => `${column} = ?`).join(', ')
  db.prepare(`UPDATE deals SET ${setClause} WHERE id = ?`).run(
    ...columns.map((column) => updates[column]),
    deal.id
  )

  const updated = dealsWithMath().find((row) => row.id === deal.id)
  res.json(updated)
})

// delete a deal. same rule as editing — your own deals only, broker
// can delete any. the deal's checklist rows go too, so nothing is
// left pointing at a deal that doesn't exist any more.
app.delete('/api/deals/:id', (req, res) => {
  const deal = db
    .prepare('SELECT * FROM deals WHERE id = ?')
    .get(Number(req.params.id))
  if (!deal) {
    return res.status(404).json({ error: 'no deal with that id' })
  }
  if (!canSeeDeal(req.user, deal)) {
    return res.status(403).json({ error: "that's not your deal" })
  }

  db.prepare('DELETE FROM checklist_items WHERE deal_id = ?').run(deal.id)
  db.prepare('DELETE FROM deals WHERE id = ?').run(deal.id)
  res.json({ ok: true })
})

function round(n) {
  return Math.round(n * 100) / 100
}

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`)
})
