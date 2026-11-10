// every api call in the app goes through here, so the login token
// rides along on each one. the token lives in localStorage from the
// login screen.
//
// if the server says the token is dead — it restarts and the tokens
// only live in the server's memory — drop the saved login and reload,
// so the login screen shows instead of a page full of broken
// numbers. the login screen itself doesn't use this (there's no
// token yet when you're logging in), and neither does the TV board
// (it's its own page — it sends the token itself and shows a message
// when there's no login).
export function apiFetch(path, options = {}) {
  const token = localStorage.getItem('miracledesk-token')
  return fetch(path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  }).then((res) => {
    if (res.status === 401) {
      localStorage.removeItem('miracledesk-token')
      localStorage.removeItem('miracledesk-user')
      window.location.reload()
      throw new Error('not logged in')
    }
    return res
  })
}
