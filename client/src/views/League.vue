<template>
  <div class="home">
    <h1>Daily Scores</h1>
    <p class="greeting">Hi, {{ user?.username || user?.email || 'there' }}.</p>

    <section v-if="loading" class="loading">Loading…</section>
    <template v-else>
      <!-- Daily Score Entry -->
      <section class="daily-scores">
        <div class="section-header">
          <h2>Enter Today's Scores</h2>
          <button type="button" @click="showManageGames = !showManageGames" class="btn">
            {{ showManageGames ? 'Hide' : 'Manage Games' }}
          </button>
        </div>
        
        <div v-if="showManageGames" class="manage-games">
          <h3>Add or Remove Games</h3>
          <p class="hint">Games from your leagues are always shown. You can add or remove other games.</p>
          <div class="all-games-list">
            <label v-for="game in allGames" :key="game.gameid" class="game-item">
              <input
                type="checkbox"
                :value="game.gameid"
                :checked="userGames.some(g => g.gameid === game.gameid) || game.inLeagueGames"
                :disabled="game.inLeagueGames"
                @change="toggleGame(game.gameid, $event.target.checked)"
              />
              <span>
                {{ game.name }}
                <span v-if="game.inLeagueGames" class="league-badge">(from league)</span>
              </span>
            </label>
          </div>
        </div>
        
        <div v-if="userGames.length === 0" class="empty">
          <p>No games selected. <router-link to="/games/select">Select your games</router-link></p>
        </div>
        <div v-else class="score-entries">
          <div v-for="game in userGames" :key="game.gameid" class="score-entry">
            <div v-if="!todayScoresByGame[game.gameid]" class="entry-form">
              <label>{{ game.name }}</label>
              <div class="input-row">
                <input
                  v-model.number="scoreForms[game.gameid].score"
                  type="number"
                  step="any"
                  placeholder="Enter score"
                  required
                />
                <button
                  type="button"
                  @click="submitScore(game.gameid)"
                  :disabled="scoreForms[game.gameid].score == null || scoreForms[game.gameid].score === ''"
                >
                  Save
                </button>
              </div>
              <p class="hint-small">Will be saved to all leagues that include {{ game.name }}</p>
            </div>
            <div v-else class="entered-score">
              <div class="score-info">
                <strong>{{ game.name }}</strong>
                <span class="score-value">{{ todayScoresByGame[game.gameid].score }}</span>
                <div class="league-names">
                  <span v-for="leagueName in getLeagueNamesForGame(game.gameid)" :key="leagueName" class="league-tag">
                    {{ leagueName }}
                  </span>
                </div>
              </div>
              <button type="button" @click="showReenter(game.gameid)" class="reenter-btn">
                Re-enter
              </button>
              <div v-if="reenteringGame === game.gameid" class="reenter-form">
                <input
                  v-model.number="reenterForm.score"
                  type="number"
                  step="any"
                  placeholder="Score"
                  required
                />
                <button type="button" @click="updateScore(game.gameid)">Update</button>
                <button type="button" @click="cancelReenter">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Leagues with Standings -->
      <section class="leagues-section">
        <div class="section-header">
          <h2>My Leagues</h2>
          <div class="actions">
            <router-link to="/league/create" class="btn primary">Create league</router-link>
            <router-link to="/league/join" class="btn">Join league</router-link>
          </div>
        </div>
        <div v-if="leagues.length === 0" class="empty">
          <p>You're not in any leagues yet.</p>
          <p>Create one or join with an invite code.</p>
        </div>
        <div v-else class="leagues-list">
          <div v-for="league in leagues" :key="league.leagueid" class="league-card">
            <div class="league-header">
              <router-link :to="`/league/view/${league.leagueid}`" class="league-name">
                {{ league.name }}
              </router-link>
              <span class="league-meta">
                {{ league.games?.length || 0 }} games
                · {{ league.end_date ? `ends ${league.end_date}` : 'indefinite' }}
              </span>
            </div>
            <div class="standings-preview">
              <div v-for="game in (league.games || [])" :key="game.gameid" class="game-standing">
                <strong>{{ game.name }}</strong>
                <div class="top-players">
                  <span
                    v-for="(player, idx) in (leagueStandings[league.leagueid]?.[game.gameid] || []).slice(0, 3)"
                    :key="player.userId"
                    class="player-rank"
                  >
                    {{ idx + 1 }}. {{ player.username }} ({{ player.avg.toFixed(1) }})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script>
