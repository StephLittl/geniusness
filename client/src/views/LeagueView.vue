<template>
  <div class="league-view">
    <p v-if="loading" class="loading">Loading…</p>
    <template v-else-if="league">
      <header class="header">
        <div>
          <h1>{{ league.name }}</h1>
          <p class="duration">
            {{ league.end_date ? `${league.start_date || '—'} to ${league.end_date}` : 'Indefinite' }}
          </p>
        </div>
        <div v-if="league.invite_code" class="invite">
          <label>Invite code</label>
          <div class="invite-row">
            <code>{{ league.invite_code }}</code>
            <button type="button" @click="copyInvite">Copy</button>
          </div>
        </div>
      </header>

      <!-- Score Grid -->
      <section class="score-grid-section">
        <div class="grid-header">
          <h2>Score Grid</h2>
          <div class="grid-controls">
            <button type="button" @click="showAddScore = !showAddScore" class="btn">
              {{ showAddScore ? 'Hide' : 'Add Score' }}
            </button>
          </div>
        </div>

        <div v-if="showAddScore" class="add-score-form">
          <form @submit.prevent="submitScore">
            <select v-model="scoreForm.gameId" required>
              <option value="">Select game</option>
              <option v-for="g in (league.games || [])" :key="g.gameid" :value="g.gameid">
                {{ g.name }}
              </option>
            </select>
            <input v-model="scoreForm.date" type="date" required />
            <input v-model.number="scoreForm.score" type="number" step="any" placeholder="Score" required class="no-spinner" />
            <button type="submit" :disabled="scoreSubmitting">Save</button>
          </form>
          <p v-if="scoreError" class="error">{{ scoreError }}</p>
        </div>

        <div v-if="!scores.length" class="empty">No scores yet. Add your first score above.</div>
        <div v-else class="grid-container">
          <div class="grid-wrapper">
            <table class="score-grid">
              <thead>
                <tr>
                  <th class="sticky-col">Player / Game</th>
                  <th v-for="date in dateColumns" :key="date" class="date-col">
                    {{ formatDate(date) }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in gridRows" :key="row.key">
                  <td class="sticky-col row-label">
                    <strong>{{ row.playerName }}</strong><br />
                    <span class="game-name" :style="{ color: row.gameColor || '#666' }">{{ row.gameName }}</span>
                  </td>
                  <td v-for="date in dateColumns" :key="date" class="score-cell">
                    <span v-if="row.scores[date] !== undefined">{{ row.scores[date] }}</span>
                    <span v-else class="empty-cell">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <p><router-link to="/leagues">← Back to leagues</router-link></p>
    </template>
    <p v-else class="error">League not found.</p>
  </div>
</template>

<script>
import { useRoute } from 'vue-router'
import { useUserStore } from '../store/userStore'
import axios from 'axios'

export default {
  data() {
    return {
      league: null,
      scores: [],
      loading: true,
      scoreForm: { gameId: '', date: '', score: '' },
      scoreSubmitting: false,
      scoreError: null,
      showAddScore: false
    }
  },
  setup() {
    const route = useRoute()
    const store = useUserStore()
    return { route, store }
  },
  computed: {
    dateColumns() {
      if (!this.scores.length) return []
      const dates = [...new Set(this.scores.map(s => s.date))].sort().reverse()
      return dates
    },
    gridRows() {
      if (!this.league?.games || !this.league?.players || !this.scores.length) return []
      const rows = []
      for (const player of this.league.players) {
        for (const game of this.league.games) {
          const key = `${player.user_id}-${game.gameid}`
          const playerScores = {}
          for (const score of this.scores) {
            if (score.user_id === player.user_id && score.game_id === game.gameid) {
              playerScores[score.date] = score.score
            }
          }
          rows.push({
            key,
            playerName: player.username || player.email || '—',
            gameName: game.name,
            gameColor: game.color,
            scores: playerScores
          })
        }
      }
      return rows
    }
  },
  async created() {
    this.scoreForm.date = this.getEasternDate()
    await this.fetchLeague()
    await this.fetchScores()
    this.loading = false
  },
  methods: {
    async fetchLeague() {
      try {
        const res = await axios.get(`/api/league/${this.route.params.id}`)
        this.league = res.data
      } catch (err) {
        this.league = null
      }
    },
    async fetchScores() {
      try {
        const res = await axios.get(`/api/scores/league/${this.route.params.id}`)
        this.scores = res.data.scores || []
      } catch (err) {
        this.scores = []
      }
    },
    async submitScore() {
      this.scoreError = null
      if (!this.scoreForm.gameId || !this.scoreForm.date || this.scoreForm.score == null || this.scoreForm.score === '') {
        this.scoreError = 'Please fill in all fields'
        return
      }
      const scoreNum = Number(this.scoreForm.score)
      if (isNaN(scoreNum)) {
        this.scoreError = 'Score must be a valid number'
        return
      }
      this.scoreSubmitting = true
      try {
        await axios.post('/api/scores', {
          user_id: this.store.user.id,
          league_id: this.route.params.id,
          game_id: this.scoreForm.gameId,
          date: this.scoreForm.date,
          score: scoreNum
        })
        await this.fetchScores()
        this.scoreForm.gameId = ''
        this.scoreForm.date = this.getEasternDate()
        this.scoreForm.score = ''
        this.showAddScore = false
      } catch (err) {
        console.error('Score save error:', err)
        this.scoreError = err.response?.data?.error || 'Failed to save score'
      } finally {
        this.scoreSubmitting = false
      }
    },
    copyInvite() {
      if (!this.league?.invite_code) return
      navigator.clipboard?.writeText(this.league.invite_code).catch(() => {})
    },
    formatDate(dateStr) {
      // Parse date string (YYYY-MM-DD) as local date, not UTC
      const [year, month, day] = dateStr.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    },
    getEasternDate() {
      const now = new Date();
      // Convert to Eastern time (handles DST automatically)
      const easternDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      // Format as YYYY-MM-DD
      const year = easternDate.getFullYear();
      const month = String(easternDate.getMonth() + 1).padStart(2, '0');
      const day = String(easternDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
}
</script>

<style scoped>
.league-view {
  max-width: 100%;
  margin: 0 auto;
  text-align: left;
}
.loading,
.error {
  margin: 2rem 0;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.duration {
  color: var(--muted, #666);
  margin: 0.25rem 0;
}
.invite {
  margin-top: 0.5rem;
}
.invite label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}
.invite-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.invite-row code {
  padding: 0.35rem 0.5rem;
  background: #f0f8f0;
  border-radius: 6px;
  color: #2d5a3d;
}
.score-grid-section {
  margin-bottom: 2rem;
}
.grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid #4a7c59;
  background: white;
  color: #2d5a3d;
  cursor: pointer;
}
.btn:hover {
  background: #f0f8f0;
}
.add-score-form {
  padding: 1rem;
  background: #f0f8f0;
  border-radius: 8px;
  margin-bottom: 1rem;
}
.input.no-spinner::-webkit-inner-spin-button,
.input.no-spinner::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.input.no-spinner {
  -moz-appearance: textfield;
}
.add-score-form form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.add-score-form select,
.add-score-form input {
  padding: 0.5rem;
  border: 1px solid #4a7c59;
  border-radius: 4px;
}
.add-score-form input[type="number"] {
  width: 100px;
}
.add-score-form input[type="number"].no-spinner::-webkit-inner-spin-button,
.add-score-form input[type="number"].no-spinner::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.add-score-form input[type="number"].no-spinner {
  -moz-appearance: textfield;
}
.add-score-form button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  background: #2d5a3d;
  color: white;
  border: none;
}
.add-score-form button:hover {
  background: #1e3d28;
}
.add-score-form button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.error {
  color: #e74;
  margin-top: 0.5rem;
}
.grid-container {
  overflow-x: auto;
  border: 1px solid #444;
  border-radius: 8px;
}
.grid-wrapper {
  min-width: 100%;
  display: inline-block;
}
.score-grid {
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
}
.score-grid th,
.score-grid td {
  padding: 0.75rem;
  text-align: center;
  border: 1px solid #4a7c59;
}
.score-grid th {
  background: #2d5a3d;
  color: white;
  font-weight: 500;
  position: sticky;
  top: 0;
  z-index: 1;
}
.sticky-col {
  position: sticky;
  left: 0;
  background: white;
  z-index: 2;
  text-align: left;
}
.score-grid th.sticky-col {
  background: #2d5a3d;
  color: white;
  z-index: 3;
}
.row-label {
  min-width: 150px;
  max-width: 200px;
}
.row-label strong {
  display: block;
}
.game-name {
  font-size: 0.85rem;
  color: var(--muted, #666);
}
.date-col {
  min-width: 80px;
}
.score-cell {
  min-width: 60px;
}
.empty-cell {
  color: #999;
}
.empty {
  color: #666;
  margin: 2rem 0;
  text-align: center;
}
.error {
  color: #c00;
}
.duration {
  color: #666;
}
</style>
