// tiny rate limits, kept in memory — fine for one server, since
// there's only one process answering requests. if this ever ran on
// two servers they'd each count on their own, so the limits would
// be looser than they look — worth knowing, not worth fixing yet.
// each key gets its own little counter with a reset time; the
// counter only ever counts the bad stuff (failed logins, reset
// requests), so normal use never trips it.
function createLimiter(windowMs, max, nowFn = Date.now) {
  const counts = new Map()

  function entry(key) {
    const now = nowFn()
    let found = counts.get(key)
    if (!found || found.resetAt <= now) {
      found = { count: 0, resetAt: now + windowMs }
      counts.set(key, found)
    }
    return found
  }

  return {
    // true when this key is out of tries until its window ends.
    isBlocked(key) {
      const found = counts.get(key)
      return Boolean(found && found.count >= max && found.resetAt > nowFn())
    },

    // count one against this key (a failed login, a reset request).
    hit(key) {
      entry(key).count += 1
    },

    // forget this key entirely — a good login clears the failures
    // that came before it, so one typo doesn't haunt anyone.
    clear(key) {
      counts.delete(key)
    },
  }
}

module.exports = { createLimiter }
