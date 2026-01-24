<template>
  <div class="league-create">
    <h1>Create a league</h1>
    <form @submit.prevent="createLeague">
      <div class="field">
        <label>League name</label>
        <input v-model="leagueName" placeholder="e.g. Weekend Wordle" required />
      </div>

      <div class="field">
        <label>Duration</label>
        <div class="duration-options">
          <label class="radio">
            <input v-model="durationMode" type="radio" value="indefinite" />
            Indefinite
          </label>
          <label class="radio">
            <input v-model="durationMode" type="radio" value="end" />
            End date
          </label>
        </div>
        <div v-if="durationMode === 'end'" class="date-row">
          <input v-model="startDate" type="date" />
          <span>to</span>
          <input v-model="endDate" type="date" />
        </div>
      </div>

      <div class="field">
        <label>Games</label>
        <div class="game-list">
          <label v-for="game in games" :key="game.gameid" class="game-check">
            <input type="checkbox" :value="game.gameid" v-model="selectedGames" />
            {{ game.name }}
          </label>
        </div>
      </div>

      <button type="submit" :disabled="creating">Create league</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p><router-link to="/league">← Back to leagues</router-link></p>
  </div>
</template>

<script>
import axios from 'axios'
import { useUserStore } from '../store/userStore'
import { useRouter } from 'vue-router'

export default {
  data() {
    return {
      leagueName: '',
      durationMode: 'indefinite',
      startDate: '',
      endDate: '',
      games: [],
      selectedGames: [],
      creating: false,
      error: null
    }
  },
  setup() {
    const store = useUserStore()
    const router = useRouter()
    return { store, router }
  },
  async created() {
    try {
      const res = await axios.get('/api/league/games')
      this.games = res.data.games || []
    } catch (err) {
      this.error = 'Failed to load games'
    }
    const today = new Date().toISOString().slice(0, 10)
    this.startDate = today
    this.endDate = today
  },
  methods: {
    async createLeague() {
      if (!this.leagueName || this.selectedGames.length === 0) {
        this.error = 'Name and at least one game required'
        return
      }
      this.error = null
      this.creating = true
      try {
        const payload = {
          name: this.leagueName,
          gameIds: this.selectedGames,
          userId: this.store.user.id
        }
        if (this.durationMode === 'end' && this.startDate && this.endDate) {
          payload.startDate = this.startDate
          payload.endDate = this.endDate
        }
        const res = await axios.post('/api/league/create', payload)
        this.router.push(`/league/view/${res.data.leagueId}`)
      } catch (err) {
        this.error = err.response?.data?.error || 'Failed to create league'
      } finally {
        this.creating = false
      }
    }
  }
}
</script>

<style scoped>
.league-create { max-width: 480px; margin: 0 auto; text-align: left; }
.field { margin-bottom: 1.25rem; }
.field label { display: block; margin-bottom: 0.35rem; font-weight: 500; }
.field input[type="text"],
.field input[type="date"] { width: 100%; padding: 0.5rem; box-sizing: border-box; }
.duration-options { display: flex; gap: 1rem; margin-bottom: 0.5rem; }
.radio { display: flex; align-items: center; gap: 0.35rem; font-weight: normal; }
.date-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
.date-row input { flex: 1; }
.game-list { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
.game-check { display: flex; align-items: center; gap: 0.35rem; font-weight: normal; }
.error { color: #e74; margin-top: 1rem; }
</style>
