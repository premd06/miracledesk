// working out what a deal edit is allowed to change. this runs before
// the update hits the database, so a bad edit never saves half-way.
// it only picks the fields I actually let people edit — anything
// else in the request (like agent_id) just gets dropped, so nobody
// can move a deal to another agent by editing it.
//
// returns { updates } with the clean fields, or { error } with a
// plain message the form can show.
const STATUSES = ['pending', 'conditional', 'closed']
const SIDES = ['buyer', 'seller']

function cleanDealUpdate(body) {
  const updates = {}

  if (body.address !== undefined) {
    if (!body.address || !String(body.address).trim()) {
      return { error: 'address cannot be blank' }
    }
    updates.address = String(body.address).trim()
  }

  if (body.price !== undefined) {
    const price = Number(body.price)
    if (!price || price <= 0) {
      return { error: 'price has to be a number above 0' }
    }
    updates.price = price
  }

  if (body.commission_pct !== undefined) {
    const pct = Number(body.commission_pct)
    if (!pct || pct <= 0 || pct > 100) {
      return { error: 'commission % has to be between 0 and 100' }
    }
    updates.commission_pct = pct
  }

  if (body.side !== undefined) {
    if (!SIDES.includes(body.side)) {
      return { error: 'side has to be buyer or seller' }
    }
    updates.side = body.side
  }

  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return { error: 'status has to be pending, conditional or closed' }
    }
    updates.status = body.status
  }

  if (body.referral_pct !== undefined) {
    const referral = Number(body.referral_pct)
    if (isNaN(referral) || referral < 0 || referral > 100) {
      return { error: 'referral % has to be between 0 and 100' }
    }
    updates.referral_pct = referral
  }

  // dates and source are free text — blank means "no date", same as
  // when the deal was first added.
  if (body.sold_date !== undefined) {
    updates.sold_date = body.sold_date || null
  }
  if (body.closing_date !== undefined) {
    updates.closing_date = body.closing_date || null
  }
  if (body.condition_deadline !== undefined) {
    updates.condition_deadline = body.condition_deadline || null
  }
  if (body.source !== undefined) {
    updates.source = body.source || null
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'nothing to update' }
  }

  return { updates }
}

module.exports = { cleanDealUpdate }
