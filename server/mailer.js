// sending the reset email. this only really sends mail when the
// SMTP settings are in the environment (see the README) — until
// then it just prints the reset link to the server console, so I can
// still test the whole flow without wiring up real email. the link
// never goes back in an api response either way: the only place a
// raw token shows up is the email itself or that console line.
const nodemailer = require('nodemailer')

// true when I have enough to actually send mail. port defaults to
// 587 (the usual one for sending mail), user/pass come from the env.
function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  )
}

function makeTransporter() {
  const port = Number(process.env.SMTP_PORT) || 587
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

// send the reset link to one address. returns { sent: true } when
// the mail went out, { sent: false } when there's no SMTP and the
// link just got printed instead. either way the caller answers the
// browser the same — nobody learns whether the email exists.
async function sendResetEmail(to, resetUrl) {
  if (!smtpConfigured()) {
    console.log(`[dev] password reset link for ${to}: ${resetUrl}`)
    return { sent: false }
  }
  const transporter = makeTransporter()
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'Reset your MiracleDesk password',
    text:
      'Someone asked to reset the password for this MiracleDesk account.\n\n' +
      `Reset it here (the link works for one hour, and only once):\n${resetUrl}\n\n` +
      "If that wasn't you, just ignore this email — your password stays the same.",
  })
  return { sent: true }
}

module.exports = { smtpConfigured, sendResetEmail }
