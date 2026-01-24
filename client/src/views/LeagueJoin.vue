<template>
  <div class="league-join">
    <h1>Join a league</h1>
    <p class="hint">Enter the invite code you received.</p>
    <form @submit.prevent="join">
      <div class="field">
        <label>Invite code</label>
        <input
          v-model="inviteCode"
          placeholder="e.g. ABC12XYZ"
          autocomplete="off"
          class="code-input"
        />
      </div>
      <button type="submit" :disabled="joining">Join</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p><router-link to="/league">← Back to leagues</router-link></p>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/userStore'
import axios from 'axios'

export default {
  data() {
    return { inviteCode: '', joining: false, error: null }
  },
  setup() {
    const router = useRouter()
    const store = useUserStore()
    return { router, store }
  },
  methods: {
    async join() {
      const code = String(this.inviteCode || '').trim()
      if (!code) {
        this.error = 'Enter an invite code'
        return
      }
      this.error = null
      this.joining = true
      try {
        const res = await axios.post('/api/league/join', {
          userId: this.store.user.id,
          inviteCode: code
        })
        this.router.push(`/league/view/${res.data.leagueId}`)
      } catch (err) {
        this.error = err.response?.data?.error || 'Could not join (invalid or expired code)'
      } finally {
        this.joining = false
      }
    }
  }
}
</script>

<style scoped>
.league-join { max-width: 400px; margin: 0 auto; text-align: left; }
.hint { color: var(--muted, #666); margin-bottom: 1rem; }
.field { margin-bottom: 1rem; }
.field label { display: block; margin-bottom: 0.35rem; font-weight: 500; }
.code-input { width: 100%; padding: 0.5rem; box-sizing: border-box; font-family: monospace; }
.error { color: #e74; margin-top: 1rem; }
</style>
