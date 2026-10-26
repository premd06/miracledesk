// tests for the money math — the one part I refuse to get wrong.
// run with: npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { commission } = require('./commission')

test('flat split, no referral', () => {
  const result = commission(
    { price: 1000000, commission_pct: 2.5, referral_pct: 0, split_plan: '70' },
    0
  )
  assert.equal(result.gross, 25000)
  assert.equal(result.referral, 0)
  assert.equal(result.agentShare, 17500)
  assert.equal(result.hst, 2275)
  assert.equal(result.net, 17500)
})

test('flat split with a referral fee off the top', () => {
  const result = commission(
    { price: 800000, commission_pct: 2.5, referral_pct: 25, split_plan: '80' },
    0
  )
  // gross 20000, referral takes 5000, split applies to the 15000 left
  assert.equal(result.gross, 20000)
  assert.equal(result.referral, 5000)
  assert.equal(result.afterReferral, 15000)
  assert.equal(result.agentShare, 12000)
})

test('tiered split, still under the cap', () => {
  const result = commission(
    { price: 1000000, commission_pct: 2.5, referral_pct: 0, split_plan: '70/90@100000' },
    40000
  )
  assert.equal(result.agentShare, 17500)
})

test('tiered split, already past the cap', () => {
  const result = commission(
    { price: 1000000, commission_pct: 2.5, referral_pct: 0, split_plan: '70/90@100000' },
    120000
  )
  assert.equal(result.agentShare, 22500)
})

test('tiered split, one deal crosses the cap', () => {
  const result = commission(
    { price: 1000000, commission_pct: 2.5, referral_pct: 0, split_plan: '70/90@100000' },
    90000
  )
  // 10000 of room left under the cap = 14285.71 of the deal at 70%,
  // the rest at 90% -> 10000 + 9642.86 = 19642.86
  assert.equal(result.agentShare, 19642.86)
})
