# stuff I'm building, in order

one thing per session, small commits. this is a demo with sample data — no real deals, ever.

## how I want it to look

professional, like something an office would actually use. dark green + white (brokerage colours), clean tables, numbers big and easy to read. it's a money tool — it should look like one, not a game. agents will check this on their phones between showings, so it has to work on a small screen too.

## scaffold (done)
- [x] project set up: client/ (react) + server/ (express) in one repo
- [x] /api/health route so I know the server runs
- [ ] dashboard shell: header, nav, the cards row — built to the mockup I approved

## database
- [ ] sqlite tables: agents (name, split plan, yearly goal) and deals (agent, address, price, commission %, side, sold + closing dates, status, where the deal came from)
- [ ] seed script with sample data — a few fake agents, ~15 fake deals spread over the year so the charts have something to show

## the money math (own piece, with tests)
- [ ] commission.js — one function that does the whole calculation: gross, referral fee off the top if there is one, the split (flat or tiered), HST, agent's net
- [ ] unit tests for it. money math is the one part I refuse to get wrong

## api
- [ ] GET /api/deals — all deals, or one agent's with ?agentId=
- [ ] GET /api/summary — the numbers for the cards (made this year, closing soon, deal count, goal progress)
- [ ] GET /api/leaderboard — every agent's totals for the broker view
- [ ] POST /api/deals — add a deal

## frontend
- [ ] deals table loaded from the api (status shown as little coloured labels)
- [ ] summary cards wired to /api/summary, goal progress bar included
- [ ] add-a-deal form that posts to the api and shows up in the table
- [ ] monthly earnings chart (recharts — same as my seo dashboard)

## broker view
- [ ] office page: every agent's totals + office total
- [ ] leaderboard (most net earned this year on top)
- [ ] what's closing this month
- [ ] export a pay-period summary as csv — the feature that would make an office actually use this

## later
- [ ] login — agent only sees their own deals, broker sees everything (demo version first: pick your name; real passwords after)
- [ ] import deals from a csv (offices already have spreadsheets — nobody's re-typing history)
- [ ] reminder when a closing is 7 days out
- [ ] pace forecast: "at this rate you finish the year at $X"
- [ ] deploy the demo (sample data) + screenshots in the readme
