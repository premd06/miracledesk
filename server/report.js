// the income report — a plain printable page an agent can hand to a
// bank or lender (browser print -> save as pdf). it only counts deals
// that actually closed this year, and the numbers come from the same
// commission math as everything else, so they match the dashboard.
function incomeTotals(deals) {
  const year = String(new Date().getFullYear())
  const closed = deals.filter(
    (deal) => deal.status === 'closed' && deal.closing_date && deal.closing_date.startsWith(year)
  )

  const total = (field) =>
    closed.reduce((sum, deal) => sum + (deal[field] || 0), 0)

  const net = total('net')
  return {
    year,
    closedCount: closed.length,
    volume: round(total('price')),
    gross: round(total('gross')),
    referral: round(total('referral')),
    net: round(net),
    hst: round(total('hst')),
    // same rough 25% rule as the dashboard card — not tax advice,
    // the accountant has the real number.
    taxSetAside: round(net * 0.25),
    closed,
  }
}

// builds the whole report page as html. kept as a plain string on
// purpose — it's a print page, it doesn't need react.
function buildIncomeReport(agent, deals) {
  const t = incomeTotals(deals)
  const goal = agent.yearly_goal || 0
  const goalPct = goal ? Math.round((t.net / goal) * 100) : 0
  const today = new Date().toISOString().slice(0, 10)

  const rows = t.closed
    .map(
      (deal) => `<tr>
        <td>${deal.closing_date}</td>
        <td>${escapeHtml(deal.address)}</td>
        <td>${deal.side}</td>
        <td class="num">${money(deal.price)}</td>
        <td class="num">${money(deal.gross)}</td>
        <td class="num">${money(deal.referral)}</td>
        <td class="num">${money(deal.net)}</td>
      </tr>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Income report — ${escapeHtml(agent.name)} ${t.year}</title>
<style>
  body { font-family: Georgia, serif; color: #222; margin: 40px auto; max-width: 760px; padding: 0 20px; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .sub { color: #666; margin-top: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #ddd; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; }
  .num { text-align: right; }
  .totals { margin-top: 24px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
  .totals .big { font-size: 18px; font-weight: bold; border-bottom: none; }
  .note { margin-top: 32px; font-size: 12px; color: #777; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
  <h1>Income report — ${escapeHtml(agent.name)}</h1>
  <p class="sub">HomeLife / Miracle Realty &middot; ${t.year} &middot; prepared ${today}</p>

  <div class="totals">
    <div><span>Deals closed</span><span>${t.closedCount}</span></div>
    <div><span>Total sales volume</span><span>${money(t.volume)}</span></div>
    <div><span>Gross commission</span><span>${money(t.gross)}</span></div>
    <div><span>Referral fees paid</span><span>${money(t.referral)}</span></div>
    <div><span>HST collected (13%)</span><span>${money(t.hst)}</span></div>
    <div><span>Rough tax set-aside (25% of net)</span><span>${money(t.taxSetAside)}</span></div>
    <div class="big"><span>Net earned</span><span>${money(t.net)}</span></div>
    <div><span>Yearly goal</span><span>${money(goal)} (${goalPct}%)</span></div>
  </div>

  <h2>Closed deals</h2>
  ${
    t.closed.length === 0
      ? '<p>No closed deals yet this year.</p>'
      : `<table>
      <tr><th>Closed</th><th>Address</th><th>Side</th><th class="num">Price</th><th class="num">Gross</th><th class="num">Referral</th><th class="num">Net</th></tr>
      ${rows}
    </table>`
  }

  <p class="note">The tax set-aside is a rough rule of thumb, not tax advice.</p>
</body>
</html>`
}

function money(n) {
  return '$' + Number(n).toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function round(n) {
  return Math.round(n * 100) / 100
}

// addresses come from the database, so escape them before they go
// into the page — a quote or bracket in an address shouldn't break it.
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = { incomeTotals, buildIncomeReport }
