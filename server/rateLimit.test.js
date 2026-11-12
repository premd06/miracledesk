// tests for the little in-memory rate limits — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const { createLimiter } = require('./rateLimit')

test('a key gets its tries, then it is blocked until the window ends', () => {
  let now = 1000000
  const limiter = createLimiter(60 * 1000, 3, () => now)
  assert.equal(limiter.isBlocked('sam'), false)
  limiter.hit('sam')
  limiter.hit('sam')
  assert.equal(limiter.isBlocked('sam'), false)
  limiter.hit('sam')
  assert.equal(limiter.isBlocked('sam'), true)
  // other keys are not affected
  assert.equal(limiter.isBlocked('jess'), false)
})

test('the block lifts once the window passes', () => {
  let now = 1000000
  const limiter = createLimiter(60 * 1000, 2, () => now)
  limiter.hit('sam')
  limiter.hit('sam')
  assert.equal(limiter.isBlocked('sam'), true)
  now += 60 * 1000 + 1
  assert.equal(limiter.isBlocked('sam'), false)
  // and the count starts over from zero
  limiter.hit('sam')
  assert.equal(limiter.isBlocked('sam'), false)
})

test('clearing a key forgets its failures', () => {
  let now = 1000000
  const limiter = createLimiter(60 * 1000, 2, () => now)
  limiter.hit('sam')
  limiter.hit('sam')
  assert.equal(limiter.isBlocked('sam'), true)
  limiter.clear('sam')
  assert.equal(limiter.isBlocked('sam'), false)
  limiter.hit('sam')
  limiter.hit('sam')
  assert.equal(limiter.isBlocked('sam'), true)
})
