# stuff I'm building, in order

one feature per session, finished properly. keep the code simple — if I can't explain a line, it's too much. this is a demo with sample data — no real deals, ever.

the idea got bigger than "commission dashboard" on purpose (oct 24): it's the agent's whole desk at the brokerage — money, clients, follow-ups, calendar, the lot. commissions are the core, everything else hangs off the same deal data.

## how I want it to look

professional, like something an office would actually use. clean tables, numbers big and easy to read. agents check this on their phones between showings, so mobile matters. theme picked (oct 24): **light sage green, bank style** — white and light grey background, soft eucalyptus green for the chart and accents, dark slate text, one clean sans font for everything, hairline dividers instead of boxes everywhere, big calm numbers, lots of empty space. like a bank app — not crowded, nothing flashy. dark mode toggle included.

## scaffold (done)
- [x] project set up: client/ (react) + server/ (express) in one repo
- [x] /api/health route so I know the server runs
- [x] dashboard shell: header, nav, the cards row — built to the mockup I approved

## database
- [x] sqlite tables: agents (name, split plan, yearly goal) and deals (agent, address, price, commission %, side, sold + closing dates, status, where the deal came from)
- [x] seed script with sample data — a few fake agents, ~15 fake deals spread over the year so the charts have something to show

## the money math (own piece, with tests)
- [x] commission.js — one function that does the whole calculation: gross, referral fee off the top if there is one, the split (flat or tiered), HST, agent's net
- [x] unit tests for it. money math is the one part I refuse to get wrong

## api
- [x] GET /api/deals — all deals, or one agent's with ?agentId=
- [x] GET /api/summary — the numbers for the cards (made this year, closing soon, deal count, goal progress)
- [x] GET /api/leaderboard — every agent's totals for the broker view
- [x] POST /api/deals — add a deal

## frontend
- [x] deals table loaded from the api (status shown as little coloured labels)
- [x] summary cards wired to /api/summary, goal progress bar included
- [x] add-a-deal form that posts to the api and shows up in the table
- [x] edit + delete a deal: fix a typo'd price or status, or remove a deal, right from the deals table
- [x] monthly earnings chart (recharts — same as my seo dashboard)

## broker view
- [x] office page: every agent's totals + office total
- [x] leaderboard (most net earned this year on top)
- [x] what's closing this month
- [x] export a pay-period summary as csv — the feature that would make an office actually use this

## look & feel pass
- [ ] apply the theme I picked (from the mockups) across the whole app with css variables
- [x] dark mode toggle, saved so it sticks between visits

## the extras (picked oct 24)
- [x] tax + HST set-aside card: HST collected so far + a rough "keep this much aside for taxes" number
- [x] closing checklist on each deal: deposit in, conditions waived, lawyer has the docs, keys ready — so nothing falls through before closing day
- [x] clients: a list of each agent's buyers/sellers with a status and last-contacted date (own table + api + page)
- [x] follow-up nudges: "you haven't talked to this client in 14 days" + closing anniversaries ("1 year since they closed — send a text")
- [x] calendar view: closings and condition deadlines on a month calendar
- [x] pace forecast on the goal bar: "at this rate you finish the year at $X"
- [x] badges + streaks: top producer of the month, closing streaks, first $100k — little stuff, agents love it
- [x] office pulse feed: "sarah just closed in brampton" — recent activity across the office
- [x] TV leaderboard: a fullscreen big-type version of the leaderboard for an office TV, refreshes itself
- [x] deal map: leaflet map with a pin for every deal (same map setup as my real estate site) — where the office's business actually is
- [x] PDF income report: a clean printable earnings report per agent (agents need these for mortgages and loans)

## accounts
- [x] real login: agents log in and only see their own deals, the broker sees everything. hashed passwords, roles checked on the server, not just hidden in the frontend
- [x] log in with email or username + forgot-password reset: a one-time link, good for an hour, emailed when SMTP is set up — otherwise the link prints to the server log so the flow still works for testing
- [x] logins that survive a restart: sessions live in the database, 30 days with a sliding expiry — closing the tab or restarting the server doesn't log anyone out, logging out kills just that one login
- [x] broker accounts page: add an agent (name, username, email, starting password, split plan, yearly goal), see every account, reset anyone's password, turn an account off and back on
- [x] change your own password from the sidebar — current password first
- [x] rate limits: 10 failed logins per login in 15 minutes, 5 reset requests per email in an hour

## later
- [x] import deals from a csv (offices already have spreadsheets — nobody's re-typing history): upload on the Deals page, bad rows are skipped and reported back with a reason instead of killing the whole import
- [x] sort the deals table by address, price, net or closing date — click a header to sort, click it again to flip it
- [x] per-agent goals: the broker sets each agent's yearly goal from the Accounts page, the leaderboard shows each agent against their own goal, and an agent's dashboard goal bar uses their own goal (the office goal is everyone's added up)
- [ ] phone app feel (pwa) — installable, no app store
- [ ] deploy the demo (sample data) + screenshots in the readme
