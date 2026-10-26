// the money math — one function, that's it. I keep it here so every
// route uses the same numbers and I only ever have to fix it once.
//
// how it works, in order:
//   1. gross = price x commission %
//   2. referral fee comes off the top first, if there is one
//   3. the split: what's left gets divided between me and the brokerage
//   4. HST is 13% of my share — it's charged on top, so I show it
//      separately instead of taking it out of my net
//
// split plans live on the agent as a plain string:
//   "70"           -> I keep 70% of everything, flat
//   "70/90@100000" -> I keep 70% until I've earned $100,000 this year,
//                     then 90% on everything after that
function commission(deal, ytdShare) {
  const gross = deal.price * (deal.commission_pct / 100)
  const referral = gross * ((deal.referral_pct || 0) / 100)
  const afterReferral = gross - referral

  const agentShare = splitAmount(afterReferral, deal.split_plan, ytdShare || 0)
  const hst = agentShare * 0.13

  return {
    gross: round(gross),
    referral: round(referral),
    afterReferral: round(afterReferral),
    agentShare: round(agentShare),
    hst: round(hst),
    net: round(agentShare),
  }
}

// works out my share of one deal. for a tiered plan the cap is on what
// I've already earned this year, so a deal that crosses the cap gets
// split in two: the part under the cap at the low rate, the rest at the
// high rate.
function splitAmount(afterReferral, plan, ytdShare) {
  if (!plan.includes('/')) {
    return afterReferral * (Number(plan) / 100)
  }

  const [low, rest] = plan.split('/')
  const [high, cap] = rest.split('@')
  const lowRate = Number(low) / 100
  const highRate = Number(high) / 100

  // how much room is left under the cap, in dollars I actually keep
  const room = Math.max(0, Number(cap) - ytdShare)
  // how much of this deal fits in that room at the low rate
  const fitsUnderCap = room / lowRate

  if (afterReferral <= fitsUnderCap) {
    return afterReferral * lowRate
  }
  return room + (afterReferral - fitsUnderCap) * highRate
}

function round(n) {
  return Math.round(n * 100) / 100
}

module.exports = { commission }