import { useRouter } from 'vue-router'
import { useUserStore } from '../store/userStore'
import { storeToRefs } from 'pinia'
import axios from 'axios'

export default {
  data() {
    return {
      leagues: [],
      userGames: [],
      allGames: [],
      todayScores: [],
      loading: true,
      scoreForms: {},
      reenteringGame: null,
      reenterForm: { score: '' },
      leagueStandings: {},
      showManageGames: false
    }
  },
  setup() {
    const store = useUserStore()
    const { user } = storeToRefs(store)
    return { store, user }
  },
  computed: {
    todayScoresByGame() {
      const map = {}
      for (const s of this.todayScores) {
        // If we already have this game, just add the league info
        if (map[s.game_id]) {
          if (!map[s.game_id].leagues) {
            map[s.game_id].leagues = [map[s.game_id].league]
          }
          if (s.league && !map[s.game_id].leagues.some(l => l?.name === s.league?.name)) {
            map[s.game_id].leagues.push(s.league)
          }
        } else {
          map[s.game_id] = { ...s, leagues: s.league ? [s.league] : [] }
        }
      }
      return map
    }
  },
  async created() {
    if (!this.store.user?.id) return
    await this.loadData()
  },
  methods: {
    async loadData() {
      this.loading = true
      try {
        const [leaguesRes, gamesRes, scoresRes, allGamesRes] = await Promise.all([
          axios.get('/api/league/my', { params: { userId: this.store.user.id } }),
          axios.get(`/api/user-games/${this.store.user.id}`),
          axios.get(`/api/scores/today/${this.store.user.id}`),
          axios.get('/api/league/games')
        ])
        this.leagues = leaguesRes.data.leagues || []
        this.userGames = gamesRes.data.games || []
        this.todayScores = scoresRes.data.scores || []
        // Map all games with flags from userGames
        const userGamesMap = new Map(this.userGames.map(g => [g.gameid, g]))
        this.allGames = (allGamesRes.data.games || []).map(g => {
          const userGame = userGamesMap.get(g.gameid)
          return {
            ...g,
            inUserGames: !!userGame,
            inLeagueGames: userGame?.inLeagueGames || false
          }
        })
        this.initScoreForms()
        await this.loadStandings()
      } catch (err) {
        console.error(err)
      } finally {
        this.loading = false
      }
    },
    initScoreForms() {
      const forms = {}
      for (const game of this.userGames) {
        forms[game.gameid] = { score: '' }
      }
      this.scoreForms = forms
    },
    getLeagueNamesForGame(gameId) {
      const scoreData = this.todayScoresByGame[gameId]
      if (!scoreData) return []
      // Use leagues from the score data if available, otherwise find from leagues list
      if (scoreData.leagues && scoreData.leagues.length > 0) {
        return scoreData.leagues.map(l => l?.name || l).filter(Boolean)
      }
      // Fallback: get all leagues that include this game
      return this.leagues
        .filter(l => l.games?.some(g => g.gameid === gameId))
        .map(l => l.name)
    },
    async loadStandings() {
      const standings = {}
      for (const league of this.leagues) {
        try {
          const res = await axios.get(`/api/scores/league/${league.leagueid}`)
          const scores = res.data.scores || []
          standings[league.leagueid] = this.computeStandings(scores, league.games || [])
        } catch (err) {
          console.error(err)
        }
      }
      this.leagueStandings = standings
    },
    computeStandings(scores, games) {
      const byGame = {}
      for (const g of games) {
        const byUser = {}
        for (const s of scores) {
          if (s.game_id !== g.gameid) continue
          const uid = s.user_id
          if (!byUser[uid]) {
            byUser[uid] = { username: s.user?.username || '—', sum: 0, n: 0 }
          }
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
        byGame[g.gameid] = rows
      }
      return byGame
    },
    async submitScore(gameId) {
      const form = this.scoreForms[gameId]
      if (form.score == null || form.score === '') {
        alert('Please enter a score')
        return
      }
      try {
        const today = new Date().toISOString().slice(0, 10)
        const scoreNum = Number(form.score)
        if (isNaN(scoreNum)) {
          alert('Score must be a valid number')
          return
        }
        const res = await axios.post('/api/scores/daily', {
          user_id: this.store.user.id,
          game_id: gameId,
          date: today,
          score: scoreNum
        })
        // Clear the form for this game
        this.scoreForms[gameId] = { score: '' }
        await this.loadData()
      } catch (err) {
        console.error('Score save error:', err)
        alert(err.response?.data?.error || 'Failed to save score')
      }
    },
    showReenter(gameId) {
      const existing = this.todayScoresByGame[gameId]
      this.reenteringGame = gameId
      this.reenterForm = {
        score: existing?.score || ''
      }
    },
    cancelReenter() {
      this.reenteringGame = null
      this.reenterForm = { score: '' }
    },
    async updateScore(gameId) {
      if (this.reenterForm.score == null || this.reenterForm.score === '') {
        alert('Please enter a score')
        return
      }
      try {
        const today = new Date().toISOString().slice(0, 10)
        const scoreNum = Number(this.reenterForm.score)
        if (isNaN(scoreNum)) {
          alert('Score must be a valid number')
          return
        }
        await axios.post('/api/scores/daily', {
          user_id: this.store.user.id,
          game_id: gameId,
          date: today,
          score: scoreNum
        })
        this.cancelReenter()
        await this.loadData()
      } catch (err) {
        console.error('Score update error:', err)
        alert(err.response?.data?.error || 'Failed to update score')
      }
    },
    async toggleGame(gameId, checked) {
      const game = this.allGames.find(g => g.gameid === gameId)
      if (game?.inLeagueGames) {
        // Can't toggle league games - they always show
        return
      }
      try {
        if (checked) {
          // Add game to user_games
          const currentGameIds = this.userGames.map(g => g.gameid)
          if (!currentGameIds.includes(gameId)) {
            await axios.post(`/api/user-games/${this.store.user.id}`, {
              gameIds: [...currentGameIds, gameId]
            })
          }
        } else {
          // Remove game from user_games
          await axios.delete(`/api/user-games/${this.store.user.id}/${gameId}`)
        }
        await this.loadData()
      } catch (err) {
        alert(err.response?.data?.error || 'Failed to update games')
      }
    }
  }
}
</script>

<style scoped>
.home {
  max-width: 900px;
  margin: 0 auto;
  text-align: left;
}
.greeting {
  margin: -0.5rem 0 1.5rem;
  color: var(--muted, #666);
}
.daily-scores {
  margin-bottom: 3rem;
}
.daily-scores h2,
.leagues-section h2 {
  margin-bottom: 1rem;
}
.score-entries {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.score-entry {
  padding: 1rem;
  border: 1px solid #444;
  border-radius: 8px;
}
.entry-form label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}
.input-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.input-row input {
  padding: 0.5rem;
  flex: 1;
}
.hint-small {
  font-size: 0.85rem;
  color: var(--muted, #666);
  margin-top: 0.5rem;
  margin-bottom: 0;
}
.entered-score {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.score-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}
.score-info strong {
  display: block;
}
.score-value {
  font-size: 1.25rem;
  font-weight: bold;
}
.league-names {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.league-tag {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  background: #2a2a2a;
  border-radius: 4px;
  color: var(--muted, #888);
}
.reenter-btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.9rem;
}
.reenter-form {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.5rem;
}
.reenter-form input {
  padding: 0.5rem;
  flex: 1;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 1rem;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  text-decoration: none;
  border: 1px solid #444;
  font-size: 0.9rem;
}
.btn.primary {
  background: #646cff;
  border-color: #646cff;
  color: #fff;
}
.leagues-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.league-card {
  padding: 1.25rem;
  border: 1px solid #444;
  border-radius: 8px;
}
.league-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.league-name {
  font-size: 1.1rem;
  font-weight: 500;
  text-decoration: none;
}
.league-meta {
  font-size: 0.9rem;
  color: var(--muted, #666);
}
.standings-preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.game-standing strong {
  display: block;
  margin-bottom: 0.25rem;
}
.top-players {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: var(--muted, #666);
}
.loading,
.empty {
  color: var(--muted, #666);
  margin: 2rem 0;
}
.manage-games {
  padding: 1.25rem;
  background: #2a2a2a;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}
.manage-games h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
}
.hint {
  color: var(--muted, #666);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}
.all-games-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.game-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
}
.game-item input[type="checkbox"] {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}
.game-item input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.league-badge {
  font-size: 0.85rem;
  color: var(--muted, #888);
  font-style: italic;
}
</style>
