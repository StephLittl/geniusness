import { defineStore } from 'pinia'

const STORAGE_KEY = 'geniusness_auth'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { user: null, accessToken: null }
    const { user, accessToken } = JSON.parse(raw)
    return { user: user || null, accessToken: accessToken || null }
  } catch {
    return { user: null, accessToken: null }
  }
}

function save(user, accessToken) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, accessToken }))
  } catch {}
}

export const useUserStore = defineStore('user', {
  state: () => load(),
  actions: {
    setUser(userData) {
      this.user = userData
      save(this.user, this.accessToken)
    },
    setToken(token) {
      this.accessToken = token
      save(this.user, this.accessToken)
    },
    setAuth(userData, token) {
      this.user = userData
      this.accessToken = token
      save(this.user, this.accessToken)
    },
    clearUser() {
      this.user = null
      this.accessToken = null
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
  }
})
