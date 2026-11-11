// tests for the deal-edit checks — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { cleanDealUpdate } = require('./dealEdit')

test('a normal edit keeps the fields it was given', () => {
  const result = cleanDealUpdate({ address: '9 New St, Brampton', price: 900000 })
  assert.equal(result.error, undefined)
  assert.equal(result.updates.address, '9 New St, Brampton')
  assert.equal(result.updates.price, 900000)
})

test('a price of 0 or a negative price is rejected', () => {
  assert.equal(cleanDealUpdate({ price: 0 }).error, 'price has to be a number above 0')
  assert.equal(cleanDealUpdate({ price: -5 }).error, 'price has to be a number above 0')
})

test('a bad status or side is rejected', () => {
  assert.equal(
    cleanDealUpdate({ status: 'sold' }).error,
    'status has to be pending, conditional or closed'
  )
  assert.equal(
    cleanDealUpdate({ side: 'both' }).error,
    'side has to be buyer or seller'
  )
})

test('a blank address and a negative referral % are rejected', () => {
  assert.equal(cleanDealUpdate({ address: '   ' }).error, 'address cannot be blank')
  assert.equal(
    cleanDealUpdate({ referral_pct: -1 }).error,
    'referral % cannot be below 0'
  )
})

test('fields I do not let people edit get dropped', () => {
  const result = cleanDealUpdate({ price: 800000, agent_id: 99, id: 42 })
  assert.equal(result.error, undefined)
  assert.equal(result.updates.price, 800000)
  assert.equal(result.updates.agent_id, undefined)
  assert.equal(result.updates.id, undefined)
})

test('an empty edit is rejected', () => {
  assert.equal(cleanDealUpdate({}).error, 'nothing to update')
  assert.equal(cleanDealUpdate({ agent_id: 2 }).error, 'nothing to update')
})
