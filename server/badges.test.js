// tests for the badges and the pulse feed — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { computeBadges, buildFeed } = require('./badges')

const agents = [
  { id: 1, name: 'Sam' },
  { id: 2, name: 'Jess' },
]

// deals are plain objects here — same shape the routes pass in,
// already with their net worked out.
function deal(agentId, status, closingDate, net) {
  return {
    agent_id: agentId,
    agent_name: agentId === 1 ? 'Sam' : 'Jess',
    address: '1 Test St',
    status,
    closing_date: closingDate,
    net,
  }
}

const thisMonth = new Date().toISOString().slice(0, 7)

test('streak badge: three closed in a row earns it', () => {
  const deals = [
    deal(1, 'closed', '2026-01-10', 10000),
    deal(1, 'closed', '2026-02-10', 10000),
    deal(1, 'closed', '2026-03-10', 10000),
    deal(1, 'pending', '2026-11-12', 10000),
  ]
  const rows = computeBadges(agents, deals)
  const sam = rows.find((row) => row.id === 1)
  const streak = sam.badges.find((badge) => badge.id === 'streak-3')
  assert.equal(streak.earned, true)
  assert.match(streak.detail, /3 closed in a row/)
})

test('streak badge: an open deal in the middle breaks the run', () => {
  const deals = [
    deal(1, 'closed', '2026-01-10', 10000),
    deal(1, 'closed', '2026-02-10', 10000),
    deal(1, 'pending', '2026-03-10', 10000),
    deal(1, 'closed', '2026-04-10', 10000),
  ]
  const rows = computeBadges(agents, deals)
  const streak = rows
    .find((row) => row.id === 1)
    .badges.find((badge) => badge.id === 'streak-3')
  assert.equal(streak.earned, false)
  assert.match(streak.detail, /2 in a row/)
})

test('first $100k: earned at $100,000, not before', () => {
  const year = new Date().getFullYear()
  const rich = [
    deal(1, 'closed', `${year}-01-10`, 60000),
    deal(1, 'closed', `${year}-02-10`, 45000),
  ]
  const poor = [deal(2, 'closed', `${year}-01-10`, 50000)]
  const rows = computeBadges(agents, [...rich, ...poor])
  const first = (id) =>
    rows.find((row) => row.id === id).badges.find((b) => b.id === 'first-100k')
  assert.equal(first(1).earned, true)
  assert.equal(first(2).earned, false)
  assert.match(first(2).detail, /\$50,000 of \$100,000/)
})

test('top producer: the agent who closed the most this month wins', () => {
  const deals = [
    deal(1, 'closed', `${thisMonth}-05`, 20000),
    deal(2, 'closed', `${thisMonth}-06`, 35000),
    deal(1, 'closed', '2026-01-10', 999999),
  ]
  const rows = computeBadges(agents, deals)
  const top = (id) =>
    rows.find((row) => row.id === id).badges.find((b) => b.id === 'top-producer')
  assert.equal(top(2).earned, true)
  assert.equal(top(1).earned, false)
})

test('top producer: nobody earns it when nothing closed this month', () => {
  const deals = [deal(1, 'closed', '2026-01-10', 20000)]
  const rows = computeBadges(agents, deals)
  const top = rows
    .find((row) => row.id === 1)
    .badges.find((b) => b.id === 'top-producer')
  assert.equal(top.earned, false)
  assert.match(top.detail, /nobody has closed/)
})

test('feed: closed deals and closings in the next 60 days, newest first', () => {
  const today = '2026-11-05'
  const deals = [
    deal(1, 'closed', '2026-10-30', 15000),
    deal(2, 'closed', '2026-04-15', 12000),
    deal(1, 'pending', '2026-11-12', 9000),
    deal(2, 'conditional', '2027-03-01', 9000),
  ]
  const feed = buildFeed(deals, today)
  assert.equal(feed.length, 3)
  assert.equal(feed[0].kind, 'closing soon')
  assert.equal(feed[0].date, '2026-11-12')
  assert.equal(feed[1].kind, 'closed')
  assert.equal(feed[1].date, '2026-10-30')
  assert.match(feed[1].text, /Sam closed/)
  assert.match(feed[2].text, /Jess closed/)
})

test('feed: a deal closing more than 60 days out does not show up', () => {
  const today = '2026-11-05'
  const deals = [deal(1, 'pending', '2027-02-01', 9000)]
  assert.equal(buildFeed(deals, today).length, 0)
})
