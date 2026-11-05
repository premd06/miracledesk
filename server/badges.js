// badges + the office pulse feed — small stuff, but agents love
// seeing their name up there. both are worked out from the deals we
// already have, so there's nothing new to store.
//
// the badges:
//   top producer this month — most net from deals closed this month
//   3 closes in a row      — three closed deals back to back, no open
//                             deal in between
//   first $100k             — $100,000 net earned this year
//
// the feed is just the office's recent activity in plain words:
// deals that closed, and deals closing soon. newest first.

function money(n) {
  return '$' + Math.round(n).toLocaleString()
}

function thisYear(deal) {
  const year = String(new Date().getFullYear())
  return deal.closing_date && deal.closing_date.startsWith(year)
}

function thisMonth(deal) {
  const month = new Date().toISOString().slice(0, 7)
  return deal.closing_date && deal.closing_date.startsWith(month)
}

// longest run of closed deals in a row, deals sorted by closing date.
// an open deal breaks the run — that's the whole point of a streak.
function longestStreak(deals) {
  const mine = deals
    .filter((deal) => deal.closing_date)
    .sort((a, b) => a.closing_date.localeCompare(b.closing_date))

  let best = 0
  let run = 0
  for (const deal of mine) {
    if (deal.status === 'closed') {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}

// one row per agent, with all three badges marked earned or not and a
// line saying what it took (or what it's still going to take). locked
// badges stay visible on purpose — that's what makes people chase them.
function computeBadges(agents, deals) {
  // top producer first: net from deals closed this month, per agent.
  const monthNet = {}
  deals
    .filter((deal) => deal.status === 'closed' && thisMonth(deal))
    .forEach((deal) => {
      monthNet[deal.agent_id] = (monthNet[deal.agent_id] || 0) + deal.net
    })
  const topId =
    Object.keys(monthNet).length === 0
      ? null
      : Number(
          Object.entries(monthNet).sort((a, b) => b[1] - a[1])[0][0]
        )

  return agents.map((agent) => {
    const mine = deals.filter((deal) => deal.agent_id === agent.id)
    const netThisYear = mine
      .filter((deal) => deal.status === 'closed' && thisYear(deal))
      .reduce((sum, deal) => sum + deal.net, 0)
    const streak = longestStreak(mine)

    return {
      id: agent.id,
      name: agent.name,
      badges: [
        {
          id: 'top-producer',
          label: 'Top producer this month',
          earned: agent.id === topId,
          detail:
            topId === null
              ? 'nobody has closed anything this month yet'
              : agent.id === topId
                ? money(monthNet[agent.id]) + ' closed this month'
                : money(monthNet[agent.id] || 0) + ' closed this month',
        },
        {
          id: 'streak-3',
          label: '3 closes in a row',
          earned: streak >= 3,
          detail:
            streak >= 3
              ? streak + ' closed in a row'
              : streak === 0
                ? 'no closes in a row yet'
                : streak + ' in a row — ' + (3 - streak) + ' more to go',
        },
        {
          id: 'first-100k',
          label: 'First $100k',
          earned: netThisYear >= 100000,
          detail:
            money(netThisYear) + ' of $100,000 earned this year',
        },
      ],
    }
  })
}

// the pulse feed: recent closings, plus deals closing in the next 60
// days so the office can see what's about to land. newest first, ten
// at most — it's a quick glance, not a history page.
function buildFeed(deals, todayText) {
  const today = todayText || new Date().toISOString().slice(0, 10)
  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const events = []
  deals.forEach((deal) => {
    if (deal.status === 'closed' && deal.closing_date) {
      events.push({
        date: deal.closing_date,
        kind: 'closed',
        text:
          deal.agent_name +
          ' closed ' +
          deal.address +
          ' — ' +
          money(deal.net) +
          ' net',
      })
    } else if (
      (deal.status === 'pending' || deal.status === 'conditional') &&
      deal.closing_date &&
      deal.closing_date >= today &&
      deal.closing_date <= in60Days
    ) {
      events.push({
        date: deal.closing_date,
        kind: 'closing soon',
        text:
          deal.agent_name +
          ' closes ' +
          deal.address +
          ' on ' +
          deal.closing_date,
      })
    }
  })

  events.sort((a, b) => b.date.localeCompare(a.date))
  return events.slice(0, 10)
}

module.exports = { computeBadges, buildFeed }
