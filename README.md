# miracledesk

a dashboard I'm building for the realtors at my brokerage (HomeLife/Miracle Realty, in the GTA) to track their deals and commissions. right now, if you want to know what you've actually made this year, you're digging through closing paperwork or a spreadsheet somebody made in 2015. this puts it on one page. I called it MiracleDesk — the agents' desk at Miracle.

heads up: everything in here runs on **sample data** — fake agents, fake deals, fake addresses. it's a demo of how the system would work. real client info would never go in a public repo.

## what it does

two sides to it:

**agent view**
- add a deal: address, sale price, commission %, listing side or buyer side, closing date
- the app does the math: gross commission, the brokerage's cut from your split, what you actually take home
- cards at the top: made this year, closing soon, number of deals

**broker view**
- the whole office on one page: every agent's totals, the office total, a leaderboard
- see what's closing this month across the brokerage

## the commission math (ontario)

gross commission = sale price × commission rate. every agent is on a split plan with the brokerage (like 95/5 — the agent keeps 95%). the dashboard takes the brokerage's share out and shows the agent's net. commissions here also have HST (13%) charged on top, so the numbers show that too instead of pretending it doesn't exist.

## tech

same stack as my other projects, on purpose: react + vite frontend (`client/`), node + express api (`server/`), sqlite database. third project on this stack — I'd rather know one stack properly than three badly.

## run it

```
# api
cd server && npm install && npm start     # localhost:3001

# frontend
cd client && npm install && npm run dev   # localhost:5173
```

## demo logins

the seed script (`cd server && node seed.js`) makes a login for each sample agent, plus a broker login. they all use the password **demo1234** — it's the same for everyone because this is sample data, and the database only stores the password's hash, never the password itself. usernames: `sam`, `jess`, `dan`, `priya` (agents), `broker` (sees the whole office).

## log in with email, forgot password

you can log in with your username or your email — same password either way. every account has an email on it now (the sample ones are `sam@miracledesk.test` and so on).

forgot your password? there's a link on the login screen. type your email in and a reset link goes out — it works for one hour and only once, and the reply is always the same whether or not the email is registered, so nobody can fish for real accounts. the database only ever stores a hash of the link, never the link itself.

honest bit: the reset email only actually sends once the server has SMTP set up. put these in the environment and it sends for real: `SMTP_HOST`, `SMTP_PORT` (587 if you leave it out), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (defaults to SMTP_USER), `RESET_BASE_URL` (where the reset link points — `http://localhost:5173` when you're running it locally). with no SMTP, the reset link just gets printed to the server console instead, so the flow still works for testing — check the log.

## logins that stick, and the broker's accounts page

once you're logged in, you stay logged in. logins live in the database (the sessions table), not in the server's memory — so restarting the server doesn't log anyone out, and closing the tab changes nothing, the token is still saved in your browser and still good when you come back. a login lasts 30 days, and every time you use the app it stretches another 30 days out, so anyone who actually uses it never gets kicked out. logging out deletes just that one login — if you're logged in on your phone too, that one keeps working.

the broker has an Accounts page in the sidebar (agents never see it). from there the broker can add a new agent (name, username, email, starting password, split plan, yearly goal), see every account in the office, reset anyone's password, and turn an account off and back on. turning an account off logs them out everywhere on the spot and they can't log back in until it's turned back on. the broker can't turn off their own account, and can't reset their own password from that page — everyone changes their own password from the "Change password" button in the sidebar, current password first.

two small limits keep the login safe: 10 wrong passwords for one login in 15 minutes gets a "try again in a few minutes" (a good login clears the count, so a typo doesn't count against you), and 5 reset requests for one email in an hour. they're counted in the server's memory — fine for one server.

## setting it up for a real office

the seed script is only for playing around — it wipes the whole database. a real office starts empty:

1. `cd server && npm install`
2. `npm run setup <username> <email> <password>` — makes the first broker account. it only works on an empty database, and it refuses if any account already exists, so run it once and that's it.
3. log in as that broker and add your agents from the Accounts page.
4. for password resets to actually email people, set the SMTP settings from the section above, plus `RESET_BASE_URL` to the address agents open the app at (like `https://miracledesk.ca`) — without it, reset links point at localhost. the server says so on startup if either one is missing.
5. never run `node seed.js` against a real office's database — it deletes every deal, client, account and login in it.

## pilot readiness

the first full check (nov 12) found six things that had to be fixed before a real office could use this. I fixed them all, then ran the whole check again on nov 13 and tested each one live — here's where it stands:

- the setup script makes the first broker account on an empty database, and refuses if any account already exists. the seed script is never the setup path.
- a closed deal can't save without a closing date — not from the form, not from an edit, not from a csv import (the bad row gets skipped and tells you why). the follow-ups page doesn't crash if a dateless closed deal somehow gets in there anyway.
- bad split plans get rejected instead of breaking the office totals — "abc" or a rate over 100 won't save, on the accounts page or anywhere else.
- changing your password logs your other devices out on the spot. the device you're on keeps working.
- there's no demo text left on the login screen, the sidebar, the TV board or the income report.
- the server warns on startup when email isn't set up, and when the reset link would point at localhost — so forgot-password can't silently do nothing.

also re-checked the stuff that already passed the first time: the money math (86 tests, all passing), agents only ever seeing their own deals, logins surviving a server restart, and the pages staying fast with 201 agents and 2,015 deals in the database — everything answered in under 50ms and the leaderboard total matched the office total to the cent.

still open before a real office uses it: pick the email that sends the password resets, and pick the domain. the per-ip rate limit, database hardening and the audit trail are still on the list as follow-ups, not blockers.

## importing deals, sorting the table, per-agent goals

moving off a spreadsheet? on the Deals page there's an "Import deals from a CSV" form — pick a file and whose deals they are, and the server adds the good rows. the columns it wants are: address, price, commission %, side, status, closing date, city (optional). a row with a problem is skipped, not the whole file — it tells you which row and why, so you can fix the file and try again. agents can only import their own deals; the broker can import for anyone.

the deals table sorts now: click Address, Price, Net or Closing date to sort by it, click the same one again to flip it. the little arrow shows which column and which way.

every agent has their own yearly goal (the office goal is just everyone's added up). the broker can change one from the Accounts page — there's a goal column with a Change button — and the leaderboard shows each agent against their own goal. an agent's dashboard goal bar uses their own goal too.

## status

just started (oct 2026). building it in small commits, same as my other projects — the plan is in ROADMAP.md.

---

I'm Prem — realtor at HomeLife/Miracle and a CS student. other stuff: [davehomes.ca](https://davehomes.ca) · [seo-dashboard](https://github.com/premd06/seo-dashboard) · [halal-eats](https://github.com/premd06/halal-eats)
