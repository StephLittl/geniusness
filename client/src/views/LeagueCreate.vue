<template>
  <div class="league-create">
    <h1>Create a league</h1>
    <form @submit.prevent="createLeague">
      <div class="field">
        <label>League name</label>
        <input v-model="leagueName" placeholder="e.g. Weekend Wordle" required />
      </div>

      <div class="field">
        <label>Duration Type</label>
        <select v-model="durationType" required>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="indefinite">Indefinite</option>
          <option value="specific">Specific Dates</option>
        </select>
      </div>

      <div v-if="durationType === 'specific'" class="field">
        <label>Date Range</label>
        <div class="date-row">
          <input v-model="startDate" type="date" required />
          <span>to</span>
          <input v-model="endDate" type="date" required />
        </div>
      </div>

      <div v-if="durationType !== 'indefinite'" class="field">
        <label class="checkbox-label">
          <input type="checkbox" v-model="isRepeating" />
          Repeating (resets at end of period)
        </label>
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
    <p><router-link to="/leagues">← Back to leagues</router-link></p>
  </div>
</template>

<script>
import axios from 'axios'
import { useUserStore } from '../store/userStore'
import { useRouter } from 'vue-router'

export default {
  data() {
    const today = new Date().toISOString().slice(0, 10)
    return {
      leagueName: '',
      durationType: 'indefinite',
      startDate: today,
      endDate: today,
      isRepeating: false,
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
  },
  methods: {
    async createLeague() {
      if (!this.leagueName || this.selectedGames.length === 0) {
        this.error = 'Name and at least one game required'
        return
      }
      if (this.durationType === 'specific' && (!this.startDate || !this.endDate)) {
        this.error = 'Start and end dates required for specific dates'
        return
      }
      this.error = null
      this.creating = true
      try {
        const payload = {
          name: this.leagueName,
          gameIds: this.selectedGames,
          userId: this.store.user.id,
          durationType: this.durationType,
          isRepeating: this.isRepeating
        }
        if (this.durationType === 'specific') {
          payload.startDate = this.startDate
          payload.endDate = this.endDate
        }
        const res = await axios.post('/api/league/create', payload)
        this.router.push(`/leagues/${res.data.leagueId}`)
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
.field label { display: block; margin-bottom: 0.35rem; font-weight: 500; color: #2d5a3d; }
.field input[type="text"],
.field input[type="date"],
.field select { width: 100%; padding: 0.5rem; box-sizing: border-box; border: 1px solid #4a7c59; border-radius: 4px; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-weight: normal; }
.date-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }
.date-row input { flex: 1; }
.game-list { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
.game-check { display: flex; align-items: center; gap: 0.35rem; font-weight: normal; }
button[type="submit"] { padding: 0.75rem 1.5rem; background: #2d5a3d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
button[type="submit"]:hover { background: #1e3d28; }
button[type="submit"]:disabled { background: #ccc; cursor: not-allowed; }
.error { color: #c00; margin-top: 1rem; }
</style>
