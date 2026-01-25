<template>
  <div class="login">
    <h1>Login</h1>
    <form @submit.prevent="login">
      <div>
        <label for="email">Email:</label>
        <input id="email" v-model="email" type="email" required />
      </div>
      <div>
        <label for="password">Password:</label>
        <input id="password" v-model="password" type="password" required />
      </div>
      <button type="submit">Login</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script>
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/userStore'

export default {
  data() {
    return {
      email: '',
      password: '',
      error: null
    }
  },
  setup() {
    const router = useRouter()
    const store = useUserStore()
    return { router, store }
  },
  methods: {
    async login() {
      this.error = null
      try {
        const res = await axios.post('/api/auth/login', {
          email: this.email,
          password: this.password
        })

        if (!res.data || !res.data.user || !res.data.access_token) {
          console.error('Invalid response from server:', res.data)
          this.error = 'Invalid response from server. Please try again.'
          return
        }

        // Save user info and token to Pinia store
        this.store.setUser(res.data.user)
        this.store.setToken(res.data.access_token)

        // Check if user has selected games
        try {
          const gamesRes = await axios.get(`/api/user-games/${res.data.user.id}`)
          const hasGames = gamesRes.data.games && gamesRes.data.games.length > 0
          if (!hasGames) {
            this.router.push('/games/select')
          } else {
            this.router.push('/')
          }
        } catch (gamesErr) {
          console.error('Error checking games:', gamesErr)
          // If check fails, go to home page anyway
          this.router.push('/')
        }
      } catch (err) {
        console.error('Login failed:', err)
        if (err.response) {
          // Server responded with error
          this.error = err.response.data?.error || `Login failed: ${err.response.status} ${err.response.statusText}`
        } else if (err.request) {
          // Request made but no response
          this.error = 'Unable to connect to server. Please check if the server is running.'
        } else {
          // Error setting up request
          this.error = err.message || 'Login failed. Please try again.'
        }
      }
    }
  }
}
</script>

<style>
.login {
  max-width: 400px;
  margin: auto;
}
.error {
  color: red;
  margin-top: 1rem;
}
</style>
