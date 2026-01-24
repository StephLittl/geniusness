<template>
  <div class="league-view">
    <p v-if="loading" class="loading">Loading…</p>
    <template v-else-if="league">
      <header class="header">
        <h1>{{ league.name }}</h1>
        <p class="duration">
          {{ league.end_date ? `${league.start_date || '—'} to ${league.end_date}` : 'Indefinite' }}
        </p>
        <div v-if="league.invite_code" class="invite">
          <label>Invite code</label>
          <div class="invite-row">
            <code>{{ league.invite_code }}</code>
            <button type="button" @click="copyInvite">Copy</button>
          </div>
        </div>
      </header>

      <section class="games">
        <h2>Games</h2>
        <p>{{ (league.games || []).map(g => g.name).join(', ') || '—' }}</p>
      </section>

      <section class="players">
        <h2>Players</h2>
        <ul>
          <li v-for="p in (league.players || [])" :key="p.user_id">
            {{ p.username || p.email || p.user_id }}
          </li>
        </ul>
      </section>

      <section class="add-score">
        <h2>Add score</h2>
        <form @submit.prevent="submitScore">
          <div class="row">
            <label>Game</label>
            <select v-model="scoreForm.gameId" required>
              <option value="">—</option>
              <option v-for="g in (league.games || [])" :key="g.gameid" :value="g.gameid">{{ g.name }}</option>
            </select>
          </div>
          <div class="row">
            <label>Date</label>
            <input v-model="scoreForm.date" type="date" required />
          </div>
          <div class="row">
            <label>Score</label>
            <input v-model.number="scoreForm.score" type="number" step="any" required />
          </div>
          <button type="submit" :disabled="scoreSubmitting">Save</button>
        </form>
        <p v-if="scoreError" class="error">{{ scoreError }}</p>
      </section>

      <section class="standings">
        <h2>Standings</h2>
        <p v-if="!scores.length">No scores yet.</p>
        <template v-else>
          <div v-for="game in league.games" :key="game.gameid" class="game-standings">
            <h3>{{ game.name }}</h3>
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Avg</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in (standingsByGame[game.gameid] || [])" :key="row.userId">
                  <td>{{ row.username }}</td>
                  <td>{{ row.avg.toFixed(1) }}</td>
                  <td>{{ row.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <section class="recent">
        <h2>Recent scores</h2>
        <p v-if="!scores.length">No scores yet.</p>
        <table v-else>
          <thead>
            <tr>
              <th>Date</th>
              <th>Game</th>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in scores.slice(0, 30)" :key="s.id">
              <td>{{ s.date }}</td>
              <td>{{ s.game?.name || '—' }}</td>
              <td>{{ s.user?.username || '—' }}</td>
              <td>{{ s.score }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <p><router-link to="/league">← Back to leagues</router-link></p>
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
      scoreError: null
    }
  },
  setup() {
    const route = useRoute()
    const store = useUserStore()
    return { route, store }
  },
  computed: {
    standingsByGame() {
      const league = this.league
      const scores = this.scores || []
      if (!league?.games) return {}

      const out = {}
      for (const g of league.games) {
        const byUser = {}
        for (const s of scores) {
          if (s.game_id !== g.gameid) continue
          const uid = s.user_id
          if (!byUser[uid]) byUser[uid] = { username: s.user?.username || '—', sum: 0, n: 0 }
          byUser[uid].sum += Number(s.score)
          byUser[uid].n += 1
        }
        const rows = Object.entries(byUser).map(([userId, x]) => ({
          userId,
          username: x.username,
          avg: x.n ? x.sum / x.n : 0,
          count: x.n
        }))
        const lower = (g.score_type || '').toLowerCase().includes('lower')
        rows.sort((a, b) => (lower ? a.avg - b.avg : b.avg - a.avg))
        out[g.gameid] = rows
      }
      return out
    }
  },
  async created() {
    this.scoreForm.date = new Date().toISOString().slice(0, 10)
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
      this.scoreSubmitting = true
      try {
        await axios.post('/api/scores', {
          user_id: this.store.user.id,
          league_id: this.route.params.id,
          game_id: this.scoreForm.gameId,
          date: this.scoreForm.date,
          score: this.scoreForm.score
        })
        await this.fetchScores()
        this.scoreForm.gameId = ''
        this.scoreForm.date = new Date().toISOString().slice(0, 10)
        this.scoreForm.score = ''
      } catch (err) {
        this.scoreError = err.response?.data?.error || 'Failed to save score'
      } finally {
        this.scoreSubmitting = false
      }
    },
    copyInvite() {
      if (!this.league?.invite_code) return
      navigator.clipboard?.writeText(this.league.invite_code).catch(() => {})
    }
  }
}
</script>

<style scoped>
.league-view { max-width: 800px; margin: 0 auto; text-align: left; }
.loading, .error { margin: 2rem 0; }
.header { margin-bottom: 2rem; }
.duration { color: var(--muted, #666); margin: 0.25rem 0; }
.invite { margin-top: 1rem; }
.invite label { display: block; margin-bottom: 0.25rem; font-weight: 500; }
.invite-row { display: flex; align-items: center; gap: 0.5rem; }
.invite-row code { padding: 0.35rem 0.5rem; background: #2a2a2a; border-radius: 6px; }
.games, .players, .add-score, .standings, .recent { margin-bottom: 2rem; }
.games ul, .players ul { list-style: none; padding: 0; margin: 0; }
.players li { padding: 0.25rem 0; }
.add-score .row { margin-bottom: 0.75rem; }
.add-score label { display: block; margin-bottom: 0.25rem; }
.add-score select, .add-score input { padding: 0.5rem; width: 100%; max-width: 240px; box-sizing: border-box; }
.game-standings { margin-bottom: 1.5rem; }
.game-standings h3 { font-size: 1rem; margin-bottom: 0.5rem; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #333; }
th { font-weight: 500; }
</style>
