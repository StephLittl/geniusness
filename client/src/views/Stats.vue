<template>
  <div class="stats">
    <h1>My stats</h1>
    <p class="hint">Your scores over time. Filter by league and game.</p>

    <div class="filters">
      <div class="field">
        <label>League</label>
        <select v-model="filters.leagueId">
          <option value="">All</option>
          <option v-for="l in myLeagues" :key="l.leagueid" :value="l.leagueid">{{ l.name }}</option>
        </select>
      </div>
      <div class="field">
        <label>Game</label>
        <select v-model="filters.gameId">
          <option value="">All</option>
          <option v-for="g in allGames" :key="g.gameid" :value="g.gameid">{{ g.name }}</option>
        </select>
      </div>
      <div class="field">
        <label>From</label>
        <input v-model="filters.from" type="date" />
      </div>
      <div class="field">
        <label>To</label>
        <input v-model="filters.to" type="date" />
      </div>
      <button type="button" @click="fetch">Apply</button>
    </div>

    <section v-if="loading" class="loading">Loading…</section>
    <section v-else-if="!scores.length" class="empty">No scores match your filters.</section>
    <section v-else class="score-list">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Game</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in scores" :key="s.id">
            <td>{{ s.date }}</td>
            <td>{{ s.game?.name || '—' }}</td>
            <td>{{ s.score }}</td>
          </tr>
        </tbody>
      </table>
    </section>

  </div>
</template>

<script>
import { useUserStore } from '../store/userStore'
import axios from 'axios'

export default {
  data() {
    const today = new Date()
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(today.getFullYear() - 1)
    return {
      scores: [],
      myLeagues: [],
      allGames: [],
      loading: true,
      filters: {
        leagueId: '',
        gameId: '',
        from: oneYearAgo.toISOString().slice(0, 10),
        to: today.toISOString().slice(0, 10)
      }
    }
  },
  setup() {
    const store = useUserStore()
    return { store }
  },
  async created() {
    await this.loadLeaguesAndGames()
    await this.fetch()
    this.loading = false
  },
  methods: {
    async loadLeaguesAndGames() {
      try {
        const [leagueRes, gameRes] = await Promise.all([
          axios.get('/api/league/my', { params: { userId: this.store.user?.id } }),
          axios.get('/api/league/games')
        ])
        this.myLeagues = leagueRes.data.leagues || []
        this.allGames = gameRes.data.games || []
      } catch (err) {
        console.error(err)
      }
    },
    async fetch() {
      if (!this.store.user?.id) return
      this.loading = true
      try {
        const params = { userId: this.store.user.id }
        if (this.filters.leagueId) params.leagueId = this.filters.leagueId
        if (this.filters.gameId) params.gameId = this.filters.gameId
        if (this.filters.from) params.from = this.filters.from
        if (this.filters.to) params.to = this.filters.to
        const res = await axios.get('/api/scores/stats', { params })
        this.scores = res.data.scores || []
      } catch (err) {
        this.scores = []
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.stats { max-width: 900px; margin: 0 auto; text-align: left; }
.hint { color: #666; margin-bottom: 1.5rem; }
.filters { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; margin-bottom: 2rem; }
.field label { display: block; margin-bottom: 0.25rem; font-weight: 500; color: #2d5a3d; }
.field select, .field input { padding: 0.5rem; min-width: 140px; border: 1px solid #4a7c59; border-radius: 4px; }
.filters button { padding: 0.5rem 1rem; background: #2d5a3d; color: white; border: none; border-radius: 4px; cursor: pointer; }
.filters button:hover { background: #1e3d28; }
.loading, .empty { margin: 2rem 0; color: #666; }
.score-list table { width: 100%; border-collapse: collapse; }
.score-list th, .score-list td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #4a7c59; }
.score-list th { background: #f0f8f0; color: #2d5a3d; font-weight: 500; }
</style>
