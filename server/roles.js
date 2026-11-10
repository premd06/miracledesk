// who is allowed to see what. this is the whole point of login
// part 2: the server checks roles, not just the frontend hiding
// pages. kept in its own file so I can test the rules without
// starting the server.
//
// a "user" here is the session from auth.js: { id, name, role, agentId }.
// role is 'agent' or 'broker'. brokers see everything; agents only
// ever see their own stuff.

function isBroker(user) {
  return user.role === 'broker'
}

// which agent id a request is allowed to be scoped to. askedAgentId
// is the ?agentId= from the query, or null if there wasn't one.
//   broker  -> whatever they asked for, or null for the whole office
//   agent   -> their own id, no matter what they asked for... unless
//              they asked for someone else, which is a no: returns
//              false, and the route turns that into a 403.
function visibleAgentId(user, askedAgentId) {
  if (isBroker(user)) {
    return askedAgentId || null
  }
  if (askedAgentId && askedAgentId !== user.agentId) {
    return false
  }
  return user.agentId
}

// can this user create a deal or a client for this agent id?
// an agent can only create their own; a broker can create for anyone.
function canCreateFor(user, agentId) {
  return isBroker(user) || agentId === user.agentId
}

// can this user see this deal (or its checklist)? same rule: your
// own deals, or everything if you're the broker.
function canSeeDeal(user, deal) {
  return isBroker(user) || deal.agent_id === user.agentId
}

module.exports = { isBroker, visibleAgentId, canCreateFor, canSeeDeal }
