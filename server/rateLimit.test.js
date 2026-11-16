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

// the login route runs two limiters side by side — one per login,
// one per ip — and they have to stay separate. sam failing twice
// should trip the per-login one without touching the per-ip one,
// and the ip one only trips on its own count.
test('a per-login limiter and a per-ip limiter do not share counts', () => {
  let now = 1000000
  const perLogin = createLimiter(15 * 60 * 1000, 2, () => now)
  const perIp = createLimiter(15 * 60 * 1000, 3, () => now)
  perLogin.hit('sam')
  perLogin.hit('sam')
  assert.equal(perLogin.isBlocked('sam'), true)
  assert.equal(perIp.isBlocked('10.0.0.1'), false)
  perIp.hit('10.0.0.1')
  perIp.hit('10.0.0.1')
  assert.equal(perIp.isBlocked('10.0.0.1'), false)
  perIp.hit('10.0.0.1')
  assert.equal(perIp.isBlocked('10.0.0.1'), true)
  // and the per-login limit still only blocks sam, not everyone
  assert.equal(perLogin.isBlocked('jess'), false)
})
