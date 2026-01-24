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
            this.router.push('/league')
          }
        } catch {
          // If check fails, go to league page anyway
          this.router.push('/league')
        }
      } catch (err) {
        console.error('Login failed:', err.response?.data || err)
        this.error = err.response?.data?.error || 'Login failed'
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
