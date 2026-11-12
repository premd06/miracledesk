// tests for the income report — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { incomeTotals, buildIncomeReport } = require('./report')

const agent = { id: 1, name: 'Sam Patel', yearly_goal: 150000 }
const year = String(new Date().getFullYear())

// same shape the route passes in — deals with their math already done.
function deal(closingDate, price, gross, referral, net, hst) {
  return {
    agent_id: 1,
    address: '12 Test St, Brampton',
    side: 'buyer',
    status: 'closed',
    closing_date: closingDate,
    price,
    gross,
    referral,
    net,
    hst,
  }
}

test('totals only count this year closed deals', () => {
  const deals = [
    deal(`${year}-02-20`, 900000, 22500, 0, 15750, 2047.5),
    deal(`${year}-06-30`, 1000000, 25000, 6250, 13125, 1706.25),
    deal('2025-03-10', 800000, 20000, 0, 14000, 1820),
    { ...deal(`${year}-11-12`, 700000, 17500, 0, 12250, 1592.5), status: 'pending' },
  ]
  const t = incomeTotals(deals)
  assert.equal(t.closedCount, 2)
  assert.equal(t.volume, 1900000)
  assert.equal(t.gross, 47500)
  assert.equal(t.referral, 6250)
  assert.equal(t.net, 28875)
  assert.equal(t.hst, 3753.75)
  assert.equal(t.taxSetAside, 7218.75)
})

test('report page shows the agent, the totals and the deals', () => {
  const deals = [deal(`${year}-02-20`, 900000, 22500, 0, 15750, 2047.5)]
  const html = buildIncomeReport(agent, deals)
  assert.match(html, /Sam Patel/)
  assert.match(html, new RegExp(year)) // the report year
  assert.match(html, /\$15,750\.00/) // net earned
  assert.match(html, /12 Test St, Brampton/)
  assert.match(html, /Yearly goal/)
  // the report must not say it's sample data any more — a real
  // agent hands this to a bank, and "demo report" on it would
  // make the whole thing look fake. the tax note stays.
  assert.doesNotMatch(html, /Sample data/)
  assert.match(html, /rough rule of thumb, not tax advice/)
})

test('report with no closed deals still renders', () => {
  const html = buildIncomeReport(agent, [])
  assert.match(html, /No closed deals yet this year/)
  assert.match(html, /\$0\.00/)
})
