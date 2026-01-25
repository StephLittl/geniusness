<template>
  <div class="leagues-page">
    <div class="page-header">
      <h1>My Leagues</h1>
      <div class="actions">
        <router-link to="/leagues/create" class="btn primary">Create League</router-link>
        <router-link to="/leagues/join" class="btn">Join League</router-link>
      </div>
    </div>

    <section v-if="loading" class="loading">Loading…</section>
    <section v-else-if="leagues.length === 0" class="empty">
      <p>You're not in any leagues yet.</p>
      <p>Create one or join with an invite code.</p>
    </section>
    <section v-else class="leagues-grid">
      <div v-for="league in leagues" :key="league.leagueid" class="league-card">
        <div class="league-header">
          <router-link :to="`/leagues/${league.leagueid}`" class="league-name">
            {{ league.name }}
          </router-link>
          <span class="league-meta">
            {{ league.games?.length || 0 }} games
            · {{ league.end_date ? `ends ${league.end_date}` : 'indefinite' }}
          </span>
        </div>
        <div class="standings-overview">
          <div class="overall-standing-card">
            <h3>Overall Standings</h3>
            <div class="standings-list">
              <div
                v-for="(player, idx) in (leagueStandings[league.leagueid]?.overall || []).slice(0, 5)"
                :key="player.userId"
                class="standing-row"
                :class="{ 'is-you': player.userId === store.user?.id }"
              >
                <span class="rank">{{ idx + 1 }}</span>
                <span class="player-name">{{ player.username }}</span>
                <span class="player-points">{{ player.totalPoints }} pts</span>
              </div>
              <div v-if="!leagueStandings[league.leagueid]?.overall || leagueStandings[league.leagueid].overall.length === 0" class="no-scores">
                No scores yet
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { useUserStore } from '../store/userStore'
import axios from 'axios'

export default {
  data() {
    return {
      leagues: [],
      loading: true,
      leagueStandings: {}
    }
  },
  setup() {
    const store = useUserStore()
    return { store }
  },
  async created() {
    if (!this.store.user?.id) return
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      try {
        const res = await axios.get('/api/league/my', { params: { userId: this.store.user.id } })
        this.leagues = res.data.leagues || []
        await this.loadStandings()
      } catch (err) {
        console.error(err)
      } finally {
        this.loading = false
      }
    },
    async loadStandings() {
      const standings = {}
      for (const league of this.leagues) {
        try {
          const res = await axios.get(`/api/standings/${league.leagueid}`)
          standings[league.leagueid] = {
            overall: res.data.overallStandings || []
          }
        } catch (err) {
          console.error(err)
          standings[league.leagueid] = { overall: [] }
        }
      }
      this.leagueStandings = standings
    }
  }
}
</script>

<style scoped>
.leagues-page {
  max-width: 1200px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  text-decoration: none;
  border: 1px solid #4a7c59;
  font-size: 0.9rem;
  background: white;
  color: #2d5a3d;
}
.btn.primary {
  background: #2d5a3d;
  color: white;
  border-color: #2d5a3d;
}
.btn:hover {
  background: #f0f8f0;
}
.btn.primary:hover {
  background: #1e3d28;
}
.leagues-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}
.league-card {
  padding: 1.5rem;
  background: white;
  border: 1px solid #4a7c59;
  border-radius: 8px;
}
.league-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.league-name {
  font-size: 1.25rem;
  font-weight: 500;
  text-decoration: none;
  color: #2d5a3d;
}
.league-name:hover {
  text-decoration: underline;
}
.league-meta {
  font-size: 0.9rem;
  color: #666;
}
.standings-overview {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.overall-standing-card h3 {
  margin: 0 0 0.75rem 0;
  font-size: 1rem;
  color: #2d5a3d;
}
.standings-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.standing-row {
  display: grid;
  grid-template-columns: 30px 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.5rem;
  border-radius: 4px;
}
.standing-row:hover {
  background: #f0f8f0;
}
.standing-row.is-you {
  background: #e8f5e9;
  font-weight: 500;
}
.rank {
  font-weight: bold;
  color: #2d5a3d;
}
.player-name {
  color: #333;
}
.player-points {
  font-weight: 500;
  color: #2d5a3d;
}
.no-scores {
  color: #666;
  font-style: italic;
  padding: 0.5rem;
}
.loading,
.empty {
  color: #666;
  margin: 2rem 0;
  text-align: center;
}
</style>
