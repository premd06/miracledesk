# stuff I'm building, in order

one thing per session, small commits. this is a demo with sample data — no real deals, ever.

## how I want it to look

professional, like something an office would actually use. dark green + white (brokerage colours), clean tables, numbers easy to read. it's a money tool — it should look like one, not like a game.

## scaffold (mostly done)
- [x] project set up: client/ (react) + server/ (express) in one repo
- [x] /api/health route so I know the server runs
- [ ] dashboard shell in the frontend: header, sidebar or top nav, empty cards row

## database
- [ ] sqlite tables: agents (name, split %) and deals (agent, address, price, commission %, side, closing date, status)
- [ ] seed script with sample data — a few fake agents, ~15 fake deals spread over the year so the charts have something to show

## api
- [ ] GET /api/deals — all deals, or one agent's with ?agentId=
- [ ] GET /api/summary — the totals for the cards (made this year, closing soon, deal count), math done on the server
- [ ] POST /api/deals — add a deal

## frontend
- [ ] deals table loaded from the api
- [ ] summary cards wired to /api/summary
- [ ] add-a-deal form that posts to the api and shows up in the table
- [ ] monthly earnings chart (recharts — same as my seo dashboard)

## broker view
- [ ] office page: every agent's totals + office total
- [ ] leaderboard (who's made the most this year)
- [ ] closing this month list

## later
- [ ] simple login — pick your name from a list (demo style, no real passwords)
- [ ] export a pay-period report (csv)
- [ ] deploy it and add screenshots to the readme
