// tests for the role rules — run with:
// npm test (from the server folder)
const test = require('node:test')
const assert = require('node:assert')
const {
  isBroker,
  visibleAgentId,
  canCreateFor,
  canSeeDeal,
} = require('./roles')

const sam = { id: 1, name: 'Sam Patel', role: 'agent', agentId: 1 }
const jess = { id: 2, name: 'Jess Lee', role: 'agent', agentId: 2 }
const broker = { id: 5, name: 'Broker', role: 'broker', agentId: null }

test('a broker is a broker, an agent is not', () => {
  assert.equal(isBroker(broker), true)
  assert.equal(isBroker(sam), false)
})

test('a broker asking for an agent gets that agent, asking for none gets everyone', () => {
  assert.equal(visibleAgentId(broker, 2), 2)
  assert.equal(visibleAgentId(broker, null), null)
})

test('an agent asking for nothing gets their own id', () => {
  assert.equal(visibleAgentId(sam, null), 1)
})

test('an agent asking for themselves is fine, asking for someone else is a no', () => {
  assert.equal(visibleAgentId(sam, 1), 1)
  assert.equal(visibleAgentId(sam, 2), false)
})

test('an agent can only create deals and clients for themselves', () => {
  assert.equal(canCreateFor(sam, 1), true)
  assert.equal(canCreateFor(sam, 2), false)
  assert.equal(canCreateFor(broker, 2), true)
})

test('an agent can only see their own deals', () => {
  const samsDeal = { id: 1, agent_id: 1 }
  const jessDeal = { id: 2, agent_id: 2 }
  assert.equal(canSeeDeal(sam, samsDeal), true)
  assert.equal(canSeeDeal(sam, jessDeal), false)
  assert.equal(canSeeDeal(jess, samsDeal), false)
  assert.equal(canSeeDeal(broker, samsDeal), true)
  assert.equal(canSeeDeal(broker, jessDeal), true)
})
