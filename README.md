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

## status

just started (oct 2026). building it in small commits, same as my other projects — the plan is in ROADMAP.md.

---

I'm Prem — realtor at HomeLife/Miracle and a CS student. other stuff: [davehomes.ca](https://davehomes.ca) · [seo-dashboard](https://github.com/premd06/seo-dashboard) · [halal-eats](https://github.com/premd06/halal-eats)
